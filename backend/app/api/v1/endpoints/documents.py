from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.document import Document, DocumentChunk
from app.schemas.document import DocumentResponse
from app.services.ingestion import ingestion_service
from app.providers.factory import get_embedding

router = APIRouter()

@router.post("/", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # 1. Read content
    content = await file.read()
    text = content.decode("utf-8") # Basic txt support for now
    
    # 2. Save Document to DB
    db_doc = Document(filename=file.filename, file_type=file.content_type, content=text)
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)
    
    # 3. Chunking
    chunks = ingestion_service.process_document(text)
    
    # 4. Create chunks in DB
    try:
        embedding_provider = get_embedding()
        embeddings = await embedding_provider.embed_batch(chunks)
        
        for i, chunk_text in enumerate(chunks):
            db_chunk = DocumentChunk(
                document_id=db_doc.id,
                content=chunk_text,
                embedding=embeddings[i],
                page_num=1 # Placeholder for page tracking
            )
            db.add(db_chunk)
            
        db.commit()
    except Exception as e:
        db.delete(db_doc)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Error processing chunks: {str(e)}")
        
    return db_doc

@router.delete("/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)):
    db_doc = db.query(Document).filter(Document.id == document_id).first()
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found")
        
    db.delete(db_doc)
    db.commit()
    return {"status": "deleted"}
