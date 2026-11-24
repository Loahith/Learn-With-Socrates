"""Text extraction for PDF, DOCX, PPTX, TXT, MD and images (OCR)."""
import os

from flask import current_app

SECTION_CHARS = 3000


def _ocr_image(img):
    try:
        import pytesseract

        cmd = current_app.config.get("TESSERACT_CMD")
        if cmd:
            pytesseract.pytesseract.tesseract_cmd = cmd
        return pytesseract.image_to_string(img)
    except Exception as exc:
        current_app.logger.warning("OCR unavailable: %s", exc)
        return ""


def _split_sections(blocks):
    """Group paragraphs into ~3000-char sections (docx/txt/md have no real pages)."""
    pages, cur = [], ""
    for b in blocks:
        if cur and len(cur) + len(b) > SECTION_CHARS:
            pages.append(cur.strip())
            cur = ""
        cur += b + "\n"
    if cur.strip():
        pages.append(cur.strip())
    return [(i + 1, t) for i, t in enumerate(pages)]


def extract_pdf(path):
    import fitz  # PyMuPDF

    pages = []
    with fitz.open(path) as doc:
        for i, page in enumerate(doc, start=1):
            text = page.get_text("text").strip()
            if len(text) < 20:  # probably scanned -> OCR
                try:
                    from PIL import Image
                    import io

                    pix = page.get_pixmap(dpi=200)
                    img = Image.open(io.BytesIO(pix.tobytes("png")))
                    text = _ocr_image(img).strip() or text
                except Exception:
                    pass
            pages.append((i, text))
    return pages


def extract_docx(path):
    import docx

    d = docx.Document(path)
    blocks = [p.text.strip() for p in d.paragraphs if p.text.strip()]
    for t in d.tables:
        for row in t.rows:
            blocks.append(" | ".join(c.text.strip() for c in row.cells))
    return _split_sections(blocks)


def extract_pptx(path):
    from pptx import Presentation

    prs = Presentation(path)
    pages = []
    for i, slide in enumerate(prs.slides, start=1):
        parts = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                parts.append(shape.text_frame.text)
            if getattr(shape, "has_table", False) and shape.has_table:
                for row in shape.table.rows:
                    parts.append(" | ".join(c.text for c in row.cells))
        if slide.has_notes_slide:
            parts.append(slide.notes_slide.notes_text_frame.text)
        pages.append((i, "\n".join(p for p in parts if p.strip())))
    return pages


def extract_text_file(path):
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        blocks = [ln.rstrip() for ln in f.read().splitlines() if ln.strip()]
    return _split_sections(blocks)


def extract_image(path):
    from PIL import Image

    return [(1, _ocr_image(Image.open(path)).strip())]


def extract(path, ext):
    ext = ext.lower()
    if ext == "pdf":
        pages = extract_pdf(path)
    elif ext == "docx":
        pages = extract_docx(path)
    elif ext == "pptx":
        pages = extract_pptx(path)
    elif ext in ("txt", "md"):
        pages = extract_text_file(path)
    else:
        pages = extract_image(path)
    pages = [(n, t) for n, t in pages if t and t.strip()]
    if not pages:
        raise ValueError("No readable text found. If this is a scan, install Tesseract OCR (see README).")
    return pages


def chunk_pages(pages, size=900, overlap=150):
    chunks, idx = [], 0
    for page_no, text in pages:
        text = " ".join(text.split())
        start = 0
        while start < len(text):
            end = min(len(text), start + size)
            if end < len(text):  # try to break at a sentence end
                cut = text.rfind(". ", start + size // 2, end)
                if cut != -1:
                    end = cut + 1
            piece = text[start:end].strip()
            if len(piece) > 30:
                chunks.append({"page_number": page_no, "chunk_index": idx, "text": piece})
                idx += 1
            if end >= len(text):
                break
            start = max(end - overlap, start + 1)
    return chunks
