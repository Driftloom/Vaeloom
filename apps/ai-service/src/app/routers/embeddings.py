from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..services.llm_service import LLMService, llm_service, LLMProviderError
from ..dependencies import get_current_user

router = APIRouter()


class EmbeddingRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=8192)


class EmbeddingBatchRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=100)


class EmbeddingResponse(BaseModel):
    embedding: list[float]
    dimension: int
    model: str


class EmbeddingBatchResponse(BaseModel):
    embeddings: list[list[float]]
    dimension: int
    model: str


@router.post("", response_model=EmbeddingResponse)
async def generate_embedding(
    dto: EmbeddingRequest,
    _: dict = Depends(get_current_user),
):
    try:
        embedding = await llm_service.generate_embedding(dto.text)
        return EmbeddingResponse(
            embedding=embedding,
            dimension=len(embedding),
            model=llm_service.embedding_model,
        )
    except LLMProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.post("/batch", response_model=EmbeddingBatchResponse)
async def generate_embeddings_batch(
    dto: EmbeddingBatchRequest,
    _: dict = Depends(get_current_user),
):
    try:
        embeddings = []
        for text in dto.texts:
            emb = await llm_service.generate_embedding(text)
            embeddings.append(emb)
        return EmbeddingBatchResponse(
            embeddings=embeddings,
            dimension=len(embeddings[0]) if embeddings else 0,
            model=llm_service.embedding_model,
        )
    except LLMProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
