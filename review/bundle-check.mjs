#!/usr/bin/env node
// Build the app with marker values in place of real keys, then search the JavaScript that ships
// to browsers (.next-markers/static) for each marker. A marker found there = that key reaches every visitor.
//   node review/bundle-check.mjs <repo-dir> [--json out.json]
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(process.argv[2]);
const MARKERS = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://review-marker-project.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'REVIEW-MARKER-PUBLIC-KEY-a41d',
  NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'REVIEW-MARKER-SERVICE-KEY-7f3a',   // only read by code that (wrongly) uses the prefixed name
  SUPABASE_SERVICE_ROLE_KEY: 'REVIEW-MARKER-SERVICE-KEY-7f3a',              // same value under the server-only name
};
const dist = '.next-markers';
fs.rmSync(path.join(repo, dist), { recursive: true, force: true });
const t0 = Date.now();
execSync('npx next build', { cwd: repo, stdio: 'pipe', env: { ...process.env, ...MARKERS, NEXT_DIST_DIR: dist, NEXT_TELEMETRY_DISABLED: '1' } });
const buildSeconds = (Date.now() - t0) / 1000;

function walk(d, acc = []) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p, acc) : acc.push(p); } return acc; }
const browserFiles = walk(path.join(repo, dist, 'static')).filter(f => f.endsWith('.js'));
const result = { repo: path.basename(repo), build_seconds: buildSeconds, browser_js_files: browserFiles.length, markers: {} };
for (const [name, value] of Object.entries({ public_key: MARKERS.NEXT_PUBLIC_SUPABASE_ANON_KEY, service_key: MARKERS.SUPABASE_SERVICE_ROLE_KEY })) {
  const hits = browserFiles.filter(f => fs.readFileSync(f, 'utf8').includes(value)).map(f => path.relative(path.join(repo, dist), f));
  result.markers[name] = { files_containing: hits.length, files: hits };
}
fs.rmSync(path.join(repo, dist), { recursive: true, force: true });
const i = process.argv.indexOf('--json'); if (i > 0) fs.writeFileSync(process.argv[i + 1], JSON.stringify(result, null, 2));
console.log(`${result.repo}: ${result.browser_js_files} browser JS files; service key in ${result.markers.service_key.files_containing}, public key in ${result.markers.public_key.files_containing} (build ${buildSeconds.toFixed(0)} s)`);
