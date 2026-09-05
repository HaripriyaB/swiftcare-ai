from unittest.mock import patch


def test_search_contract(client, auth_headers):
    fake = {
        "match_count": 1,
        "matches": [
            {
                "patient_id": "p1",
                "first_name": "Fannie123",
                "last_name": "Kuhn456",
                "display_first_name": "Fannie",
                "display_last_name": "Kuhn",
            }
        ],
        "results_table": "| # | ...",
        "display_hint": "Select a row",
    }
    with patch(
        "api.routers.patients.search_patients", return_value=fake
    ):
        res = client.get(
            "/api/v1/patients/search?q=Kuhn", headers=auth_headers
        )
    assert res.status_code == 200
    body = res.json()
    assert body["match_count"] == 1
    assert body["matches"][0]["display_last_name"] == "Kuhn"


def test_summary_404(client, auth_headers):
    with patch(
        "api.routers.patients.get_patient_summary", return_value=None
    ):
        res = client.get(
            "/api/v1/patients/missing/summary", headers=auth_headers
        )
    assert res.status_code == 404
    assert res.json()["error"] == "not_found"


def test_chat_refuse(client, auth_headers):
    res = client.post(
        "/api/v1/chat",
        headers=auth_headers,
        json={"message": "Please diagnose and prescribe antibiotics"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["agent_type"] == "orchestrator"
    assert "diagnos" in body["reply"].lower() or "can’t" in body["reply"].lower() or "can't" in body["reply"].lower()
    assert body["patients"] == []
