-- =============================================================================
-- SwiftCare AI — Chunk 1 exploration snippets
-- =============================================================================
-- Usage: Open in BigQuery Console and run one block at a time (highlight + Run).
-- Not part of the deployment pipeline — read-only SELECTs only.
-- Project: swiftcare-patchamomma (change if using a different GCP_PROJECT_ID).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. MASTER SUMMARY — row counts across all Chunk 1 objects
-- -----------------------------------------------------------------------------
SELECT 'swiftcare_fhir_raw' AS dataset, '_cohort_patient_ids' AS object_name, 'table' AS object_type, COUNT(*) AS row_count
FROM `swiftcare-patchamomma.swiftcare_fhir_raw._cohort_patient_ids`
UNION ALL SELECT 'swiftcare_fhir_raw', 'patient', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_raw.patient`
UNION ALL SELECT 'swiftcare_fhir_raw', 'encounter', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_raw.encounter`
UNION ALL SELECT 'swiftcare_fhir_raw', 'condition', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_raw.condition`
UNION ALL SELECT 'swiftcare_fhir_raw', 'observation', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_raw.observation`
UNION ALL SELECT 'swiftcare_fhir_raw', 'medication_request', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_raw.medication_request`
UNION ALL SELECT 'swiftcare_fhir_raw', 'procedure', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_raw.procedure`
UNION ALL SELECT 'swiftcare_fhir_raw', 'allergy_intolerance', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_raw.allergy_intolerance`
UNION ALL SELECT 'swiftcare_fhir_raw', 'immunization', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_raw.immunization`
UNION ALL SELECT 'swiftcare_fhir_raw', 'diagnostic_report', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_raw.diagnostic_report`
UNION ALL SELECT 'swiftcare_fhir_raw', 'care_plan', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_raw.care_plan`
UNION ALL SELECT 'swiftcare_fhir_raw', 'organization', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_raw.organization`
UNION ALL SELECT 'swiftcare_fhir_raw', 'practitioner', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_raw.practitioner`
UNION ALL SELECT 'swiftcare_fhir_analytics', 'dim_patients', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.dim_patients`
UNION ALL SELECT 'swiftcare_fhir_analytics', 'fact_encounters', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_encounters`
UNION ALL SELECT 'swiftcare_fhir_analytics', 'fact_conditions', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_conditions`
UNION ALL SELECT 'swiftcare_fhir_analytics', 'fact_medications', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_medications`
UNION ALL SELECT 'swiftcare_fhir_analytics', 'fact_observations', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_observations`
UNION ALL SELECT 'swiftcare_fhir_analytics', 'fact_allergies', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_allergies`
UNION ALL SELECT 'swiftcare_fhir_analytics', 'dim_providers', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.dim_providers`
UNION ALL SELECT 'swiftcare_fhir_analytics', 'dim_organizations', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.dim_organizations`
UNION ALL SELECT 'swiftcare_fhir_views', 'v_patient_demographics', 'view', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_patient_demographics`
UNION ALL SELECT 'swiftcare_fhir_views', 'v_patient_timeline', 'view', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_patient_timeline`
UNION ALL SELECT 'swiftcare_fhir_views', 'v_active_medications', 'view', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_active_medications`
UNION ALL SELECT 'swiftcare_fhir_views', 'v_active_allergies', 'view', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_active_allergies`
UNION ALL SELECT 'swiftcare_fhir_views', 'v_visit_summary', 'view', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_visit_summary`
UNION ALL SELECT 'swiftcare_fhir_views', 'v_risk_flags', 'view', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_risk_flags`
UNION ALL SELECT 'swiftcare_fhir_views', 'v_patient_360', 'view', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_patient_360`
UNION ALL SELECT 'swiftcare_agent_cache', 'mv_patient_latest_vitals', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_agent_cache.mv_patient_latest_vitals`
UNION ALL SELECT 'swiftcare_agent_cache', 'mv_active_medications', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_agent_cache.mv_active_medications`
UNION ALL SELECT 'swiftcare_agent_cache', 'mv_at_risk_patients', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_agent_cache.mv_at_risk_patients`
UNION ALL SELECT 'swiftcare_ops', 'sessions', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_ops.sessions`
UNION ALL SELECT 'swiftcare_ops', 'advisory_cards', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_ops.advisory_cards`
UNION ALL SELECT 'swiftcare_ops', 'agent_query_log', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_ops.agent_query_log`
UNION ALL SELECT 'swiftcare_ops', 'insight_alerts', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_ops.insight_alerts`
UNION ALL SELECT 'swiftcare_ops', 'patient_access_audit', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_ops.patient_access_audit`
UNION ALL SELECT 'swiftcare_ops', 'data_validation_runs', 'table', COUNT(*) FROM `swiftcare-patchamomma.swiftcare_ops.data_validation_runs`
ORDER BY dataset, object_name;


-- -----------------------------------------------------------------------------
-- 1. RAW FHIR — sample rows (LIMIT 10 each)
-- -----------------------------------------------------------------------------

-- _cohort_patient_ids
SELECT * FROM `swiftcare-patchamomma.swiftcare_fhir_raw._cohort_patient_ids` LIMIT 10;

-- patient (nested FHIR — wide rows)
SELECT id, name, birthDate, gender, address, deceased
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.patient`
LIMIT 10;

