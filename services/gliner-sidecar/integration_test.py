import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SIDECAR_DIR = os.path.join(ROOT_DIR, "services", "gliner-sidecar")
DEFAULT_GLINER_MODEL = os.path.join(ROOT_DIR, ".models", "gliner_multi-v2.1")


def main() -> int:
    api_key = os.environ.get("TERM_EXTRACTOR_API_KEY", "local-dev-key")
    port = int(os.environ.get("GLINER_SIDECAR_TEST_PORT", "8765"))
    base_url = f"http://127.0.0.1:{port}"

    env = os.environ.copy()
    env.setdefault("TERM_EXTRACTOR_API_KEY", api_key)
    env.setdefault("GLINER_MODEL", DEFAULT_GLINER_MODEL)

    require_file(env["GLINER_MODEL"], "GLiNER model")

    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=SIDECAR_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    try:
        wait_for_health(base_url, api_key, process)
        verify_extraction(base_url, api_key)
        print("integration ok: GLiNER extraction is available")
        return 0
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=10)


def require_file(path: str, label: str) -> None:
    if not os.path.exists(path):
        raise SystemExit(f"{label} is missing: {path}")


def wait_for_health(base_url: str, api_key: str, process: subprocess.Popen[str]) -> None:
    deadline = time.time() + 30
    while time.time() < deadline:
        if process.poll() is not None:
            output = process.stdout.read() if process.stdout else ""
            raise SystemExit(f"sidecar exited early with code {process.returncode}\n{output}")

        try:
            request_json(base_url + "/metadata", api_key)
            return
        except Exception:
            time.sleep(0.5)

    raise SystemExit("sidecar did not become ready within 30 seconds")


def verify_extraction(base_url: str, api_key: str) -> None:
    payload = {
        "chunks": [
            {
                "chunkId": "chunk_1",
                "content": "PostgreSQL supports pgvector indexing for retrieval augmented generation.",
            }
        ],
        "labels": ["technology", "tool", "concept"],
        "threshold": 0.3,
        "languageHint": "en",
    }
    response = request_json(base_url + "/extract", api_key, payload)
    extractor = response.get("extractor")
    if not isinstance(extractor, dict) or not extractor.get("name"):
        raise AssertionError(f"expected extractor metadata, got: {extractor!r}")

    candidates = response.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        raise AssertionError(f"expected GLiNER candidates, got: {candidates!r}")

    extracted_texts = {candidate.get("text") for candidate in candidates if isinstance(candidate, dict)}
    if "retrieval augmented generation" not in extracted_texts:
        raise AssertionError(f"expected RAG concept candidate, got: {sorted(extracted_texts)}")


def request_json(url: str, api_key: str, payload: dict | None = None) -> dict:
    data = None
    method = "GET"
    headers = {"Authorization": f"Bearer {api_key}"}

    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        method = "POST"
        headers["Content-Type"] = "application/json"

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} failed with {exc.code}: {body}") from exc


if __name__ == "__main__":
    raise SystemExit(main())
