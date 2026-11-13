from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan, VaiTroEnum
from app.schemas.admin import AdminDashboardStatsResponse, ServiceExportResponse
from app.services.admin_service import admin_service

bi_router = APIRouter()

def require_admin(current_user: TaiKhoan = Depends(get_current_user)):
    if current_user.vai_tro != VaiTroEnum.ADMIN.value:
        raise ForbiddenException("Chức năng quản trị chỉ dành riêng cho Quản trị viên (Admin)!")
    return current_user

@bi_router.get("/dashboard-stats", response_model=ResponseEnvelope[AdminDashboardStatsResponse])
async def get_dashboard_stats(
    query_date: Optional[date] = Query(None),
    current_user: TaiKhoan = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_dashboard_stats(query_date, db)
    return ResponseEnvelope.success_response(data=data, message="Lấy số liệu thống kê vận hành thành công")

@bi_router.get("/export-excel", response_model=ResponseEnvelope[ServiceExportResponse])
async def export_excel_summary(
    current_user: TaiKhoan = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.export_services_catalog(db)
    return ResponseEnvelope.success_response(data=data, message="Xuất báo cáo thành công")
