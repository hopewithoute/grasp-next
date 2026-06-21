import logging
import httpx
import asyncio
from functools import lru_cache

logger = logging.getLogger(__name__)


class EmbeddingClient:
    """Async client for an OpenAI-compatible embedding service (e.g. embedding-sidecar)."""

    def __init__(
        self,
        base_url: str,
        api_key: str | None = None,
        dimensions: int | None = None,
        timeout: float = 30.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.dimensions = dimensions
        self.timeout = timeout
        self._client = httpx.AsyncClient(timeout=self.timeout)

    def _headers(self) -> dict[str, str]:
        headers: dict[str, str] = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def embed_texts(self, texts: list[str], batch_size: int = 100) -> list[list[float]]:
        """Embed a batch of texts. Returns one vector per text."""
        if not texts:
            return []

        all_embeddings = []
        semaphore = asyncio.Semaphore(5)  # Max 5 concurrent requests

        async def fetch_batch(batch: list[str], batch_index: int) -> tuple[int, list[list[float]]]:
            payload = {"input": batch}
            if self.dimensions:
                payload["dimensions"] = self.dimensions  # type: ignore

            async with semaphore:
                response = await self._client.post(
                    f"{self.base_url}/v1/embeddings",
                    headers=self._headers(),
                    json=payload,
                )
            response.raise_for_status()
            data = response.json()
            items = sorted(data["data"], key=lambda item: item["index"])
            return batch_index, [item["embedding"] for item in items]

        tasks = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            tasks.append(fetch_batch(batch, i))

        results = await asyncio.gather(*tasks)
        # Reconstruct embeddings in the exact original order
        results.sort(key=lambda x: x[0])
        for _, batch_embeddings in results:
            all_embeddings.extend(batch_embeddings)

        return all_embeddings

    async def embed_query(self, text: str) -> list[float]:
        """Embed a single query text."""
        results = await self.embed_texts([text])
        return results[0]


@lru_cache
def get_embedding_client(
    base_url: str | None,
    api_key: str | None = None,
    dimensions: int | None = None,
) -> EmbeddingClient | None:
    """Return an EmbeddingClient if configured, else None."""
    if not base_url:
        return None
    return EmbeddingClient(base_url=base_url, api_key=api_key, dimensions=dimensions)
