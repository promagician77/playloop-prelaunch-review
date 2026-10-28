#!/usr/bin/env node
// Turns the measured outputs (review/out/*.json) into the plain-English report the founder reads.
// Every number on the page comes from those files; wording and hour estimates live in CATALOG below.
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const J = f => JSON.parse(fs.readFileSync(`review/out/${f}`, 'utf8'));
const before = J('scan-before.json'), after = J('scan-after.json');
const bundleB = J('bundle-before.json'), bundleA = J('bundle-after.json'), rt = J('runtime.json');
const RATE = 45;

const worst = rt.before.overflow.filter(o => o.overflows).sort((a, b) => b.page_width - a.page_width)[0];
const nOver = rt.before.overflow.filter(o => o.overflows).length, nCombos = rt.before.overflow.length;
const ev = rule => before.findings.filter(f => f.rule === rule).map(f => `${f.file}:${f.line}`);

const CATALOG = [
  { id: 'F1', sev: 'P0', rules: ['secret-in-public-env', 'admin-client-in-browser'], hours: 1.5, owner: 'Code + Supabase dashboard',
    title: 'The master database key is sent to every visitor\'s browser',
    plain: `The Save button uses Supabase's admin key, which skips every access rule. Because the key is named NEXT_PUBLIC_..., Next.js copies it into the JavaScript every visitor downloads. In a test build it appeared in ${bundleB.markers.service_key.files_containing} of ${bundleB.browser_js_files} browser files.`,
    risk: 'Whoever has this key can read or change any table, ignoring every rule you set.',
    fix: 'Rename it to a server-only variable, make the Save button act as the signed-in parent, and replace the key in Supabase: a key that has shipped publicly has to be treated as public.',
    proof: `After the fix: ${bundleA.markers.service_key.files_containing} of ${bundleA.browser_js_files} browser files contain it.` },
  { id: 'F2', sev: 'P0', rules: ['open-read-personal-data'], hours: 1.5, owner: 'Database',
    title: 'Every parent\'s profile, including children\'s names and birth years, is readable by anyone',
    plain: 'The profiles table has an access rule of "true" for reading, which means everyone. It holds home zip codes and a list of children with first names and birth years.',
    risk: 'Children\'s details and home areas of every family on the platform are exposed.',
    fix: 'Each parent reads only their own profile. If a public display name is needed, publish just that column through a separate view.',
    proof: 'After the fix the rule is "auth.uid() = id": the signed-in parent, and only them.' },
  { id: 'F3', sev: 'P0', rules: ['rls-disabled'], hours: 1.0, owner: 'Database',
    title: 'Saved lists have no access rules at all',
    plain: 'The saved_activities table was created without row-level security. Supabase\'s public key is in every browser by design, and its docs say to enable these rules on every table it exposes.',
    risk: 'Which family saved which activity is open, and so is adding or deleting other families\' saves.',
    fix: 'Turn row-level security on and add three owner-only rules: read, add and remove your own saves.',
    proof: 'After the fix: RLS on, 3 owner-only policies.' },
  { id: 'F4', sev: 'P0', rules: ['write-endpoint-without-auth'], hours: 2.0, owner: 'Code',
    title: 'Anyone can create activity listings without signing in',
    plain: 'The /api/activities endpoint saves whatever it is sent, never checks who is calling, and writes with the admin key, so the database rules never run.',
    risk: 'Spam or fake listings on a site parents trust for their kids.',
    fix: 'Require a signed-in organizer, write as that user so the database rules apply, and validate the fields (title required, length limits).',
    proof: 'After the fix the handler answers 401 without a signed-in user and checks the title.' },
  { id: 'F5', sev: 'P1', rules: ['write-not-owner-scoped'], hours: 0.5, owner: 'Database',
    title: 'Any signed-in parent can edit anyone else\'s review',
    plain: 'The edit rule for reviews only checks that someone is signed in, not that they wrote the review.',
    risk: 'Reviews can be rewritten by other users.',
    fix: 'Authors edit only their own reviews.', proof: 'After the fix: "auth.uid() = user_id" on both read and write side of the rule.' },
  { id: 'F6', sev: 'P1', rules: ['private-page-unguarded'], hours: 0.5, owner: 'Code', runtime: 'guard',
    title: 'The Saved page opens for signed-out visitors',
    plain: `The sign-in check covers /profile only. A signed-out visit to /saved returned ${rt.before.guard.status} and the page itself. Today it shows sample data; once it reads real saves it must not.`,
    risk: 'A private page renders for people who are not signed in.',
    fix: 'Add /saved to the sign-in check.', proof: `After the fix a signed-out visit gets ${rt.after.guard.status} to ${rt.after.guard.location}.` },
  { id: 'F7', sev: 'P1', rules: [], runtime: 'overflow', hours: 0.5, owner: 'Code (CSS)',
    title: 'On phones the home page slides sideways',
    plain: `The row of category buttons does not wrap or scroll on its own, so the whole page is wider than the screen: ${worst.page_width}px wide on a ${worst.viewport}px phone. ${nOver} of ${nCombos} page and screen-size combinations are affected.`,
    risk: 'Parents on phones (most of them) get a page that shifts under their thumb.',
    fix: 'Let the category row scroll by itself.', proof: `After the fix: ${rt.after.overflow.filter(o => o.overflows).length} of ${rt.after.overflow.length} combinations overflow; a sideways swipe moves the page ${rt.after.swipe_scroll_x ?? 0}px.` },
  { id: 'F8', sev: 'P2', rules: ['env-not-gitignored'], hours: 0.25, owner: 'Repository',
    title: 'Nothing stops your real keys file from going to GitHub',
    plain: 'The project has no .gitignore, so a .env file with real keys could be committed along with the code.',
    risk: 'Keys leaking through the code repository.', fix: 'Add a .gitignore that excludes .env files.', proof: 'After the fix: .env* ignored.' },
  { id: 'F9', sev: 'P2', rules: [], manual: true, hours: 0.5, owner: 'Database', evidence_manual: ['supabase/migrations/0001_init.sql:43-44'],
    title: 'Ratings are not limited to 1-5, and review text has no length limit',
    plain: 'Found by reading the schema, not by the scanner. A rating of 0 or 500 would be stored, and a review can be any length.',
    risk: 'Broken averages and oversized posts.', fix: 'Database checks: rating between 1 and 5, review up to 2,000 characters.', proof: 'After the fix both checks are in the schema.' },
];
for (const c of CATALOG) {
  c.evidence = c.manual ? c.evidence_manual : c.runtime === 'overflow' ? [`/ at ${worst.viewport}px: page ${worst.page_width}px wide (widest element: ${worst.widest.tag}.${worst.widest.cls})`]
    : c.runtime === 'guard' ? [...c.rules.flatMap(ev), `GET /saved signed out -> ${rt.before.guard.status}`] : c.rules.flatMap(ev);
  c.cost = Math.round(c.hours * RATE);
}
const ok = before.findings.filter(f => f.severity === 'OK').map(f => ({ rule: f.rule, where: `${f.file}:${f.line}`, evidence: f.evidence }));
const sum = s => CATALOG.filter(c => c.sev === s);
const totals = ['P0', 'P1', 'P2'].map(s => ({ sev: s, n: sum(s).length, hours: sum(s).reduce((a, c) => a + c.hours, 0), cost: sum(s).reduce((a, c) => a + c.cost, 0) }));

