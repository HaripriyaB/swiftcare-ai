CREATE SCHEMA IF NOT EXISTS `swiftcare-patchamomma.swiftcare_fhir_raw`
  OPTIONS(location = 'US', description = 'FHIR R4 raw tables');

CREATE SCHEMA IF NOT EXISTS `swiftcare-patchamomma.swiftcare_fhir_analytics`
  OPTIONS(location = 'US', description = 'Partitioned dim/fact tables flattened from FHIR');

CREATE SCHEMA IF NOT EXISTS `swiftcare-patchamomma.swiftcare_fhir_views`
  OPTIONS(location = 'US', description = 'Agent-facing semantic views');

CREATE SCHEMA IF NOT EXISTS `swiftcare-patchamomma.swiftcare_agent_cache`
  OPTIONS(location = 'US', description = 'Materialized views for hot agent queries');

CREATE SCHEMA IF NOT EXISTS `swiftcare-patchamomma.swiftcare_ops`
  OPTIONS(location = 'US', description = 'Sessions, audit, advisories, validation');
