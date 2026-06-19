#!/usr/bin/env node
// Generates the placeholder product screenshots in assets/screenshots/ as self-contained SVGs.
// These are designed mockups (on-brand wireframes), used so the README and marketing site render
// out of the box. Replace them with real PNG captures from the live demo for the polished look —
// see assets/screenshots/README.md.
//
//   node scripts/gen-screenshots.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../assets/screenshots');
mkdirSync(outDir, { recursive: true });

const W = 1600;
const H = 1000;
const C = {
  bg: '#0a0a0c',
  surface: '#141418',
  surface2: '#1d1d24',
  border: '#26262e',
  text: '#e7e7ea',
  muted: '#9aa0aa',
  subtle: '#5f6671',
  accent: '#f97316',
  accentSoft: 'rgba(249,115,22,0.16)',
  green: '#22c55e',
  blue: '#3b82f6',
  red: '#ef4444',
  yellow: '#eab308',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rect = (x, y, w, h, rx, fill, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" ${extra}/>`;
const text = (x, y, s, { fill = C.text, size = 14, weight = 400, mono = false, anchor = 'start' } = {}) =>
  `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" font-family="${
    mono ? "'SFMono-Regular',ui-monospace,Menlo,Consolas,monospace" : "Inter,-apple-system,'Segoe UI',Roboto,sans-serif"
  }">${esc(s)}</text>`;
const bar = (x, y, w, h, fill = C.surface2) => rect(x, y, w, h, h / 2, fill);

// Window chrome + sidebar shared by every shot. `nav` = active nav label.
function frame(title, nav, mainSvg) {
  const navItems = ['Dashboard', 'Tables', 'SQL Editor', 'Schema', 'Performance', 'AI'];
  const sidebarW = 248;
  const topH = 52;
  let sidebar = '';
  sidebar += rect(0, 0, sidebarW, H, 0, C.surface);
  sidebar += rect(sidebarW - 1, 0, 1, H, 0, C.border);
  // brand
  sidebar += rect(24, 26, 28, 28, 8, C.accent);
  sidebar += text(64, 45, 'Swyftgrids', { size: 18, weight: 700 });
  // search
  sidebar += rect(20, 76, sidebarW - 40, 36, 9, C.surface2);
  sidebar += text(38, 99, 'Search everything…', { fill: C.subtle, size: 13 });
  // nav
  navItems.forEach((label, i) => {
    const y = 140 + i * 44;
    const active = label === nav;
    if (active) sidebar += rect(14, y - 22, sidebarW - 28, 38, 9, C.accentSoft);
    sidebar += rect(28, y - 11, 16, 16, 4, active ? C.accent : C.subtle);
    sidebar += text(60, y + 2, label, { fill: active ? C.text : C.muted, size: 14, weight: active ? 600 : 400 });
  });
  // connection footer
  sidebar += rect(20, H - 70, sidebarW - 40, 44, 10, C.surface2);
  sidebar += `<circle cx="42" cy="${H - 48}" r="5" fill="${C.green}"/>`;
  sidebar += text(60, H - 52, 'production', { size: 13, weight: 600 });
  sidebar += text(60, H - 36, 'postgres · 17.2', { fill: C.subtle, size: 11 });

  // top bar
  let top = '';
  top += rect(sidebarW, 0, W - sidebarW, topH, 0, C.bg);
  top += rect(sidebarW, topH - 1, W - sidebarW, 1, 0, C.border);
  top += `<circle cx="${sidebarW + 26}" cy="26" r="6" fill="#ff5f57"/>`;
  top += `<circle cx="${sidebarW + 46}" cy="26" r="6" fill="#febc2e"/>`;
  top += `<circle cx="${sidebarW + 66}" cy="26" r="6" fill="#28c840"/>`;
  top += text(sidebarW + 100, 31, title, { fill: C.muted, size: 13, weight: 600 });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(
    title,
  )}">
  <defs>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f97316" stop-opacity="0.10"/>
      <stop offset="1" stop-color="#f97316" stop-opacity="0"/>
    </linearGradient>
  </defs>
  ${rect(0, 0, W, H, 0, C.bg)}
  ${rect(sidebarW, topH, W - sidebarW, H - topH, 0, '#0c0c10')}
  <rect x="${sidebarW}" y="${topH}" width="${W - sidebarW}" height="${H - topH}" fill="url(#glow)"/>
  ${sidebar}
  ${top}
  <g transform="translate(${sidebarW + 28}, ${topH + 28})">${mainSvg}</g>
</svg>`;
}

const MW = W - 248 - 56; // usable main width inside the translate group

// ── SQL editor ────────────────────────────────────────────────────────────────
function sqlEditor() {
  let s = '';
  s += text(0, 4, 'SQL Editor', { size: 22, weight: 700 });
  // tabs
  ['query.sql', 'analytics.sql', '+ new'].forEach((t, i) => {
    s += rect(i * 130, 28, 120, 30, 8, i === 0 ? C.surface2 : 'transparent');
    s += text(i * 130 + 16, 48, t, { fill: i === 0 ? C.text : C.subtle, size: 12, mono: true });
  });
  // editor
  s += rect(0, 72, MW, 230, 12, C.surface);
  const lines = [
    [['SELECT', C.accent], [' u.id, u.email,', C.text], [' count(o.id) AS orders', C.muted]],
    [['FROM', C.accent], [' users u', C.text]],
    [['LEFT JOIN', C.accent], [' orders o ', C.text], ['ON', C.accent], [' o.user_id = u.id', C.text]],
    [['WHERE', C.accent], [' u.created_at > ', C.text], ["'2026-01-01'", C.green]],
    [['GROUP BY', C.accent], [' u.id', C.text], ['  ORDER BY', C.accent], [' orders ', C.text], ['DESC', C.accent], [' LIMIT ', C.text], ['50', C.yellow], [';', C.text]],
  ];
  lines.forEach((segs, i) => {
    const y = 104 + i * 30;
    s += text(20, y, String(i + 1), { fill: C.subtle, size: 13, mono: true });
    let x = 48;
    segs.forEach(([txt, fill]) => {
      s += text(x, y, txt, { fill, size: 14, mono: true });
      x += txt.length * 8.2;
    });
  });
  // run button
  s += rect(MW - 132, 256, 112, 32, 8, C.accent);
  s += text(MW - 76, 277, '▶  Run', { fill: '#fff', size: 13, weight: 600, anchor: 'middle' });
  // results grid
  s += rect(0, 320, MW, 330, 12, C.surface);
  s += text(20, 348, '50 rows · 12 ms', { fill: C.muted, size: 12, mono: true });
  const cols = ['id', 'email', 'orders'];
  cols.forEach((c, i) => s += text(24 + i * (MW / 3), 380, c, { fill: C.subtle, size: 12, weight: 600 }));
  s += rect(0, 392, MW, 1, 0, C.border);
  for (let r = 0; r < 7; r++) {
    const y = 396 + r * 34;
    if (r % 2 === 0) s += rect(8, y, MW - 16, 30, 6, C.surface2);
    s += text(24, y + 20, String(1000 + r), { fill: C.muted, size: 13, mono: true });
    s += text(24 + MW / 3, y + 20, `user${r}@example.com`, { fill: C.text, size: 13, mono: true });
    s += text(24 + (2 * MW) / 3, y + 20, String(120 - r * 11), { fill: C.text, size: 13, mono: true });
  }
  return s;
}

// ── Table browser ───────────────────────────────────────────────────────────
function tableBrowser() {
  let s = '';
  s += text(0, 4, 'public.orders', { size: 22, weight: 700 });
  s += text(0, 30, '14,228 rows · filtered', { fill: C.muted, size: 13 });
  // toolbar
  ['Filter', 'Sort', 'Insert row', 'Export'].forEach((t, i) => {
    s += rect(i * 116, 48, 104, 32, 8, C.surface2);
    s += text(i * 116 + 52, 69, t, { fill: C.muted, size: 12, anchor: 'middle' });
  });
  // grid
  s += rect(0, 96, MW, 560, 12, C.surface);
  const cols = ['id', 'customer', 'status', 'total', 'created_at'];
  const widths = [0.1, 0.28, 0.16, 0.16, 0.3];
  let cx = 24;
  const colX = widths.map((w) => {
    const x = cx;
    cx += w * (MW - 40);
    return x;
  });
  cols.forEach((c, i) => s += text(colX[i], 128, c, { fill: C.subtle, size: 12, weight: 600 }));
  s += rect(0, 140, MW, 1, 0, C.border);
  const statuses = [['paid', C.green], ['pending', C.yellow], ['refunded', C.red], ['paid', C.green]];
  for (let r = 0; r < 12; r++) {
    const y = 150 + r * 41;
    if (r === 2) s += rect(8, y - 4, MW - 16, 38, 6, C.accentSoft);
    else if (r % 2 === 0) s += rect(8, y - 4, MW - 16, 38, 6, C.surface2);
    s += text(colX[0], y + 20, String(5200 + r), { fill: C.muted, size: 13, mono: true });
    s += text(colX[1], y + 20, `Customer ${r + 1}`, { fill: C.text, size: 13 });
    const [st, col] = statuses[r % 4];
    s += rect(colX[2], y + 4, 76, 22, 11, 'rgba(255,255,255,0.04)');
    s += `<circle cx="${colX[2] + 14}" cy="${y + 15}" r="4" fill="${col}"/>`;
    s += text(colX[2] + 26, y + 20, st, { fill: col, size: 11, weight: 600 });
    s += text(colX[3], y + 20, `$${(120 + r * 7).toFixed(2)}`, { fill: C.text, size: 13, mono: true });
    s += text(colX[4], y + 20, '2026-06-1' + (r % 9) + ' 09:' + (10 + r), { fill: C.muted, size: 12, mono: true });
  }
  return s;
}

// ── ER diagram ────────────────────────────────────────────────────────────────
function erDiagram() {
  let s = '';
  s += text(0, 4, 'Schema diagram', { size: 22, weight: 700 });
  s += text(0, 30, 'public · 9 tables · auto-generated', { fill: C.muted, size: 13 });
  const tableBox = (x, y, name, rows) => {
    let t = rect(x, y, 230, 30 + rows.length * 26, 10, C.surface, `stroke="${C.border}"`);
    t += rect(x, y, 230, 30, 10, C.surface2);
    t += `<rect x="${x}" y="${y + 20}" width="230" height="10" fill="${C.surface2}"/>`;
    t += text(x + 14, y + 20, name, { size: 13, weight: 700, fill: C.accent });
    rows.forEach((r, i) => {
      t += text(x + 14, y + 50 + i * 26, r[0], { size: 12, mono: true, fill: C.text });
      t += text(x + 216, y + 50 + i * 26, r[1], { size: 11, mono: true, fill: C.subtle, anchor: 'end' });
    });
    return t;
  };
  const line = (x1, y1, x2, y2) =>
    `<path d="M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}" stroke="${C.accent}" stroke-width="2" fill="none" opacity="0.7"/>`;
  s += line(250, 150, 430, 120);
  s += line(250, 200, 430, 360);
  s += line(660, 150, 840, 360);
  s += tableBox(20, 90, 'users', [['id', 'uuid'], ['email', 'text'], ['created_at', 'tstz']]);
  s += tableBox(430, 70, 'orders', [['id', 'bigint'], ['user_id', 'fk'], ['total', 'numeric'], ['status', 'enum']]);
  s += tableBox(430, 320, 'order_items', [['id', 'bigint'], ['order_id', 'fk'], ['qty', 'int']]);
  s += tableBox(840, 320, 'products', [['id', 'bigint'], ['name', 'text'], ['price', 'numeric']]);
  s += tableBox(840, 70, 'payments', [['id', 'bigint'], ['order_id', 'fk'], ['amount', 'numeric']]);
  // mini toolbar
  s += rect(MW - 150, 0, 150, 34, 8, C.surface2);
  s += text(MW - 75, 22, '＋  −  ⤢  ⤓ PNG', { fill: C.muted, size: 12, anchor: 'middle' });
  return s;
}

// ── Database health ─────────────────────────────────────────────────────────
function health() {
  let s = '';
  s += text(0, 4, 'Database health', { size: 22, weight: 700 });
  // score ring
  const cxp = 150, cyp = 150, rad = 70;
  const pct = 0.86;
  const circ = 2 * Math.PI * rad;
  s += rect(0, 40, 300, 220, 14, C.surface);
  s += `<circle cx="${cxp}" cy="${cyp}" r="${rad}" stroke="${C.surface2}" stroke-width="14" fill="none"/>`;
  s += `<circle cx="${cxp}" cy="${cyp}" r="${rad}" stroke="${C.green}" stroke-width="14" fill="none" stroke-linecap="round" stroke-dasharray="${circ * pct} ${circ}" transform="rotate(-90 ${cxp} ${cyp})"/>`;
  s += text(cxp, cyp - 2, '86', { size: 40, weight: 700, anchor: 'middle' });
  s += text(cxp, cyp + 22, 'Healthy', { size: 13, fill: C.green, anchor: 'middle', weight: 600 });
  // metric cards
  const metrics = [
    ['Cache hit ratio', '99.2%', C.green],
    ['Index usage', '94%', C.green],
    ['Table bloat', '12%', C.yellow],
    ['Dead tuples', '3.1M', C.yellow],
  ];
  metrics.forEach((m, i) => {
    const x = 330 + (i % 2) * 300;
    const y = 40 + Math.floor(i / 2) * 108;
    s += rect(x, y, 280, 92, 12, C.surface);
    s += text(x + 18, y + 30, m[0], { fill: C.muted, size: 13 });
    s += text(x + 18, y + 66, m[1], { fill: m[2], size: 26, weight: 700 });
  });
  // recommendations
  s += rect(0, 290, MW, 360, 12, C.surface);
  s += text(20, 322, 'Recommendations', { size: 15, weight: 700 });
  const recs = [
    ['Missing index on orders.user_id', 'High impact · ~240ms/query', C.red],
    ['Unused index idx_orders_legacy', 'Reclaim 84 MB', C.yellow],
    ['VACUUM recommended on events', '3.1M dead tuples', C.yellow],
    ['Slow query: SELECT * FROM logs …', '1.8s avg · 2,401 calls', C.red],
  ];
  recs.forEach((r, i) => {
    const y = 348 + i * 68;
    s += rect(16, y, MW - 32, 56, 10, C.surface2);
    s += `<circle cx="44" cy="${y + 28}" r="6" fill="${r[2]}"/>`;
    s += text(70, y + 24, r[0], { size: 13, weight: 600 });
    s += text(70, y + 44, r[1], { fill: C.subtle, size: 12 });
    s += rect(MW - 130, y + 14, 96, 28, 7, 'rgba(249,115,22,0.14)');
    s += text(MW - 82, y + 33, 'Fix', { fill: C.accent, size: 12, weight: 600, anchor: 'middle' });
  });
  return s;
}

// ── AI workspace ──────────────────────────────────────────────────────────────
function aiWorkspace() {
  let s = '';
  s += text(0, 4, 'AI workspace', { size: 22, weight: 700 });
  s += text(0, 30, 'Local & BYO-key · nothing leaves your machine', { fill: C.muted, size: 13 });
  // chat
  s += rect(0, 52, MW, 600, 12, C.surface);
  // user bubble
  s += rect(MW - 470, 76, 450, 52, 12, C.surface2);
  s += text(MW - 446, 108, 'Show me the top customers by revenue this quarter', { fill: C.text, size: 13 });
  // ai bubble
  s += rect(20, 152, 520, 40, 12, C.accentSoft);
  s += text(40, 177, 'Here is the SQL — it joins orders and customers:', { fill: C.text, size: 13 });
  // code block
  s += rect(20, 204, 760, 150, 10, '#0c0c10', `stroke="${C.border}"`);
  const code = [
    [['SELECT', C.accent], [' c.name, ', C.text], ['sum', C.blue], ['(o.total) AS revenue', C.text]],
    [['FROM', C.accent], [' customers c ', C.text], ['JOIN', C.accent], [' orders o ', C.text], ['ON', C.accent], [' o.customer_id = c.id', C.text]],
    [['WHERE', C.accent], [' o.created_at >= ', C.text], ["date_trunc('quarter', now())", C.green]],
    [['GROUP BY', C.accent], [' c.name ', C.text], ['ORDER BY', C.accent], [' revenue ', C.text], ['DESC', C.accent]],
  ];
  code.forEach((segs, i) => {
    let x = 40;
    const y = 236 + i * 28;
    segs.forEach(([t, fill]) => {
      s += text(x, y, t, { fill, size: 13, mono: true });
      x += t.length * 7.6;
    });
  });
  s += rect(40, 372, 120, 30, 7, C.accent);
  s += text(100, 392, 'Run query', { fill: '#fff', size: 12, weight: 600, anchor: 'middle' });
  s += rect(172, 372, 120, 30, 7, C.surface2);
  s += text(232, 392, 'Explain', { fill: C.muted, size: 12, anchor: 'middle' });
  // provider chips
  s += text(20, 470, 'Provider', { fill: C.subtle, size: 12, weight: 600 });
  ['Anthropic', 'OpenAI', 'Gemini', 'Ollama (local)'].forEach((p, i) => {
    const x = 20 + i * 150;
    const active = i === 0;
    s += rect(x, 484, 138, 32, 8, active ? C.accentSoft : C.surface2);
    s += text(x + 16, 505, p, { fill: active ? C.accent : C.muted, size: 12, weight: active ? 600 : 400 });
  });
  // input
  s += rect(20, 590, MW - 40, 44, 10, C.surface2);
  s += text(40, 617, 'Ask anything about your database…', { fill: C.subtle, size: 13 });
  s += rect(MW - 84, 598, 44, 28, 7, C.accent);
  s += text(MW - 62, 617, '↑', { fill: '#fff', size: 15, weight: 700, anchor: 'middle' });
  return s;
}

const shots = [
  ['hero.svg', frame('Swyftgrids — SQL Editor', 'SQL Editor', sqlEditor())],
  ['sql-editor.svg', frame('SQL Editor', 'SQL Editor', sqlEditor())],
  ['table-browser.svg', frame('Table Browser', 'Tables', tableBrowser())],
  ['er-diagram.svg', frame('Schema Diagram', 'Schema', erDiagram())],
  ['database-health.svg', frame('Database Health', 'Performance', health())],
  ['ai-workspace.svg', frame('AI Workspace', 'AI', aiWorkspace())],
];

for (const [name, svg] of shots) {
  writeFileSync(resolve(outDir, name), svg);
  console.log('wrote', name);
}
console.log(`\n✓ ${shots.length} screenshots in assets/screenshots/`);
