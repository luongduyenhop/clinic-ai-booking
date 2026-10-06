from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.response import ResponseEnvelope
from app.models.medical import DichVu
from app.schemas.medical import SpecialtyResponse, DoctorResponse, AcademicDegreeResponse
from app.services.medical_service import medical_service
from pydantic import BaseModel

router = APIRouter(prefix="/medical", tags=["4. Danh Mục & Y Tế Lâm Sàng (Package D, E)"])


class ServiceItemResponse(BaseModel):
    id: int
    ma_dich_vu: str
    ten_dich_vu: str
    don_gia: float
    don_vi_tinh: str


@router.get(
    "/specialties",
    response_model=ResponseEnvelope[List[SpecialtyResponse]],
    summary="Lấy danh mục chuyên khoa đang hoạt động kèm số lượng bác sĩ (UC-B01)"
)
async def get_specialties(db: AsyncSession = Depends(get_db)):
    data = await medical_service.get_specialties(db)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh mục chuyên khoa thành công")


@router.get(
    "/doctors",
    response_model=ResponseEnvelope[List[DoctorResponse]],
    summary="Tra cứu danh sách bác sĩ lọc theo chuyên khoa/học vị, có phân trang (UC-B01)"
)
async def get_doctors(
    specialty_id: Optional[int] = Query(None, ge=1, description="Lọc theo chuyên khoa ID"),
    hoc_vi: Optional[List[str]] = Query(
        None,
        description="Lọc theo học vị (giá trị lấy từ /medical/academic-degrees), "
                    "lặp lại tham số để chọn nhiều giá trị (VD: ?hoc_vi=ThS.BS&hoc_vi=PGS.TS)"
    ),
    page: int = Query(1, ge=1, description="Số thứ tự trang (bắt đầu từ 1)"),
    page_size: int = Query(10, ge=1, le=100, description="Số bác sĩ trên mỗi trang"),
    db: AsyncSession = Depends(get_db)
):
    doctors, meta = await medical_service.get_doctors(
        specialty_id=specialty_id,
        hoc_vi=hoc_vi,
        page=page,
        page_size=page_size,
        db=db
    )
    return ResponseEnvelope.success_response(data=doctors, meta=meta, message="Lấy danh sách bác sĩ thành công")


@router.get(
    "/academic-degrees",
    response_model=ResponseEnvelope[List[AcademicDegreeResponse]],
    summary="Lấy danh mục học vị của bác sĩ để dựng bộ lọc (UC-B01)"
)
async def get_academic_degrees(
    specialty_id: Optional[int] = Query(None, ge=1, description="Chỉ lấy học vị của bác sĩ thuộc chuyên khoa này"),
    db: AsyncSession = Depends(get_db)
):
    data = await medical_service.get_academic_degrees(specialty_id, db)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh mục học vị thành công")


@router.get("/services", response_model=ResponseEnvelope[List[ServiceItemResponse]], summary="Lấy danh mục dịch vụ cận lâm sàng")
async def get_services(db: AsyncSession = Depends(get_db)):
    stmt = select(DichVu).where(DichVu.is_active.is_(True))
    services = (await db.execute(stmt)).scalars().all()
    data = [
        ServiceItemResponse(
            id=dv.id,
            ma_dich_vu=dv.ma_dich_vu,
            ten_dich_vu=dv.ten_dich_vu,
            don_gia=dv.don_gia,
            don_vi_tinh=dv.don_vi_tinh
        )
        for dv in services
    ]
    return ResponseEnvelope.success_response(data=data, message="Lấy danh mục dịch vụ cận lâm sàng thành công")
