# SwiftCare AI — Workflows, MVP Screens, and Scenarios

## Product definition

**SwiftCare AI is an AI Operations Command Center for Patient Continuity.** It helps front-desk staff and care coordinators act on the patients most likely to fall through an operational gap—by showing an explainable, safe next action and retaining staff control at every step.

The primary user begins their shift with a queue, not a patient search box. The product promise is deliberately practical: **“Start with the patient who needs attention; see the evidence; take an appropriate operational step.”**

### Users

- **Primary — Front-desk staff:** checks today’s workload, starts outreach/verification work, records what occurred, and finds a patient when needed.
- **Secondary — Care coordinator:** reviews higher-complexity continuity items, filters the queue, and asks factual patient-context questions.
- **Not an MVP user — Clinician:** does not receive orders, diagnoses, treatment plans, or automated triage from SwiftCare.

## MVP boundary

### In scope

- Synthetic FHIR-shaped data in BigQuery and deterministic operational continuity signals.
- A prioritized Attention Queue, explainable NBOA cards, patient context, staff action recording, queue filters, patient search, and small population insights.
- Firebase Google and email/password sign-in; FastAPI; ADK/Gemini only through bounded tools; one Cloud Run demo URL.

### Out of scope

- Clinical diagnosis, medication/treatment suggestions, emergency determination, or medical triage.
- Sending SMS/email, placing calls, booking appointments, modifying EHR data, or live patient communications.
- Doctors directory, office noticeboard, generic chat-first interaction, full BI dashboards, and non-synthetic PHI.

## Core workflow

```text
Sign in
  → Today / Attention Queue
  → choose highest-priority card
  → review “why now” and evidence
  → open patient context if needed
  → start an operational action
  → record a bounded outcome or dismiss with reason
  → queue updates and audit event is saved
```

### NBOA lifecycle

`OPEN → IN_PROGRESS → COMPLETED` is the normal path. `OPEN → DISMISSED` is available when the action is not appropriate. Completion/dismissal must never erase the original evidence or audit trail.

## Screen specifications

### 1. Authentication `/login`

**Purpose:** securely enter the staff workspace, with a warm but focused first impression.

- Split desktop layout: left side has a concise promise, “Keep patient follow-up from falling through the cracks,” three small process statements (See priority / Understand why / Record the outcome), and a synthetic-data label. Right side is a compact sign-in card.
- Sign-in card: “Welcome to SwiftCare”, Google button first, divider, email and password fields, sign-in button, and a single appropriate recovery/create-account link only if enabled in Firebase.
- Do not show an office notice feed, doctors directory, or fake operational information.
- Display errors directly under the relevant control, with recovery guidance. Examples: “Google sign-in could not open. Allow popups and try again.” and “This domain is not authorized for sign-in. Ask the demo administrator.”
- On success, route to `/today`. If a valid session exists, skip login.

**Acceptance:** Google and email/password work on the Cloud Run domain. Auth errors are visible, not console-only.

### 2. Today / Attention Queue `/today` (default home)

**Purpose:** answer “What should I work on next?” immediately.

Top area:

- Header: SwiftCare AI logo/name; navigation **Today**, **Patients**, **Insights**; global patient search; signed-in staff name/menu. No Doctors, office notices, or floating generic chat.
- Greeting: “Good morning, Maya.” Next line: “7 patients need continuity attention today.” This is data driven, not a hard-coded hero.
- Summary chips: `3 High priority`, `3 Follow-up`, `1 Referral review`. Chips change the queue filter.
- A quiet badge: “Synthetic demo data · Operational support only.”

Queue area:

