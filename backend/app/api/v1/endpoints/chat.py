import json
from typing import List, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.rag import rag_orchestrator

router = APIRouter()


class ChatRequest(BaseModel):
    query: str
    document_ids: Optional[List[int]] = None
    use_graph: bool = False  # Toggle between normal RAG and GraphRAG


def sse_event(name: str, payload: dict) -> str:
    return f"event: {name}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/")
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    async def event_generator():
        try:
            async for name, payload in rag_orchestrator.chat_events(
                db, request.query, request.document_ids, use_graph=request.use_graph
            ):
                yield sse_event(name, payload)
        except Exception:
            yield sse_event("error", {"message": "Chat generation failed"})
    return StreamingResponse(event_generator(), media_type="text/event-stream")