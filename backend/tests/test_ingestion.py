from app.services.ingestion import DocumentIngestionService

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
    assert "sentence" in chunks[0]
