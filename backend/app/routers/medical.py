from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.core.database import get_db
from app.core.response import ResponseEnvelope
from app.models.medical import DichVu, KhaiNiem, Thuoc
from app.schemas.medical import SpecialtyResponse, DoctorResponse, AcademicDegreeResponse
from app.services.cls_service_group import nhom_dich_vu_of
from app.services.medical_service import medical_service
from pydantic import BaseModel

router = APIRouter(prefix="/medical", tags=["4. Danh Mục & Y Tế Lâm Sàng (Package D, E)"])


class ServiceItemResponse(BaseModel):
    id: int
    ma_dich_vu: str
    ten_dich_vu: str
    don_gia: float
    don_vi_tinh: str
    nhom_dich_vu: Optional[str] = None


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
            don_vi_tinh=dv.don_vi_tinh,
            nhom_dich_vu=nhom_dich_vu_of(dv.ma_nhom_byt, dv.ma_dich_vu),
        )
        for dv in services
    ]
    return ResponseEnvelope.success_response(data=data, message="Lấy danh mục dịch vụ cận lâm sàng thành công")


class ICD10ItemResponse(BaseModel):
    ma: str
    ten: str


class DrugItemResponse(BaseModel):
    id: int
    ma_thuoc: str
    ten_thuoc: str
    hoat_chat: Optional[str] = None
    ham_luong: Optional[str] = None
    don_vi_tinh: str
    duong_dung: Optional[str] = None


@router.get("/icd10", response_model=ResponseEnvelope[List[ICD10ItemResponse]], summary="Tìm kiếm mã bệnh / tên bệnh ICD-10")
async def search_icd10(
    keyword: Optional[str] = Query(None, description="Từ khóa tìm kiếm mã hoặc tên bệnh"),
    limit: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(KhaiNiem).where(
        KhaiNiem.loai_khai_niem == "benh_icd10",
        KhaiNiem.is_active.is_(True)
    )
    if keyword and keyword.strip():
        kw = f"%{keyword.strip()}%"
        stmt = stmt.where(
            or_(
                KhaiNiem.ma_khai_niem.ilike(kw),
                KhaiNiem.ten_khai_niem.ilike(kw)
            )
        )
    stmt = stmt.order_by(KhaiNiem.ma_khai_niem.asc()).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    data = [
        ICD10ItemResponse(ma=r.ma_khai_niem, ten=r.ten_khai_niem)
        for r in rows
    ]
    return ResponseEnvelope.success_response(data=data, message="Tìm kiếm ICD-10 thành công")


@router.get("/drugs", response_model=ResponseEnvelope[List[DrugItemResponse]], summary="Tìm kiếm danh mục thuốc")
async def search_drugs(
    keyword: Optional[str] = Query(None, description="Từ khóa tìm kiếm tên thuốc hoặc hoạt chất"),
    limit: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Thuoc).where(Thuoc.is_active.is_(True))
    if keyword and keyword.strip():
        kw = f"%{keyword.strip()}%"
        stmt = stmt.where(
            or_(
                Thuoc.ten_thuoc.ilike(kw),
                Thuoc.hoat_chat.ilike(kw),
                Thuoc.ma_thuoc_noi_bo.ilike(kw)
            )
        )
    stmt = stmt.order_by(Thuoc.ten_thuoc.asc()).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    data = [
        DrugItemResponse(
            id=t.id,
            ma_thuoc=t.ma_thuoc_noi_bo,
            ten_thuoc=t.ten_thuoc,
            hoat_chat=t.hoat_chat,
            ham_luong=t.ham_luong,
            don_vi_tinh=t.don_vi_tinh,
            duong_dung=t.duong_dung,
        )
        for t in rows
    ]
    return ResponseEnvelope.success_response(data=data, message="Tìm kiếm thuốc thành công")
