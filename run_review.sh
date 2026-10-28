#!/usr/bin/env bash
# One command: scan both repos, marker-key build check, real-browser check, scanner tests, report data.
set -euo pipefail
cd "$(dirname "$0")"
export NODE_PATH="${NODE_PATH:-$(npm root -g)}" NEXT_TELEMETRY_DISABLED=1
(cd demo-app && npm install --no-audit --no-fund --loglevel=error)
[ -e demo-app-fixed/node_modules ] || ln -s ../demo-app/node_modules demo-app-fixed/node_modules
(cd demo-app && npx next build >/dev/null) && (cd demo-app-fixed && npx next build >/dev/null)
mkdir -p review/out
node review/scan.mjs demo-app --json review/out/scan-before.json | tail -1
node review/scan.mjs demo-app-fixed --json review/out/scan-after.json | tail -1
node review/bundle-check.mjs demo-app --json review/out/bundle-before.json
node review/bundle-check.mjs demo-app-fixed --json review/out/bundle-after.json
node review/runtime.mjs demo-app demo-app-fixed --json review/out/runtime.json --shots review/out/shots
node --test review/test/*.test.mjs 2>&1 | grep -E "^# (tests|pass|fail)"
node review/build_report.mjs
