/**
 * Swyftgrids self-hosted server.
 *
 * Serves the built React UI and exposes the IPC contract at `POST /api/invoke`. The UI is the exact
 * same bundle as the desktop app; we inject `window.__SWYFTGRID_API__` so the frontend's IPC bridge
 * talks HTTP instead of Tauri.
 *
 * Env:
 *   PORT                 (default 4000)
 *   HOST                 (default 0.0.0.0)
 *   SWYFTGRID_STATIC_DIR (default ../desktop/dist) — the built frontend
 *   SWYFTGRID_DATA_DIR   (default ./data)          — JSON store location
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { invokeCommand } from './backend.js';
import { loadAuthConfig } from './auth/config.js';
import { AuthStore } from './auth/store.js';
import { setupAuth } from './auth/plugin.js';
import { hashPassword, validateEmail, validatePassword } from './auth/passwords.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';
const STATIC_DIR = resolve(
  process.env.SWYFTGRID_STATIC_DIR ?? join(__dirname, '..', '..', 'desktop', 'dist'),
);

// `trustProxy` lets the app read `x-forwarded-proto` so Secure cookies work behind a TLS proxy.
const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' }, trustProxy: true });

// Health check for container orchestrators (always public).
app.get('/healthz', async () => ({ status: 'ok', service: 'swyftgrid-web' }));

// ── Authentication (self-hosted only) ──────────────────────────────────────────
const authConfig = loadAuthConfig();
const authStore = new AuthStore(authConfig.dataDir);

/** Create the admin account from SWYFT_ADMIN_EMAIL / SWYFT_ADMIN_PASSWORD on first run. */
async function bootstrapAdmin(): Promise<void> {
  if (authStore.userCount() > 0) return;
  const { bootstrapEmail, bootstrapPassword } = authConfig;
  if (!bootstrapEmail || !bootstrapPassword) return;
  if (!validateEmail(bootstrapEmail)) {
    app.log.warn('SWYFT_ADMIN_EMAIL is invalid; skipping admin bootstrap.');
    return;
  }
  const pwError = validatePassword(bootstrapPassword);
  if (pwError) {
    app.log.warn(`SWYFT_ADMIN_PASSWORD rejected (${pwError}); skipping admin bootstrap.`);
    return;
  }
  authStore.createUser(bootstrapEmail, await hashPassword(bootstrapPassword));
  app.log.info(`Bootstrapped admin account for ${bootstrapEmail}.`);
}

await bootstrapAdmin();
if (authConfig.envDisabled) {
  app.log.warn('Authentication is DISABLED (SWYFT_AUTH_DISABLED). Use only on a trusted network.');
}
await setupAuth(app, authStore, authConfig);

// The single IPC endpoint.
app.post<{ Body: { command: string; params: unknown } }>('/api/invoke', async (req, reply) => {
  const { command, params } = req.body ?? {};
  if (!command) return reply.code(400).send({ error: { message: 'Missing command' } });
  try {
    const result = await invokeCommand(command, params);
    return { result };
  } catch (err) {
    req.log.error({ err, command }, 'command failed');
    const e = err as { message?: string; code?: string; detail?: string; hint?: string };
    return reply.code(400).send({
      error: {
        message: e.message ?? 'Command failed',
        code: e.code,
        detail: e.detail,
        hint: e.hint,
      },
    });
  }
});

// Serve the static frontend, injecting the API endpoint into index.html.
const indexHtmlPath = join(STATIC_DIR, 'index.html');
const hasFrontend = existsSync(indexHtmlPath);

if (hasFrontend) {
  await app.register(fastifyStatic, { root: STATIC_DIR, wildcard: false });

  const injectedIndex = readFileSync(indexHtmlPath, 'utf8').replace(
    '</head>',
    `<script>window.__SWYFTGRID_API__ = '/api/invoke';</script></head>`,
  );

  // SPA fallback: any non-API GET returns the injected index.
  app.setNotFoundHandler((req, reply) => {
    if (req.method === 'GET' && !req.url.startsWith('/api')) {
      return reply.type('text/html').send(injectedIndex);
    }
    return reply.code(404).send({ error: { message: 'Not found' } });
  });
} else {
  app.log.warn(
    `Frontend not found at ${STATIC_DIR}. Build it with: pnpm --filter @swyftgrid/desktop build`,
  );
}

app
  .listen({ port: PORT, host: HOST })
  .then(() => app.log.info(`Swyftgrids web listening on http://${HOST}:${PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