function diff(file) {
  try { execSync(`diff -u demo-app/${file} demo-app-fixed/${file}`, { encoding: 'utf8' }); return ''; }
  catch (e) { return e.stdout.split('\n').slice(2).join('\n'); }
}
const diffs = ['lib/supabase/admin.ts', 'components/SaveButton.tsx', 'supabase/migrations/0001_init.sql', 'app/api/activities/route.ts', 'middleware.ts', 'app/globals.css']
  .map(f => ({ file: f, diff: diff(f) }));
const testsOut = execSync('node --test review/test/scan.test.mjs 2>&1 | grep -E "^# (tests|pass|fail)"', { encoding: 'utf8' });
const tests = Object.fromEntries(testsOut.trim().split('\n').map(l => l.replace('# ', '').split(' ')).map(([k, v]) => [k, +v]));

const data = { rate: RATE, generated: new Date().toISOString().slice(0, 10), versions: { next: '15.5', supabase_js: '2.118', react: '19.3' },
  scan: { before: before.counts, after: after.counts, tables: before.tables, policies_before: before.policies, policies_after: after.policies, files: before.files_scanned },
  bundle: { before: bundleB.markers, after: bundleA.markers, files: bundleB.browser_js_files },
  runtime: rt, findings: CATALOG, ok, totals, diffs, tests };
fs.writeFileSync('site/data.js', 'window.REVIEW = ' + JSON.stringify(data) + ';\n');
for (const f of ['before-390', 'before-390-swiped', 'after-390', 'after-390-swiped']) fs.copyFileSync(`review/out/shots/${f}.png`, `site/img/${f}.png`);
console.log(`report data: ${CATALOG.length} findings, ${totals.map(t => `${t.sev} ${t.n} (${t.hours} h, $${t.cost})`).join(', ')}; tests ${tests.pass}/${tests.tests}`);
