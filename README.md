# Pre-launch review sample (Next.js + Supabase)

A sample of the plain-English pre-launch review offered to PlayLoop, run on a **demo app built for this sample with
problems planted on purpose**. It is not PlayLoop's code. Every number in the report is produced by the scripts here.

## What is in the report (site/)
Summary (prioritised fixes with hours and cost), Findings (what, why, fix, how confirmed, file:line), On a phone
(before/after screenshots, page width per screen size), How I checked, The fixes (real diffs), Scope and price.
A 2-page PDF version is in `dist/`.

## Measured on the demo
* Scanner flags: 9 before the fixes, 0 after (6 must-fix, 2 should-fix, 1 first-month). Scanner tests: 15/15 pass,
  including "no false alarms on correctly configured tables".
* Admin (service-role) key found in 3 of 20 browser JavaScript files of a build made with marker values; 0 after.
* Home page wider than the screen at 360-768 px (982 px wide); 0 of 10 page/width combinations after.
* Signed-out request for /saved: 200 before, 307 to /login after.

## Not measured / limits
* Hour and cost estimates are judgement, at a sample rate of $45/hour.
* The scanner is a set of heuristics for this stack, not a complete security tool; the review also reads the code by hand
  (finding F9 came from reading).
* All checks are defensive: source, build output and a local production build in Chromium. Nothing is run against a live system.
* Supabase itself was not run (no local Supabase stack); access rules were checked by reading the migrations.

## Run it
```bash
./run_review.sh      # needs node 22 and Playwright's Chromium
```

## Deploy
Static: `vercel.json` serves `site/` with `noindex`.

## Platform facts used
* Supabase API keys (publishable key is public and relies on RLS; secret keys bypass RLS and must never reach a browser):
  https://supabase.com/docs/guides/api/api-keys
* Supabase RLS (enable on every table in an exposed schema; RLS on with no policies = no API access):
  https://supabase.com/docs/guides/auth/row-level-security
* Next.js: `NEXT_PUBLIC_` values are inlined into JavaScript sent to the browser:
  https://nextjs.org/docs/app/guides/environment-variables
