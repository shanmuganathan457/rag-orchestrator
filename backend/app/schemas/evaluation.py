from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

class EvaluationRequest(BaseModel):
    sample_size: int = Field(default=10, ge=1, le=50, description="Number of chunks to evaluate")
    top_k: int = Field(default=5, ge=1, le=20, description="Top K documents for hit rate evaluation")

class ModeMetrics(BaseModel):
    hit_at_1: float
    hit_at_5: float
    mrr: float
    avg_latency_ms: float

class EvaluationDetail(BaseModel):
    chunk_id: str
    document_id: str
    question: str
    ranks: Dict[str, Optional[int]]

class EvaluationResponse(BaseModel):
    total_evaluated: int
    top_k: int
    summary: Dict[str, ModeMetrics]
    details: List[EvaluationDetail]
