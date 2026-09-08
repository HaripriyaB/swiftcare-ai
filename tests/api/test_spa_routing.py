from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.main import SPAStaticFiles


def test_client_route_falls_back_to_react_entrypoint(tmp_path):
    """A browser refresh on a React route must not become a server-side 404."""
    (tmp_path / "index.html").write_text("<main>SwiftCare</main>")
    app = FastAPI()
    app.mount("/", SPAStaticFiles(directory=tmp_path, html=True), name="fe")

    response = TestClient(app).get("/patient/example-patient")

    assert response.status_code == 200
    assert "SwiftCare" in response.text


def test_missing_asset_remains_a_404(tmp_path):
    (tmp_path / "index.html").write_text("<main>SwiftCare</main>")
    app = FastAPI()
    app.mount("/", SPAStaticFiles(directory=tmp_path, html=True), name="fe")

    response = TestClient(app).get("/assets/missing.js")

    assert response.status_code == 404
