#!/usr/bin/env node
// Static pre-launch review for a Next.js + Supabase repo. Defensive checks only: it reads
// migrations and source files and reports configuration problems with file:line evidence.
//   node review/scan.mjs <repo-dir> [--json out.json]
import fs from 'node:fs';
import path from 'node:path';

const PERSONAL_COL = /\b(email|phone|child\w*|birth\w*|dob|date_of_birth|home_\w+)\b/i;
const OWNER_EQ = /auth\.uid\(\)\s*=\s*\w+|\b\w+\s*=\s*auth\.uid\(\)/i;
const PRIVATE_SEGMENT = /^(saved|profile|account|settings|dashboard|favorites)$/;

const lineAt = (text, idx) => text.slice(0, idx).split('\n').length;

function balanced(text, start) {             // text[start] === '(' -> contents up to the matching ')'
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') { depth--; if (depth === 0) return text.slice(start + 1, i); }
  }
  return null;
}
function clause(stmt, keyword) {             // 'using' or 'with check'
  const m = new RegExp(`\\b${keyword.replace(' ', '\\s+')}\\s*\\(`, 'i').exec(stmt);
  if (!m) return null;
  return balanced(stmt, m.index + m[0].length - 1);
}
const norm = s => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

export function parseSql(text, file = 'schema.sql') {
  const clean = text.replace(/--[^\n]*/g, m => ' '.repeat(m.length));   // keep offsets for line numbers
  const tables = {}, rls = new Set(), policies = [];
  let start = 0;
  for (const part of clean.split(';')) {
    const stmt = part, offset = start; start += part.length + 1;
    const ct = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?(\w+)"?\s*\(/i.exec(stmt);
    if (ct) {
      const cols = balanced(stmt, ct.index + ct[0].length - 1) ?? '';
      tables[ct[1]] = { name: ct[1], columns: cols, line: lineAt(text, offset + ct.index), file };
      continue;
    }
    const en = /alter\s+table\s+(?:only\s+)?(?:public\.)?"?(\w+)"?\s+enable\s+row\s+level\s+security/i.exec(stmt);
    if (en) { rls.add(en[1]); continue; }
    const cp = /create\s+policy\s+"([^"]+)"\s+on\s+(?:public\.)?"?(\w+)"?([\s\S]*)/i.exec(stmt);
    if (cp) {
      const rest = cp[3];
      const cmd = (/\bfor\s+(select|insert|update|delete|all)\b/i.exec(rest)?.[1] ?? 'all').toLowerCase();
      policies.push({ name: cp[1], table: cp[2], cmd, using: clause(rest, 'using'), check: clause(rest, 'with check'),
                      line: lineAt(text, offset + cp.index), file });
    }
  }
  return { tables, rls, policies };
}

