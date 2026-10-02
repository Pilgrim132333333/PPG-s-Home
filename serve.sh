#!/usr/bin/env bash
# Stable local preview entry point.
# Usage: ./serve.sh              # http://127.0.0.1:1313/
#        PORT=1414 ./serve.sh    # use another port

set -euo pipefail

preview_host="127.0.0.1"
preview_port="${PORT:-1313}"
preview_url="http://${preview_host}:${preview_port}/"

if ! [[ "${preview_port}" =~ ^[0-9]+$ ]] || (( preview_port < 1 || preview_port > 65535 )); then
  echo "Invalid PORT: ${preview_port}" >&2
  exit 2
fi

# Do not silently leave the browser connected to an old Hugo process. Killing
# every Hugo instance is unsafe, so report the exact listener and let the user
# stop it deliberately.
if command -v lsof >/dev/null 2>&1 && lsof -nP -iTCP:"${preview_port}" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port ${preview_port} is already in use:" >&2
  lsof -nP -iTCP:"${preview_port}" -sTCP:LISTEN >&2
  echo "Stop that process or run: PORT=1414 ./serve.sh" >&2
  exit 1
fi

echo "Starting Hugo development server at ${preview_url}"
exec hugo server \
  --environment development \
  --baseURL "${preview_url}" \
  --bind "${preview_host}" \
  --port "${preview_port}" \
  --appendPort=false \
  --buildDrafts \
  --disableFastRender \
  --noHTTPCache
