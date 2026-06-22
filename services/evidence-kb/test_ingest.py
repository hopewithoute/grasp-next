import asyncio
from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app
from app.settings import get_settings

client = TestClient(app)

def test_upload():
    # Use a dummy text file to act as PDF for testing, but parse_pdf_bytes will fail if it's not a real PDF!
    # Wait, let me download a tiny PDF.
    pass

if __name__ == "__main__":
    import urllib.request
    urllib.request.urlretrieve("https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", "dummy.pdf")
    with open("dummy.pdf", "rb") as f:
        response = client.post(
            "/v1/ingest/pdf",
            data={
                "tenantId": "test_tenant",
                "projectId": str(uuid4()),
                "externalSourceId": str(uuid4()),
                "title": "Test PDF"
            },
            files={"file": ("dummy.pdf", f, "application/pdf")},
            headers={"x-api-key": get_settings().API_KEY}
        )
    print(response.status_code)
    print(response.text)
