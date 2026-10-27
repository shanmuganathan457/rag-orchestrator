"""
Visualization data endpoint.
Returns parsed CSV data from stored documents for chart rendering.
"""
import csv
import io
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.document import Document, DocumentChunk

router = APIRouter()


def _is_csv(doc: Document) -> bool:
    name = (doc.filename or "").lower()
    return name.endswith(".csv") or doc.file_type == "text/csv"


@router.get("/csv-files")
def list_csv_files(db: Session = Depends(get_db)):
    """Return all uploaded documents that are CSV files."""
    docs = db.query(Document).order_by(Document.created_at.desc()).all()
    return [
        {"id": d.id, "name": d.filename, "created_at": d.created_at.isoformat() if d.created_at else None}
        for d in docs if _is_csv(d)
    ]


@router.get("/data")
def get_visualization_data(
    ids: str = Query(..., description="Comma-separated document IDs"),
    db: Session = Depends(get_db),
):
    """
    Return parsed tabular data from one or more CSV documents.
    Chunks are reassembled and parsed into rows + columns.
    """
    try:
        doc_ids = [int(x.strip()) for x in ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="ids must be comma-separated integers")

    if not doc_ids:
        raise HTTPException(status_code=400, detail="No document IDs provided")

    datasets: List[dict] = []
    for doc_id in doc_ids:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail=f"Document {doc_id} not found")

        # Reassemble all chunks for this document in order
        chunks = (
            db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == doc_id)
            .order_by(DocumentChunk.id)
            .all()
        )
        full_text = "\n".join(c.content for c in chunks)

        # Parse as CSV
        reader = csv.reader(io.StringIO(full_text))
        rows = list(reader)
        if not rows:
            datasets.append({"id": doc_id, "name": doc.filename, "columns": [], "rows": []})
            continue

        columns = rows[0]
        data_rows = []
        for row in rows[1:]:
            if len(row) != len(columns):
                continue  # skip malformed rows
            record: dict = {}
            for col, val in zip(columns, row):
                col = col.strip()
                # Try to parse as number for chart compatibility
                try:
                    record[col] = float(val) if "." in val else int(val)
                except (ValueError, TypeError):
                    record[col] = val.strip()
            data_rows.append(record)

        datasets.append({
            "id": doc_id,
            "name": doc.filename,
            "columns": [c.strip() for c in columns],
            "rows": data_rows,
        })

    return {"datasets": datasets}
