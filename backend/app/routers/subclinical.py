from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_roles
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan, VaiTroEnum
from app.schemas.subclinical import (
    SubclinicalDetailResponse,
    SubclinicalQueueResponse,
    SubclinicalResultSubmitRequest,
)
from app.services.subclinical_service import subclinical_service

router = APIRouter(prefix="/subclinical", tags=["8. Cận Lâm Sàng & Xét Nghiệm / CĐHA (LIS & PACS)"])
technician_role_guard = require_roles([VaiTroEnum.KY_THUAT_VIEN, VaiTroEnum.BAC_SI, VaiTroEnum.ADMIN])


@router.get(
    "/queue",
    response_model=ResponseEnvelope[SubclinicalQueueResponse],
    summary="Lấy danh sách hàng đợi bệnh nhân tại phòng kỹ thuật cận lâm sàng"
)
async def get_subclinical_queue(
    phong_thuc_hien_id: Optional[int] = Query(None, description="Lọc theo ID phòng kỹ thuật thực hiện"),
    trang_thai: Optional[str] = Query(None, description="Lọc theo trạng thái: da_chi_dinh, dang_thuc_hien, da_co_ket_qua"),
    current_user: TaiKhoan = Depends(technician_role_guard),
    db: AsyncSession = Depends(get_db)
):
    result = await subclinical_service.get_subclinical_queue(
        phong_thuc_hien_id=phong_thuc_hien_id,
        trang_thai=trang_thai,
        db=db
    )
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Lấy hàng đợi {result.total} ca cận lâm sàng thành công"
    )


@router.post(
    "/orders/{order_id}/start",
    response_model=ResponseEnvelope[SubclinicalDetailResponse],
    summary="Kỹ thuật viên tiếp nhận mẫu và bắt đầu thực hiện ca cận lâm sàng"
)
async def start_subclinical_order(
    order_id: int,
    current_user: TaiKhoan = Depends(technician_role_guard),
    db: AsyncSession = Depends(get_db)
):
    order = await subclinical_service.start_subclinical_order(
        order_id=order_id,
        technician_user_id=current_user.nguoi_dung_id,
        db=db
    )
    resp = SubclinicalDetailResponse.model_validate(order)
    return ResponseEnvelope.success_response(
        data=resp,
        message="Bắt đầu thực hiện ca cận lâm sàng thành công"
    )


@router.post(
    "/orders/{order_id}/results",
    response_model=ResponseEnvelope[SubclinicalDetailResponse],
    summary="Kỹ thuật viên nhập kết quả, phân loại và hoàn tất ca cận lâm sàng"
)
async def submit_subclinical_result(
    order_id: int,
    payload: SubclinicalResultSubmitRequest,
    current_user: TaiKhoan = Depends(technician_role_guard),
    db: AsyncSession = Depends(get_db)
):
    order = await subclinical_service.submit_subclinical_result(
        order_id=order_id,
        payload=payload,
        technician_user_id=current_user.nguoi_dung_id,
        db=db
    )
    resp = SubclinicalDetailResponse.model_validate(order)
    return ResponseEnvelope.success_response(
        data=resp,
        message="Nhập kết quả cận lâm sàng thành công"
    )


@router.post(
    "/orders/{order_id}/cancel",
    response_model=ResponseEnvelope[SubclinicalDetailResponse],
    summary="Hủy chỉ định cận lâm sàng"
)
async def cancel_subclinical_order(
    order_id: int,
    ly_do: str = Query("Bệnh nhân từ chối thực hiện", description="Lý do hủy chỉ định"),
    current_user: TaiKhoan = Depends(technician_role_guard),
    db: AsyncSession = Depends(get_db)
):
    order = await subclinical_service.cancel_subclinical_order(
        order_id=order_id,
        reason=ly_do,
        user_id=current_user.nguoi_dung_id,
        db=db
    )
    resp = SubclinicalDetailResponse.model_validate(order)
    return ResponseEnvelope.success_response(
        data=resp,
        message="Hủy chỉ định cận lâm sàng thành công"
    )
