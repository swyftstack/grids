// Dev server for the marketing site WITH a working /demo, mirroring the production `build:cf` layout
// where one origin serves both the site and the demo app.
//
//   corepack pnpm dev   (in apps/marketing)
//     -> http://localhost:5173        the marketing site
//     -> http://localhost:5173/demo/  the real desktop app on sample data
//
// It boots the desktop Vite dev server under base=/demo/ on a fixed port, then runs the marketing
// Vite server with a /demo -> desktop proxy (see vite.config.ts, gated on SWYFTGRID_DEMO_PROXY).
// Note: editing demo (desktop) source may need a manual refresh — HMR does not cross the proxy.
import { spawn } from 'node:child_process';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const marketing = resolve(here, '..');
const root = resolve(marketing, '../..');

/** Grab an OS-assigned free port so the demo server can never collide with the marketing server. */
function freePort() {
  return new Promise((res, rej) => {
    const srv = net.createServer();
    srv.once('error', rej);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => res(port));
    });
  });
}

const demoPort = process.env.SWYFTGRID_DEMO_PORT ?? String(await freePort());

const children = [];
function run(cmd, args, { cwd, env } = {}) {
  const child = spawn(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...env },
  });
  children.push(child);
  child.on('exit', shutdown);
  return child;
}

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) c.kill();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// 1. Desktop app as the /demo, on its own port and base.
run(
  'corepack',
  [
    'pnpm',
    '--filter',
    '@swyftgrid/desktop',
    'exec',
    'vite',
    '--port',
    demoPort,
    '--strictPort',
    '--base=/demo/',
  ],
  { cwd: root },
);

// 2. Marketing site, proxying /demo to the demo server.
run('corepack', ['pnpm', 'exec', 'vite'], {
  cwd: marketing,
  env: { SWYFTGRID_DEMO_PROXY: `http://localhost:${demoPort}` },
});
