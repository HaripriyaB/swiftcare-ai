#!/usr/bin/env bash
# Start the SwiftCare Retrieval Agent via ADK web UI.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

export GCP_PROJECT_ID="${GCP_PROJECT_ID:-swiftcare-patchamomma}"
export GOOGLE_CLOUD_PROJECT="${GOOGLE_CLOUD_PROJECT:-$GCP_PROJECT_ID}"
export GEMINI_MODEL="${GEMINI_MODEL:-gemini-2.5-flash}"
export AGENT_NAME="${AGENT_NAME:-swiftcare_retrieval_agent}"
export LOG_QUERIES_TO_BQ="${LOG_QUERIES_TO_BQ:-TRUE}"
export PYTHONPATH="${ROOT}${PYTHONPATH:+:$PYTHONPATH}"

# Prefer project venv so `adk` / deps resolve without manual activate
if [[ -x "${ROOT}/.venv/bin/adk" ]]; then
  ADK_BIN="${ROOT}/.venv/bin/adk"
elif command -v adk >/dev/null 2>&1; then
  ADK_BIN="$(command -v adk)"
else
  echo "error: adk not found. Activate the venv or run: pip install -e '.[dev]'" >&2
  exit 1
fi

echo "Project:  $GCP_PROJECT_ID"
echo "Model:    $GEMINI_MODEL"
echo "Agent:    agents.retrieval"
echo "Starting adk web ..."

exec "$ADK_BIN" web --port "${ADK_PORT:-8000}" agents