- Default sort: HIGH, then newest/highest score. Filter bar: priority, action type, status, and “My in-progress work.” Include clear-all state.
- Each card shows: priority, patient name, plain-language action label, `why now`, two evidence facts, and “Review action”. Never hide the evidence behind a chat interaction.
- An evidence fact must include a source label, e.g. “Follow-up due 19 days ago · appointments” or “2 missed visits in the past 6 months · encounters.”
- An empty filter result has “No patients match these filters” and Clear filters. A true queue-zero state congratulates the user and shows Patient Search.
- Selecting a card opens the action detail on desktop (side panel or route) and a full page on mobile.

**Visual behavior:** use one-column cards plus a contextual right rail only on wide screens. Avoid the current large blank center and long unrelated notice sidebar. Do not show more than 8 cards before progressive loading.

**Acceptance:** a user can reach a high-priority card’s evidence in one click and its action confirmation in two.

### 3. Action detail / NBOA workspace `/continuity/:cardId`

**Purpose:** make the recommendation explainable and safely actionable.

Layout:

- Breadcrumb back to Today; patient name and priority at the top.
- Main action block: action label, `why now`, plain disclosure “Operational support only — staff review required.”
- Evidence block, expanded by default, with 2–3 dated source facts and “How priority was set” link. The link shows rule score/input labels, never hidden model reasoning.
- Patient context rail: last relevant visit, next/last appointment status, referral state, and a link to full patient workspace. This is factual only.
- Action controls: `Start work`, then `Mark outcome`; `Dismiss` as a quiet secondary action. “Mark outcome” opens a modal/sheet with the allowed outcomes and optional note. Confirmation uses wording such as “Record patient reached”, never “Send reminder”.
- Completed state shows who recorded which outcome and when. Dismissed state shows reason. Allow `Reopen` only for the demo/admin role if implemented; otherwise leave as history.

**Acceptance:** all controls persist through API and refresh. A user cannot complete an action without choosing an outcome.

### 4. Patient workspace `/patients/:patientId`

**Purpose:** provide relevant factual context without turning the product into a full EHR.

- Patient header: name, simple identity marker, active continuity status, and back link.
- First section: “Continuity at a glance” with current/previous action state, last encounter, appointment/follow-up status, referral state, and the reason it appears in the queue.
- Tabs/accordion below: recent encounters, medications on file, documented conditions, and operational history. Mark each as “Chart data” or “Operational record”. Use capped lists and “View more” only if supported.
- Optional compact `Ask about this patient` drawer uses the Retrieval Agent for factual answers. It includes a guardrail subtitle and refuses clinical advice. It must never displace the NBOA or create a card.

**Acceptance:** patient context shows grounded data and has no language that presents chart conditions as an AI diagnosis.

### 5. Patients `/patients`

**Purpose:** global patient lookup for a staff-initiated task.

- Search input with debounced results and clear exact-match/multiple-match handling.
- Results show name, synthetic identifier, most recent visit, and current continuity status; selecting a result opens Patient workspace.
- Empty state teaches a search example. No generic home notices or dashboard widgets.

### 6. Insights `/insights`

**Purpose:** show only patterns that help prioritize continuity work.

- Compact “Continuity snapshot” counts, e.g. “42 overdue follow-ups; 9 high-priority queue items.”
- Up to three patterns, each with a clear action link: “Review overdue follow-ups”, “Review referral verification”, “Review frequent recent visits.”
- Links open Today with filters already applied. Do not reproduce an independent alert workflow.
- The Insights Agent may provide a short source-grounded briefing, clearly marked as operational—not clinical.

## Required data/API behaviors

- Queue payload includes every NBOA contract field, a stable ID, `priority_score`, and source-backed evidence. It must not depend on parsing a model response.
- Patient actions are idempotent (use action/event IDs or expected version) so a double-click cannot produce duplicate outcomes.
- `GET /continuity/summary` values must reflect the same filtered/open cards available to the user’s role.
- All dynamic surfaces show skeleton/loading state, retryable error state, and empty state.
- Firebase ID token must be present on protected API calls. API returns a structured 401/403 error; UI returns user to login only for expired/invalid sessions.

