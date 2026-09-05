#!/usr/bin/env bash
# Start SwiftCare FastAPI locally (Chunk 6).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

export PYTHONPATH="$ROOT${PYTHONPATH:+:$PYTHONPATH}"
export API_AUTH_BYPASS="${API_AUTH_BYPASS:-true}"

# Prefer project venv so uvicorn resolves without manual activate
if [[ -x "${ROOT}/.venv/bin/python" ]]; then
  PYTHON_BIN="${ROOT}/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
else
  echo "error: python3 not found. Create a venv and run: pip install -e '.[dev]'" >&2
  exit 1
fi

if ! "$PYTHON_BIN" -c "import uvicorn" 2>/dev/null; then
  echo "error: uvicorn not installed for $PYTHON_BIN" >&2
  echo "  Fix: source .venv/bin/activate && pip install -e '.[dev]'" >&2
  exit 1
fi

HOST="${API_HOST:-127.0.0.1}"
PORT="${API_PORT:-8080}"
echo "API:  http://${HOST}:${PORT}/api/v1/health"
echo "Docs: http://${HOST}:${PORT}/docs"

exec "$PYTHON_BIN" -m uvicorn api.main:app --host "$HOST" --port "$PORT" --reload
