"""
Multi-format document ingestion service.
Supported formats: PDF, TXT, MD, CSV, DOCX
"""
import csv
import io
import re
from typing import List, Optional

import markdown
from pypdf import PdfReader


# ──────────────────────────────────────────────
# Data class
# ──────────────────────────────────────────────

class DocumentChunkInfo:
    def __init__(self, content: str, page_num: Optional[int] = None):
        self.content = content
        self.page_num = page_num


# ──────────────────────────────────────────────
# Text cleaning helpers
# ──────────────────────────────────────────────

def _fix_spacing(text: str) -> str:
    """
    Repair common PDF/DOCX extraction artefacts:
    - Missing space before a capital letter after a lowercase/digit
      e.g. "1September2026" → "1 September 2026"
    - Collapsed spaces around punctuation
    - Multiple consecutive spaces / newlines
    """
    # Insert space between digit+letter or letter+digit boundaries
    # (catches "1September", "June2026", "JohnDoe" etc.)
    text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)          # camelCase boundary
    text = re.sub(r'(\d)([A-Za-z])', r'\1 \2', text)          # digit → letter
    text = re.sub(r'([A-Za-z])(\d)', r'\1 \2', text)          # letter → digit

    # Normalize whitespace: collapse multiple spaces, fix newlines
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _remove_html_tags(html: str) -> str:
    """Strip HTML tags returned by the `markdown` library."""
    return re.sub(r'<[^>]+>', '', html)


# ──────────────────────────────────────────────
# Chunking
# ──────────────────────────────────────────────

def _split_sentences(text: str) -> List[str]:
    """Simple regex sentence splitter that preserves sentence boundaries."""
    parts = re.split(r'(?<=[.!?])\s+', text)
    return [p.strip() for p in parts if p.strip()]


def _make_chunks(
    text: str,
    page_num: Optional[int] = None,
    chunk_size: int = 900,
    chunk_overlap: int = 150,
) -> List[DocumentChunkInfo]:
    """Sentence-aware chunking with overlap."""
    sentences = _split_sentences(text)
    if not sentences:
        return []

    chunks: List[DocumentChunkInfo] = []
    current: List[str] = []
    current_len = 0

    for sent in sentences:
        sent_len = len(sent)
        if current_len + sent_len > chunk_size and current:
            chunks.append(DocumentChunkInfo(" ".join(current), page_num))
            # Keep overlap tail
            overlap: List[str] = []
            ol = 0
            for s in reversed(current):
                if ol + len(s) <= chunk_overlap:
                    overlap.insert(0, s)
                    ol += len(s) + 1
                else:
                    break
            current, current_len = overlap, ol
        current.append(sent)
        current_len += sent_len + 1

    if current:
        chunks.append(DocumentChunkInfo(" ".join(current), page_num))
    return chunks


def _chunk_rows(rows: List[str], chunk_size: int = 800) -> List[DocumentChunkInfo]:
    """
    Structure-aware chunking for tabular data (CSV).
    Groups rows into fixed-size text blocks, each starting with the header.
    """
    if not rows:
        return []
    header = rows[0]
    chunks: List[DocumentChunkInfo] = []
    block: List[str] = [header]
    block_len = len(header)

    for row in rows[1:]:
        if block_len + len(row) + 1 > chunk_size and len(block) > 1:
            chunks.append(DocumentChunkInfo("\n".join(block)))
            block = [header, row]
            block_len = len(header) + len(row) + 1
        else:
            block.append(row)
            block_len += len(row) + 1

    if len(block) > 1:
        chunks.append(DocumentChunkInfo("\n".join(block)))
    return chunks


# ──────────────────────────────────────────────
# Format parsers
# ──────────────────────────────────────────────

def parse_pdf(content: bytes) -> List[DocumentChunkInfo]:
    reader = PdfReader(io.BytesIO(content))
    all_chunks: List[DocumentChunkInfo] = []
    for i, page in enumerate(reader.pages, start=1):
        raw = page.extract_text() or ""
        cleaned = _fix_spacing(raw)
        if cleaned:
            all_chunks.extend(_make_chunks(cleaned, page_num=i))
    return all_chunks


def parse_txt(content: bytes) -> List[DocumentChunkInfo]:
    text = _fix_spacing(content.decode("utf-8", errors="replace"))
    return _make_chunks(text)


def parse_md(content: bytes) -> List[DocumentChunkInfo]:
    raw = content.decode("utf-8", errors="replace")
    # Convert MD → HTML → plain text so we preserve headings as text but drop syntax
    html = markdown.markdown(raw)
    text = _fix_spacing(_remove_html_tags(html))
    return _make_chunks(text)


def parse_csv(content: bytes) -> List[DocumentChunkInfo]:
    text = content.decode("utf-8", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows = [", ".join(row) for row in reader if any(cell.strip() for cell in row)]
    return _chunk_rows(rows)


def parse_docx(content: bytes) -> List[DocumentChunkInfo]:
    try:
        import docx  # python-docx
    except ImportError:
        raise ValueError("python-docx is not installed. Add it to requirements.txt.")

    doc = docx.Document(io.BytesIO(content))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    text = _fix_spacing("\n\n".join(paragraphs))
    return _make_chunks(text)


# ──────────────────────────────────────────────
# Router / public API
# ──────────────────────────────────────────────

_EXT_MAP = {
    ".pdf":      parse_pdf,
    ".txt":      parse_txt,
    ".md":       parse_md,
    ".markdown": parse_md,
    ".csv":      parse_csv,
    ".docx":     parse_docx,
}

_MIME_MAP = {
    "application/pdf":  parse_pdf,
    "text/plain":       parse_txt,
    "text/markdown":    parse_md,
    "text/csv":         parse_csv,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": parse_docx,
}


class DocumentIngestionService:
    """
    Format router: detects file type by extension or MIME type and
    delegates to the correct parser.
    """

    def process_document(
        self, content: bytes, file_type: str, filename: str
    ) -> List[DocumentChunkInfo]:
        name = filename.lower()

        # Try extension first (more reliable than MIME from browser)
        for ext, parser in _EXT_MAP.items():
            if name.endswith(ext):
                return parser(content)

        # Fallback: MIME type
        if file_type in _MIME_MAP:
            return _MIME_MAP[file_type](content)

        raise ValueError(
            f"Unsupported file type '{file_type}' / filename '{filename}'. "
            "Supported: PDF, TXT, MD, CSV, DOCX."
        )


ingestion_service = DocumentIngestionService()
