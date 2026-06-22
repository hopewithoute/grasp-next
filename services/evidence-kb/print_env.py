from app.settings import get_settings
s = get_settings()
print("URL:", s.EMBEDDING_SERVICE_URL)
