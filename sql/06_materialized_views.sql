-- Agent cache: snapshot tables (refreshed on demand; avoids MV shape restrictions).
-- Legacy `mv_` names are retained for compatibility with the agent tools.
CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_agent_cache.mv_patient_latest_vitals` AS
WITH ranked AS (
  SELECT
    patient_id, observation_code, value_numeric, observation_date,
    ROW_NUMBER() OVER (
      PARTITION BY patient_id, observation_code
      ORDER BY observation_date DESC, observation_id DESC
    ) AS rn
  FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_observations`
  WHERE category = 'vital-signs'
), latest AS (
  SELECT * FROM ranked WHERE rn = 1
)
SELECT
  patient_id,
  MAX(IF(observation_code = '8302-2', value_numeric, NULL))  AS height_cm,
  MAX(IF(observation_code = '29463-7', value_numeric, NULL)) AS weight_kg,
  MAX(IF(observation_code = '39156-5', value_numeric, NULL)) AS bmi,
  MAX(IF(observation_code = '8480-6', value_numeric, NULL))  AS systolic_bp,
  MAX(IF(observation_code = '8462-4', value_numeric, NULL))  AS diastolic_bp,
  MAX(IF(observation_code = '8867-4', value_numeric, NULL))  AS heart_rate,
  MAX(IF(observation_code = '9279-1', value_numeric, NULL))  AS respiratory_rate,
  MAX(observation_date) AS latest_observation_date,
  CURRENT_TIMESTAMP() AS cache_refreshed_at
FROM latest
GROUP BY patient_id;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_agent_cache.mv_active_medications` AS
SELECT m.patient_id, p.first_name, p.last_name, m.medication_code, m.medication_desc,
       m.start_date, m.status
FROM `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_medications` m
JOIN `swiftcare-patchamomma.swiftcare_fhir_analytics.dim_patients` p ON m.patient_id = p.patient_id
WHERE m.is_active = TRUE;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_agent_cache.mv_at_risk_patients` AS
SELECT patient_id, first_name, last_name, age_years, encounters_last_90d,
       active_condition_count, active_med_count, days_since_last_visit, risk_flag, risk_level
FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_risk_flags`
WHERE risk_flag != 'none';
