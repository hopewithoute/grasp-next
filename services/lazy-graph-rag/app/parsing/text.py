from app.parsing.contracts import ParseResult

def parse_text(raw_text: str) -> ParseResult:
    return ParseResult(content=raw_text.strip(), metadata={})