export function sqlFindings({ tables, rls, policies }) {
  const out = [];
  for (const t of Object.values(tables)) {
    const tp = policies.filter(p => p.table === t.name);
    const personalCols = [...new Set([...t.columns.matchAll(new RegExp(PERSONAL_COL.source, 'gi'))].map(m => m[0]))];
    const personal = personalCols.length ? personalCols.join(', ') : null;
    if (!rls.has(t.name)) {
      out.push({ rule: 'rls-disabled', severity: 'P0', table: t.name, file: t.file, line: t.line,
                 evidence: `create table public.${t.name} has no "enable row level security"` });
      continue;
    }
    if (tp.length === 0) out.push({ rule: 'rls-locked', severity: 'OK', table: t.name, file: t.file, line: t.line,
                                    evidence: `RLS on, no policies: not reachable with the public key` });
    for (const p of tp) {
      if ((p.cmd === 'select' || p.cmd === 'all') && norm(p.using) === 'true') {
        if (personal) out.push({ rule: 'open-read-personal-data', severity: 'P0', table: t.name, file: p.file, line: p.line,
                                 evidence: `policy "${p.name}" reads with using (true); table holds ${personal}` });
        else out.push({ rule: 'public-read-by-design', severity: 'OK', table: t.name, file: p.file, line: p.line,
                        evidence: `policy "${p.name}" is public read; no personal-data columns` });
      }
      if (['update', 'delete', 'all'].includes(p.cmd)) {
        const expr = `${p.using ?? ''} ${p.check ?? ''}`;
        if (!OWNER_EQ.test(expr)) out.push({ rule: 'write-not-owner-scoped', severity: 'P1', table: t.name, file: p.file, line: p.line,
                                             evidence: `policy "${p.name}" (${p.cmd}) using (${norm(p.using)}) has no auth.uid() = owner check` });
        else out.push({ rule: 'write-owner-scoped', severity: 'OK', table: t.name, file: p.file, line: p.line,
                        evidence: `policy "${p.name}" (${p.cmd}) is scoped to the owner` });
      }
    }
  }
  return out;
}

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(e.name) || e.name.startsWith('.next')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc); else acc.push(p);
  }
  return acc;
}
function resolveImport(repo, fromFile, spec) {
  let base;
  if (spec.startsWith('@/')) base = path.join(repo, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec);
  else return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.jsx`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}
export function matcherToRegex(m) {
  const src = m.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\/:(\w+)\*/g, '(?:/.*)?')
    .replace(/\/:(\w+)\+/g, '(?:/.+)')
    .replace(/:(\w+)/g, '[^/]+');
  return new RegExp(`^${src}$`);
}

export function codeFindings(repo) {
  const out = [];
  const files = walk(repo).filter(f => /\.(tsx?|jsx?|mjs)$|(^|\/)\.env[^/]*$/.test(f));
  const rel = f => path.relative(repo, f);
  const seenVar = new Set();
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8');
    for (const m of text.matchAll(/NEXT_PUBLIC_[A-Z0-9_]*(SERVICE|SECRET|PRIVATE)[A-Z0-9_]*/g)) {
      const key = `${m[0]}@${rel(f)}`;
      if (seenVar.has(key)) continue; seenVar.add(key);
      out.push({ rule: 'secret-in-public-env', severity: 'P0', file: rel(f), line: lineAt(text, m.index),
                 evidence: `${m[0]}: the NEXT_PUBLIC_ prefix tells Next.js to inline this value into browser JavaScript` });
    }
    if (/^\s*['"]use client['"]/.test(text)) {
      for (const im of text.matchAll(/import\s+[^'"]+from\s+['"]([^'"]+)['"]/g)) {
        const target = resolveImport(repo, f, im[1]);
        if (target && /SERVICE_ROLE|SECRET_KEY|service_role/.test(fs.readFileSync(target, 'utf8'))) {
          out.push({ rule: 'admin-client-in-browser', severity: 'P0', file: rel(f), line: lineAt(text, im.index),
                     evidence: `'use client' component imports ${im[1]}, which builds a client from the service-role key` });
        }
      }
    }
    if (/(^|\/)app\/.*\/route\.(t|j)sx?$/.test(rel(f))) {
      for (const ex of text.matchAll(/export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\b/g)) {
        if (!/auth\.getUser\(/.test(text)) {
          const usesAdmin = /getAdminClient|SERVICE_ROLE/.test(text);
          out.push({ rule: 'write-endpoint-without-auth', severity: usesAdmin ? 'P0' : 'P1', file: rel(f), line: lineAt(text, ex.index),
                     evidence: `${ex[1]} handler never checks who is calling${usesAdmin ? ', and writes with the service-role client (row-level security skipped)' : ''}` });
        }
      }
    }
  }
  // secrets hygiene: .env files must be ignored by git
  const gi = path.join(repo, '.gitignore');
  const ignored = fs.existsSync(gi) && /^\s*\.env/m.test(fs.readFileSync(gi, 'utf8'));
  out.push(ignored
    ? { rule: 'env-gitignored', severity: 'OK', file: '.gitignore', line: 1, evidence: '.env files are ignored by git' }
    : { rule: 'env-not-gitignored', severity: 'P2', file: fs.existsSync(gi) ? '.gitignore' : '(missing .gitignore)', line: 1,
        evidence: 'nothing stops a real .env file with keys from being committed to the repository' });
  // middleware coverage of private pages
  const mwFile = files.find(f => /(^|\/)middleware\.(t|j)s$/.test(rel(f)));
  const matchers = mwFile ? [...fs.readFileSync(mwFile, 'utf8').matchAll(/matcher:\s*\[([^\]]*)\]/g)]
    .flatMap(m => [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map(x => x[1])) : [];
  for (const f of files.filter(f => /(^|\/)app\/(.*\/)?page\.(t|j)sx?$/.test(rel(f)))) {
    const route = '/' + rel(f).replace(/^app\/?/, '').replace(/\/?page\.(t|j)sx?$/, '');
    const segs = route.split('/').filter(Boolean);
    if (!segs.some(s => PRIVATE_SEGMENT.test(s))) continue;
    const covered = matchers.some(m => matcherToRegex(m).test(route));
    out.push(covered
      ? { rule: 'private-page-guarded', severity: 'OK', file: rel(f), line: 1, evidence: `${route} is covered by middleware` }
      : { rule: 'private-page-unguarded', severity: 'P1', file: rel(f), line: 1,
          evidence: `${route} looks private but the middleware matcher (${matchers.join(', ') || 'none'}) does not cover it` });
  }
  return out;
}

export function scanRepo(repo) {
  const sqlFiles = walk(repo).filter(f => /supabase\/migrations\/.*\.sql$/.test(f)).sort();
  const merged = { tables: {}, rls: new Set(), policies: [] };
  for (const f of sqlFiles) {
    const p = parseSql(fs.readFileSync(f, 'utf8'), path.relative(repo, f));
    Object.assign(merged.tables, p.tables); p.rls.forEach(t => merged.rls.add(t)); merged.policies.push(...p.policies);
  }
  const findings = [...sqlFindings(merged), ...codeFindings(repo)];
  const order = { P0: 0, P1: 1, P2: 2, OK: 3 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || a.rule.localeCompare(b.rule) || a.file.localeCompare(b.file));
  const count = s => findings.filter(f => f.severity === s).length;
  return { repo: path.basename(repo), tables: Object.keys(merged.tables).length, policies: merged.policies.length,
           files_scanned: walk(repo).length, counts: { P0: count('P0'), P1: count('P1'), P2: count('P2'), OK: count('OK') }, findings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const repo = path.resolve(process.argv[2] ?? '.');
  const res = scanRepo(repo);
  const i = process.argv.indexOf('--json');
  if (i > 0) fs.writeFileSync(process.argv[i + 1], JSON.stringify(res, null, 2));
  for (const f of res.findings) console.log(`${f.severity.padEnd(3)} ${f.rule.padEnd(28)} ${f.file}:${f.line}  ${f.evidence}`);
  console.log(`\n${res.repo}: ${res.counts.P0} P0, ${res.counts.P1} P1, ${res.counts.P2} P2, ${res.counts.OK} checked OK  (${res.tables} tables, ${res.policies} policies)`);
}
