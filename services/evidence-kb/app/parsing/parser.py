from app.models import Location


def parse_text(content: str) -> list[tuple[str, Location]]:
    return [(content, Location(start_offset=0, end_offset=len(content)))]


def parse_pdf_bytes(content: bytes) -> list[tuple[str, Location]]:
    import fitz

    with fitz.open(stream=content, filetype="pdf") as doc:
        pages: list[tuple[str, Location]] = []
        for page_index in range(doc.page_count):
            page = doc.load_page(page_index)
            text = page.get_text("text")
            if text.strip():  # type: ignore
                pages.append((text, Location(page=page_index + 1)))  # type: ignore
        return pages
