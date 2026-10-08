from fastapi import APIRouter
from sqlalchemy.orm import Session
from fastapi import Depends
from app.db.session import get_db

router = APIRouter()

@router.get("/")
def health_check(db: Session = Depends(get_db)):
    try:
        # Simple test to check DB connectivity
        db.execute("SELECT 1")
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {str(e)}"
        
    return {"status": "ok", "database": db_status}
