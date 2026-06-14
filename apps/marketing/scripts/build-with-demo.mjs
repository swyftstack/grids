// Builds the marketing site AND the live demo into a single static output, so one Cloudflare Pages
// project serves both:
//   grids.swyftstack.com        -> the marketing site
//   grids.swyftstack.com/demo   -> the real desktop app on sample data (in-memory mock, no API)
//
// The demo is the @swyftgrid/desktop app built for the web with base=/demo/. Its `isDemo()` turns on
// automatically because the path ends with /demo.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const marketing = resolve(here, '..'); // apps/marketing
const desktop = resolve(marketing, '../desktop'); // apps/desktop

function run(cmd, cwd) {
  console.log(`\n$ ${cmd}\n  (in ${cwd})`);
  execSync(cmd, { stdio: 'inherit', cwd, shell: true });
}

// 1. Build the marketing site. This empties apps/marketing/dist, so it must run first.
run('pnpm run build', marketing);

// 2. Build the desktop app as the /demo, written straight into the marketing output at dist/demo.
//    --emptyOutDir is required because the outDir is outside the desktop package root.
run('pnpm exec vite build --base=/demo/ --outDir ../marketing/dist/demo --emptyOutDir', desktop);

const demoIndex = resolve(marketing, 'dist/demo/index.html');
if (!existsSync(demoIndex)) {
  console.error('\nExpected demo build at dist/demo/index.html — not found.');
  process.exit(1);
}
console.log('\n✓ Built site + demo. Deploy apps/marketing/dist (demo at /demo).');
