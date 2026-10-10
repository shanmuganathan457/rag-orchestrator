from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.evaluation import EvaluationRequest, EvaluationResponse
from app.services.evaluation import EvaluationService

router = APIRouter()

@router.post("/run", response_model=EvaluationResponse)
async def run_evaluation(
    request: EvaluationRequest = EvaluationRequest(),
    db: Session = Depends(get_db)
):
    try:
        service = EvaluationService(db)
        results = await service.run_evaluation(
            sample_size=request.sample_size,
            top_k=request.top_k
        )
        return results
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err))
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(err)}")
