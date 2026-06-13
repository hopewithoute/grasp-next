import pytest
from app.parsing.text import parse_text
from app.parsing.markdown import parse_markdown
from app.parsing.pdf import parse_pdf
import fitz

def test_parse_text():
    raw = "  Hello World  \n"
    res = parse_text(raw)
    assert res.content == "Hello World"
    assert res.metadata == {}

def test_parse_markdown():
    raw = "# My Title\n\nSome content"
    res = parse_markdown(raw)
    assert res.content == raw
    assert res.metadata["title"] == "My Title"

def test_parse_pdf():
    # Create a dummy PDF in memory using fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Hello PDF")
    doc.set_metadata({"title": "Test Doc", "author": "Tester"})
    pdf_bytes = doc.write()
    doc.close()
    
    res = parse_pdf(pdf_bytes)
    assert "Hello PDF" in res.content
    assert res.metadata["title"] == "Test Doc"
    assert res.metadata["page_count"] == 1
