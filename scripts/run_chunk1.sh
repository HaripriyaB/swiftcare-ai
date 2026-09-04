#!/usr/bin/env bash
set -euo pipefail
PROJECT="${GCP_PROJECT_ID:-swiftcare-patchamomma}"
DIR="$(cd "$(dirname "$0")/.." && pwd)/sql"

run_sql() {
  echo "==> $1"
  bq query --use_legacy_sql=false --project_id="$PROJECT" < "$1"
}

run_sql "$DIR/01_create_datasets.sql"
run_sql "$DIR/02_ingest_cohort.sql"
run_sql "$DIR/03_analytics_etl.sql"
run_sql "$DIR/04_ops_tables.sql"
run_sql "$DIR/05_views.sql"
run_sql "$DIR/06_materialized_views.sql"
run_sql "$DIR/07_validation.sql"

echo "Chunk 1 deployment complete for project: $PROJECT"
