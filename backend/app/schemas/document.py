from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class DocumentBase(BaseModel):
    filename: str
    file_type: str
    metadata_: Optional[dict] = None

class DocumentCreate(DocumentBase):
    pass

class DocumentResponse(DocumentBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class ChunkResponse(BaseModel):
    id: int
    content: str
    page_num: Optional[int]
    
    class Config:
        from_attributes = True
