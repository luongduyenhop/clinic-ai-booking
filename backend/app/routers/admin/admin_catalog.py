from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import ForbiddenException
from app.core.response import ResponseEnvelope
from app.core.dependencies import get_current_user
from app.models.user import TaiKhoan, VaiTroEnum
from app.schemas.admin import (
    DepartmentAdminResponse,
    DepartmentCreateRequest,
    DepartmentUpdateRequest,
    RoomCreateRequest,
    RoomResponse,
    ServiceCreateRequest,
    ServiceItemAdminResponse,
    ServiceUpdateRequest,
)
from app.services.admin_catalog_service import admin_catalog_service

catalog_router = APIRouter()


class RoomUpdateRequest(BaseModel):
    ten_phong: Optional[str] = Field(None, min_length=2, max_length=100)
    chuyen_khoa_id: Optional[int] = None
    tang: Optional[str] = None
    loai_phong: Optional[str] = None
    thiet_bi_chinh: Optional[str] = None
    is_active: Optional[bool] = None


class PriceUpdatePayload(BaseModel):
    service_id: int
    don_gia: float = Field(..., ge=0)
    ly_do: Optional[str] = None


class CatalogImportPayload(BaseModel):
    catalog_type: str
    items: List[Dict[str, Any]]


def _require_admin(current_user: TaiKhoan = Depends(get_current_user)) -> TaiKhoan:
    if current_user.vai_tro != VaiTroEnum.ADMIN.value:
        raise ForbiddenException("Chức năng chỉ dành cho Quản trị viên hệ thống (Admin)!")
    return current_user


@catalog_router.get(
    "/departments",
    response_model=ResponseEnvelope[List[DepartmentAdminResponse]]
)
async def get_departments(
    is_active: Optional[bool] = Query(None),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_catalog_service.get_departments_admin(db, is_active=is_active)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh mục chuyên khoa thành công")


@catalog_router.post(
    "/departments",
    response_model=ResponseEnvelope[DepartmentAdminResponse],
    status_code=status.HTTP_201_CREATED
)
async def create_department(
    payload: DepartmentCreateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_catalog_service.create_department_admin(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Tạo mới chuyên khoa {data.ten_chuyen_khoa} thành công!",
        code=status.HTTP_201_CREATED
    )


@catalog_router.put(
    "/departments/{department_id}",
    response_model=ResponseEnvelope[DepartmentAdminResponse]
)
async def update_department(
    department_id: int,
    payload: DepartmentUpdateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_catalog_service.update_department_admin(department_id, payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Cập nhật chuyên khoa {data.ten_chuyen_khoa} thành công!"
    )


@catalog_router.delete(
    "/departments/{department_id}",
    response_model=ResponseEnvelope[Dict[str, Any]]
)
async def delete_department(
    department_id: int,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_catalog_service.delete_department_admin(department_id, db)
    return ResponseEnvelope.success_response(data=data, message=data.get("message", "Xử lý chuyên khoa thành công"))


@catalog_router.get(
    "/rooms",
    response_model=ResponseEnvelope[List[RoomResponse]]
)
async def get_rooms(
    loai_phong: Optional[str] = Query(None),
    chuyen_khoa_id: Optional[int] = Query(None),
    is_active: Optional[bool] = Query(None),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_catalog_service.get_rooms_admin(
        db,
        loai_phong=loai_phong,
        chuyen_khoa_id=chuyen_khoa_id,
        is_active=is_active
    )
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách buồng khám thành công")


@catalog_router.post(
    "/rooms",
    response_model=ResponseEnvelope[RoomResponse],
    status_code=status.HTTP_201_CREATED
)
async def create_room(
    payload: RoomCreateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_catalog_service.create_room_admin(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Tạo mới buồng khám {data.ma_phong} - {data.ten_phong} thành công!",
        code=status.HTTP_201_CREATED
    )


@catalog_router.put(
    "/rooms/{room_id}",
    response_model=ResponseEnvelope[RoomResponse]
)
async def update_room(
    room_id: int,
    payload: RoomUpdateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_catalog_service.update_room_admin(room_id, payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Cập nhật buồng khám {data.ma_phong} - {data.ten_phong} thành công!"
    )


@catalog_router.delete(
    "/rooms/{room_id}",
    response_model=ResponseEnvelope[Dict[str, Any]]
)
async def delete_room(
    room_id: int,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_catalog_service.delete_room_admin(room_id, db)
    return ResponseEnvelope.success_response(data=data, message=data.get("message", "Xử lý buồng khám thành công"))


@catalog_router.get(
    "/services",
    response_model=ResponseEnvelope[List[ServiceItemAdminResponse]]
)
async def get_services(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_catalog_service.get_services_admin(db)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh mục dịch vụ thành công")


@catalog_router.post(
    "/services",
    response_model=ResponseEnvelope[ServiceItemAdminResponse],
    status_code=status.HTTP_201_CREATED
)
async def create_service(
    payload: ServiceCreateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_catalog_service.create_service_admin(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Thêm dịch vụ {data.ten_dich_vu} thành công!",
        code=status.HTTP_201_CREATED
    )


@catalog_router.put(
    "/services/{service_id}",
    response_model=ResponseEnvelope[ServiceItemAdminResponse]
)
async def update_service(
    service_id: int,
    payload: ServiceUpdateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_catalog_service.update_service_admin(service_id, payload, db, user_id=current_user.id)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Cập nhật dịch vụ {data.ten_dich_vu} thành công!"
    )


@catalog_router.delete(
    "/services/{service_id}",
    response_model=ResponseEnvelope[Dict[str, Any]]
)
async def delete_service(
    service_id: int,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_catalog_service.delete_service_admin(service_id, db)
    return ResponseEnvelope.success_response(data=data, message=data.get("message", "Xử lý dịch vụ thành công"))


@catalog_router.get(
    "/prices",
    response_model=ResponseEnvelope[List[Dict[str, Any]]]
)
async def get_prices(
    service_id: Optional[int] = Query(None),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_catalog_service.get_prices_admin(db, service_id=service_id)
    return ResponseEnvelope.success_response(data=data, message="Lấy bảng giá dịch vụ thành công")


@catalog_router.post(
    "/prices",
    response_model=ResponseEnvelope[Dict[str, Any]]
)
async def update_price(
    payload: PriceUpdatePayload,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_catalog_service.update_service_price_admin(
        service_id=payload.service_id,
        don_gia=payload.don_gia,
        db=db,
        user_id=current_user.id,
        ly_do=payload.ly_do
    )
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Cập nhật giá dịch vụ {data['ma_dich_vu']} thành công (lưu vết kiểm toán bất biến)"
    )


@catalog_router.get(
    "/prices/history",
    response_model=ResponseEnvelope[List[Dict[str, Any]]]
)
async def get_price_history(
    service_id: Optional[int] = Query(None),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_catalog_service.get_price_history_admin(db, service_id=service_id)
    return ResponseEnvelope.success_response(data=data, message="Lấy lịch sử điều chỉnh giá thành công")


@catalog_router.post(
    "/import",
    response_model=ResponseEnvelope[Dict[str, Any]]
)
async def import_catalog(
    payload: CatalogImportPayload,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_catalog_service.import_catalog_admin(
        catalog_type=payload.catalog_type,
        items=payload.items,
        db=db
    )
    return ResponseEnvelope.success_response(
        data=data,
        message=data.get("message", "Nạp danh mục thành công")
    )
