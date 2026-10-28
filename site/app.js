(() => {
  'use strict';
  const R = window.REVIEW;
  const $ = (s, r = document) => r.querySelector(s);
  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(c));
    return n;
  }
  const SEV = { P0: ['▲', 'Fix before inviting anyone'], P1: ['◆', 'Fix before public launch'], P2: ['●', 'Fix in the first month'] };
  const money = n => '$' + Math.round(n).toLocaleString('en-US');
  const hrs = h => (h % 1 ? h.toFixed(h * 4 % 2 ? 2 : 1) : h) + (h === 1 ? ' hour' : ' hours');
  const T = Object.fromEntries(R.totals.map(t => [t.sev, t]));
  const totalH = R.totals.reduce((a, t) => a + t.hours, 0), totalC = R.totals.reduce((a, t) => a + t.cost, 0);

  $('#lede').textContent = `Short answer: not yet. ${T.P0.n} problems should be fixed before any real parent signs up, about ${hrs(T.P0.hours)} of work. None of them needs a rebuild.`;
  $('#lanes').append(...['P0', 'P1', 'P2'].map(s => el('div', { class: 'lane ' + s },
    el('div', { class: 'k' }, `${SEV[s][0]} ${SEV[s][1]}`), el('div', { class: 'n' }, String(T[s].n)),
    el('div', { class: 's' }, `${hrs(T[s].hours)} · about ${money(T[s].cost)} at $${R.rate}/hour`))));
  $('#foot').textContent = `Demo app: Next.js ${R.versions.next}, React ${R.versions.react}, supabase-js ${R.versions.supabase_js}. Scanner tests ${R.tests.pass}/${R.tests.tests} passing. Generated ${R.generated} from review/out/*.json.`;

  const TABS = [['summary', 'Summary'], ['findings', 'Findings'], ['phone', 'On a phone'], ['checks', 'How I checked'], ['fixes', 'The fixes'], ['scope', 'Scope and price']];
  const tl = $('#tablist'), panels = {};
  TABS.forEach(([id, label]) => {
    tl.append(el('button', { role: 'tab', id: 't-' + id, 'aria-controls': 'p-' + id, 'aria-selected': 'false', tabindex: '-1', onclick: () => { location.hash = id; } }, label));
    panels[id] = el('section', { class: 'panel', id: 'p-' + id, role: 'tabpanel', 'aria-labelledby': 't-' + id, hidden: true });
    $('#panels').append(panels[id]);
  });
  tl.addEventListener('keydown', e => {
    const b = [...tl.children], i = b.indexOf(document.activeElement); if (i < 0) return;
    const j = e.key === 'ArrowRight' ? (i + 1) % b.length : e.key === 'ArrowLeft' ? (i - 1 + b.length) % b.length : -1;
    if (j >= 0) { b[j].focus(); b[j].click(); e.preventDefault(); }
  });
  const select = id => {
    if (!panels[id]) id = 'summary';
    Object.entries(panels).forEach(([k, p]) => { p.hidden = k !== id; });
    [...tl.children].forEach(b => { const on = b.id === 't-' + id; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
  };
  addEventListener('hashchange', () => select(location.hash.slice(1)));

  /* ---------- summary ---------- */
  const OKTEXT = {
    'public-read-by-design': 'Public on purpose, and holds no personal data',
    'write-owner-scoped': 'Only the owner can change it',
    'rls-locked': 'Locked: not reachable with the public key',
  };
  panels.summary.append(el('h2', {}, 'What to fix, in order, and what it costs'),
    el('p', { class: 'sub' }, 'Each line is a separate, small fix. You can take this list to any developer; the estimates are per item.'),
    el('div', { class: 'grid2' },
      el('div', { class: 'card' }, el('table', { class: 't' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Priority'), el('th', {}, 'Problem'), el('th', { class: 'num' }, 'Hours'), el('th', { class: 'num' }, 'Cost'))),
        el('tbody', {}, R.findings.map(f => el('tr', {},
          el('td', {}, el('span', { class: 'sev ' + f.sev }, `${SEV[f.sev][0]} ${f.sev}`)),
          el('td', {}, el('a', { href: '#findings', onclick: () => setTimeout(() => document.getElementById(f.id)?.scrollIntoView({ block: 'start' }), 30) }, f.title)),
          el('td', { class: 'num' }, String(f.hours)), el('td', { class: 'num' }, money(f.cost)))),
          el('tr', {}, el('td', {}), el('td', {}, el('b', {}, 'Total')), el('td', { class: 'num' }, el('b', {}, String(totalH))), el('td', { class: 'num' }, el('b', {}, money(totalC))))))),
      el('div', { class: 'stack' },
        el('div', { class: 'card' }, el('h3', { style: 'margin:0 0 6px' }, 'Already right'),
          el('p', { class: 'note', style: 'margin:0 0 8px' }, 'A review should say what is fine, too, so you know where not to spend money.'),
          el('ul', { class: 'clean' }, R.ok.map(o => el('li', {}, el('span', { class: 'okc' }, '✓ '), `${OKTEXT[o.rule] || o.rule}: `, el('span', { class: 'note' }, o.evidence.replace(/^policy /, ''))))),
        ),
        el('div', { class: 'card' }, el('h3', { style: 'margin:0 0 6px' }, 'After the fixes'),
          el('ul', { class: 'clean' },
            el('li', {}, `Scanner flags: ${R.scan.before.P0 + R.scan.before.P1 + R.scan.before.P2} before, ${R.scan.after.P0 + R.scan.after.P1 + R.scan.after.P2} after (one finding can raise more than one flag).`),
            el('li', {}, `Admin key in browser files: ${R.bundle.before.service_key.files_containing} of ${R.bundle.files} before, ${R.bundle.after.service_key.files_containing} after.`),
            el('li', {}, `Phone layouts that slide sideways: ${R.runtime.before.overflow.filter(o => o.overflows).length} of ${R.runtime.before.overflow.length} before, ${R.runtime.after.overflow.filter(o => o.overflows).length} after.`),
            el('li', {}, `Signed-out visit to /saved: ${R.runtime.before.guard.status} before, ${R.runtime.after.guard.status} redirect to sign-in after.`))))));

  /* ---------- findings ---------- */
  panels.findings.append(el('h2', {}, 'Findings, in plain English'),
    el('p', { class: 'sub' }, 'What it is, why it matters, what fixes it, and how the fix was confirmed. File and line references are for whoever does the work.'),
    el('div', { class: 'stack' }, R.findings.map(f => el('article', { class: 'card finding ' + f.sev, id: f.id },
      el('header', {}, el('span', { class: 'sev ' + f.sev }, `${SEV[f.sev][0]} ${f.sev} · ${SEV[f.sev][1]}`), el('span', { class: 'cost' }, `${f.id} · ${hrs(f.hours)} · ${money(f.cost)} · ${f.owner}`)),
      el('h3', {}, f.title),
      el('dl', {},
        el('dt', {}, 'What is going on'), el('dd', {}, f.plain),
        el('dt', {}, 'Why it matters'), el('dd', {}, f.risk),
        el('dt', {}, 'The fix'), el('dd', {}, f.fix),
        el('dt', {}, 'Confirmed by'), el('dd', {}, f.proof),
        el('dt', {}, 'Where'), el('dd', { class: 'ev' }, f.evidence.map((e, i) => [i ? ' · ' : '', el('code', {}, e)]), f.manual ? '  (found by reading the code)' : ''))))));

  /* ---------- phone ---------- */
  const rows = R.runtime.before.overflow.filter(o => o.path === '/');
  const rowsA = R.runtime.after.overflow.filter(o => o.path === '/');
  panels.phone.append(el('h2', {}, 'What a parent sees on a phone'),
    el('p', { class: 'sub' }, 'Production build, real Chromium, 390 px wide (an iPhone-sized screen). The second picture in each pair is the same page after a sideways swipe.'),
    el('div', { class: 'phones' },
      el('figure', { class: 'phone' }, el('img', { src: 'img/before-390.png', alt: 'Before: home page on a 390 pixel screen' }), el('figcaption', {}, el('b', {}, 'Before'), ': looks fine at first')),
      el('figure', { class: 'phone' }, el('img', { src: 'img/before-390-swiped.png', alt: 'Before: the same page after a sideways swipe, content cut off' }), el('figcaption', {}, el('b', {}, 'Before, after a swipe'), `: the page slides ${R.runtime.before.swipe_scroll_x}px and the cards fall off the screen`)),
      el('figure', { class: 'phone' }, el('img', { src: 'img/after-390.png', alt: 'After: home page on a 390 pixel screen' }), el('figcaption', {}, el('b', {}, 'After'), ': the category row scrolls on its own')),
      el('figure', { class: 'phone' }, el('img', { src: 'img/after-390-swiped.png', alt: 'After: same page after a swipe, nothing moves' }), el('figcaption', {}, el('b', {}, 'After, after a swipe'), `: the page moves ${R.runtime.after.swipe_scroll_x}px`))),
    el('div', { class: 'card', style: 'margin-top:18px' }, el('h3', { style: 'margin:0 0 8px' }, 'Page width at each screen size (home page)'),
      el('table', { class: 't' }, el('thead', {}, el('tr', {}, ['Screen', 'Before: page width', '', 'After: page width', ''].map((h, i) => el('th', { class: i && i % 2 ? 'num' : '' }, h)))),
        el('tbody', {}, rows.map((r, i) => el('tr', {}, el('td', {}, `${r.width} px`),
          el('td', { class: 'num' }, `${r.page_width} px`), el('td', { class: r.overflows ? 'badc' : 'okc' }, r.overflows ? '✗ slides sideways' : '✓ fits'),
          el('td', { class: 'num' }, `${rowsA[i].page_width} px`), el('td', { class: rowsA[i].overflows ? 'badc' : 'okc' }, rowsA[i].overflows ? '✗ slides sideways' : '✓ fits'))))),
      el('p', { class: 'note' }, `Activity detail pages were checked at the same widths: ${R.runtime.before.overflow.filter(o => o.path !== '/' && o.overflows).length} problems before, ${R.runtime.after.overflow.filter(o => o.path !== '/' && o.overflows).length} after.`)));

  /* ---------- checks ---------- */
  const method = (i, title, body, num, numLabel) => el('div', { class: 'card method' }, el('div', { class: 'i' }, i),
    el('div', {}, el('h3', { style: 'margin:0 0 4px' }, title), el('p', { style: 'margin:0 0 8px' }, body), el('div', { class: 'bignum' }, num), el('div', { class: 'note' }, numLabel)));
  panels.checks.append(el('h2', {}, 'How each finding was checked'),
    el('p', { class: 'sub' }, 'Three kinds of check, then a careful read of the code for what tools cannot see. All of them are defensive: they read the code, the build output and pages in a browser. Nothing is run against a live system.'),
    el('div', { class: 'stack' },
      method('1', 'Schema and code scan', `Reads every migration and source file: tables without access rules, rules that let everyone read personal data, edit rules without an owner check, secrets with a public name, admin keys in browser components, write endpoints with no sign-in check, private pages outside the sign-in check, and keys files not ignored by git. ${R.scan.tables} tables, ${R.scan.policies_before} rules, ${R.scan.files} files.`,
        `${R.scan.before.P0 + R.scan.before.P1 + R.scan.before.P2} → ${R.scan.after.P0 + R.scan.after.P1 + R.scan.after.P2}`, `scanner flags before → after the fixes · the scanner's own tests: ${R.tests.pass} of ${R.tests.tests} pass, including "no false alarms on correct tables"`),
      method('2', 'Build check with marker keys', 'Builds the app with harmless marker values in place of real keys, then searches the JavaScript files that ship to browsers for each marker. A marker found there means that key reaches every visitor.',
        `${R.bundle.before.service_key.files_containing} → ${R.bundle.after.service_key.files_containing}`, `browser files containing the admin key, of ${R.bundle.files} · the public key appears in ${R.bundle.after.public_key.files_containing} after the fix, which is expected and safe`),
      method('3', 'Real browser, production build', 'Runs the built app and opens it in Chromium at 360, 390, 414, 768 and 1280 px, measuring whether the page is wider than the screen; then visits a private page while signed out.',
        `${R.runtime.before.overflow.filter(o => o.overflows).length} → ${R.runtime.after.overflow.filter(o => o.overflows).length}`, 'page and screen-size combinations that slide sideways'),
      el('div', { class: 'card' }, el('h3', { style: 'margin:0 0 6px' }, 'What tools cannot see, so I read for it'),
        el('ul', { class: 'clean' },
          el('li', {}, 'Whether the access rules match how the product is meant to work (who should see what).'),
          el('li', {}, 'Limits a database should enforce, like ratings from 1 to 5 (finding F9 came from reading, not scanning).'),
          el('li', {}, 'Flows end to end: sign up, sign in, save, unsave, sign out, reset password.'),
          el('li', {}, 'Code that works but will be hard to change later.')))));

  /* ---------- fixes ---------- */
  const pre = el('pre', { class: 'diff', tabindex: '0' }), files = el('div', { class: 'files' });
  const show = i => {
    pre.replaceChildren(...R.diffs[i].diff.split('\n').map(l => el('span', { class: l.startsWith('+') ? 'a' : l.startsWith('-') ? 'd' : l.startsWith('@@') ? 'h' : '' }, l || ' ')));
    files.querySelectorAll('button').forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
  };
  R.diffs.forEach((d, i) => files.append(el('button', { 'aria-pressed': 'false', onclick: () => show(i) }, d.file)));
  panels.fixes.append(el('h2', {}, 'The fixes, line by line'),
    el('p', { class: 'sub' }, 'The real diff between the demo and the fixed demo. Small, targeted changes: no rebuild.'),
    el('div', { class: 'card' }, files, pre));
  show(0);

  /* ---------- scope ---------- */
  panels.scope.append(el('h2', {}, 'What the PlayLoop review includes, and what it does not'),
    el('p', { class: 'sub' }, 'The same method as this sample, run on your real code, with your own report in this format.'),
    el('div', { class: 'grid2' },
      el('div', { class: 'card' }, el('h3', { style: 'margin:0 0 6px' }, el('span', { class: 'okc' }, '✓ '), 'Included'),
        el('ul', { class: 'clean' },
          el('li', {}, 'Architecture read-through: how pages, server code and Supabase fit together'),
          el('li', {}, 'Sign-up, sign-in, sessions and the pages that need a signed-in parent'),
          el('li', {}, 'Every table\'s access rules, checked against who should see what'),
          el('li', {}, 'Keys and environment variables, including what ships to the browser'),
          el('li', {}, 'Server routes and actions: who can call them, and what they accept'),
          el('li', {}, 'Core features tested by hand on phone and desktop'),
          el('li', {}, 'Bugs and technical debt worth fixing before launch'),
          el('li', {}, 'Plain-English report with priorities and a cost for each fix'),
          el('li', {}, 'A 30-minute call to walk you through it'))),
      el('div', { class: 'card' }, el('h3', { style: 'margin:0 0 6px' }, el('span', { class: 'badc' }, '✗ '), 'Not included'),
        el('ul', { class: 'clean' },
          el('li', {}, 'Making the fixes (quoted per item in the report; any developer can do them)'),
          el('li', {}, 'A rebuild or a long-term contract'),
          el('li', {}, 'Penetration testing or load testing of your live system'),
          el('li', {}, 'Legal or privacy-law advice'),
          el('li', {}, 'Design or copy changes')),
        el('div', { style: 'margin-top:16px' }, el('div', { class: 'price' }, '$480 fixed'),
          el('div', { class: 'note' }, '3 business days from access. Read-only access is enough. All code, accounts and the report stay yours.')))));

  select(location.hash.slice(1) || 'summary');
})();
