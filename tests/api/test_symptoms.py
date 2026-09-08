from unittest.mock import patch

from api import symptoms as symptoms_mod


def test_staff_display_hides_internal_firebase_uid():
    assert symptoms_mod._staff_display("dev-user") == "dev-user@local"
    assert symptoms_mod._staff_display("FOPXzpS2aTPcBww7KPv7ekl772L2") == "Signed-in staff"
    assert symptoms_mod._staff_display(None) is None


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
