import json
from app.main import app

def export_openapi():
    openapi_schema = app.openapi()
    with open("../../openapi.json", "w") as f:
        json.dump(openapi_schema, f, indent=2)
    print("Successfully exported openapi.json to /var/www/grasp-next/openapi.json")

if __name__ == "__main__":
    export_openapi()