## Synthetic demo scenarios

### Scenario A — Overdue follow-up plus repeated no-shows (hero path)

**Patient:** Ananya Rao (synthetic)  
**Signals:** follow-up due 19 days ago; two no-shows in six months; no next appointment.  
**Expected card:** HIGH, `Contact to reschedule`, why now names the overdue follow-up and missed visits. Evidence presents both source facts.  
**Staff path:** Today → Review action → Start work → Mark outcome `PATIENT_REACHED` → optional note “Asked for callback tomorrow.”  
**Expected result:** card becomes Completed, queue count decrements, operational history shows event. No SMS/call is claimed as sent.

### Scenario B — Referral needs verification

**Patient:** Rahul Khanna (synthetic)  
**Signals:** referral is pending/incomplete; last encounter includes a referral record; follow-up window is open.  
**Expected card:** MEDIUM, `Verify referral`, with referral status and dated encounter evidence.  
**Staff path:** open detail → inspect patient context → mark `REFERRAL_VERIFIED`.  
**Expected result:** operational event is stored. The UI does not state that a clinician referral was ordered or medically approved.

### Scenario C — Upcoming visit needs confirmation

**Patient:** Priya Shah (synthetic)  
**Signals:** appointment starts within 48 hours; confirmation is absent; previous cancellation exists.  
**Expected card:** MEDIUM, `Confirm upcoming visit`.  
**Staff path:** starts work, records `CONTACT_ATTEMPTED`.  
**Expected result:** card status and history update, but appointment is not modified.

### Scenario D — Complex patient requires care-team review

**Patient:** Luis Ortiz (synthetic)  
**Signals:** multiple active conditions and high recent visit volume, from curated views.  
**Expected card:** MEDIUM, `Review with care team`, with non-clinical language.  
**Staff path:** opens evidence, chooses `NEEDS_CARE_TEAM_REVIEW`.  
**Expected result:** a coordination handoff outcome is recorded; no diagnosis or treatment content is generated.

### Scenario E — Low-priority visit gap is dismissed responsibly

**Patient:** Maya Patel (synthetic)  
**Signals:** visit gap beyond threshold, but an external follow-up is documented in operations notes.  
**Expected card:** LOW, `Contact for follow-up`.  
**Staff path:** dismisses with bounded reason `Already handled elsewhere` and optional note.  
**Expected result:** card remains in audit history as Dismissed and disappears from default open queue.

### Scenario F — Ambiguous lookup and safe chat refusal

**Setup:** two synthetic patients share a surname.  
**Staff path:** searches surname and must select a match; then asks “Should we change her medication?” in patient chat.  
**Expected result:** system asks the staff member to choose a patient before context is loaded and then refuses medication advice, offering factual meds-on-file or care-team review.

## Demo-critical acceptance checklist

- In a clean browser session, staff sign in with Google and separately with email/password.
- Today loads queue data, not a static search/notices page.
- Scenario A completes fully and persists after refresh.
- Scenario B shows explainable referral evidence.
- Insights link filters the Attention Queue correctly.
- Search handles ambiguous surname selection.
- An unsafe clinical prompt is refused calmly and the UI offers a safe operational next step.
- Sign-out works and a subsequent protected request is denied.
- The deployed Cloud Run URL displays a clear synthetic-data disclosure.

## Copy guardrails

Use: “may need follow-up”, “staff may want to review”, “documented on file”, “operational support only.”

Avoid: “noncompliant”, “high-risk patient” without a specific operational qualifier, “we sent”, “we scheduled”, “the AI diagnosed”, “prescribe”, “urgent/emergency”, or anything implying clinical authority.

## Measure during the demo build

Track only non-clinical operational metrics in synthetic data: open queue count, time from card open to recorded outcome, completion/dismissal rate, and actions by type. Do not claim clinical outcomes or model accuracy from a three-day synthetic-data MVP.
