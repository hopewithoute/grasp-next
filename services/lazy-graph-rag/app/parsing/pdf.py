import fitz  # PyMuPDF
from app.parsing.contracts import ParseResult

def parse_pdf(file_bytes: bytes) -> ParseResult:
    """Spike implementation of PDF parsing using PyMuPDF."""
    with fitz.open(stream=file_bytes, filetype="pdf") as doc:
        metadata = {
            "page_count": doc.page_count,
            "title": doc.metadata.get("title"),
            "author": doc.metadata.get("author")
        }
        content = "\n\n".join(page.get_text() for page in doc).strip()
        
    return ParseResult(content=content, metadata=metadata)
