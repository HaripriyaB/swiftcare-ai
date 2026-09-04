CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_analytics.dim_patients` AS
SELECT
  p.id AS patient_id,
  p.name[SAFE_OFFSET(0)].given[SAFE_OFFSET(0)] AS first_name,
  p.name[SAFE_OFFSET(0)].family AS last_name,
  DATE(p.birthDate) AS birth_date,
  CAST(NULL AS DATE) AS death_date,
  p.gender,
  p.address[SAFE_OFFSET(0)].city AS city,
  p.address[SAFE_OFFSET(0)].state AS state,
  p.address[SAFE_OFFSET(0)].postalCode AS zip,
  COALESCE(p.deceased.boolean, FALSE) AS is_deceased,
  DATE_DIFF(CURRENT_DATE(), DATE(p.birthDate), YEAR) AS age_years,
  CURRENT_TIMESTAMP() AS created_at
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.patient` p;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_encounters`
CLUSTER BY patient_id, encounter_class AS
SELECT
  e.id AS encounter_id,
  e.subject.patientId AS patient_id,
  e.participant[SAFE_OFFSET(0)].individual.practitionerId AS provider_id,
  e.serviceProvider.organizationId AS organization_id,
  e.class.code AS encounter_class,
  COALESCE(e.type[SAFE_OFFSET(0)].text, e.type[SAFE_OFFSET(0)].coding[SAFE_OFFSET(0)].display) AS encounter_desc,
  COALESCE(e.reason[SAFE_OFFSET(0)].text, e.reason[SAFE_OFFSET(0)].coding[SAFE_OFFSET(0)].display) AS reason_desc,
  DATE(e.period.start) AS visit_date,
  TIMESTAMP(e.period.start) AS start_datetime,
  TIMESTAMP(e.period.end) AS stop_datetime,
  e.status,
  CURRENT_TIMESTAMP() AS created_at
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.encounter` e;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_conditions`
CLUSTER BY patient_id, condition_code AS
SELECT
  c.id AS condition_id,
  c.subject.patientId AS patient_id,
  c.context.encounterId AS encounter_id,
  c.code.coding[SAFE_OFFSET(0)].code AS condition_code,
  c.code.text AS condition_desc,
  DATE(c.onset.dateTime) AS onset_date,
  DATE(COALESCE(c.abatement.dateTime, c.abatement.period.start)) AS abatement_date,
  c.clinicalStatus = 'active' AS is_active,
  CURRENT_TIMESTAMP() AS created_at
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.condition` c;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_medications`
CLUSTER BY patient_id, medication_code AS
SELECT
  m.id AS medication_id,
  m.subject.patientId AS patient_id,
  m.context.encounterId AS encounter_id,
  m.medication.codeableConcept.coding[SAFE_OFFSET(0)].code AS medication_code,
  m.medication.codeableConcept.text AS medication_desc,
  DATE(m.authoredOn) AS start_date,
  m.status IN ('active', 'on-hold') AS is_active,
  m.status,
  CURRENT_TIMESTAMP() AS created_at
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.medication_request` m;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_observations`
CLUSTER BY patient_id, category, observation_code AS
SELECT
  o.id AS observation_id,
  o.subject.patientId AS patient_id,
  o.context.encounterId AS encounter_id,
  DATE(COALESCE(o.effective.dateTime, o.effective.period.start)) AS observation_date,
  COALESCE(o.category[SAFE_OFFSET(0)].coding[SAFE_OFFSET(0)].code, o.category[SAFE_OFFSET(0)].text) AS category,
  o.code.coding[SAFE_OFFSET(0)].code AS observation_code,
  o.code.text AS observation_desc,
  o.value.quantity.value AS value_numeric,
  o.value.quantity.unit AS units,
  CAST(NULL AS STRING) AS value_string,
  CURRENT_TIMESTAMP() AS created_at
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.observation` o;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_analytics.fact_allergies`
CLUSTER BY patient_id AS
SELECT
  a.id AS allergy_id,
  a.patient.patientId AS patient_id,
  a.code.text AS allergy_desc,
  a.criticality,
  a.clinicalStatus = 'active' AS is_active,
  CURRENT_TIMESTAMP() AS created_at
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.allergy_intolerance` a;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_analytics.dim_providers` AS
SELECT
  id AS provider_id,
  CONCAT(
    COALESCE(name[SAFE_OFFSET(0)].prefix[SAFE_OFFSET(0)], ''),
    ' ',
    COALESCE(name[SAFE_OFFSET(0)].given[SAFE_OFFSET(0)], ''),
    ' ',
    COALESCE(name[SAFE_OFFSET(0)].family, '')
  ) AS provider_name,
  qualification[SAFE_OFFSET(0)].code.text AS speciality
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.practitioner`;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_analytics.dim_organizations` AS
SELECT
  id AS organization_id,
  name AS org_name,
  address[SAFE_OFFSET(0)].city AS city,
  address[SAFE_OFFSET(0)].state AS state
FROM `swiftcare-patchamomma.swiftcare_fhir_raw.organization`;
