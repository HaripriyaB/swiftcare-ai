-- Example: grant a Firebase Auth staff user chart + population access.
-- Replace YOUR_FIREBASE_UID with Authentication → Users → User UID.
--
--   bq query --use_legacy_sql=false < sql/10_seed_access_grant.example.sql
--
-- A NULL patient_id grants population (insights / at-risk lists).
-- Concrete patient_id values grant one chart. can_write=true allows mutations.

INSERT INTO `swiftcare-patchamomma.swiftcare_ops.patient_access_grants`
  (user_id, patient_id, can_write, active, granted_by)
VALUES
  ('YOUR_FIREBASE_UID', NULL, TRUE, TRUE, 'bootstrap'),
  -- Optional: grant a specific Synthea patient chart (search "Kuhn" in the UI)
  -- ('YOUR_FIREBASE_UID', 'PATIENT_ID_FROM_SEARCH', TRUE, TRUE, 'bootstrap')
;
