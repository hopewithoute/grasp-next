import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request


ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SIDECAR_DIR = os.path.join(ROOT_DIR, "services", "embedding-sidecar")
DEFAULT_MODEL_PATH = os.path.join(
    ROOT_DIR,
    ".models",
    "qwen3-embedding-0.6b-gguf",
    "Qwen3-Embedding-0.6B-Q8_0.gguf",
)


def main() -> int:
    api_key = os.environ.get("EMBEDDING_API_KEY", "local-dev-key")
    port = int(os.environ.get("EMBEDDING_SIDECAR_TEST_PORT", "8766"))
    base_url = f"http://127.0.0.1:{port}"

    env = os.environ.copy()
    env.setdefault("EMBEDDING_API_KEY", api_key)
    env.setdefault("EMBEDDING_MODEL", "Qwen/Qwen3-Embedding-0.6B")
    env.setdefault("EMBEDDING_MODEL_PATH", DEFAULT_MODEL_PATH)

    require_file(env["EMBEDDING_MODEL_PATH"], "embedding model")

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
        verify_embeddings(base_url, api_key)
        print("integration ok: embedding service is available")
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
            raise SystemExit(f"embedding sidecar exited early with code {process.returncode}\n{output}")

        try:
            request_json(base_url + "/metadata", api_key)
            return
        except Exception:
            time.sleep(0.5)

    raise SystemExit("embedding sidecar did not become ready within 30 seconds")


def verify_embeddings(base_url: str, api_key: str) -> None:
    payload = {
        "model": "Qwen/Qwen3-Embedding-0.6B",
        "dimensions": 1024,
        "input": ["vector search", "graph retrieval"],
    }
    response = request_json(base_url + "/v1/embeddings", api_key, payload)
    data = response.get("data")
    if not isinstance(data, list) or len(data) != 2:
        raise AssertionError(f"expected 2 embedding items, got: {data!r}")

    dimensions = [len(item.get("embedding", [])) for item in data if isinstance(item, dict)]
    if dimensions != [1024, 1024]:
        raise AssertionError(f"expected 1024-dimensional embeddings, got: {dimensions}")


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
