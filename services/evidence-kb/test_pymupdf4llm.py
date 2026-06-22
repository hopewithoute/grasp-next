import fitz
import pymupdf4llm
from io import BytesIO

def test():
    # Create a simple PDF for testing
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Hello world from PyMuPDF4LLM!")
    pdf_bytes = doc.write()
    doc.close()
    
    # Process with pymupdf4llm
    with fitz.open(stream=pdf_bytes, filetype="pdf") as pdf_doc:
        # Check if we can do page_chunks=True to get a list of dicts with text & metadata
        md_text = pymupdf4llm.to_markdown(pdf_doc, page_chunks=True)
        print(md_text)

if __name__ == "__main__":
    test()
