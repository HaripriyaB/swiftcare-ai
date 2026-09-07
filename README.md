# SwiftCare AI

**Patchamomma 2026** · Google Cloud

An agentic, retrieval-augmented clinical operations assistant that grounds natural-language queries against structured patient data, surfaces guardrailed care recommendations, and drives BigQuery-powered operational analytics for front-desk teams — orchestrated end-to-end on Google Cloud.

> Built as part of **[Patchamomma 2026](https://rsvp.withgoogle.com/events/patchamomma_2026)** — a Google Cloud initiative for women in tech to go from **concept → code → deployment** using Data, AI, multi-agent systems (ADK), and serverless Google Cloud services.

---

## Public URL

| Surface | URL | Status |
| ------- | --- | ------ |
| Live app (Cloud Run / FE) | `<!-- TODO: PUBLIC_APP_URL — fill after deploy -->` | Pending; printed by `./scripts/deploy_cloud_run.sh` or Cloud Build |
| Health check | `https://<Cloud-Run-URL>/api/v1/health` | Unauthenticated |
| Demo video | `<!-- TODO: DEMO_VIDEO_URL -->` | Pending — script in [final_chunk_7.md](private_docs/final_chunk_7.md) §B.5 |
| Pitch deck | `<!-- TODO: PITCH_DECK_URL -->` | Pending — outline in [final_chunk_7.md](private_docs/final_chunk_7.md) §B.6 |
| Looker Studio dashboard | `<!-- TODO: LOOKER_STUDIO_URL -->` | Optional |
| Repo | [github.com/HaripriyaB/swiftcare-ai](https://github.com/HaripriyaB/swiftcare-ai) | Connected to Cloud Build trigger |

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
   React FE  ── Firebase Auth (email/password ID token) ──►  FastAPI (Cloud Run)
        │                                                         │
        │                                               ADK Orchestrator
        │                                            ┌────────────┼────────────┐
        │                                            ▼            ▼            ▼
        │                                      Retrieval     Suggestion    Insights
        │                                      (chart Q&A)   (advisory     (population
        │                                                     cards)        risk alerts)
        │                                            │            │            │
        └────────────────────────────────────────────┴────────────┴────────────┘
                                                              │
                                                              ▼
                                                   BigQuery (FHIR views + ops)
                                                   + patient_access_grants
```

| Agent | Job | Writes |
| ----- | --- | ------ |
| **Retrieval** | Chart Q&A (meds, visits, timeline, vitals) | Ops logs only |
| **Suggestion** | Per-patient dismissible **advisory cards** | `swiftcare_ops.advisory_cards` |
| **Insights** | Population risk / care gaps / scheduling flags | `swiftcare_ops.insight_alerts` |

All clinical reads use **guarded, parameterized SQL** against allowlisted BigQuery views/cache — no free-form text-to-SQL. Shared patient name search lives in `agents/patient_lookup.py`.

**Auth model:** Firebase Authentication issues identity only. FastAPI verifies the Bearer ID token (`api/auth.py`). Patient/population authorization is a separate BigQuery table (`swiftcare_ops.patient_access_grants`). Clinical data never lives in Firestore.

---

## Deployment targets (this project)

| Item | Value |
| ---- | ----- |
| GCP project | `swiftcare-patchamomma` |
| Region | `asia-south1` |
| Cloud Run service | `swiftcare-api` |
| Artifact Registry | `asia-south1-docker.pkg.dev/swiftcare-patchamomma/swiftcare/swiftcare-api` |
| Runtime / build SA | `swiftcare-cloudrun@swiftcare-patchamomma.iam.gserviceaccount.com` |
| Cloud Build logs bucket | `gs://swiftcare-patchamomma-build-logs` |
| GitHub repo | [HaripriyaB/swiftcare-ai](https://github.com/HaripriyaB/swiftcare-ai) |
| Trigger | `SwiftCare-Github-Deploy` (push to `main`, region `asia-south1`) |

GCP console login (e.g. Gmail) and the GitHub account that owns the repo **do not need to be the same**. See [§8 Continuous deploy](#8-continuous-deploy-github--cloud-build).

---

## Tech stack

| Layer | Choice |
| ----- | ------ |
| AI / agents | Gemini + [Google ADK](https://google.github.io/adk-docs/) |
| Data | BigQuery (`bigquery-public-data.fhir_synthea` cohort) |
| Backend | Python 3.11+, FastAPI |
| Frontend | React + Vite |
| Auth | Firebase Authentication (email/password; identity only) |
| Deploy | Docker → Artifact Registry → Cloud Run |
| CI/CD | Cloud Build (`cloudbuild.yaml`) on GitHub push to `main` |
| Analytics | Looker Studio (optional) |

**Google Cloud services in use:** Vertex AI / Gemini, ADK, BigQuery, Firebase Auth, Artifact Registry, Cloud Build, Cloud Run, Cloud Storage (build logs).

---

## Current progress

| Chunk | Scope | Status |
| ----- | ----- | ------ |
| 1 | FHIR data foundation in BigQuery | Done |
| 2 | Retrieval agent | Done |
| 3 | Suggestion agent + advisory cards | Done |
| 4 | Insights agent + insight alerts | Done |
| 5 | Frontend | Done |
| 6 | Orchestrate agents + deploy Cloud Run | Done — `./scripts/run_api.sh`, `./scripts/deploy_cloud_run.sh` |
| 7 | Full test, polish, demos, docs | Done — [final_chunk_7.md](private_docs/final_chunk_7.md) |

Detailed build contracts: [`private_docs/`](private_docs/) (`final_chunk_1.md` … `final_chunk_7.md`, [`spec.md`](private_docs/spec.md)).

### Frontend (Chunk 5) — local MSW demo

```bash
./scripts/run_frontend.sh
# or: cd frontend && cp .env.example .env && npm install && npm run dev
```

Opens http://127.0.0.1:5173 with MSW mocks (`VITE_AUTH_BYPASS=true`). Search **Kuhn**, open a patient, use Symptoms / Outcomes / Next steps tabs.

---

## Project setup

### Prerequisites

- Python **3.11+**
- Node **22+** (frontend)
- Google Cloud project with APIs enabled: BigQuery, Vertex AI, Cloud Run, Cloud Build, Artifact Registry, Firebase / Identity Toolkit
- [`gcloud`](https://cloud.google.com/sdk) CLI authenticated as a project Owner/Editor
- Application Default Credentials: `gcloud auth application-default login`

### 1. Clone & install

```bash
git clone https://github.com/HaripriyaB/swiftcare-ai.git
cd swiftcare-ai   # or patchamomma2026 locally

python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — see tables below
cp frontend/.env.example frontend/.env
```

#### Root `.env` (API, agents, deploy)

| Variable | Purpose |
| -------- | ------- |
| `GCP_PROJECT_ID` / `GOOGLE_CLOUD_PROJECT` | `swiftcare-patchamomma` |
| `GOOGLE_CLOUD_LOCATION` | `asia-south1` (must match AR, Cloud Run, Cloud Build) |
| `GOOGLE_GENAI_USE_VERTEXAI` | `TRUE` for Vertex + ADC |
| `GEMINI_MODEL` | Default `gemini-2.5-flash` |
| `CLOUD_RUN_SA` | `swiftcare-cloudrun@swiftcare-patchamomma.iam.gserviceaccount.com` |
| `CLOUD_RUN_SERVICE` | `swiftcare-api` (optional) |
| `BUILD_LOGS_BUCKET` | `gs://swiftcare-patchamomma-build-logs` (optional; script default) |
| `API_AUTH_BYPASS` | `true` only for local MSW/bypass; Cloud Run always `false` |
| `FIREBASE_PROJECT_ID` | Same as GCP / Firebase project |
| `VITE_FIREBASE_*` | Web app config — **required for image builds** (baked into FE) |
| `CORS_ORIGINS` | Local FE origins, then Cloud Run URL after first deploy |

#### Frontend `frontend/.env`

| Mode | Key settings |
| ---- | ------------ |
| MSW offline demo | `VITE_AUTH_BYPASS=true`, `VITE_API_BASE_URL=/api` |
| Live local API | `VITE_AUTH_BYPASS=false`, `VITE_API_BASE_URL=http://127.0.0.1:8080/api`, real `VITE_FIREBASE_*` |
| Cloud Run | Served from the same container; Firebase config baked at **image build** time |

Full templates: [`.env.example`](.env.example), [`frontend/.env.example`](frontend/.env.example).

### 3. Load Chunk 1 data (BigQuery)

```bash
./scripts/run_chunk1.sh
```

Creates datasets (`swiftcare_fhir_*`, `swiftcare_agent_cache`, `swiftcare_ops`), loads a Synthea FHIR cohort, builds views/cache, and runs validation.

Also apply (once):

```bash
bq query --use_legacy_sql=false < sql/09_patient_symptoms.sql
```

### 4. Run agents locally (ADK web)

| Agent | Command | Default port |
| ----- | ------- | ------------ |
| Retrieval | `./scripts/run_retrieval_agent.sh` | `8000` |
| Suggestion | `./scripts/run_suggestion_agent.sh` | `8001` |
| Insights | `./scripts/run_insights_agent.sh` | `8002` |

Open the ADK UI URL printed in the terminal (typically `http://127.0.0.1:<port>`).

```bash
python scripts/invoke_insights_agent.py "Which patients have care gaps? Top 5."
```

### 5. Tests

```bash
pytest tests/ -q
pytest tests/retrieval/ tests/suggestion/ tests/insights/ tests/api/ -q
```

### 6. API + Cloud Run (manual deploy)

Build contract: [`private_docs/final_chunk_6.md`](private_docs/final_chunk_6.md).

```bash
# Local API
./scripts/run_api.sh
# → http://127.0.0.1:8080/api/v1/health

# One-shot build + deploy (requires VITE_FIREBASE_* and CLOUD_RUN_SA in .env)
./scripts/deploy_cloud_run.sh
# Prints:
#   Cloud Run URL: https://swiftcare-api-….run.app
#   Health:        https://…/api/v1/health
```

`deploy_cloud_run.sh` runs `gcloud builds submit` with [`cloudbuild.yaml`](cloudbuild.yaml), which:

1. Builds the multi-stage Docker image (React FE + FastAPI)
2. Pushes to Artifact Registry
3. Deploys Cloud Run with `API_AUTH_BYPASS=false` and `FIREBASE_PROJECT_ID` set

After the first successful deploy:

1. Paste the URL into this README’s **Public URL** table
2. Set `CORS_ORIGINS` in `.env` (and on the Cloud Build trigger) to that URL
3. Add the Cloud Run hostname under Firebase **Authorized domains**
4. Redeploy once so CORS + FE config pick up the final URL if needed

### 7. Enable Firebase Authentication

Staff sign-in uses **Firebase Auth email/password**. The FE attaches `Authorization: Bearer <ID token>`; the API verifies with Firebase Admin (`api/auth.py`). Clinical data stays in BigQuery.

#### Console (one-time)

1. Open [Firebase Console](https://console.firebase.google.com/) → project **`swiftcare-patchamomma`** (same as GCP).
2. **Build → Authentication → Get started → Sign-in method** → enable **Email/Password**.
3. **Project settings → Your apps → Add app → Web** → register e.g. `swiftcare-web`. Copy `apiKey`, `authDomain`, `projectId`, `appId`.
4. **Authentication → Users → Add user** → create a staff email/password.
5. Copy that user’s **User UID** for the access grant below.
6. After Cloud Run exists: **Authentication → Settings → Authorized domains** → add the Cloud Run host (e.g. `swiftcare-api-xxxxx-el.a.run.app`).

#### Env (root `.env`)

```bash
FIREBASE_PROJECT_ID=swiftcare-patchamomma
API_AUTH_BYPASS=false   # for local live-token testing; Cloud Run always forces false
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=swiftcare-patchamomma.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=swiftcare-patchamomma
VITE_FIREBASE_APP_ID=1:...:web:...
# After deploy:
# CORS_ORIGINS=https://YOUR-SERVICE-XXXX.run.app
```

#### Local FE against live API (`frontend/.env`)

```bash
VITE_AUTH_BYPASS=false
VITE_API_BASE_URL=http://127.0.0.1:8080/api
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=swiftcare-patchamomma.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=swiftcare-patchamomma
VITE_FIREBASE_APP_ID=...
VITE_DEMO_BANNER=false
```

Keep `VITE_AUTH_BYPASS=true` only for MSW offline demos.

#### Access grants (required outside `LOCAL_DEMO_MODE`)

A valid Firebase login is **not** enough for charts/insights. Insert a grant for the staff UID:

```bash
# Edit sql/10_seed_access_grant.example.sql — replace YOUR_FIREBASE_UID
bq query --use_legacy_sql=false < sql/10_seed_access_grant.example.sql
```

- `patient_id = NULL` → population (insights / at-risk lists)
- concrete `patient_id` → that chart only
- `can_write = TRUE` → mutations (symptoms, dismiss cards, etc.)

#### Local live check

```bash
gcloud auth application-default login   # ADC for Firebase Admin verify
# .env: API_AUTH_BYPASS=false, FIREBASE_PROJECT_ID set
./scripts/run_api.sh
cd frontend && npm run dev              # VITE_AUTH_BYPASS=false + VITE_FIREBASE_*
```

Sign in with the staff email/password → API calls send `Authorization: Bearer <Firebase ID token>`.

If Admin SDK cannot initialize, the API returns **503** `auth_unavailable` (not a vague 401).

### 8. Continuous deploy (GitHub → Cloud Build)

Every push to **`main`** on [HaripriyaB/swiftcare-ai](https://github.com/HaripriyaB/swiftcare-ai) can rebuild and redeploy via Cloud Build trigger **`SwiftCare-Github-Deploy`**.

Pipeline ([`cloudbuild.yaml`](cloudbuild.yaml)):

1. `docker build` (bakes `VITE_FIREBASE_*` into the FE)
2. `docker push` to Artifact Registry
3. `gcloud run deploy swiftcare-api`

Logs go to **`gs://swiftcare-patchamomma-build-logs`** (`logsBucket` in `cloudbuild.yaml`). This is **required** because the trigger uses a user-specified service account.

#### Different Gmail vs GitHub accounts

| Side | Account | Role |
| ---- | ------- | ---- |
| Google Cloud | Your Gmail (e.g. project Owner) | Creates/edits the trigger, views builds |
| GitHub | Account that owns `HaripriyaB/swiftcare-ai` | Installs the **Cloud Build GitHub App** on that repo |

They do **not** need to be the same person or email:

1. Stay logged into **GCP** as Gmail.
2. [Cloud Build → Triggers](https://console.cloud.google.com/cloud-build/triggers?project=swiftcare-patchamomma) → region **`asia-south1`**.
3. **Connect repository** → **GitHub (Cloud Build GitHub App)**.
4. In the GitHub popup, sign in as **`HaripriyaB`** (repo owner/admin), not Gmail.
5. Install/authorize the app on `swiftcare-ai` (or the whole user/org).
6. Back in GCP, select the repo and finish the trigger.

If you are not the GitHub owner: get Admin collaborator access, or ask the owner to install the app once.

#### One-time IAM (build/deploy SA)

```bash
PROJECT=swiftcare-patchamomma
SA=swiftcare-cloudrun@${PROJECT}.iam.gserviceaccount.com

# Deploy Cloud Run
gcloud projects add-iam-policy-binding "$PROJECT" \
  --member="serviceAccount:${SA}" \
  --role="roles/run.admin"

# Allow the SA to act as itself on Cloud Run
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --member="serviceAccount:${SA}" \
  --role="roles/iam.serviceAccountUser" \
  --project="$PROJECT"
```

Also ensure (usually already present for this project):

| Role / binding | Why |
| -------------- | --- |
| `roles/artifactregistry.writer` | Push images |
| `roles/logging.logWriter` | Build logs to Cloud Logging |
| `roles/storage.objectAdmin` (or legacy writer on the logs bucket) | Read/write log objects |
| Bucket IAM `roles/storage.legacyBucketWriter` on `gs://swiftcare-patchamomma-build-logs` | `storage.buckets.get` + write objects (Cloud Build validates bucket access) |
| Vertex / BigQuery roles as needed at runtime | Agents + ops tables |

Create the logs bucket once if missing:

```bash
gcloud storage buckets create gs://swiftcare-patchamomma-build-logs \
  --project=swiftcare-patchamomma \
  --location=asia-south1 \
  --uniform-bucket-level-access

gcloud storage buckets add-iam-policy-binding gs://swiftcare-patchamomma-build-logs \
  --member="serviceAccount:swiftcare-cloudrun@swiftcare-patchamomma.iam.gserviceaccount.com" \
  --role="roles/storage.legacyBucketWriter" \
  --project=swiftcare-patchamomma
```

#### Create / edit the push trigger

1. [Cloud Build → Triggers](https://console.cloud.google.com/cloud-build/triggers?project=swiftcare-patchamomma) → region **`asia-south1`**
2. **Create trigger** (or edit `SwiftCare-Github-Deploy`):
   - Event: **Push to a branch**
   - Branch: `^main$`
   - Config: `cloudbuild.yaml` (repo root)
   - Service account: `swiftcare-cloudrun@swiftcare-patchamomma.iam.gserviceaccount.com`
3. **Substitution variables** (Firebase web config is client-side; set the same values as `.env`):

| Variable | Example / notes |
| -------- | ----------------- |
| `_REGION` | `asia-south1` |
| `_SERVICE` | `swiftcare-api` |
| `_ARTIFACT_REPO` | `swiftcare` |
| `_CLOUD_RUN_SA` | `swiftcare-cloudrun@swiftcare-patchamomma.iam.gserviceaccount.com` |
| `_CORS_ORIGINS` | Cloud Run URL (after first deploy) |
| `_FIREBASE_PROJECT_ID` | `swiftcare-patchamomma` |
| `_VITE_FIREBASE_API_KEY` | From Firebase Console |
| `_VITE_FIREBASE_AUTH_DOMAIN` | `swiftcare-patchamomma.firebaseapp.com` |
| `_VITE_FIREBASE_PROJECT_ID` | `swiftcare-patchamomma` |
| `_VITE_FIREBASE_APP_ID` | From Firebase Console |
| `_IMAGE` | Optional. If empty, image tag is `$SHORT_SHA` |

4. Save → **Run** once, or `git push origin main`.

#### Day-to-day

```bash
git push origin main
```

Watch: [Cloud Build → History](https://console.cloud.google.com/cloud-build/builds?project=swiftcare-patchamomma) (region `asia-south1`).

Manual deploy (same pipeline): `./scripts/deploy_cloud_run.sh`.

---

## Troubleshooting (deploy / CI)

| Symptom | Cause | Fix |
| ------- | ----- | --- |
| `if 'build.service_account' is specified, the build must … logs_bucket` | Custom SA without logs config | Ensure `cloudbuild.yaml` has `logsBucket: gs://swiftcare-patchamomma-build-logs` and that file is on `main` |
| `Failed to parse resource name …@….iam.gserviceaccount.com` | Bare email on regional Cloud Build API | Use `projects/PROJECT/serviceAccounts/EMAIL` for `--service-account` (deploy script does this) |
| `service account … does not have access to the bucket` | Missing `storage.buckets.get` | Grant `roles/storage.legacyBucketWriter` on the logs bucket to the SA |
| Build OK but login form / Firebase fails | Empty `VITE_FIREBASE_*` in image | Set substitutions on the trigger **and** in root `.env` for manual deploys; rebuild |
| Login OK but charts/insights **403** | No row in `patient_access_grants` | Seed grant with staff Firebase UID ([sql/10_seed_access_grant.example.sql](sql/10_seed_access_grant.example.sql)) |
| API **503** `auth_unavailable` | Admin SDK init failed | Set `FIREBASE_PROJECT_ID`; on Cloud Run use the runtime SA; locally run `gcloud auth application-default login` |
| Browser CORS errors | `CORS_ORIGINS` mismatch | Set to the exact Cloud Run origin; redeploy |
| Firebase `auth/unauthorized-domain` | Domain not allowlisted | Add Cloud Run host under Firebase Authorized domains |
| Trigger does not see latest yaml | Changes only local | Push `cloudbuild.yaml` to `main` |

---

## Repository layout

```text
swiftcare-ai/
├── agents/                    # Chunks 2–4 ADK agents
├── api/                       # FastAPI + Firebase Admin verify (api/auth.py)
├── frontend/                  # React FE + Firebase client SDK
├── sql/                       # BigQuery DDL + sql/09 symptoms + grant example
├── scripts/                   # run_api, deploy_cloud_run, agents, chunk1
├── tests/                     # agent + API tests
├── private_docs/              # Spec + final_chunk_1…7
├── Dockerfile                 # Multi-stage FE + API (VITE_FIREBASE_* build-args)
├── cloudbuild.yaml            # Build → push → Cloud Run deploy (+ logsBucket)
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
6. Mention **Firebase Auth** (staff identity) + BigQuery-only clinical data

---

## Safety & guardrails

- Agents **do not** diagnose, prescribe, or issue clinical orders.
- Suggestion cards and Insights alerts are **dismissible operational** layers with explicit disclaimers.
- BigQuery access is via **fixed SQL templates** + parameter binding only.
- Clinical data stays in **BigQuery** (no Firestore clinical store).
- Firebase Auth supplies **identity**, not PHI access — grants live in `patient_access_grants`.
- Cloud Run forces `API_AUTH_BYPASS=false` (`K_SERVICE` also disables bypass).

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
| Issue tracker | [github.com/HaripriyaB/swiftcare-ai/issues](https://github.com/HaripriyaB/swiftcare-ai/issues) |
