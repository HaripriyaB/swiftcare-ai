CREATE OR REPLACE VIEW `swiftcare-patchamomma.swiftcare_fhir_views.v_patient_demographics` AS
SELECT * FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.dim_patients`;

CREATE OR REPLACE VIEW `swiftcare-patchamomma.swiftcare_fhir_views.v_patient_timeline` AS
SELECT patient_id, event_date, event_type, event_label, source_id, encounter_id FROM (
  SELECT patient_id, visit_date AS event_date, 'encounter' AS event_type,
         encounter_desc AS event_label, encounter_id AS source_id, encounter_id
  FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_encounters`
  UNION ALL
  SELECT patient_id, onset_date, 'condition', condition_desc, condition_id, encounter_id
  FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_conditions`
  UNION ALL
  SELECT patient_id, observation_date, 'observation', observation_desc, observation_id, encounter_id
  FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_observations`
  UNION ALL
  SELECT patient_id, start_date, 'medication', medication_desc, medication_id, encounter_id
  FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_medications`
);

CREATE OR REPLACE VIEW `swiftcare-patchamomma.swiftcare_fhir_views.v_active_medications` AS
SELECT patient_id, medication_id, medication_code, medication_desc AS medication_name,
       start_date AS prescribed_date, status
FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_medications`
WHERE is_active = TRUE;

CREATE OR REPLACE VIEW `swiftcare-patchamomma.swiftcare_fhir_views.v_active_allergies` AS
SELECT patient_id, allergy_id, allergy_desc AS allergen, criticality
FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_allergies`
WHERE is_active = TRUE;

CREATE OR REPLACE VIEW `swiftcare-patchamomma.swiftcare_fhir_views.v_visit_summary` AS
SELECT encounter_id, patient_id, visit_date, encounter_class, encounter_desc AS visit_type,
       reason_desc AS chief_complaint, status
FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_encounters`;

CREATE OR REPLACE VIEW `swiftcare-patchamomma.swiftcare_fhir_views.v_risk_flags` AS
WITH as_of AS (
  -- Synthetic Synthea history is static. Anchor recency rules to its newest
  -- encounter instead of the wall clock so every patient does not age into a
  -- care gap after the dataset is generated.
  SELECT MAX(visit_date) AS as_of_date
  FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_encounters`
),
enc AS (
  SELECT patient_id, COUNT(*) AS total_encounters,
         MAX(visit_date) AS last_visit_date,
         COUNTIF(visit_date >= DATE_SUB(as_of.as_of_date, INTERVAL 90 DAY)) AS encounters_last_90d
  FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_encounters`
  CROSS JOIN as_of
  GROUP BY patient_id
),
meds AS (
  SELECT patient_id, COUNT(*) AS active_med_count
  FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_medications` WHERE is_active GROUP BY 1
),
conds AS (
  SELECT patient_id, COUNT(*) AS active_condition_count
  FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_conditions` WHERE is_active GROUP BY 1
)
SELECT p.patient_id, p.first_name, p.last_name, p.age_years,
       COALESCE(e.total_encounters, 0) AS total_encounters,
       e.last_visit_date,
       DATE_DIFF(as_of.as_of_date, e.last_visit_date, DAY) AS days_since_last_visit,
       COALESCE(e.encounters_last_90d, 0) AS encounters_last_90d,
       COALESCE(m.active_med_count, 0) AS active_med_count,
       COALESCE(c.active_condition_count, 0) AS active_condition_count,
       CASE
         WHEN DATE_DIFF(as_of.as_of_date, e.last_visit_date, DAY) > 365 THEN 'gap_in_care'
         WHEN COALESCE(m.active_med_count, 0) >= 5 THEN 'polypharmacy'
         WHEN COALESCE(e.encounters_last_90d, 0) >= 5 THEN 'high_utilizer'
         WHEN COALESCE(c.active_condition_count, 0) >= 3 THEN 'chronic_burden'
         ELSE 'none'
       END AS risk_flag,
       CASE
         WHEN COALESCE(e.encounters_last_90d, 0) >= 5 THEN 'HIGH'
         WHEN COALESCE(c.active_condition_count, 0) >= 3 THEN 'MEDIUM'
         WHEN DATE_DIFF(as_of.as_of_date, e.last_visit_date, DAY) > 180 THEN 'MEDIUM'
         ELSE 'LOW'
       END AS risk_level
FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.dim_patients` p
LEFT JOIN enc e ON p.patient_id = e.patient_id
LEFT JOIN meds m ON p.patient_id = m.patient_id
LEFT JOIN conds c ON p.patient_id = c.patient_id
CROSS JOIN as_of
WHERE NOT COALESCE(p.is_deceased, FALSE);

CREATE OR REPLACE VIEW `swiftcare-patchamomma.swiftcare_fhir_views.v_patient_360` AS
SELECT
  p.patient_id, p.first_name, p.last_name, p.birth_date, p.age_years, p.gender,
  p.city, p.state, p.is_deceased,
  le.encounter_class AS last_encounter_class,
  le.encounter_desc AS last_encounter_desc,
  le.visit_date AS last_visit_date,
  (SELECT COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_conditions` c
   WHERE c.patient_id = p.patient_id AND c.is_active) AS active_conditions_count,
  (SELECT COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_medications` m
   WHERE m.patient_id = p.patient_id AND m.is_active) AS active_medications_count,
  (SELECT COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_allergies` a
   WHERE a.patient_id = p.patient_id AND a.is_active) AS active_allergies_count,
  (SELECT COUNT(*) FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_encounters` e
   WHERE e.patient_id = p.patient_id) AS total_encounters
FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.dim_patients` p
LEFT JOIN (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY patient_id ORDER BY visit_date DESC) AS rn
  FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_encounters`
) le ON le.patient_id = p.patient_id AND le.rn = 1;
