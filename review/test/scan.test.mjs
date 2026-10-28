import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { parseSql, sqlFindings, scanRepo, matcherToRegex } from '../scan.mjs';

const rules = (sql) => sqlFindings(parseSql(sql)).map(f => `${f.severity}:${f.rule}:${f.table}`).sort();
const T = 'create table public.t (id uuid primary key, user_id uuid, email text);';

test('table without RLS is P0', () => assert.deepEqual(rules(T), ['P0:rls-disabled:t']));
test('table name in quotes and IF NOT EXISTS still parsed', () =>
  assert.deepEqual(rules('create table if not exists public."t" (id int);'), ['P0:rls-disabled:t']));
test('RLS on, no policies = locked (OK)', () =>
  assert.deepEqual(rules(T + 'alter table public.t enable row level security;'), ['OK:rls-locked:t']));
test('using (true) on personal data is P0', () =>
  assert.deepEqual(rules(T + 'alter table public.t enable row level security; create policy "p" on public.t for select using (true);'),
    ['P0:open-read-personal-data:t']));
test('using (true) on non-personal table is public by design', () =>
  assert.deepEqual(rules('create table public.a (id int, title text, address text); alter table public.a enable row level security; create policy "r" on public.a for select using ( true );'),
    ['OK:public-read-by-design:a']));
test('owner-scoped select on personal data passes', () =>
  assert.deepEqual(rules(T + 'alter table public.t enable row level security; create policy "p" on public.t for select using (auth.uid() = user_id);'), []));
test('update without owner check is P1', () =>
  assert.deepEqual(rules(T + 'alter table public.t enable row level security; create policy "u" on public.t for update using (auth.uid() is not null);'),
    ['P1:write-not-owner-scoped:t']));
test('update with reversed equality passes', () =>
  assert.deepEqual(rules(T + 'alter table public.t enable row level security; create policy "u" on public.t for update using (user_id = auth.uid()) with check (user_id = auth.uid());'),
    ['OK:write-owner-scoped:t']));
test('policy with no FOR clause is treated as ALL', () =>
  assert.deepEqual(rules(T + 'alter table public.t enable row level security; create policy "x" on public.t using (true);'),
    ['P0:open-read-personal-data:t', 'P1:write-not-owner-scoped:t']));
test('comments do not create tables or shift line numbers', () => {
  const p = parseSql('-- create table public.fake (id int);\n\ncreate table public.real (id int);');
  assert.deepEqual(Object.keys(p.tables), ['real']); assert.equal(p.tables.real.line, 3);
});
test('nested parentheses in policy expressions', () => {
  const p = parseSql(T + 'alter table public.t enable row level security; create policy "n" on public.t for delete using ((select auth.uid()) = user_id);');
  assert.equal(p.policies[0].using, '(select auth.uid()) = user_id');
});
test('middleware matcher semantics', () => {
  assert.ok(matcherToRegex('/saved/:path*').test('/saved'));
  assert.ok(matcherToRegex('/saved/:path*').test('/saved/123'));
  assert.ok(!matcherToRegex('/profile/:path*').test('/saved'));
  assert.ok(matcherToRegex('/u/:id').test('/u/42'));
  assert.ok(!matcherToRegex('/u/:id').test('/u/42/edit'));
});

const root = path.resolve(import.meta.dirname, '..', '..');
test('before repo: exact expected findings', () => {
  const r = scanRepo(path.join(root, 'demo-app'));
  const got = r.findings.filter(f => f.severity !== 'OK').map(f => `${f.severity}:${f.rule}:${f.file}`).sort();
  assert.deepEqual(got, [
    'P0:admin-client-in-browser:components/SaveButton.tsx',
    'P0:open-read-personal-data:supabase/migrations/0001_init.sql',
    'P0:rls-disabled:supabase/migrations/0001_init.sql',
    'P0:secret-in-public-env:.env.example',
    'P0:secret-in-public-env:lib/supabase/admin.ts',
    'P0:write-endpoint-without-auth:app/api/activities/route.ts',
    'P1:private-page-unguarded:app/saved/page.tsx',
    'P1:write-not-owner-scoped:supabase/migrations/0001_init.sql',
    'P2:env-not-gitignored:(missing .gitignore)',
  ]);
});
test('after repo: zero P0 and P1', () => {
  const r = scanRepo(path.join(root, 'demo-app-fixed'));
  assert.equal(r.counts.P0, 0); assert.equal(r.counts.P1, 0); assert.equal(r.counts.P2, 0);
});
test('correct tables are not flagged in either repo (no false alarms)', () => {
  for (const d of ['demo-app', 'demo-app-fixed']) {
    const r = scanRepo(path.join(root, d));
    assert.ok(!r.findings.some(f => f.severity !== 'OK' && ['activities', 'organizer_contacts'].includes(f.table)), d);
  }
});
