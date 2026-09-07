from unittest.mock import patch


def test_queue_contract(client, auth_headers):
    row = {
        "card_id": "c1",
        "patient_id": "p1",
        "patient_name": "Synthetic Patient",
        "priority": "HIGH",
        "priority_score": 60,
        "action_type": "REVIEW_WITH_CARE_TEAM",
        "action_label": "Review with care team",
        "why_now": "8 documented active conditions may need coordination review.",
        "evidence": [{"label": "Documented active conditions", "value": "8 active conditions", "source": "v_risk_flags"}],
        "status": "OPEN",
        "rule_version": "v1",
        "created_at": "2026-09-07T00:00:00+00:00",
        "updated_at": "2026-09-07T00:00:00+00:00",
        "disclaimer": "Operational support only — staff review required.",
    }
    with patch("api.routers.continuity.continuity.list_cards", return_value=[row]):
        res = client.get("/api/v1/continuity/queue", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["cards"][0]["action_label"] == "Review with care team"


def test_complete_rejects_unknown_outcome(client, auth_headers):
    res = client.post(
        "/api/v1/continuity/cards/c1/complete",
        headers=auth_headers,
        json={"outcome": "ORDER_MEDICATION"},
    )
    assert res.status_code == 400
    assert res.json()["error"] == "invalid_outcome"
