-- Chunk 6: patient-reported + staff-added symptoms (ops layer; not FHIR Condition).
-- Apply after sql/04_ops_tables.sql. Substitute project if needed.
-- Usage: bq query --use_legacy_sql=false < sql/09_patient_symptoms.sql

CREATE TABLE IF NOT EXISTS `swiftcare-patchamomma.swiftcare_ops.patient_symptoms` (
  symptom_id           STRING NOT NULL,
  patient_id           STRING NOT NULL,
  description          STRING NOT NULL,
  reported_by          STRING NOT NULL,  -- patient | staff
  recorded_by_user_id  STRING,
  status               STRING NOT NULL,  -- active | resolved
  recorded_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  resolved_at          TIMESTAMP
);
