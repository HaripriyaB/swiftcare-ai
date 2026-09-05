CREATE TABLE IF NOT EXISTS `swiftcare-patchamomma.swiftcare_ops.sessions` (
  session_id        STRING NOT NULL,
  user_id           STRING,
  active_patient_id STRING,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP(),
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS `swiftcare-patchamomma.swiftcare_ops.advisory_cards` (
  card_id      STRING NOT NULL,
  session_id   STRING,
  patient_id   STRING NOT NULL,
  agent_type   STRING,
  content      STRING,
  source_refs  STRING,
  dismissed    BOOL DEFAULT FALSE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS `swiftcare-patchamomma.swiftcare_ops.agent_query_log` (
  log_id                 STRING NOT NULL,
  session_id             STRING,
  agent_type             STRING NOT NULL,
  patient_id             STRING,
  natural_language_query STRING,
  generated_sql          STRING,
  row_count              INT64,
  latency_ms             INT64,
  created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS `swiftcare-patchamomma.swiftcare_ops.insight_alerts` (
  alert_id   STRING NOT NULL,
  patient_id STRING NOT NULL,
  alert_type STRING,
  severity   STRING,
  message    STRING,
  dismissed  BOOL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

CREATE TABLE IF NOT EXISTS `swiftcare-patchamomma.swiftcare_ops.patient_access_audit` (
  audit_id   STRING NOT NULL,
  user_id    STRING,
  patient_id STRING NOT NULL,
  action     STRING,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

-- Production authorization source. Keep it empty for the synthetic demo.
-- A NULL patient_id is a population-level grant; concrete IDs grant one chart.
CREATE TABLE IF NOT EXISTS `swiftcare-patchamomma.swiftcare_ops.patient_access_grants` (
  user_id     STRING NOT NULL,
  patient_id  STRING,
  can_write   BOOL NOT NULL DEFAULT FALSE,
  active      BOOL NOT NULL DEFAULT TRUE,
  granted_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP(),
  granted_by  STRING
);

CREATE TABLE IF NOT EXISTS `swiftcare-patchamomma.swiftcare_ops.data_validation_runs` (
  run_id        STRING NOT NULL,
  run_timestamp TIMESTAMP NOT NULL,
  check_id      STRING NOT NULL,
  check_name    STRING,
  severity      STRING,
  expected      STRING,
  actual        STRING,
  passed        BOOL,
  details       STRING
);
