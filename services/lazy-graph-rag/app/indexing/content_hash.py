import hashlib

def compute_content_hash(content: str) -> str:
    """Compute SHA256 hash of string content."""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()
