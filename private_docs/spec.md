Project Name: **SwiftCare Al**

One liner: An agentic, retrieval-augmented clinical operations assistant that grounds natural-language queries against structured patient data, surfaces guardrailed care recommendations, and drives BigQuery-powered operational analytics for front-desk teams, orchestrated end-to-end on Google Cloud.

Project Description: SwiftCare Al is an agentic retrieval-augmented healthcare operations platform built for front desk and care coordination workflows. A dedicated retrieval agent, powered by Gemini and grounded in FHIR structured patient records in BigQuery, resolves natural language queries into precise, context aware responses, eliminating manual chart navigation. A parallel suggestion agent applies guardrailed reasoning to surface potential next steps rendered as a distinct, dismissible advisory layer to preserve clinical accountability and avoid diagnostic overreach. A third insight agent continuously mines visits and follow up patterns to flag at-risk patients and scheduling inefficiencies. The three agents are orchestrated through Google's ADK as a coordinated pipeline rather than a single monolith model.

Data Source: BigQuery Public Dataset

Google Cloud Services Used: Gemini API, ADK, big query, looker studio, pub/sub, firebase, cloud run

AI to be used: Gemini Agent Platform from Google Cloud

Tech Stack: Python, fastAPl, react, bigquery, fire base, docker

Using any Vibe Coding / Build Tools: Yes. Antigravity IDE

Chunks of work:

1. Generate patient data in bigquery, define scheme and all data exploration and gathering
2. Build retrieval agent
3. Build suggestion agent with guardrailed advisory card
4. Build insights agent
5. Build FE
6. Integrate agents and depot to cloud run
7. Full test run and final Polish with documentation demos

