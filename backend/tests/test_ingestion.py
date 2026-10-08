import pytest
from app.services.ingestion import DocumentIngestionService
import io

def test_sentence_splitting():
    service = DocumentIngestionService()
    text = "This is a sentence. This is another sentence! Is this a question? Yes."
    sentences = service.split_into_sentences(text)
    
    assert len(sentences) == 4
    assert sentences[0] == "This is a sentence."
    assert sentences[1] == "This is another sentence!"

def test_chunk_creation():
    service = DocumentIngestionService(chunk_size=50, chunk_overlap=10)
    text = "A small sentence. Another small sentence. Yet another sentence. Final sentence."
    chunks = service.create_chunks(text)
    
    # Check that chunks are created
    assert len(chunks) > 0
    # Ensure overlap is respected implicitly by content
    assert "sentence" in chunks[0].content

def test_process_txt():
    service = DocumentIngestionService()
    content = b"This is a test document."
    chunks = service.process_document(content, "text/plain", "test.txt")
    assert len(chunks) == 1
    assert chunks[0].content == "This is a test document."
    
def test_process_md():
    service = DocumentIngestionService()
    content = b"# Title\n\nThis is markdown."
    chunks = service.process_document(content, "text/markdown", "test.md")
    assert len(chunks) == 1
    assert "Title" in chunks[0].content

def test_unsupported_type():
    service = DocumentIngestionService()
    with pytest.raises(ValueError):
        service.process_document(b"data", "image/png", "test.png")
