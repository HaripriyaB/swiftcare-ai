-- Cohort: 5000 reproducible patient IDs
CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_raw._cohort_patient_ids` AS
SELECT id AS patient_id
FROM `bigquery-public-data.fhir_synthea.patient`
ORDER BY id
LIMIT 5000;

-- Core clinical tables
CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_raw.patient` AS
SELECT p.* FROM `bigquery-public-data.fhir_synthea.patient` p
JOIN `swiftcare-patchamomma.swiftcare_fhir_raw._cohort_patient_ids` c ON p.id = c.patient_id;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_raw.encounter` AS
SELECT e.* FROM `bigquery-public-data.fhir_synthea.encounter` e
JOIN `swiftcare-patchamomma.swiftcare_fhir_raw._cohort_patient_ids` c ON e.subject.patientId = c.patient_id;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_raw.condition` AS
SELECT x.* FROM `bigquery-public-data.fhir_synthea.condition` x
JOIN `swiftcare-patchamomma.swiftcare_fhir_raw._cohort_patient_ids` c ON x.subject.patientId = c.patient_id;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_raw.observation` AS
SELECT x.* FROM `bigquery-public-data.fhir_synthea.observation` x
JOIN `swiftcare-patchamomma.swiftcare_fhir_raw._cohort_patient_ids` c ON x.subject.patientId = c.patient_id;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_raw.medication_request` AS
SELECT x.* FROM `bigquery-public-data.fhir_synthea.medication_request` x
JOIN `swiftcare-patchamomma.swiftcare_fhir_raw._cohort_patient_ids` c ON x.subject.patientId = c.patient_id;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_raw.procedure` AS
SELECT x.* FROM `bigquery-public-data.fhir_synthea.procedure` x
JOIN `swiftcare-patchamomma.swiftcare_fhir_raw._cohort_patient_ids` c ON x.subject.patientId = c.patient_id;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_raw.allergy_intolerance` AS
SELECT x.* FROM `bigquery-public-data.fhir_synthea.allergy_intolerance` x
JOIN `swiftcare-patchamomma.swiftcare_fhir_raw._cohort_patient_ids` c ON x.patient.patientId = c.patient_id;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_raw.immunization` AS
SELECT x.* FROM `bigquery-public-data.fhir_synthea.immunization` x
JOIN `swiftcare-patchamomma.swiftcare_fhir_raw._cohort_patient_ids` c ON x.patient.patientId = c.patient_id;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_raw.diagnostic_report` AS
SELECT x.* FROM `bigquery-public-data.fhir_synthea.diagnostic_report` x
JOIN `swiftcare-patchamomma.swiftcare_fhir_raw._cohort_patient_ids` c ON x.subject.patientId = c.patient_id;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_raw.care_plan` AS
SELECT x.* FROM `bigquery-public-data.fhir_synthea.care_plan` x
JOIN `swiftcare-patchamomma.swiftcare_fhir_raw._cohort_patient_ids` c ON x.subject.patientId = c.patient_id;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_raw.organization` AS
SELECT * FROM `bigquery-public-data.fhir_synthea.organization`;

CREATE OR REPLACE TABLE `swiftcare-patchamomma.swiftcare_fhir_raw.practitioner` AS
SELECT * FROM `bigquery-public-data.fhir_synthea.practitioner`;
