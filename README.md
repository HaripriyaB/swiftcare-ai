# SwiftCare AI

SwiftCare AI is a deployed clinical-operations demo for front-desk and care-coordination workflows. It combines a React interface, a FastAPI service, Gemini agents, and BigQuery-backed patient and workflow data.

This project was built for **Patchamomma 2026**. It uses synthetic data only and is not a clinical decision-making system.

## Live application

- App: [swiftcare-api-841404088974.asia-south1.run.app](https://swiftcare-api-841404088974.asia-south1.run.app/)
- Health check: [API health](https://swiftcare-api-841404088974.asia-south1.run.app/api/v1/health)
- Source: [github.com/HaripriyaB/swiftcare-ai](https://github.com/HaripriyaB/swiftcare-ai)

Demo video and pitch-deck links have not been published yet.

## What it does

- Searches patient records and displays chart summaries, conditions, medications, allergies, visits, timelines, and vitals.
- Provides three Gemini-powered agents for grounded patient retrieval, advisory-card suggestions, and population insights.
- Shows a Care Dashboard with risk and care-gap signals.
- Supports an Attention Queue: staff can start, complete, or dismiss operational work items.
- Records those actions in Work History.
- Uses Firebase Authentication for staff identity; BigQuery access grants are available when stricter authorization is enabled.

The application does not diagnose, prescribe, or create clinical orders.

## Data and persistence

The deployed clinical dataset is a 5,000-patient synthetic FHIR cohort copied from the Google BigQuery public dataset [`bigquery-public-data.fhir_synthea`](https://console.cloud.google.com/marketplace/product/bigquery-public-data/fhir_synthea). It is not a locally generated Synthea export and contains no real patient data.

```text
BigQuery public Synthea FHIR cohort
                │
                ▼
SwiftCare raw → analytics → guarded clinical views
                │
                ├── Patient search, charts, agents, and dashboard reads
                │
                ▼
SwiftCare operational tables
  ├── Attention Queue
  ├── Advisory cards and insight alerts
  ├── Sessions, access grants, and audit records
  └── Work History
```

BigQuery is the runtime source of truth.

- Clinical reads use allowlisted `swiftcare_fhir_views` and supporting analytics/cache datasets.
- The application writes workflow data to `swiftcare_ops`.
- Starting, completing, or dismissing a queue card updates `continuity_cards` and records an event in `continuity_action_events`.
- Symptoms, alerts, advisory cards, access grants, and audit records are also stored in `swiftcare_ops`.
- Clinical source tables are not modified by application workflows.

The repository includes a fixture-based local demo adapter, but it only runs when `LOCAL_DEMO_MODE=true`. It is disabled in the deployed Cloud Run service.

## Architecture

```text
React frontend
    │ Firebase ID token
    ▼
FastAPI on Cloud Run
    │
    ├── Firebase Admin token verification
    ├── Google ADK orchestration with Gemini on Vertex AI
    └── Parameterized BigQuery queries and workflow writes
                 │
                 ▼
        BigQuery clinical views + operational tables
```

## Technology

| Area | Implementation |
| --- | --- |
| AI | Gemini 2.5 Flash through Vertex AI and Google ADK |
| Clinical data | BigQuery public Synthea FHIR cohort |
| Application data | BigQuery `swiftcare_ops` tables |
| API | Python, FastAPI, Uvicorn |
| Frontend | React and Vite |
| Authentication | Firebase Authentication and Firebase Admin SDK |
| Deployment | Docker, Cloud Build, Artifact Registry, and Cloud Run |
| Configuration | Secret Manager for Firebase web-build configuration |
| Build logs | Cloud Storage |

## Deployed environment

| Item | Value |
| --- | --- |
| Google Cloud project | `swiftcare-patchamomma` |
| Region | `asia-south1` |
| Cloud Run service | `swiftcare-api` |
| Container registry | `asia-south1-docker.pkg.dev/swiftcare-patchamomma/swiftcare/swiftcare-api` |
| Runtime service account | `swiftcare-cloudrun@swiftcare-patchamomma.iam.gserviceaccount.com` |

## Run locally

### Requirements

- Python 3.11+
- Node.js 22+
- A Google Cloud project with BigQuery, Vertex AI, Cloud Run, Cloud Build, Artifact Registry, Secret Manager, Firebase/Identity Toolkit, and Cloud Storage enabled
- Authenticated `gcloud` and Application Default Credentials for Google Cloud access

### Install

```bash
git clone https://github.com/HaripriyaB/swiftcare-ai.git
cd swiftcare-ai

python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

cp .env.example .env
cp frontend/.env.example frontend/.env
```

Configure the copied environment files before running against Google Cloud. In particular, set the GCP project, Firebase configuration, Cloud Run service account, and Vertex AI settings. Do not commit `.env` files.

### Load demo data into a new BigQuery project

`run_chunk1.sh` creates or replaces the raw cohort tables. Use it only for a new/demo environment.

```bash
./scripts/run_chunk1.sh
bq query --use_legacy_sql=false < sql/09_patient_symptoms.sql
bq query --use_legacy_sql=false < sql/11_continuity_queue.sql
```

The final command creates the queue and work-history tables and idempotently seeds queue cards from the risk view.

### Start the application

```bash
./scripts/run_api.sh
cd frontend && npm install && npm run dev
```

For the local fixture-only experience, enable the documented local-demo settings in the environment templates. Never enable `LOCAL_DEMO_MODE` for a deployed service.

## Deploy

The deployment script builds the React and FastAPI container, pushes it to Artifact Registry, and deploys it to Cloud Run.

```bash
./scripts/deploy_cloud_run.sh
```

The script requires the Cloud Run service account and Firebase web configuration. `cloudbuild.yaml` retrieves Firebase build values from Secret Manager and deploys with `API_AUTH_BYPASS=false`.

## Authentication and authorization

- Firebase supplies the staff identity token, and FastAPI verifies it with Firebase Admin.
- Authentication bypass is for local development only; Cloud Run disables it.
- This synthetic demo defaults to authenticated open access (`SWIFTCARE_DEMO_OPEN_ACCESS=true`) so users can explore the cohort without pre-provisioned grants.
- For a restricted deployment, set `SWIFTCARE_DEMO_OPEN_ACCESS=false`. BigQuery table `swiftcare_ops.patient_access_grants` then controls population and patient-chart access.
- In that restricted mode, `can_write = TRUE` is required for mutations such as symptoms and operational cards.

## Tests

```bash
pytest -q
```

## Repository layout

```text
agents/       Google ADK retrieval, suggestion, and insights agents
api/          FastAPI routes, authorization, orchestration, and BigQuery access
frontend/     React application
sql/          BigQuery datasets, ingestion, transformations, views, and workflow tables
scripts/      Local-run, data-load, agent-run, and deployment scripts
tests/        API and agent tests
```

## Safety

- All patient data in this demo is synthetic.
- The agents return grounded information and operational support only.
- Agents do not diagnose, prescribe, or issue clinical orders.
- BigQuery access uses fixed, parameterized SQL rather than free-form text-to-SQL.
- Firebase is used for identity; clinical data is not stored in Firestore.
