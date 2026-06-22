import asyncio
from app.embedding.client import EmbeddingClient
from app.settings import get_settings
import time

async def test():
    settings = get_settings()
    client = EmbeddingClient(
        base_url=settings.EMBEDDING_SERVICE_URL,
        api_key=settings.EMBEDDING_SERVICE_API_KEY,
        dimensions=settings.EMBEDDING_DIMENSIONS
    )
    
    texts = ["This is a test sentence number " + str(i) * 50 for i in range(100)]
    start = time.time()
    try:
        embeddings = await client.embed_texts(texts, batch_size=100)
        print(f"Success! Embedded {len(embeddings)} items in {time.time()-start:.2f}s")
    except Exception as e:
        print(f"Error: {repr(e)}")

asyncio.run(test())
