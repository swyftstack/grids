/**
 * Self-contained, server-rendered HTML for the pre-application auth screens (setup, login, forced
 * password change). Inline CSS keeps them dependency-free and loadable before the SPA bundle.
 */

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface LayoutOptions {
  title: string;
  heading: string;
  subheading: string;
  body: string;
}

function layout({ title, heading, subheading, body }: LayoutOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escape(title)} · Swyftgrids</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: #09090b; color: #f4f4f5;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
  .card {
    width: 100%; max-width: 380px; margin: 24px;
    background: #111114; border: 1px solid #27272c; border-radius: 14px;
    padding: 28px; box-shadow: 0 10px 38px -10px rgba(0,0,0,.5);
  }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
  .logo { width: 28px; height: 28px; border-radius: 7px; background: #f97316;
          display: grid; place-items: center; color: #fff; font-weight: 700; }
  h1 { font-size: 18px; margin: 0 0 4px; letter-spacing: -.01em; }
  .sub { color: #a1a1aa; font-size: 13px; margin: 0 0 20px; line-height: 1.5; }
  label { display: block; font-size: 12px; color: #a1a1aa; margin: 14px 0 6px; }
  input {
    width: 100%; height: 38px; padding: 0 11px; font-size: 14px;
    background: #1c1c20; border: 1px solid #34343a; border-radius: 8px; color: #f4f4f5; outline: none;
  }
  input:focus { border-color: #f97316; }
  button {
    width: 100%; height: 40px; margin-top: 20px; font-size: 14px; font-weight: 600;
    background: #f97316; color: #fff; border: 0; border-radius: 8px; cursor: pointer;
  }
  button:hover { background: #ea6a0c; }
  .error {
    margin: 16px 0 0; padding: 10px 12px; font-size: 13px; border-radius: 8px;
    background: rgba(220,38,38,.12); border: 1px solid rgba(220,38,38,.3); color: #f87171;
  }
  .hint { margin-top: 16px; font-size: 12px; color: #71717a; line-height: 1.5; }
  .code { font-family: ui-monospace, "JetBrains Mono", Menlo, Consolas, monospace; }
</style>
</head>
<body>
  <div class="card">
    <div class="brand"><span class="logo">S</span><strong>Swyftgrids</strong></div>
    <h1>${escape(heading)}</h1>
    <p class="sub">${subheading}</p>
    ${body}
  </div>
</body>
</html>`;
}

function errorBlock(error?: string): string {
  return error ? `<div class="error">${escape(error)}</div>` : '';
}

export function renderSetup(opts: { csrf: string; error?: string; email?: string }): string {
  return layout({
    title: 'Create admin account',
    heading: 'Create Admin Account',
    subheading:
      'Welcome to Swyftgrids. Create the single admin account that secures this instance.',
    body: `
      <form method="post" action="/setup" autocomplete="off">
        <input type="hidden" name="_csrf" value="${escape(opts.csrf)}" />
        <label for="email">Email address</label>
        <input id="email" name="email" type="email" required value="${escape(opts.email ?? '')}" autofocus />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" required minlength="8" />
        <label for="confirm">Confirm password</label>
        <input id="confirm" name="confirm" type="password" required minlength="8" />
        ${errorBlock(opts.error)}
        <button type="submit">Create account</button>
      </form>
      <p class="hint">Passwords are hashed with bcrypt and stored locally. Minimum 8 characters.</p>
    `,
  });
}

export function renderLogin(opts: { csrf: string; error?: string; email?: string }): string {
  return layout({
    title: 'Sign in',
    heading: 'Sign in',
    subheading: 'Enter your admin credentials to continue.',
    body: `
      <form method="post" action="/login" autocomplete="off">
        <input type="hidden" name="_csrf" value="${escape(opts.csrf)}" />
        <label for="email">Email</label>
        <input id="email" name="email" type="email" required value="${escape(opts.email ?? '')}" autofocus />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" required />
        ${errorBlock(opts.error)}
        <button type="submit">Sign in</button>
      </form>
    `,
  });
}

export function renderChangePassword(opts: {
  csrf: string;
  error?: string;
  forced?: boolean;
}): string {
  return layout({
    title: 'Change password',
    heading: opts.forced ? 'Set a new password' : 'Change password',
    subheading: opts.forced
      ? 'Your password was reset. Choose a new password to continue.'
      : 'Update the admin account password.',
    body: `
      <form method="post" action="/change-password" autocomplete="off">
        <input type="hidden" name="_csrf" value="${escape(opts.csrf)}" />
        <label for="current">${opts.forced ? 'Temporary password' : 'Current password'}</label>
        <input id="current" name="current" type="password" required autofocus />
        <label for="password">New password</label>
        <input id="password" name="password" type="password" required minlength="8" />
        <label for="confirm">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" required minlength="8" />
        ${errorBlock(opts.error)}
        <button type="submit">Update password</button>
      </form>
      <p class="hint">Minimum 8 characters. All other sessions are signed out after a change.</p>
    `,
  });
}
