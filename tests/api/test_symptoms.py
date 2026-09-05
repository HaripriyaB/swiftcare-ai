from unittest.mock import patch

from api import symptoms as symptoms_mod


def test_list_symptoms_mocked(client, auth_headers):
    rows = [
        {
            "symptom_id": "s1",
            "patient_id": "p1",
            "description": "Cough",
            "reported_by": "staff",
            "status": "active",
            "recorded_at": "2026-01-01T00:00:00",
            "resolved_at": None,
        }
    ]
    with patch.object(symptoms_mod, "list_symptoms", return_value=rows):
        res = client.get(
            "/api/v1/patients/p1/symptoms", headers=auth_headers
        )
    assert res.status_code == 200
    assert res.json()[0]["description"] == "Cough"
