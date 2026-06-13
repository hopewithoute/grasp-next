from app.parsing.contracts import ParseResult

def parse_markdown(raw_markdown: str) -> ParseResult:
    content = raw_markdown.strip()
    lines = content.split("\n")
    
    metadata = {}
    if lines and lines[0].startswith("# "):
        metadata["title"] = lines[0][2:].strip()
        
    return ParseResult(content=content, metadata=metadata)
