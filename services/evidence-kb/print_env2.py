from app.settings import get_settings
s = get_settings()
print("API_KEY:", s.EMBEDDING_SERVICE_API_KEY)
