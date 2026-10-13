from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints import documents
from app.services.ingestion import DocumentChunkInfo


class Upload:
    filename = "notes.txt"
    content_type = "text/plain"

    async def read(self):
        return b"source text"


class Db:
    def __init__(self):
        self.added = []
        self.added_many = []
        self.committed = False
        self.rolled_back = False

    def add(self, value):
        self.added.append(value)

    def flush(self):
        self.added[0].id = 42

    def add_all(self, values):
        self.added_many.extend(values)

    def commit(self):
        self.committed = True

    def refresh(self, _):
        pass

    def rollback(self):
        self.rolled_back = True


@pytest.mark.asyncio
async def test_upload_uses_configured_embedding_provider_and_attaches_vectors(monkeypatch):
    class Provider:
        async def embed_batch(self, texts):
            assert texts == ["one", "two"]
            return [[0.1] * 384, [0.2] * 384]

    monkeypatch.setattr(documents.ingestion_service, "process_document", lambda *_: [DocumentChunkInfo("one"), DocumentChunkInfo("two", 2)])
    monkeypatch.setattr(documents, "get_embedding", lambda: Provider())
    db = Db()

    document = await documents.upload_document(Upload(), db)

    assert document["id"] == 42
    assert db.committed
    assert [chunk.embedding for chunk in db.added_many] == [[0.1] * 384, [0.2] * 384]
    assert db.added_many[1].page_num == 2


@pytest.mark.asyncio
async def test_upload_does_not_persist_document_when_embedding_generation_fails(monkeypatch):
    class Provider:
        async def embed_batch(self, _):
            raise RuntimeError("model unavailable")

    monkeypatch.setattr(documents.ingestion_service, "process_document", lambda *_: [DocumentChunkInfo("one")])
    monkeypatch.setattr(documents, "get_embedding", lambda: Provider())
    db = Db()

    with pytest.raises(HTTPException, match="Error generating document embeddings"):
        await documents.upload_document(Upload(), db)

    assert db.added == []
    assert not db.committed