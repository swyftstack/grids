/**
 * Wires authentication into the Fastify server: cookie/session handling, a request guard that
 * enforces login (and forced password changes), double-submit CSRF protection, rate limiting on the
 * credential endpoints, and the auth routes (setup / login / logout / change-password / status).
 *
 * `setupAuth` operates on the root instance directly (not as an encapsulated plugin) so its guard
 * hook applies to every route, including the static SPA and `/api/invoke`.
 */
import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyFormbody from '@fastify/formbody';
import fastifyRateLimit from '@fastify/rate-limit';
import { COOKIE_CSRF, COOKIE_SESSION, type AuthConfig } from './config.js';
import { type AuthStore, META_AUTH_DISABLED } from './store.js';
import { renderChangePassword, renderLogin, renderSetup } from './pages.js';
import { hashPassword, validateEmail, validatePassword, verifyPassword } from './passwords.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const RATE_LIMIT = { max: 10, timeWindow: '1 minute' };

export async function setupAuth(
  app: FastifyInstance,
  store: AuthStore,
  config: AuthConfig,
): Promise<void> {
  await app.register(fastifyCookie);
  await app.register(fastifyFormbody);
  await app.register(fastifyRateLimit, { global: false });

  const secureFlag = (req: FastifyRequest): boolean =>
    config.cookieSecure === 'auto' ? req.protocol === 'https' : config.cookieSecure;

  const cookieBase = (req: FastifyRequest) => ({
    path: '/',
    sameSite: 'lax' as const,
    secure: secureFlag(req),
    maxAge: config.sessionDays * 86_400,
  });

  /** Effective auth-disabled state: env switch OR the runtime flag set by `disable-auth`. */
  const authDisabled = (): boolean =>
    config.envDisabled || store.getMeta(META_AUTH_DISABLED) === 'true';

  /** Ensure a CSRF cookie exists; return its value (also patched onto `req` for this request). */
  const ensureCsrf = (req: FastifyRequest, reply: FastifyReply): string => {
    let value = req.cookies[COOKIE_CSRF];
    if (!value) {
      value = randomBytes(24).toString('hex');
      reply.setCookie(COOKIE_CSRF, value, { ...cookieBase(req), httpOnly: false });
      req.cookies[COOKIE_CSRF] = value;
    }
    return value;
  };

  const setSessionCookie = (req: FastifyRequest, reply: FastifyReply, sessionId: string) =>
    reply.setCookie(COOKIE_SESSION, sessionId, { ...cookieBase(req), httpOnly: true });

  const sessionFor = (req: FastifyRequest) => store.getSession(req.cookies[COOKIE_SESSION]);

  const wantsHtml = (req: FastifyRequest) => !req.url.startsWith('/api');

  // ── Request guard ─────────────────────────────────────────────────────────────
  app.addHook('preHandler', async (req, reply) => {
    if (req.url === '/healthz') return;
    ensureCsrf(req, reply);
    if (authDisabled()) return; // trusted-network mode: no auth, no CSRF

    const path = req.url.split('?')[0] ?? req.url;

    // Double-submit CSRF for every state-changing request.
    if (!SAFE_METHODS.has(req.method)) {
      const submitted =
        (req.headers['x-csrf-token'] as string | undefined) ??
        (req.body as { _csrf?: string } | undefined)?._csrf;
      if (!submitted || submitted !== req.cookies[COOKIE_CSRF]) {
        return reply.code(403).send({ error: { message: 'Invalid CSRF token', code: 'CSRF' } });
      }
    }

    const user = store.getUser();

    // No account yet → force the setup wizard.
    if (!user) {
      if (['/setup', '/api/auth/setup', '/api/auth/status'].includes(path)) return;
      if (!wantsHtml(req)) {
        return reply.code(401).send({ error: { message: 'Setup required', code: 'NEEDS_SETUP' } });
      }
      return reply.redirect('/setup');
    }

    const session = sessionFor(req);

    // Not signed in.
    if (!session) {
      if (['/login', '/api/auth/login', '/api/auth/status'].includes(path)) return;
      if (!wantsHtml(req)) {
        return reply
          .code(401)
          .send({ error: { message: 'Authentication required', code: 'UNAUTHENTICATED' } });
      }
      return reply.redirect('/login');
    }

    // Signed in but must change a temporary password.
    if (session.user.mustChangePassword) {
      const allowed = [
        '/change-password',
        '/api/auth/change-password',
        '/api/auth/logout',
        '/api/auth/status',
      ];
      if (allowed.includes(path)) return;
      if (!wantsHtml(req)) {
        return reply
          .code(403)
          .send({ error: { message: 'Password change required', code: 'MUST_CHANGE_PASSWORD' } });
      }
      return reply.redirect('/change-password');
    }

    // Fully authenticated — keep them out of the pre-auth pages.
    if (path === '/login' || path === '/setup') return reply.redirect('/');
  });

  // ── Setup wizard ────────────────────────────────────────────────────────────────
  app.get('/setup', async (req, reply) => {
    if (store.userCount() > 0) return reply.redirect('/login');
    return reply.type('text/html').send(renderSetup({ csrf: ensureCsrf(req, reply) }));
  });

  app.post('/setup', { config: { rateLimit: RATE_LIMIT } }, async (req, reply) => {
    const csrf = ensureCsrf(req, reply);
    if (store.userCount() > 0) return reply.redirect('/login');
    const body = (req.body ?? {}) as Record<string, string>;
    const error = validateSetup(body);
    if (error) {
      return reply
        .code(400)
        .type('text/html')
        .send(renderSetup({ csrf, error, email: body.email }));
    }
    const user = store.createUser(body.email ?? '', await hashPassword(body.password ?? ''));
    const session = store.createSession(user.id, config.sessionDays);
    store.recordLogin(user.id);
    setSessionCookie(req, reply, session.id);
    return reply.redirect('/');
  });

  // ── Login ─────────────────────────────────────────────────────────────────────
  app.get('/login', async (req, reply) => {
    if (store.userCount() === 0) return reply.redirect('/setup');
    return reply.type('text/html').send(renderLogin({ csrf: ensureCsrf(req, reply) }));
  });

  app.post('/login', { config: { rateLimit: RATE_LIMIT } }, async (req, reply) => {
    const csrf = ensureCsrf(req, reply);
    const body = (req.body ?? {}) as Record<string, string>;
    const user = store.getUser();
    const hash = store.passwordHash();
    const ok =
      user &&
      hash &&
      user.email.toLowerCase() ===
        String(body.email ?? '')
          .trim()
          .toLowerCase() &&
      (await verifyPassword(body.password ?? '', hash));
    if (!ok || !user) {
      return reply
        .code(401)
        .type('text/html')
        .send(renderLogin({ csrf, error: 'Invalid email or password', email: body.email }));
    }
    const session = store.createSession(user.id, config.sessionDays);
    store.recordLogin(user.id);
    setSessionCookie(req, reply, session.id);
    return reply.redirect(user.mustChangePassword ? '/change-password' : '/');
  });

  // ── Change password (HTML, also used for the forced flow) ───────────────────────
  app.get('/change-password', async (req, reply) => {
    const session = sessionFor(req);
    if (!session) return reply.redirect('/login');
    return reply.type('text/html').send(
      renderChangePassword({
        csrf: ensureCsrf(req, reply),
        forced: session.user.mustChangePassword,
      }),
    );
  });

  app.post('/change-password', { config: { rateLimit: RATE_LIMIT } }, async (req, reply) => {
    const csrf = ensureCsrf(req, reply);
    const session = sessionFor(req);
    if (!session) return reply.redirect('/login');
    const body = (req.body ?? {}) as Record<string, string>;
    const error = await changePassword(store, session.session.id, session.user.id, body);
    if (error) {
      return reply
        .code(400)
        .type('text/html')
        .send(renderChangePassword({ csrf, error, forced: session.user.mustChangePassword }));
    }
    return reply.redirect('/');
  });

  // ── JSON API (used by the SPA's Security settings) ──────────────────────────────
  app.get('/api/auth/status', async (req, reply) => {
    const csrf = ensureCsrf(req, reply);
    if (authDisabled()) {
      return { authEnabled: false, authenticated: true, needsSetup: false, csrfToken: csrf };
    }
    const user = store.getUser();
    const session = sessionFor(req);
    return {
      authEnabled: true,
      needsSetup: !user,
      authenticated: !!session,
      mustChangePassword: session?.user.mustChangePassword ?? false,
      csrfToken: csrf,
      user: session
        ? {
            email: session.user.email,
            createdAt: session.user.createdAt,
            lastLoginAt: session.user.lastLoginAt,
          }
        : null,
    };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    const sid = req.cookies[COOKIE_SESSION];
    if (sid) store.deleteSession(sid);
    reply.clearCookie(COOKIE_SESSION, { path: '/' });
    return { ok: true };
  });

  app.post(
    '/api/auth/change-password',
    { config: { rateLimit: RATE_LIMIT } },
    async (req, reply) => {
      const session = sessionFor(req);
      if (!session) return reply.code(401).send({ error: { message: 'Not authenticated' } });
      const body = (req.body ?? {}) as Record<string, string>;
      const error = await changePassword(store, session.session.id, session.user.id, body);
      if (error) return reply.code(400).send({ error: { message: error } });
      return { ok: true };
    },
  );

  // Periodically purge expired sessions.
  store.pruneExpiredSessions();
}

function validateSetup(body: Record<string, string>): string | null {
  if (!validateEmail(body.email)) return 'Enter a valid email address';
  const pwError = validatePassword(body.password);
  if (pwError) return pwError;
  if (body.password !== body.confirm) return 'Passwords do not match';
  return null;
}

/** Shared change-password logic. Returns an error message, or `null` on success. */
async function changePassword(
  store: AuthStore,
  sessionId: string,
  userId: string,
  body: Record<string, string>,
): Promise<string | null> {
  const hash = store.passwordHash();
  if (!hash || !(await verifyPassword(body.current ?? '', hash))) {
    return 'Current password is incorrect';
  }
  const pwError = validatePassword(body.password);
  if (pwError) return pwError;
  if (body.password !== body.confirm) return 'Passwords do not match';
  store.updatePassword(userId, await hashPassword(body.password ?? ''), false);
  // Invalidate every other session after a credential change.
  store.deleteOtherSessions(userId, sessionId);
  return null;
}
