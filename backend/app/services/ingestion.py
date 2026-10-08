import re
import io
from typing import List, Dict, Optional
from pypdf import PdfReader
import markdown

class DocumentChunkInfo:
    def __init__(self, content: str, page_num: Optional[int] = None):
        self.content = content
        self.page_num = page_num

class DocumentIngestionService:
    def __init__(self, chunk_size: int = 900, chunk_overlap: int = 150):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_into_sentences(self, text: str) -> List[str]:
        # Simple regex-based sentence splitter
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]

    def create_chunks(self, text: str, page_num: Optional[int] = None) -> List[DocumentChunkInfo]:
        sentences = self.split_into_sentences(text)
        chunks = []
        current_chunk = []
        current_length = 0

        for sentence in sentences:
            sentence_length = len(sentence)
            
            if current_length + sentence_length > self.chunk_size and current_chunk:
                chunks.append(DocumentChunkInfo(content=" ".join(current_chunk), page_num=page_num))
                
                # Keep overlap sentences
                overlap_length = 0
                overlap_chunk = []
                for s in reversed(current_chunk):
                    if overlap_length + len(s) <= self.chunk_overlap:
                        overlap_chunk.insert(0, s)
                        overlap_length += len(s) + 1
                    else:
                        break
                
                current_chunk = overlap_chunk
                current_length = overlap_length
                
            current_chunk.append(sentence)
            current_length += sentence_length + 1

        if current_chunk:
            chunks.append(DocumentChunkInfo(content=" ".join(current_chunk), page_num=page_num))
            
        return chunks

    def process_txt(self, content: bytes) -> List[DocumentChunkInfo]:
        text = content.decode("utf-8")
        return self.create_chunks(text)

    def process_md(self, content: bytes) -> List[DocumentChunkInfo]:
        text = content.decode("utf-8")
        # Optional: remove markdown formatting or keep it. We will keep it for now as LLMs understand MD well.
        return self.create_chunks(text)

    def process_pdf(self, content: bytes) -> List[DocumentChunkInfo]:
        reader = PdfReader(io.BytesIO(content))
        all_chunks = []
        for i, page in enumerate(reader.pages):
            page_text = page.extract_text()
            if page_text:
                page_chunks = self.create_chunks(page_text, page_num=i+1)
                all_chunks.extend(page_chunks)
        return all_chunks

    def process_document(self, content: bytes, file_type: str, filename: str) -> List[DocumentChunkInfo]:
        if file_type == "application/pdf" or filename.lower().endswith(".pdf"):
            return self.process_pdf(content)
        elif file_type == "text/markdown" or filename.lower().endswith((".md", ".markdown")):
            return self.process_md(content)
        elif file_type == "text/plain" or filename.lower().endswith(".txt"):
            return self.process_txt(content)
        else:
            raise ValueError(f"Unsupported file type: {file_type} or filename: {filename}")

ingestion_service = DocumentIngestionService()
