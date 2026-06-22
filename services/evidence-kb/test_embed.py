import asyncio

async def main():
    try:
        from app.embedding.client import get_embedding_client
        from app.settings import get_settings
        settings = get_settings()
        print(f"URL: {settings.EMBEDDING_SERVICE_URL}")
        client = get_embedding_client(
            base_url=settings.EMBEDDING_SERVICE_URL,
            api_key=settings.EMBEDDING_SERVICE_API_KEY,
            dimensions=settings.EMBEDDING_DIMENSIONS,
        )
        print("Calling embed_texts...")
        res = await client.embed_texts(["This is a test."])
        print(f"Result length: {len(res)}, dimensions: {len(res[0]) if res else 0}")
    except Exception:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
