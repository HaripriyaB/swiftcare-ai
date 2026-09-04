-- Chunk 1 validation summary
SELECT 'V1-001 cohort' AS check_id, COUNT(*) AS actual, 5000 AS expected,
       COUNT(*) = 5000 AS passed
FROM `swiftcare-patchamomma.swiftcare_fhir_raw._cohort_patient_ids`;

SELECT 'V1-002 patients' AS check_id, COUNT(*) AS actual FROM `swiftcare-patchamomma.swiftcare_fhir_raw.patient`;
SELECT 'V1-003 encounters' AS check_id, COUNT(*) AS actual FROM `swiftcare-patchamomma.swiftcare_fhir_raw.encounter`;
SELECT 'V1-004 observations' AS check_id, COUNT(*) AS actual FROM `swiftcare-patchamomma.swiftcare_fhir_raw.observation`;

SELECT 'V2-001 orphan_encounters' AS check_id,
       SAFE_DIVIDE(COUNTIF(p.patient_id IS NULL), COUNT(*)) AS orphan_rate
FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_encounters` e
LEFT JOIN `swiftcare-patchamomma.swiftcare_fhir_analytics.dim_patients` p
  ON e.patient_id = p.patient_id;

SELECT 'V3-001 encounter_coverage' AS check_id,
       SAFE_DIVIDE(COUNT(DISTINCT e.patient_id), (SELECT COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_raw._cohort_patient_ids`)) AS coverage
FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_encounters` e;

SELECT 'V4-001 future_encounters' AS check_id, COUNT(*) AS future_count
FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_encounters`
WHERE visit_date > CURRENT_DATE();

SELECT 'V5-001 patient_360' AS check_id, COUNT(*) AS row_count
FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_patient_360`;

SELECT 'V5-002 at_risk' AS check_id, COUNT(*) AS row_count
FROM `swiftcare-patchamomma.swiftcare_agent_cache.mv_at_risk_patients`;

SELECT 'V5-003 active_meds' AS check_id, COUNT(*) AS row_count
FROM `swiftcare-patchamomma.swiftcare_agent_cache.mv_active_medications`;

SELECT 'V5-004 vitals' AS check_id, COUNT(*) AS row_count
FROM `swiftcare-patchamomma.swiftcare_agent_cache.mv_patient_latest_vitals`;
