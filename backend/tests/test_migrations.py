from pathlib import Path


def test_initial_migration_creates_pgvector_and_search_indexes():
    migration = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "20261009_0001_initial_pgvector_schema.py"
    ).read_text(encoding="utf-8")

    assert "CREATE EXTENSION IF NOT EXISTS vector" in migration
    assert "Vector(384)" in migration
    assert "to_tsvector('english', coalesce(content, ''))" in migration
    assert "postgresql_using=\"gin\"" in migration
    assert "embedding vector_cosine_ops" in migration
