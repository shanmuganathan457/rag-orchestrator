from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.document import Document, DocumentChunk
from app.schemas.document import DocumentResponse
from app.services.ingestion import ingestion_service
from app.providers.factory import get_embedding

router = APIRouter()

MAX_FILE_SIZE = 10 * 1024 * 1024 # 10 MB

@router.post("/", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # 1. Validate file type and size
    allowed_types = ["application/pdf", "text/plain", "text/markdown"]
    if file.content_type not in allowed_types and not file.filename.lower().endswith((".pdf", ".txt", ".md", ".markdown")):
        raise HTTPException(status_code=400, detail="Unsupported file type")
        
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
        
    # 2. Extract and Chunk
    try:
        chunks_info = ingestion_service.process_document(content, file.content_type, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

    if not chunks_info:
        raise HTTPException(status_code=400, detail="No extractable text found in document")
        
    # 3. Save Document to DB
    db_doc = Document(filename=file.filename, file_type=file.content_type)
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    
    # 4. Generate embeddings and create chunks in DB
    try:
        embedding_provider = get_embedding()
        chunk_texts = [info.content for info in chunks_info]
        embeddings = await embedding_provider.embed_batch(chunk_texts)
        
        for i, info in enumerate(chunks_info):
            db_chunk = DocumentChunk(
                document_id=db_doc.id,
                content=info.content,
                embedding=embeddings[i],
                page_num=info.page_num
            )
            db.add(db_chunk)
            
        db.commit()
    except Exception as e:
        db.delete(db_doc)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Error generating embeddings or saving chunks: {str(e)}")
        
    return db_doc

@router.delete("/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)):
    db_doc = db.query(Document).filter(Document.id == document_id).first()
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    db.delete(db_doc)
    db.commit()
    return {"status": "deleted"}
