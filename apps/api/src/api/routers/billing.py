from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.billing import CreateSubscriptionRequest, InvoiceResponse, SubscriptionResponse, UsageRecordResponse
from ..services.billing_service import billing_service

router = APIRouter()


@router.get("/usage", response_model=list[UsageRecordResponse])
async def get_usage(
    metric: str | None = Query(None),
    from_date: str | None = Query(None),
    to_date: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    records = await billing_service.get_usage(user_id=user_id, metric=metric, from_date=from_date, to_date=to_date, db=db)
    return [UsageRecordResponse.model_validate(r) for r in records]


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    sub = await billing_service.get_subscription(user_id=user_id, db=db)
    if not sub:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return SubscriptionResponse.model_validate(sub)


@router.post("/subscription", response_model=SubscriptionResponse, status_code=201)
async def create_subscription(dto: CreateSubscriptionRequest, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    sub = await billing_service.create_subscription(user_id=user_id, plan=dto.plan, db=db)
    return SubscriptionResponse.model_validate(sub)


@router.get("/invoices", response_model=list[InvoiceResponse])
async def list_invoices(db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    invoices = await billing_service.list_invoices(user_id=user_id, db=db)
    return [InvoiceResponse.model_validate(inv) for inv in invoices]


@router.get("/invoices/{invoice_id}/download")
async def download_invoice(invoice_id: str, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    # Verify invoice belongs to user via list_invoices
    user_id = current_user.get("sub") or current_user.get("user_id")
    invoices = await billing_service.list_invoices(user_id=user_id, db=db)
    for inv in invoices:
        if inv["id"] == invoice_id:
            # Return minimal PDF stub as JSON for now; frontend will open download
            return {
                "invoice_id": invoice_id,
                "download_url": inv["download_url"],
                "amount": inv["amount"],
                "currency": inv["currency"],
                "status": inv["status"],
                "note": "Invoice PDF generation stub — integrate Stripe/PDF provider for production",
            }
    raise HTTPException(status_code=404, detail="Invoice not found")
