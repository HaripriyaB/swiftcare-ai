# SwiftCare AI — Revised Agentic Build Instructions

**Build window:** 3 days  
**Build objective:** Deliver a reliable, demo-ready AI Operations Command Center for patient continuity. The primary user is a front-desk staff member or care coordinator, not a clinician. The core loop is: **see who needs attention → understand why → approve a next operational action → record the outcome.**

## 1. Non-negotiable product contract

SwiftCare is not a general clinic portal, a staff directory, a noticeboard, or a chatbot with patient search. Its home screen is an **Attention Queue**. Every high-value interaction must make one of these questions easy to answer:

1. Which patients need front-desk attention today?
2. Why does this patient need attention, using visible source facts?
3. What safe operational action can staff take now?
4. What happened after the action?

Use only synthetic data. Retain the existing architecture where it is useful:

- FHIR-shaped synthetic patient, encounter, condition, medication, observation, and appointment/follow-up data in BigQuery.
- Gemini + Google ADK with three bounded roles: Retrieval, Continuity/Recommendation, and Insights.
- Parameterized, allowlisted BigQuery tools. Never allow model-generated SQL.
- FastAPI orchestration, Firebase Authentication, Cloud Run deployment, and an auditable operations schema.
- A distinct, dismissible advisory layer. An advisory is never a diagnosis, prescription, clinical order, or urgency determination.

### Product decisions that supersede the previous chunks

- Replace the search-first homepage with the Attention Queue. Keep global patient search in the header.
- Remove **Doctors** and **Dean’s Office / notices** from the MVP navigation and home page. They do not advance patient continuity.
- Do not ask the model to predict clinical risk. Generate deterministic, explainable operational priority from allowed data signals, then use Gemini only to turn evidence into concise, safe language.
- Do not build arbitrary messaging, automated calls/SMS, appointment booking integrations, clinician workflows, or a full analytics dashboard in this three-day MVP.
- The demo must use a real Cloud Run route and real Firebase sign-in. A local bypass is allowed only in local development and must be impossible on Cloud Run.

## 2. Shared definition of “Next Best Operational Action” (NBOA)

An NBOA is one staff-reviewable card for one patient. It has all fields below; do not render a generic AI recommendation without them.

```ts
type NboaCard = {
  id: string;
  patientId: string;
  patientName: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  actionType: "CONTACT_TO_RESCHEDULE" | "CONTACT_FOR_FOLLOW_UP" |
              "VERIFY_REFERRAL" | "CONFIRM_UPCOMING_VISIT" |
              "REVIEW_WITH_CARE_TEAM";
  actionLabel: string;             // e.g. "Contact to reschedule"
  whyNow: string;                  // one operational sentence
  evidence: EvidenceItem[];        // 2–3 factual, dated signals
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "DISMISSED";
  createdAt: string;
  source: "RULE_ENGINE";
  disclaimer: "Operational support only — staff review required.";
}
type EvidenceItem = { label: string; value: string; observedAt?: string; source: string };
```

**Priority policy:** use a transparent point score, not opaque model judgment. Store `priority_score`, `rule_version`, and evidence JSON. Suggested v1 rules: overdue follow-up > 30 days (+40); a missed/cancelled visit (+25); two missed/cancelled visits (+20 additional); unresolved referral (+30); appointment within 48 hours without confirmation (+20); active high-utilizer flag (+10). HIGH ≥ 50, MEDIUM 30–49, LOW 10–29. Keep only the highest applicable action per patient; document all contributing evidence.

## 3. Delivery rules for every chunk

- Read the existing code before replacing it. Preserve working BigQuery views, tool allowlists, data fixtures, deployment configuration, and tests unless they conflict with this document.
- Work in small commits/PR-sized changes. At the end of each chunk, run its acceptance checks and record failures rather than masking them with fixtures.
- Use loading, empty, and error states on each screen. No blank white panels or silent authentication failures.
- Keep TypeScript types and Pydantic models aligned through a versioned API contract.
- All persisted staff actions must include Firebase `uid`, timestamp, card/action ID, and a non-sensitive result/outcome. Audit access separately.
- Use accessible semantic controls, visible keyboard focus, 44 px tap targets, sufficient contrast, and responsive behavior at 1280 px and mobile width.
- Use a concise, calm visual system: off-white background, deep navy/charcoal text, one confident teal/green action color, and amber/red only for priority. Avoid an overloaded hospital-dashboard look.

---

## Chunk 1 — Continuity-ready synthetic data and BigQuery foundation

### Goal
Extend the current FHIR/BigQuery foundation so the application can create evidence-backed continuity work items without inventing medical facts.

### Implement