-- encounter
SELECT id, subject.patientId AS patient_id, class, type, period, status
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.encounter`
LIMIT 10;

-- condition
SELECT id, subject.patientId AS patient_id, code, onset, clinicalStatus, context.encounterId AS encounter_id
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.condition`
LIMIT 10;

-- observation
SELECT id, subject.patientId AS patient_id, code, category, effective, value, context.encounterId AS encounter_id
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.observation`
LIMIT 10;

-- medication_request
SELECT id, subject.patientId AS patient_id, medication, status, authoredOn, context.encounterId AS encounter_id
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.medication_request`
LIMIT 10;

-- procedure
SELECT id, subject.patientId AS patient_id, code, performed, status
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.procedure`
LIMIT 10;

-- allergy_intolerance
SELECT id, patient.patientId AS patient_id, code, criticality, clinicalStatus
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.allergy_intolerance`
LIMIT 10;

-- immunization
SELECT id, patient.patientId AS patient_id, vaccineCode, occurrenceDateTime, status
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.immunization`
LIMIT 10;

-- diagnostic_report
SELECT id, subject.patientId AS patient_id, code, effective, status
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.diagnostic_report`
LIMIT 10;

-- care_plan
SELECT id, subject.patientId AS patient_id, status, intent, period
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.care_plan`
LIMIT 10;

-- organization
SELECT id, name, address, type
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.organization`
LIMIT 10;

-- practitioner
SELECT id, name, qualification
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.practitioner`
LIMIT 10;


-- -----------------------------------------------------------------------------
-- 2. ANALYTICS — flattened dim/fact tables (LIMIT 10 each)
-- -----------------------------------------------------------------------------

SELECT * FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.dim_patients` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_encounters` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_conditions` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_medications` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_observations` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_allergies` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.dim_providers` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.dim_organizations` LIMIT 10;


-- -----------------------------------------------------------------------------
-- 3. VIEWS — agent-facing semantic layer (LIMIT 10 each)
-- -----------------------------------------------------------------------------

SELECT * FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_patient_demographics` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_patient_timeline` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_active_medications` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_active_allergies` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_visit_summary` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_risk_flags` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_patient_360` LIMIT 10;


-- -----------------------------------------------------------------------------
-- 4. AGENT CACHE — precomputed snapshots (LIMIT 10 each)
-- -----------------------------------------------------------------------------

SELECT * FROM `swiftcare-patchamomma.swiftcare_agent_cache.mv_patient_latest_vitals` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_agent_cache.mv_active_medications` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_agent_cache.mv_at_risk_patients` LIMIT 10;


-- -----------------------------------------------------------------------------
-- 5. OPS — application state (empty until agents write; LIMIT 10 each)
-- -----------------------------------------------------------------------------

SELECT * FROM `swiftcare-patchamomma.swiftcare_ops.sessions` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_ops.advisory_cards` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_ops.agent_query_log` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_ops.insight_alerts` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_ops.patient_access_audit` LIMIT 10;

SELECT * FROM `swiftcare-patchamomma.swiftcare_ops.data_validation_runs` LIMIT 10;


-- -----------------------------------------------------------------------------
-- 6. USEFUL DRILL-DOWNS — single patient chart + population insights
-- -----------------------------------------------------------------------------

-- Patient 360 for one cohort member
SELECT *
FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_patient_360`
WHERE patient_id = (
  SELECT patient_id FROM `swiftcare-patchamomma.swiftcare_fhir_raw._cohort_patient_ids` LIMIT 1
);

-- Timeline for that patient (most recent events first)
SELECT event_date, event_type, event_label, encounter_id
FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_patient_timeline`
WHERE patient_id = (
  SELECT patient_id FROM `swiftcare-patchamomma.swiftcare_fhir_raw._cohort_patient_ids` LIMIT 1
)
ORDER BY event_date DESC
LIMIT 20;

-- Gender distribution
SELECT gender, COUNT(*) AS patient_count
FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_patient_demographics`
GROUP BY gender
ORDER BY patient_count DESC;

-- Top 10 conditions across cohort
SELECT event_label AS condition, COUNT(*) AS cnt
FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_patient_timeline`
WHERE event_type = 'condition'
GROUP BY event_label
ORDER BY cnt DESC
LIMIT 10;

-- Encounter class breakdown
SELECT encounter_class, COUNT(*) AS visit_count
FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_visit_summary`
GROUP BY encounter_class
ORDER BY visit_count DESC;

-- Care gaps (patients with no visit in 365+ days)
SELECT patient_id, first_name, last_name, days_since_last_visit, risk_level
FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_risk_flags`
WHERE risk_flag = 'gap_in_care'
ORDER BY days_since_last_visit DESC
LIMIT 20;

-- Risk flag distribution
SELECT risk_flag, risk_level, COUNT(*) AS patient_count
FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_risk_flags`
GROUP BY risk_flag, risk_level
ORDER BY patient_count DESC;

-- Raw FHIR patient schema introspection
SELECT field_path, data_type
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.INFORMATION_SCHEMA.COLUMN_FIELD_PATHS`
WHERE table_name = 'patient'
ORDER BY field_path
LIMIT 50;
