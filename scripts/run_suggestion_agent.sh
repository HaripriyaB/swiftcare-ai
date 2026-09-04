#!/usr/bin/env bash
# Start the SwiftCare Suggestion Agent via ADK web UI.
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
export AGENT_TYPE="${AGENT_TYPE:-suggestion}"
export AGENT_NAME="${AGENT_NAME:-swiftcare_suggestion_agent}"
export LOG_QUERIES_TO_BQ="${LOG_QUERIES_TO_BQ:-TRUE}"
export MAX_CARDS_PER_TURN="${MAX_CARDS_PER_TURN:-5}"
export MAX_VISIT_LOOKBACK="${MAX_VISIT_LOOKBACK:-20}"
export POLYPHARMACY_MED_THRESHOLD="${POLYPHARMACY_MED_THRESHOLD:-5}"
export FOLLOW_UP_GAP_DAYS="${FOLLOW_UP_GAP_DAYS:-180}"
export CARD_DEFAULT_SEVERITY="${CARD_DEFAULT_SEVERITY:-info}"
export DEDUPE_OPEN_CARDS="${DEDUPE_OPEN_CARDS:-TRUE}"
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
echo "Agent:    agents.suggestion"
echo "Starting adk web ..."

exec "$ADK_BIN" web --port "${ADK_PORT:-8001}" agents
