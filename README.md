# SwiftCare AI

**Patchamomma 2026** · Google Cloud

An agentic, retrieval-augmented clinical operations assistant that grounds natural-language queries against structured patient data, surfaces guardrailed care recommendations, and drives BigQuery-powered operational analytics for front-desk teams — orchestrated end-to-end on Google Cloud.

> Built as part of **[Patchamomma 2026](https://rsvp.withgoogle.com/events/patchamomma_2026)** — a Google Cloud initiative for women in tech to go from **concept → code → deployment** using Data, AI, multi-agent systems (ADK), and serverless Google Cloud services.

---

## Public URL

| Surface | URL | Status |
| ------- | --- | ------ |
| Live app (Cloud Run / FE) | `<!-- TODO: PUBLIC_APP_URL — fill after scripts/deploy_cloud_run.sh -->` | Pending deploy; see [final_chunk_7.md](private_docs/final_chunk_7.md) §B.7 |
| Demo video | `<!-- TODO: DEMO_VIDEO_URL -->` | Pending — script in [final_chunk_7.md](private_docs/final_chunk_7.md) §B.5 |
| Pitch deck | `<!-- TODO: PITCH_DECK_URL -->` | Pending — outline in [final_chunk_7.md](private_docs/final_chunk_7.md) §B.6 |
| Looker Studio dashboard | `<!-- TODO: LOOKER_STUDIO_URL -->` | Optional |
| Repo | `<!-- TODO: PUBLIC_REPO_URL -->` | — |

---

## Event

| | |
| --- | --- |
| Program | [Patchamomma 2026](https://rsvp.withgoogle.com/events/patchamomma_2026) |
| Organizer | Google Cloud |
| Focus | Data, AI / Generative AI, multi-agent systems (ADK), serverless (Cloud Run, Pub/Sub) |
| Journey | Knowledge transfer → **build & deploy** → pitch |
| Team / builder | `<!-- TODO: TEAM_NAME_AND_MEMBERS -->` |

Patchamomma is a structured build program (not a one-day hackathon): participants learn Google Cloud Data & AI services, then ship a production-minded multi-agent application. This repo is the **SwiftCare AI** submission for that build phase.

---

## One-liner

Front-desk and care-coordination staff ask plain English questions; three specialized Gemini agents — **Retrieval**, **Suggestion**, and **Insights** — answer from FHIR patient data in BigQuery, with clear guardrails so the system never diagnoses or prescribes.

---

## Architecture (high level)

```text
Front desk / care coord
        │
        ▼
   React FE  ──────────►  FastAPI (Cloud Run)     [Chunks 5–6]
        │                        │
        │              ADK Orchestrator
        │           ┌────────────┼────────────┐
        │           ▼            ▼            ▼
        │     Retrieval     Suggestion    Insights
        │     (chart Q&A)   (advisory     (population
        │                    cards)        risk alerts)
        │           │            │            │
        └───────────┴────────────┴────────────┘
                         │
                         ▼
              BigQuery (FHIR views + ops)
```

| Agent | Job | Writes |
| ----- | --- | ------ |
| **Retrieval** | Chart Q&A (meds, visits, timeline, vitals) | Ops logs only |
| **Suggestion** | Per-patient dismissible **advisory cards** | `swiftcare_ops.advisory_cards` |
| **Insights** | Population risk / care gaps / scheduling flags | `swiftcare_ops.insight_alerts` |

All clinical reads use **guarded, parameterized SQL** against allowlisted BigQuery views/cache — no free-form text-to-SQL. Shared patient name search lives in `agents/patient_lookup.py`.

---

## Tech stack

| Layer | Choice |
| ----- | ------ |
| AI / agents | Gemini + [Google ADK](https://google.github.io/adk-docs/) |
| Data | BigQuery (`bigquery-public-data.fhir_synthea` cohort) |
| Backend | Python 3.11+, FastAPI *(Chunk 6)* |
| Frontend | React *(Chunk 5)* |
| Auth | Firebase Authentication (identity only; data stays in BigQuery) |
| Deploy | Docker → Cloud Run *(Chunk 6)* |
| Analytics | Looker Studio (optional) |
| Build tools | Cursor / Antigravity-style agentic IDE workflows |

**Google Cloud services (in use):** Gemini API / Vertex AI, ADK, BigQuery, Looker Studio, Firebase Auth, Cloud Run.

---

## Current progress

| Chunk | Scope | Status |
| ----- | ----- | ------ |
| 1 | FHIR data foundation in BigQuery | Done |
| 2 | Retrieval agent | Done |
| 3 | Suggestion agent + advisory cards | Done |
| 4 | Insights agent + insight alerts | Done |
| 5 | Frontend | Done |
| 6 | Orchestrate agents + deploy Cloud Run | **Implemented** — [final_chunk_6.md](private_docs/final_chunk_6.md); run `./scripts/run_api.sh`, deploy `./scripts/deploy_cloud_run.sh` |
| 7 | Full test, polish, demos, docs | Done — [final_chunk_7.md](private_docs/final_chunk_7.md) |

Detailed build contracts: [`private_docs/`](private_docs/) (`final_chunk_1.md` … `final_chunk_7.md`, [`spec.md`](private_docs/spec.md)).

### Frontend (Chunk 5)

```bash
./scripts/run_frontend.sh
# or: cd frontend && cp .env.example .env && npm install && npm run dev
```

Opens http://127.0.0.1:5173 with MSW mocks (`VITE_AUTH_BYPASS=true`). Search **Kuhn**, open a patient, use Symptoms / Outcomes / Next steps tabs.

---

## Project setup

### Prerequisites

- Python **3.11+**
- Google Cloud project with BigQuery + Gemini / Vertex AI enabled
- [`gcloud`](https://cloud.google.com/sdk) CLI
- Application Default Credentials: `gcloud auth application-default login`

### 1. Clone & install

```bash
git clone <!-- TODO: PUBLIC_REPO_URL -->
cd patchamomma2026

python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — set GCP_PROJECT_ID / GOOGLE_CLOUD_PROJECT at minimum
```

Key variables (see [`.env.example`](.env.example)):

| Variable | Purpose |
| -------- | ------- |
| `GCP_PROJECT_ID` | BigQuery / GCP project |
| `GEMINI_MODEL` | Default `gemini-2.5-flash` |
| `GOOGLE_GENAI_USE_VERTEXAI` | `TRUE` for Vertex + ADC |
| `GOOGLE_CLOUD_LOCATION` | e.g. `us-central1` |

### 3. Load Chunk 1 data (BigQuery)

```bash
./scripts/run_chunk1.sh
```

Creates datasets (`swiftcare_fhir_*`, `swiftcare_agent_cache`, `swiftcare_ops`), loads a Synthea FHIR cohort, builds views/cache, and runs validation.

### 4. Run agents locally (ADK web)

| Agent | Command | Default port |
| ----- | ------- | ------------ |
| Retrieval | `./scripts/run_retrieval_agent.sh` | `8000` |
| Suggestion | `./scripts/run_suggestion_agent.sh` | `8001` |
| Insights | `./scripts/run_insights_agent.sh` | `8002` |

Open the ADK UI URL printed in the terminal (typically `http://127.0.0.1:<port>`).

Insights one-shot invoke:

```bash
python scripts/invoke_insights_agent.py "Which patients have care gaps? Top 5."
```

### 5. Tests

```bash
pytest tests/ -q
# Or per agent:
pytest tests/retrieval/ tests/suggestion/ tests/insights/ -q
```

### 6. API + Cloud Run (Chunk 6)

Build contract: [`private_docs/final_chunk_6.md`](private_docs/final_chunk_6.md).

```bash
# Apply symptoms ops table (once)
bq query --use_legacy_sql=false < sql/09_patient_symptoms.sql

# Local API
./scripts/run_api.sh
# → http://127.0.0.1:8080/api/v1/health

# Deploy (requires VITE_FIREBASE_* in root .env — see Firebase Auth below)
./scripts/deploy_cloud_run.sh
# Then set README Public URL + CORS_ORIGINS to the printed Cloud Run URL
```

### 7. Enable Firebase Authentication

Staff sign-in uses **Firebase Auth email/password**. The API verifies ID tokens with the Admin SDK; clinical data stays in BigQuery.

#### Console (one-time)

1. Open [Firebase Console](https://console.firebase.google.com/) → add/select project **`swiftcare-patchamomma`** (same as GCP).
2. **Build → Authentication → Get started → Sign-in method** → enable **Email/Password**.
3. **Project settings → Your apps → Add app → Web** → register e.g. `swiftcare-web`. Copy `apiKey`, `authDomain`, `projectId`, `appId`.
4. **Authentication → Users → Add user** → create a staff email/password.
5. Copy that user’s **User UID** for the access grant below.
6. (Cloud Run) **Authentication → Settings → Authorized domains** → add your Cloud Run host (e.g. `swiftcare-api-xxxxx-el.a.run.app`) after the first deploy.

#### Env files

Root `.env` (used by API + `deploy_cloud_run.sh`):

```bash
FIREBASE_PROJECT_ID=swiftcare-patchamomma
API_AUTH_BYPASS=false   # local live-token testing; Cloud Run always forces false
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=swiftcare-patchamomma.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=swiftcare-patchamomma
VITE_FIREBASE_APP_ID=1:...:web:...
# After deploy:
# CORS_ORIGINS=https://YOUR-SERVICE-XXXX.run.app
```

Local FE against a live API (`frontend/.env`):

```bash
VITE_AUTH_BYPASS=false
VITE_API_BASE_URL=http://127.0.0.1:8080/api
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=swiftcare-patchamomma
VITE_FIREBASE_APP_ID=...
VITE_DEMO_BANNER=false
```

Keep `VITE_AUTH_BYPASS=true` only for MSW offline demos.

#### Access grants (required outside local demo)

Valid Firebase login is not enough for charts/insights. Insert a grant for the staff UID:

```bash
# Edit sql/10_seed_access_grant.example.sql — replace YOUR_FIREBASE_UID
bq query --use_legacy_sql=false < sql/10_seed_access_grant.example.sql
```

#### Local live check

```bash
gcloud auth application-default login   # ADC for Firebase Admin verify
./scripts/run_api.sh                    # API_AUTH_BYPASS=false in .env
cd frontend && npm run dev              # VITE_AUTH_BYPASS=false
```

Sign in with the staff email/password → API calls send `Authorization: Bearer <Firebase ID token>`.

#### Cloud Run

`./scripts/deploy_cloud_run.sh` bakes `VITE_FIREBASE_*` into the FE image via `cloudbuild.yaml`, deploys Cloud Run (`API_AUTH_BYPASS=false`), and prints the public URL. Update `CORS_ORIGINS` and Firebase authorized domains to that host, then redeploy if needed.

### 8. Continuous deploy (GitHub → Cloud Build)

Repo remote: `https://github.com/HaripriyaB/swiftcare-ai.git`.  
Every push to `main` can rebuild the image and redeploy Cloud Run via a **Cloud Build trigger** (no GitHub Actions required).

#### A. One-time IAM (build SA used by the trigger)

Use the same SA as local deploys (`swiftcare-cloudrun@…`). It already builds; for deploy it also needs:

```bash
PROJECT=swiftcare-patchamomma
SA=swiftcare-cloudrun@${PROJECT}.iam.gserviceaccount.com

gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${SA}" \
  --role="roles/run.admin"

gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --member="serviceAccount:${SA}" \
  --role="roles/iam.serviceAccountUser" \
  --project="$PROJECT"
```

(`roles/artifactregistry.writer`, `roles/logging.logWriter`, and the logs-bucket writer binding from earlier stay as they are.)

#### B. Connect GitHub to Cloud Build

1. Open [Cloud Build → Triggers](https://console.cloud.google.com/cloud-build/triggers?project=swiftcare-patchamomma) (region **`asia-south1`** — same as your builds).
2. **Connect repository** → **GitHub (Cloud Build GitHub App)** → authenticate → select **`HaripriyaB/swiftcare-ai`**.
3. Approve the GitHub App install on that repo (or the org).

#### C. Create the push trigger

1. **Create trigger**
   - Name: `deploy-swiftcare-api`
   - Event: **Push to a branch**
   - Branch: `^main$` (or `^master$` if that is your default)
   - Configuration: **Cloud Build configuration file**
   - Location: `cloudbuild.yaml`
   - Region: `asia-south1`
   - Service account: `swiftcare-cloudrun@swiftcare-patchamomma.iam.gserviceaccount.com`
2. **Substitution variables** (same values as root `.env` — Firebase web config is client-side public):

| Variable | Example |
| -------- | ------- |
| `_IMAGE` | `asia-south1-docker.pkg.dev/swiftcare-patchamomma/swiftcare/swiftcare-api:$SHORT_SHA` |
| `_REGION` | `asia-south1` |
| `_SERVICE` | `swiftcare-api` |
| `_CLOUD_RUN_SA` | `swiftcare-cloudrun@swiftcare-patchamomma.iam.gserviceaccount.com` |
| `_CORS_ORIGINS` | your Cloud Run URL (after first deploy) |
| `_FIREBASE_PROJECT_ID` | `swiftcare-patchamomma` |
| `_VITE_FIREBASE_API_KEY` | from Firebase Console |
| `_VITE_FIREBASE_AUTH_DOMAIN` | `swiftcare-patchamomma.firebaseapp.com` |
| `_VITE_FIREBASE_PROJECT_ID` | `swiftcare-patchamomma` |
| `_VITE_FIREBASE_APP_ID` | from Firebase Console |

`$SHORT_SHA` is filled by Cloud Build for each commit.

3. Save → **Run** once manually to verify, then push to `main`.

#### D. Day-to-day

```bash
git push origin main
```

Cloud Build runs `cloudbuild.yaml` (build → push → `gcloud run deploy`). Watch progress under **Cloud Build → History**.

Manual deploys still work: `./scripts/deploy_cloud_run.sh` (same yaml).

---

## Repository layout

```text
patchamomma2026/
├── agents/                    # Chunks 2–4 ADK agents
├── api/                       # Chunk 6 FastAPI (per final_chunk_6.md)
├── frontend/                  # Chunk 5 React FE
├── sql/                       # Chunk 1 + sql/09_patient_symptoms.sql
├── scripts/                   # agents, run_api, deploy_cloud_run
├── tests/                     # agent + tests/api
├── private_docs/              # Spec + final_chunk_1…7
├── Dockerfile                 # Chunk 6
├── cloudbuild.yaml            # FE Firebase build-args for Cloud Build
├── pyproject.toml
├── .env.example
└── README.md
```

---

## Demo script

Full timed script + pitch outline: [`private_docs/final_chunk_7.md`](private_docs/final_chunk_7.md) (§B.5–B.6). Condensed walkthrough:

1. Open **Insights** → care gaps (top 5) → optional dismiss alert
2. **Home** → search *Kuhn* → open patient → scan meds / visits
3. **Next steps** → show disclaimer → dismiss one advisory card
4. **Chat** → meds question; then refuse “diagnose and prescribe”
5. Show **Cloud Run** URL / architecture one-liner (warm `GET /api/v1/health` first)

---

## Safety & guardrails

- Agents **do not** diagnose, prescribe, or issue clinical orders.
- Suggestion cards and Insights alerts are **dismissible operational** layers with explicit disclaimers.
- BigQuery access is via **fixed SQL templates** + parameter binding only.
- Clinical data stays in **BigQuery** (no Firestore clinical store).

---

## License / credits

| | |
| --- | --- |
| Program | [Patchamomma 2026](https://rsvp.withgoogle.com/events/patchamomma_2026) |
| Data | [BigQuery public FHIR Synthea](https://console.cloud.google.com/marketplace/product/bigquery-public-data/fhir_synthea) (synthetic — not real patients) |
| License | `<!-- TODO: LICENSE -->` |
| Acknowledgments | `<!-- TODO: MENTORS_AND_THANKS -->` |

---

## Contact

| | |
| --- | --- |
| Maintainer | `<!-- TODO: MAINTAINER_NAME_EMAIL -->` |
| LinkedIn / social | `<!-- TODO: SOCIAL_LINKS -->` |
| Issue tracker | `<!-- TODO: ISSUES_URL -->` |
