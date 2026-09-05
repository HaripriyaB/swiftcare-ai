# SwiftCare AI

**Patchamomma 2026** · Google Cloud

An agentic, retrieval-augmented clinical operations assistant that grounds natural-language queries against structured patient data, surfaces guardrailed care recommendations, and drives BigQuery-powered operational analytics for front-desk teams — orchestrated end-to-end on Google Cloud.

> Built as part of **[Patchamomma 2026](https://rsvp.withgoogle.com/events/patchamomma_2026)** — a Google Cloud initiative for women in tech to go from **concept → code → deployment** using Data, AI, multi-agent systems (ADK), and serverless Google Cloud services.

---

## Public URL

| Surface | URL | Status |
| ------- | --- | ------ |
| Live app (Cloud Run / FE) | `<!-- TODO: PUBLIC_APP_URL — fill after scripts/deploy_cloud_run.sh -->` | Pending deploy ([final_chunk_6.md](private_docs/final_chunk_6.md)) |
| Demo video | `<!-- TODO: DEMO_VIDEO_URL -->` | Pending |
| Pitch deck | `<!-- TODO: PITCH_DECK_URL -->` | Pending |
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
| Auth (planned) | Firebase Authentication (identity only; data stays in BigQuery) |
| Deploy | Docker → Cloud Run *(Chunk 6)* |
| Analytics | Looker Studio (optional) |
| Build tools | Cursor / Antigravity-style agentic IDE workflows |

**Google Cloud services (planned / in use):** Gemini API / Vertex AI, ADK, BigQuery, Looker Studio, Pub/Sub, Firebase Auth, Cloud Run.

---

## Current progress

| Chunk | Scope | Status |
| ----- | ----- | ------ |
| 1 | FHIR data foundation in BigQuery | Done |
| 2 | Retrieval agent | Done |
| 3 | Suggestion agent + advisory cards | Done |
| 4 | Insights agent + insight alerts | Done |
| 5 | Frontend | Done |
| 6 | Orchestrate agents + deploy Cloud Run | **Contract ready** — [final_chunk_6.md](private_docs/final_chunk_6.md) (implement + deploy next) |
| 7 | Full test, polish, demos, docs | `<!-- TODO -->` |

Detailed build contracts: [`private_docs/`](private_docs/) (`final_chunk_1.md` … `final_chunk_6.md`, [`spec.md`](private_docs/spec.md)).

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

# Local API (after api/ is implemented per chunk doc)
./scripts/run_api.sh
# → http://127.0.0.1:8080/api/v1/health

# Deploy (after Dockerfile + scripts/deploy_cloud_run.sh exist)
./scripts/deploy_cloud_run.sh
# Then set README Public URL to the printed Cloud Run URL
# Point FE: VITE_API_BASE_URL=https://<service>.run.app/api  VITE_DEMO_BANNER=false
```

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
├── private_docs/              # Spec + final_chunk_1…6
├── Dockerfile                 # Chunk 6
├── pyproject.toml
├── .env.example
└── README.md
```

---

## Demo script (placeholder)

1. `<!-- TODO: DEMO_STEP_1 — population care gaps via Insights -->`
2. `<!-- TODO: DEMO_STEP_2 — chart Q&A via Retrieval -->`
3. `<!-- TODO: DEMO_STEP_3 — advisory cards via Suggestion -->`
4. `<!-- TODO: DEMO_STEP_4 — FE / Cloud Run walkthrough -->`

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
