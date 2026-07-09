from app.models import Location


def parse_text(content: str) -> list[tuple[str, Location]]:
    return [(content, Location(start_offset=0, end_offset=len(content)))]


def parse_pdf_bytes(content: bytes) -> list[tuple[str, Location]]:
    import fitz
    import pymupdf4llm

    with fitz.open(stream=content, filetype="pdf") as doc:
        pages: list[tuple[str, Location]] = []
        md_pages = pymupdf4llm.to_markdown(doc, page_chunks=True)

        for chunk in md_pages:
            page_text = chunk.get("text", "")  # type: ignore
            # Clean null bytes that might crash Postgres TEXT columns
            page_text = page_text.replace("\x00", "").strip()

            if page_text:
                page_number = chunk.get("metadata", {}).get("page_number", 1)  # type: ignore
                pages.append((page_text, Location(page=page_number)))

        return pages
