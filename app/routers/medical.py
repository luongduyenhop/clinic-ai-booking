from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.response import ResponseEnvelope
from app.models.user import ChuyenKhoa, BacSi, NguoiDung
from app.models.medical import DichVu
from app.schemas.appointment import DoctorBriefResponse
from pydantic import BaseModel

router = APIRouter(prefix="/medical", tags=["4. Danh Mục & Y Tế Lâm Sàng (Package D, E)"])


class SpecialtyResponse(BaseModel):
    id: int
    ten_chuyen_khoa: str
    mo_ta: Optional[str] = None
    vi_tri_phong: Optional[str] = None


class ServiceItemResponse(BaseModel):
    id: int
    ma_dich_vu: str
    ten_dich_vu: str
    don_gia: float
    don_vi_tinh: str


@router.get("/specialties", response_model=ResponseEnvelope[List[SpecialtyResponse]], summary="Lấy danh mục chuyên khoa")
async def get_specialties(db: AsyncSession = Depends(get_db)):
    stmt = select(ChuyenKhoa).order_by(ChuyenKhoa.ten_chuyen_khoa)
    specialties = (await db.execute(stmt)).scalars().all()
    data = [
        SpecialtyResponse(
            id=s.id,
            ten_chuyen_khoa=s.ten_chuyen_khoa,
            mo_ta=s.mo_ta,
            vi_tri_phong=s.vi_tri_phong
        )
        for s in specialties
    ]
    return ResponseEnvelope.success_response(data=data, message="Lấy danh mục chuyên khoa thành công")


@router.get("/doctors", response_model=ResponseEnvelope[List[DoctorBriefResponse]], summary="Lấy danh sách bác sĩ")
async def get_doctors(
    specialty_id: Optional[int] = Query(None, description="Lọc theo chuyên khoa ID"),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(BacSi, NguoiDung, ChuyenKhoa)
        .join(NguoiDung, BacSi.nguoi_dung_id == NguoiDung.id)
        .outerjoin(ChuyenKhoa, BacSi.chuyen_khoa_id == ChuyenKhoa.id)
    )
    if specialty_id:
        stmt = stmt.where(BacSi.chuyen_khoa_id == specialty_id)
    
    rows = (await db.execute(stmt)).all()
    data = [
        DoctorBriefResponse(
            id=bs.id,
            ho_ten=nd.ho_ten,
            chuyen_khoa=ck.ten_chuyen_khoa if ck else "Đa khoa",
            hoc_vi=bs.hoc_vi
        )
        for bs, nd, ck in rows
    ]
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách bác sĩ thành công")


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
