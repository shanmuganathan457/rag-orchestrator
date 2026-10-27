from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.document import Document, DocumentChunk
from app.providers.embeddings.base import validate_embedding_batch
from app.providers.factory import get_embedding
from app.services.ingestion import ingestion_service

router = APIRouter()
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB
ALLOWED_SUFFIXES = (".pdf", ".txt", ".md", ".markdown", ".csv", ".docx")
ALLOWED_TYPES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _doc_to_dict(doc: Document, db: Session, pages: int = 0, chunks: int = 0) -> dict:
    """Return document as dict matching the reference frontend Doc type."""
    if pages == 0 and chunks == 0:
        # List endpoint: compute from DB
        pages = db.query(func.max(DocumentChunk.page_num)).filter(
            DocumentChunk.document_id == doc.id
        ).scalar() or 0
        chunks = db.query(func.count(DocumentChunk.id)).filter(
            DocumentChunk.document_id == doc.id
        ).scalar() or 0
    return {
        "id": doc.id,
        "name": doc.filename,
        "pages": pages,
        "chunks": chunks,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
    }


@router.get("/")
def list_documents(db: Session = Depends(get_db)):
    """List all documents with name, pages, chunks — matching reference Doc type."""
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    return [_doc_to_dict(doc, db) for doc in docs]


@router.post("/", status_code=201)
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = file.filename or ""
    if file.content_type not in ALLOWED_TYPES and not filename.lower().endswith(ALLOWED_SUFFIXES):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Upload a PDF, TXT, MD, CSV or DOCX file.",
        )

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_FILE_SIZE // 1024 // 1024} MB limit.")

    try:
        chunks_info = ingestion_service.process_document(content, file.content_type or "", filename)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Error processing document") from exc
    if not chunks_info:
        raise HTTPException(status_code=422, detail="No extractable text found (scanned PDFs need OCR).")

    try:
        chunk_texts = [info.content for info in chunks_info]
        embeddings = validate_embedding_batch(
            await get_embedding().embed_batch(chunk_texts),
            len(chunks_info),
            settings.EMBEDDING_DIMENSION,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Error generating document embeddings") from exc

    try:
        db_doc = Document(filename=filename, file_type=file.content_type or "")
        db.add(db_doc)
        db.flush()
        db.add_all(
            [
                DocumentChunk(
                    document_id=db_doc.id,
                    content=info.content,
                    embedding=embeddings[index],
                    page_num=info.page_num,
                )
                for index, info in enumerate(chunks_info)
            ]
        )
        db.commit()
        db.refresh(db_doc)
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error saving document") from exc

    page_nums = [info.page_num for info in chunks_info if info.page_num]
    max_page = max(page_nums) if page_nums else 1
    return _doc_to_dict(db_doc, db, pages=max_page, chunks=len(chunks_info))


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: int, db: Session = Depends(get_db)):
    """Delete document and all its chunks (cascades via DB relationship)."""
    db_doc = db.query(Document).filter(Document.id == document_id).first()
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    db.delete(db_doc)
    db.commit()