def test_missing_auth_401(client):
    res = client.get("/api/v1/session")
    assert res.status_code == 401
    body = res.json()
    assert body["error"] == "unauthorized"


def test_bypass_token(client, auth_headers):
    res = client.get("/api/v1/session", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["user_id"] == "dev-user"
    assert "session_id" in body
