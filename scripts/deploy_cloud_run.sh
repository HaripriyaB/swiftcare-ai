#!/usr/bin/env bash
# Deploy SwiftCare API (+ optional static FE) to Cloud Run.
# Prerequisites: gcloud auth, Artifact Registry repo `swiftcare`, runtime SA, sql/09 applied.
# Push-to-redeploy: see README "Continuous deploy (GitHub → Cloud Build)".
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
SA="${CLOUD_RUN_SA:?Set CLOUD_RUN_SA (runtime + build service account email)}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/${SERVICE}:$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo latest)"

BUILD_LOGS_BUCKET="${BUILD_LOGS_BUCKET:-gs://${PROJECT}-build-logs}"

# Firebase web config is public (domain-restricted) but must be baked into the
# FE at image build time — Vite inlines VITE_* at `npm run build`.
: "${VITE_FIREBASE_API_KEY:?Set VITE_FIREBASE_API_KEY in .env (Firebase Console → Project settings → Your apps)}"
: "${VITE_FIREBASE_AUTH_DOMAIN:?Set VITE_FIREBASE_AUTH_DOMAIN in .env}"
: "${VITE_FIREBASE_PROJECT_ID:?Set VITE_FIREBASE_PROJECT_ID in .env}"
: "${VITE_FIREBASE_APP_ID:?Set VITE_FIREBASE_APP_ID in .env}"

SUBSTITUTIONS="_IMAGE=${IMAGE}"
SUBSTITUTIONS+=",_REGION=${REGION}"
SUBSTITUTIONS+=",_SERVICE=${SERVICE}"
SUBSTITUTIONS+=",_CLOUD_RUN_SA=${SA}"
SUBSTITUTIONS+=",_CORS_ORIGINS=${CORS_ORIGINS:-https://example.com}"
SUBSTITUTIONS+=",_FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID:-$PROJECT}"
SUBSTITUTIONS+=",_BQ_DATASET_OPS=${BQ_DATASET_OPS:-swiftcare_ops}"
SUBSTITUTIONS+=",_LOG_QUERIES_TO_BQ=${LOG_QUERIES_TO_BQ:-TRUE}"
SUBSTITUTIONS+=",_GOOGLE_GENAI_USE_VERTEXAI=${GOOGLE_GENAI_USE_VERTEXAI:-TRUE}"
SUBSTITUTIONS+=",_VITE_API_BASE_URL=${VITE_API_BASE_URL:-/api}"
SUBSTITUTIONS+=",_VITE_AUTH_BYPASS=false"
SUBSTITUTIONS+=",_VITE_DEMO_BANNER=${VITE_DEMO_BANNER:-false}"
SUBSTITUTIONS+=",_VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY}"
SUBSTITUTIONS+=",_VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN}"
SUBSTITUTIONS+=",_VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID}"
SUBSTITUTIONS+=",_VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID}"

# Cloud Build wants a fully qualified resource name for --service-account.
BUILD_SA="$SA"
if [[ "$BUILD_SA" != projects/* ]]; then
  BUILD_SA="projects/${PROJECT}/serviceAccounts/${SA}"
fi

echo "Building, pushing, and deploying $IMAGE using service account $SA"
gcloud builds submit "$ROOT" \
  --config "$ROOT/cloudbuild.yaml" \
  --substitutions "$SUBSTITUTIONS" \
  --project "$PROJECT" \
  --region "$REGION" \
  --service-account "$BUILD_SA" \
  --gcs-log-dir "$BUILD_LOGS_BUCKET"

URL="$(gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" --format='value(status.url)')"
echo ""
echo "Cloud Run URL: $URL"
echo "Health:        $URL/api/v1/health"
echo "Update README Public URL with: $URL"