1. Keep current FHIR-shaped source tables/views. Add a synthetic appointments/follow-up layer if it does not exist: `appointment_id`, `patient_id`, `scheduled_start`, `status` (`BOOKED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`), `confirmation_status`, `follow_up_due_date`, `referral_status`.
2. Create guarded views such as `v_patient_continuity_signals` and `v_nboa_candidates`. Candidates must contain rule inputs, points, highest matching action, priority, and evidence fields—no free-text clinical recommendation.
3. Create operations tables: `continuity_cards`, `continuity_action_events`, `patient_access_audit`, and `agent_query_log`. Cards are soft-dismissed/completed; never delete audit history.
4. Seed 6–8 named synthetic demo personas described in the companion spec. Make them deterministic and easy to find by name.
5. Write a data dictionary and SQL smoke queries. Use partitioning/caps where appropriate to keep BigQuery demo cost low.

### Acceptance

- A query returns at least five open candidates across HIGH/MEDIUM/LOW.
- Every candidate has 2+ factual evidence fields and a permitted action type.
- No source table contains real patient data.
- A repeated seed is idempotent and does not duplicate demo cards.

## Chunk 2 — Retrieval agent and patient context

### Goal
Let staff search for a patient and inspect grounded context without treating chat as the primary product.

### Implement

1. Retain the ADK Retrieval Agent, but constrain it to patient lookup and read-only chart/context tools: patient summary, encounters, medications, conditions, continuity signals, and recent operational events.
2. Enforce a patient-resolution step for ambiguous names. Return a simple list with name, DOB/year as permitted by synthetic data, and patient ID; never select a match silently.
3. Add a `GET /api/v1/patients/search`, `GET /api/v1/patients/{id}/overview`, and `GET /api/v1/patients/{id}/continuity-context` contract. All returns must cite view/tool names internally and display human-friendly evidence labels in the UI.
4. The agent must refuse diagnosis, prescribing, dosage changes, triage, or claiming a patient needs emergency care. Offer factual chart retrieval or an operational review instead.
5. Implement unit tests for lookup ambiguity, chart grounding, tool authorization, and clinical refusal.

### Acceptance

- Searching “Kuhn” returns the seeded match(es); selecting one opens a real BigQuery-backed overview.
- “What medication is listed?” returns a grounded result.
- “Diagnose and prescribe” is refused safely, with no clinical recommendation.

## Chunk 3 — Continuity/NBOA agent with deterministic guardrails

### Goal
Turn the current Suggestion Agent into a **Continuity Agent** that creates or reads explainable operational cards from rule-engine candidates.

### Implement

1. Do not let Gemini decide the priority or invent evidence. A deterministic service reads `v_nboa_candidates`, deduplicates one open card per patient/action, and persists the NBOA contract.
2. Use Gemini/ADK only to format a short `whyNow` from supplied evidence and action label. Validate output: maximum 180 characters; no diagnostic, treatment, medical-urgency, or shame language.
3. Add tools/routes to list queue cards, fetch a card, start work, complete with an operational outcome, and dismiss with a reason. Required endpoints:
   - `GET /api/v1/continuity/queue?priority=&status=&limit=`
   - `GET /api/v1/continuity/cards/{id}`
   - `POST /api/v1/continuity/cards/{id}/start`
   - `POST /api/v1/continuity/cards/{id}/complete`
   - `POST /api/v1/continuity/cards/{id}/dismiss`
4. Completion outcomes are bounded: `CONTACT_ATTEMPTED`, `PATIENT_REACHED`, `FOLLOW_UP_REQUESTED`, `REFERRAL_VERIFIED`, `VISIT_CONFIRMED`, `NEEDS_CARE_TEAM_REVIEW`. Add optional staff note capped at 280 chars. Do not pretend the system sent a message.
5. Add card and action-event audit logging. The UI must show “Operational support only — staff review required.”

### Acceptance

- Generated cards are repeatable from the same data and do not contain invented facts.
- Every card can be opened, started, completed, or dismissed, and its state survives refresh.
- A card with “two no-shows + overdue 19 days” visibly shows both facts and recommends contact/reschedule—not a clinical treatment.

## Chunk 4 — Insights agent becomes an operational queue explainer

### Goal
Keep population insights, but make them support the queue instead of competing with it.

### Implement

1. Retain ADK Insights and guarded BigQuery tools for care gaps, high utilization, polypharmacy, and chronic burden. Rename UI language to operationally clear labels: “visit overdue”, “frequent recent visits”, “many active medications”, “multiple active conditions”.
2. Expose a small `GET /api/v1/continuity/summary` for counts by priority/action and a `GET /api/v1/insights/continuity-patterns` with at most three patterns. Link each pattern to a pre-filtered Attention Queue.
3. Do not create a separate alerts workflow for the MVP unless it maps to an NBOA card. Avoid duplicate “alert” and “advisory” concepts.
4. The Insights Agent can answer “why is this queue busy?” and “show overdue follow-ups,” but must link the user back to concrete queue cards. It must preserve the same medical guardrails.

### Acceptance

- The dashboard summary and queue counts agree.
- Selecting “overdue follow-ups” filters the queue, not a dead-end report.
- Population requests are capped and do not access raw unrestricted data.

## Chunk 5 — Frontend rebuild: command center first

### Goal
Replace the current scattered, sparse search/notices/directory interface with a focused workspace that lets staff take the next action within two clicks.

### Implement

