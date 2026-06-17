import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
SIDECAR_DIR = os.path.join(ROOT_DIR, "services", "embedding-sidecar")
DEFAULT_MODEL_PATH = os.path.join(
    ROOT_DIR,
    ".models",
    "qwen3-embedding-0.6b-gguf",
    "Qwen3-Embedding-0.6B-Q8_0.gguf",
)

DOCUMENTS = [
    "Machine learning is a subset of artificial intelligence that focuses on building systems that learn from data.",
    "Natural language processing enables computers to understand, interpret, and manipulate human language.",
    "Deep learning architectures such as deep neural networks, deep belief networks, and recurrent neural networks.",
    "Transformers have revolutionized the field of NLP by introducing self-attention mechanisms.",
    "Retrieval-Augmented Generation (RAG) is an AI framework for retrieving facts from an external knowledge base.",
    "Vector databases are purpose-built to handle the unique structure of vector embeddings.",
    "Graph databases store data in nodes and edges, emphasizing the relationships between entities.",
    "Large language models (LLMs) are trained on massive amounts of text data to generate human-like text.",
    "Embeddings represent words or phrases as dense vectors of real numbers in a continuous vector space.",
    "Fine-tuning a pre-trained model on a specific task can significantly improve its performance.",
]

def run_server_and_benchmark(mode: str, gpu_layers: str) -> float:
    api_key = "benchmark-key"
    port = 8767
    base_url = f"http://127.0.0.1:{port}"

    env = os.environ.copy()
    env.setdefault("EMBEDDING_API_KEY", api_key)
    env.setdefault("EMBEDDING_MODEL", "Qwen/Qwen3-Embedding-0.6B")
    env.setdefault("EMBEDDING_MODEL_PATH", DEFAULT_MODEL_PATH)
    env["EMBEDDING_GPU_LAYERS"] = gpu_layers

    if not os.path.exists(env["EMBEDDING_MODEL_PATH"]):
        raise SystemExit(f"Model missing: {env['EMBEDDING_MODEL_PATH']}")

    print(f"\nStarting server in {mode} mode (EMBEDDING_GPU_LAYERS={gpu_layers})...")
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
        print(f"Server ready. Sending {len(DOCUMENTS)} documents for embedding...")
        
        # Warmup request
        payload_warmup = {
            "model": "Qwen/Qwen3-Embedding-0.6B",
            "input": ["warmup document"],
        }
        request_json(base_url + "/v1/embeddings", api_key, payload_warmup)

        # Benchmark request
        payload = {
            "model": "Qwen/Qwen3-Embedding-0.6B",
            "input": DOCUMENTS,
        }
        start_time = time.time()
        request_json(base_url + "/v1/embeddings", api_key, payload)
        end_time = time.time()
        
        duration = end_time - start_time
        print(f"{mode} Ingestion Time: {duration:.4f} seconds")
        return duration
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=10)

def wait_for_health(base_url: str, api_key: str, process: subprocess.Popen) -> None:
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

def main():
    print("=== Embedding Ingestion Benchmark: CPU vs GPU ===")
    cpu_time = run_server_and_benchmark("CPU", "0")
    gpu_time = run_server_and_benchmark("GPU", "-1")

    print("\n=== Benchmark Results ===")
    print(f"CPU Time: {cpu_time:.4f}s")
    print(f"GPU Time: {gpu_time:.4f}s")
    
    if cpu_time > 0 and gpu_time > 0:
        speedup = cpu_time / gpu_time
        print(f"GPU is {speedup:.2f}x faster than CPU")

if __name__ == "__main__":
    main()
