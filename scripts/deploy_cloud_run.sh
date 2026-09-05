#!/usr/bin/env bash
# Deploy SwiftCare API (+ optional static FE) to Cloud Run.
# Prerequisites: gcloud auth, Artifact Registry repo `swiftcare`, runtime SA, sql/09 applied.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

PROJECT="${GCP_PROJECT_ID:?Set GCP_PROJECT_ID}"
REGION="${GOOGLE_CLOUD_LOCATION:-us-central1}"
SERVICE="${CLOUD_RUN_SERVICE:-swiftcare-api}"
REPO="${ARTIFACT_REPO:-swiftcare}"
SA="${CLOUD_RUN_SA:-}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/${SERVICE}:$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo latest)"

echo "Building and pushing $IMAGE"
gcloud builds submit "$ROOT" --tag "$IMAGE" --project "$PROJECT"

ENV_VARS="GCP_PROJECT_ID=${PROJECT}"
ENV_VARS+=",GOOGLE_CLOUD_PROJECT=${PROJECT}"
ENV_VARS+=",GOOGLE_GENAI_USE_VERTEXAI=${GOOGLE_GENAI_USE_VERTEXAI:-TRUE}"
ENV_VARS+=",GOOGLE_CLOUD_LOCATION=${REGION}"
ENV_VARS+=",API_AUTH_BYPASS=false"
ENV_VARS+=",FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID:-$PROJECT}"
ENV_VARS+=",CORS_ORIGINS=${CORS_ORIGINS:-https://example.com}"
ENV_VARS+=",BQ_DATASET_OPS=${BQ_DATASET_OPS:-swiftcare_ops}"
ENV_VARS+=",LOG_QUERIES_TO_BQ=${LOG_QUERIES_TO_BQ:-TRUE}"
ENV_VARS+=",STATIC_FE_DIR=/app/frontend/dist"

DEPLOY_ARGS=(
  run deploy "$SERVICE"
  --image "$IMAGE"
  --region "$REGION"
  --platform managed
  --allow-unauthenticated
  --set-env-vars "$ENV_VARS"
  --project "$PROJECT"
)
if [[ -n "$SA" ]]; then
  DEPLOY_ARGS+=(--service-account "$SA")
fi

echo "Deploying $SERVICE"
gcloud "${DEPLOY_ARGS[@]}"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" --format='value(status.url)')"
echo ""
echo "Cloud Run URL: $URL"
echo "Health:        $URL/api/v1/health"
echo "Update README Public URL with: $URL"
