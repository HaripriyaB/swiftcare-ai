-- SwiftCare continuity queue: deterministic operational work items.
-- Synthetic/demo data only. This script never writes clinical source tables.

CREATE TABLE IF NOT EXISTS `swiftcare-patchamomma.swiftcare_ops.continuity_cards` (
  card_id STRING NOT NULL,
  patient_id STRING NOT NULL,
  patient_name STRING NOT NULL,
  priority STRING NOT NULL,
  priority_score INT64 NOT NULL,
  action_type STRING NOT NULL,
  action_label STRING NOT NULL,
  why_now STRING NOT NULL,
  evidence_json STRING NOT NULL,
  status STRING DEFAULT 'OPEN' NOT NULL,
  rule_version STRING NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP() NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP() NOT NULL,
  dismissed_reason STRING
);

CREATE TABLE IF NOT EXISTS `swiftcare-patchamomma.swiftcare_ops.continuity_action_events` (
  event_id STRING NOT NULL,
  card_id STRING NOT NULL,
  patient_id STRING NOT NULL,
  actor_user_id STRING NOT NULL,
  event_type STRING NOT NULL,
  outcome STRING,
  note STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP() NOT NULL
);

CREATE OR REPLACE VIEW `swiftcare-patchamomma.swiftcare_fhir_views.v_nboa_candidates` AS
WITH eligible AS (
  SELECT *
  FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_risk_flags`
  WHERE active_condition_count >= 3 OR active_med_count >= 5
), ranked AS (
  SELECT *, ROW_NUMBER() OVER (
    ORDER BY active_condition_count DESC, active_med_count DESC, last_visit_date DESC, patient_id
  ) AS demo_rank
  FROM eligible
)
SELECT
  risk.patient_id,
  CONCAT(risk.first_name, ' ', risk.last_name) AS patient_name,
  CASE
    WHEN risk.active_condition_count >= 8 THEN 60
    WHEN risk.active_med_count >= 5 THEN 40
    ELSE 30
  END AS priority_score,
  CASE
    WHEN risk.active_condition_count >= 8 THEN 'HIGH'
    WHEN risk.active_med_count >= 5 THEN 'MEDIUM'
    ELSE 'LOW'
  END AS priority,
  CASE
    WHEN risk.active_condition_count >= 3 OR risk.active_med_count >= 5 THEN 'REVIEW_WITH_CARE_TEAM'
  END AS action_type,
  CASE
    WHEN risk.active_condition_count >= 3 OR risk.active_med_count >= 5 THEN 'Review with care team'
  END AS action_label,
  CASE
    WHEN risk.active_condition_count >= 3 THEN CONCAT(CAST(risk.active_condition_count AS STRING), ' documented active conditions may need coordination review.')
    WHEN risk.active_med_count >= 5 THEN CONCAT(CAST(risk.active_med_count AS STRING), ' active medications are documented on file for review.')
  END AS why_now,
  TO_JSON_STRING([
    STRUCT(
      CASE
        WHEN risk.active_condition_count >= 3 THEN 'Documented active conditions'
        ELSE 'Active medications on file'
      END AS label,
      CASE
        WHEN risk.active_condition_count >= 3 THEN CONCAT(CAST(risk.active_condition_count AS STRING), ' active conditions')
        ELSE CONCAT(CAST(risk.active_med_count AS STRING), ' active medications')
      END AS value,
      'swiftcare_fhir_views.v_risk_flags' AS source
    ),
    STRUCT('Last visit date' AS label, CAST(risk.last_visit_date AS STRING) AS value,
           'swiftcare_fhir_views.v_risk_flags' AS source)
  ]) AS evidence_json,
  'v1' AS rule_version
FROM `swiftcare-patchamomma.swiftcare_fhir_views.v_risk_flags` risk
JOIN ranked USING (patient_id)
WHERE demo_rank <= 8;

-- Idempotently materialize one open work item per patient/action combination.
MERGE `swiftcare-patchamomma.swiftcare_ops.continuity_cards` target
USING `swiftcare-patchamomma.swiftcare_fhir_views.v_nboa_candidates` source
ON target.patient_id = source.patient_id
  AND target.action_type = source.action_type
  AND target.status IN ('OPEN', 'IN_PROGRESS')
WHEN NOT MATCHED THEN INSERT (
  card_id, patient_id, patient_name, priority, priority_score, action_type,
  action_label, why_now, evidence_json, status, rule_version
) VALUES (
  GENERATE_UUID(), source.patient_id, source.patient_name, source.priority,
  source.priority_score, source.action_type, source.action_label, source.why_now,
  source.evidence_json, 'OPEN', source.rule_version
);
