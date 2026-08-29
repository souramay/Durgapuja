#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
echo "Sharodiya -> http://localhost:3000  (Ctrl+C to stop)"
if command -v python3 >/dev/null 2>&1; then exec python3 -m http.server 3000; fi
if command -v python  >/dev/null 2>&1; then exec python  -m http.server 3000; fi
if command -v node    >/dev/null 2>&1; then exec npx --yes serve@14 . -l 3000; fi
echo "Need Python or Node."; exit 1
