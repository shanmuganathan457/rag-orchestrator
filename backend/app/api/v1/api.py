from fastapi import APIRouter
from app.api.v1.endpoints import health, documents, chat, providers, evaluation, visualization

api_router = APIRouter()
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(providers.router, prefix="/providers", tags=["providers"])
api_router.include_router(evaluation.router, prefix="/evaluation", tags=["evaluation"])
api_router.include_router(visualization.router, prefix="/visualization", tags=["visualization"])