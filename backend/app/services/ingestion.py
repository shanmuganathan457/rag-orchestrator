import re
from typing import List

class DocumentIngestionService:
    def __init__(self, chunk_size: int = 900, chunk_overlap: int = 150):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_into_sentences(self, text: str) -> List[str]:
        # Simple regex-based sentence splitter
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]

    def create_chunks(self, text: str) -> List[str]:
        sentences = self.split_into_sentences(text)
        chunks = []
        current_chunk = []
        current_length = 0

        for sentence in sentences:
            sentence_length = len(sentence)
            
            if current_length + sentence_length > self.chunk_size and current_chunk:
                chunks.append(" ".join(current_chunk))
                # Keep overlap sentences
                overlap_length = 0
                overlap_chunk = []
                for s in reversed(current_chunk):
                    if overlap_length + len(s) <= self.chunk_overlap:
                        overlap_chunk.insert(0, s)
                        overlap_length += len(s) + 1 # +1 for space
                    else:
                        break
                
                current_chunk = overlap_chunk
                current_length = overlap_length
                
            current_chunk.append(sentence)
            current_length += sentence_length + 1

        if current_chunk:
            chunks.append(" ".join(current_chunk))
            
        return chunks

    def process_document(self, content: str) -> List[str]:
        # Handle PDF/TXT/MD extraction here based on file type
        # For this foundation, we assume content is already extracted text
        return self.create_chunks(content)

ingestion_service = DocumentIngestionService()