1. Rebuild the information architecture to: **Today** (default), **Patients**, **Insights**, and a compact user menu. Delete/hide Doctors, Dean’s Office notices, and the always-floating generic chat from the MVP route map.
2. Build the exact screens in the companion specification. Prioritize Today, patient work detail, auth, then Insights. Global search must be available in the header, but not dominate the screen.
3. Use components for `PriorityPill`, `NboaCard`, `EvidenceDrawer`, `ActionSheet`, `QueueFilters`, `PatientContextRail`, `EmptyState`, `ErrorState`, and `AuthStatus`.
4. Make actions explicit: “Review action”, “Start”, “Mark outcome”, “Dismiss”. No unlabeled icon-only action. Completion uses a small confirmation sheet; it never claims outreach was automatically performed.
5. Add React Query/SWR-style request state management and optimistic update with rollback. Preserve filters and queue position after a card action.
6. Chat, if retained, is an optional “Ask about this patient” panel inside patient detail—not a floating screen-wide blocker. It can retrieve facts and explain wording; it cannot create actions or make clinical decisions.

### Acceptance

- A signed-in user sees a real queue, not a search form or office notices, within one page load.
- The highest-priority demo card exposes a complete why/action/outcome path in under two minutes.
- Desktop UI at 1280 px has no excessive unused canvas or vertically trapped sidebar; mobile renders the queue as a single column.
- Loading, zero-state, and API error cases are intentional and readable.

## Chunk 6 — Authentication, orchestration, and Cloud Run hardening

### Goal
Make the real end-to-end application reliable enough to hand to a judge.

### Implement

1. Use Firebase Auth client SDK for Google popup/redirect and email/password. Configure Firebase Auth provider settings, authorized domains, and Cloud Run domain/redirect flow. Surface actionable user-facing errors (popup blocked, unauthorized domain, invalid credentials, provider disabled); never fail silently.
2. On API requests, get and attach a fresh Firebase ID token. FastAPI verifies it through Firebase Admin. Map authorized staff to a lightweight role (`front_desk`, `care_coordinator`, `admin`) using claims or a demo allowlist; deny unauthenticated API access.
3. `API_AUTH_BYPASS` may be read only in local development. Add a startup assertion that exits if it is enabled when `K_SERVICE` is present or environment is production. Never publish bypass credentials.
4. Run FastAPI as the source of truth for queue/patient/action APIs and in-process ADK orchestration for chat/explanations. Serve the production React build from the same Cloud Run service where practical to avoid CORS/redirect complexity.
5. Configure Cloud Run service account with least privilege: BigQuery read/job access for curated datasets, write only to operations tables, Vertex AI user, and required Firebase/Secret Manager access. Store Firebase service configuration/secrets in Secret Manager; do not commit them.
6. Add health and readiness endpoints, structured request/error logging with correlation IDs, CORS only if separate origins are necessary, and a simple smoke script for deployed URL.

### Acceptance

- Google sign-in and email/password sign-in both reach Today and survive refresh.
- Sign-out removes local state and a protected API call returns 401 thereafter.
- A production deployment rejects bypass login/token.
- Cloud Run `/health`, login, queue load, detail, action completion, and Insights all work with real services.

## Chunk 7 — Demo-path regression and finish

### Goal
Verify the product experience and only polish blockers. Do not build a pitch deck, scoring story, or additional features in this chunk.

### Implement

1. Create a short E2E checklist around the five key scenarios in the companion specification. Record pass/fail and screenshots for each.
2. Add automated tests for: Firebase auth module states (mocked), API auth verification, rule score/card generation, card action persistence, queue filter contract, and medical guardrail refusals.
3. Exercise the deployed Cloud Run URL in an incognito browser. Verify both auth modes, a full NBOA outcome, insights-to-queue link, refresh persistence, and a denied unauthenticated API call.
4. Polish copy and empty/error states only where they obstruct understanding. Keep the persistent synthetic-data disclosure visible but quiet.
5. Update README with local setup, Firebase configuration checklist, environment variables (names only), deploy command, test command, architecture diagram, and demo data disclaimer. Exclude judging pitch content.

### Release gates

- No generic noticeboard or Doctors page is in main navigation.
- No broken Google/email login path remains unreported.
- At least five deterministic synthetic queue cards exist after deploy.
- Every visible card has priority, evidence, a permitted action, human approval, and persisted outcome/dismissal.
- No model output diagnoses, prescribes, creates appointments, or sends messages.
- The public Cloud Run demo is usable in a clean browser session.

## Suggested three-day sequence

- **Day 1:** Chunk 1, API contract/types, Chunk 3 rule engine and seed personas; prove queue data via API.
- **Day 2:** Chunk 5 Today/detail rebuild; Chunk 6 Firebase configuration and production auth; connect live APIs.
- **Day 3:** Chunk 2/4 chat/insights integration only after core path works; deploy, test Chunk 7 gates, and polish blockers.

If time is constrained, ship Today + patient work detail + action outcome + real login before adding chat, exports, advanced charts, or Looker.
