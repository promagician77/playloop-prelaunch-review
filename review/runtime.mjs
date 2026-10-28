#!/usr/bin/env node
// Runs the production build of each repo and checks, in a real browser:
//  - horizontal overflow at phone and tablet widths (page wider than the screen = sideways scrolling)
//  - whether a private page answers a signed-out visitor
//   node review/runtime.mjs <before-dir> <after-dir> [--json out.json] [--shots dir]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const [beforeDir, afterDir] = process.argv.slice(2, 4).map(p => path.resolve(p));
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const shots = arg('--shots'); if (shots) fs.mkdirSync(shots, { recursive: true });
const WIDTHS = [360, 390, 414, 768, 1280];
const PAGES = ['/', '/activity/1'];

function start(dir, port) {
  const p = spawn('npx', ['next', 'start', '-p', String(port)], { cwd: dir, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: 'ignore', detached: true });
  return p;
}
async function waitUp(url) { for (let i = 0; i < 80; i++) { try { const r = await fetch(url); if (r.status < 500) return; } catch {} await new Promise(r => setTimeout(r, 250)); } throw new Error('server did not start: ' + url); }

const servers = [start(beforeDir, 3100), start(afterDir, 3101)];
const out = {};
try {
  await Promise.all([waitUp('http://localhost:3100/'), waitUp('http://localhost:3101/')]);
  const browser = await chromium.launch();
  for (const [label, port] of [['before', 3100], ['after', 3101]]) {
    const res = { overflow: [], guard: null };
    for (const w of WIDTHS) {
      const page = await browser.newPage({ viewport: { width: w, height: 800 } });
      for (const p of PAGES) {
        await page.goto(`http://localhost:${port}${p}`, { waitUntil: 'networkidle' });
        const m = await page.evaluate(() => {
          const vw = document.documentElement.clientWidth, sw = document.documentElement.scrollWidth;
          let widest = null;
          for (const el of document.querySelectorAll('body *')) {
            const r = el.getBoundingClientRect();
            if (r.right > vw + 1 && (!widest || r.right > widest.right)) widest = { right: Math.round(r.right), tag: el.tagName.toLowerCase(), cls: el.className || '' };
          }
          return { viewport: vw, page_width: sw, widest };
        });
        res.overflow.push({ width: w, path: p, ...m, overflows: m.page_width > m.viewport + 1 });
        if (shots && w === 390 && p === '/') {
          await page.screenshot({ path: path.join(shots, `${label}-390.png`), clip: { x: 0, y: 0, width: 390, height: 640 } });
          await page.evaluate(() => window.scrollTo(320, 0));          // a parent's sideways swipe
          await page.waitForTimeout(150);
          await page.screenshot({ path: path.join(shots, `${label}-390-swiped.png`) , clip: { x: 0, y: 0, width: 390, height: 640 } });
          res.swipe_scroll_x = await page.evaluate(() => window.scrollX);
        }
      }
      await page.close();
    }
    const r = await fetch(`http://localhost:${port}/saved`, { redirect: 'manual' });
    const body = r.status === 200 ? await r.text() : '';
    res.guard = { path: '/saved', status: r.status, location: r.headers.get('location'), served_private_page: r.status === 200 && body.includes('Your saved activities') };
    out[label] = res;
  }
  await browser.close();
} finally {
  for (const s of servers) { try { process.kill(-s.pid); } catch {} }
}
const f = arg('--json'); if (f) fs.writeFileSync(f, JSON.stringify(out, null, 2));
for (const [k, v] of Object.entries(out)) {
  const bad = v.overflow.filter(o => o.overflows);
  console.log(`${k}: ${bad.length}/${v.overflow.length} page-width combos overflow` + (bad.length ? ` (e.g. ${bad[0].path} at ${bad[0].width}px is ${bad[0].page_width}px wide, widest: ${bad[0].widest?.tag}.${bad[0].widest?.cls})` : '') + `; signed-out /saved -> ${v.guard.status}${v.guard.location ? ' ' + v.guard.location : ''}`);
}
