from __future__ import annotations

from typing import Any

from agents.patient_lookup import search_patients_any_core


def test_fever_search_uses_documented_elevated_temperature_view() -> None:
    captured: dict[str, Any] = {}

    def run_query(sql: str, params: dict[str, Any]):
        captured["sql"] = sql
        captured["params"] = params
        return (
            [
                {
                    "patient_id": "synthetic-patient-1",
                    "first_name": "Miki234",
                    "last_name": "Upton904",
                    "city": "Boston",
                    "state": "Massachusetts",
                    "last_visit_date": "2010-03-22",
                    "age_years": 42,
                    "gender": "female",
                    "match_score": 270,
                    "matched_on": "elevated_temperature_recorded",
                }
            ],
            1,
            9,
        )

    def fq(dataset: str, table: str) -> str:
        return f"`swiftcare-patchamomma.{dataset}.{table}`"

    result = search_patients_any_core(run_query=run_query, fq=fq, query="fever")

    assert "v_patient_temperature_observations" in captured["sql"]
    assert "temperature_celsius >= 38.0" in captured["sql"]
    assert result["matches"][0]["matched_on"] == "elevated_temperature_recorded"
    assert "Elevated temperature recorded" in result["results_table"]


def test_unrelated_search_does_not_enable_temperature_mapping() -> None:
    captured: dict[str, Any] = {}

    def run_query(sql: str, params: dict[str, Any]):
        captured["sql"] = sql
        captured["params"] = params
        return [], 0, 4

    def fq(dataset: str, table: str) -> str:
        return f"`swiftcare-patchamomma.{dataset}.{table}`"

    result = search_patients_any_core(run_query=run_query, fq=fq, query="diabetes")

    assert "v_patient_temperature_observations" not in captured["sql"]
    assert result["match_count"] == 0
