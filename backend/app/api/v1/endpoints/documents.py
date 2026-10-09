from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.document import Document, DocumentChunk
from app.providers.embeddings.base import validate_embedding_batch
from app.providers.factory import get_embedding
from app.schemas.document import DocumentResponse
from app.services.ingestion import ingestion_service

router = APIRouter()
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_SUFFIXES = (".pdf", ".txt", ".md", ".markdown")
ALLOWED_TYPES = {"application/pdf", "text/plain", "text/markdown"}


@router.post("/", response_model=DocumentResponse)
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = file.filename or ""
    if file.content_type not in ALLOWED_TYPES and not filename.lower().endswith(ALLOWED_SUFFIXES):
        raise HTTPException(status_code=400, detail="Unsupported file type")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")

    try:
        chunks_info = ingestion_service.process_document(content, file.content_type or "", filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Error processing document") from exc
    if not chunks_info:
        raise HTTPException(status_code=400, detail="No extractable text found in document")

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
        raise HTTPException(status_code=500, detail="Error saving document embeddings") from exc
    return db_doc


@router.delete("/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)):
    db_doc = db.query(Document).filter(Document.id == document_id).first()
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found")
    db.delete(db_doc)
    db.commit()
    return {"status": "deleted"}