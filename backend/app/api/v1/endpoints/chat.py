from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.db.session import get_db
from app.services.rag import rag_orchestrator

router = APIRouter()

class ChatRequest(BaseModel):
    query: str
    document_ids: Optional[List[int]] = None

@router.post("/")
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    async def event_generator():
        try:
            async for chunk in rag_orchestrator.chat_stream(db, request.query, request.document_ids):
                # Format as Server-Sent Events (SSE)
                yield f"data: {chunk}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: [ERROR] {str(e)}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")
