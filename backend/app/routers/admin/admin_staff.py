from datetime import date, time
from typing import List, Optional
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import BadRequestException, ForbiddenException
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan, VaiTroEnum
from app.schemas.admin import (
    DoctorAdminCreateRequest,
    DoctorAdminUpdateRequest,
    DoctorAdminResponse,
    ShiftCreateRequest,
    ShiftResponse,
    DoctorLeaveCreateRequest,
    DoctorLeaveResponse,
    DoctorLeaveApproveRequest,
)
from app.services.admin_doctor_service import admin_doctor_service
from app.services.admin_shift_service import admin_shift_service
from app.services.bff_admin_service import bff_admin_service
from app.services.credential_service import DoctorLicenseInvalidException

staff_router = APIRouter()


class ShiftUpdateRequest(BaseModel):
    phong_kham_id: Optional[int] = None
    gio_bat_dau: Optional[time] = None
    gio_ket_thuc: Optional[time] = None
    gioi_han_ca_kham: Optional[int] = Field(None, ge=1, le=50)
    han_muc_dat_truoc: Optional[int] = Field(None, ge=0)
    han_muc_vang_lai: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None
    ghi_chu_nghi: Optional[str] = None


def _require_admin(current_user: TaiKhoan = Depends(get_current_user)):
    if current_user.vai_tro != VaiTroEnum.ADMIN.value:
        raise ForbiddenException("Chức năng quản trị chỉ dành riêng cho Quản trị viên (Admin)!")
    return current_user


def _require_staff_or_admin(current_user: TaiKhoan = Depends(get_current_user)):
    allowed = {
        VaiTroEnum.ADMIN.value,
        VaiTroEnum.BAC_SI.value,
        VaiTroEnum.LE_TAN.value,
        VaiTroEnum.THU_NGAN.value,
        VaiTroEnum.KY_THUAT_VIEN.value,
    }
    if current_user.vai_tro not in allowed:
        raise ForbiddenException("Yêu cầu quyền nhân viên y tế hoặc quản trị viên!")
    return current_user


@staff_router.get(
    "/doctors",
    response_model=ResponseEnvelope[List[DoctorAdminResponse]],
)
async def get_doctors_endpoint(
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await admin_doctor_service.get_doctors_admin(db)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách bác sĩ thành công")


@staff_router.post(
    "/doctors",
    response_model=ResponseEnvelope[DoctorAdminResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_doctor_endpoint(
    payload: DoctorAdminCreateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await admin_doctor_service.create_doctor_admin(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Tạo mới bác sĩ {data.ho_ten} thành công!",
        code=status.HTTP_201_CREATED,
    )


@staff_router.put(
    "/doctors/{doctor_id}",
    response_model=ResponseEnvelope[DoctorAdminResponse],
)
async def update_doctor_endpoint(
    doctor_id: int,
    payload: DoctorAdminUpdateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await admin_doctor_service.update_doctor_admin(doctor_id, payload, db)
    return ResponseEnvelope.success_response(data=data, message="Cập nhật bác sĩ thành công")


@staff_router.get(
    "/shifts",
    response_model=ResponseEnvelope[List[ShiftResponse]],
)
async def get_shifts_endpoint(
    query_date: Optional[date] = Query(None),
    doctor_id: Optional[int] = Query(None),
    current_user: TaiKhoan = Depends(_require_staff_or_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await admin_shift_service.get_shifts(query_date, doctor_id, db)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách ca làm việc thành công")


@staff_router.post(
    "/shifts",
    response_model=ResponseEnvelope[ShiftResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_shift_endpoint(
    payload: ShiftCreateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    try:
        data = await admin_shift_service.create_shift(payload, db)
    except DoctorLicenseInvalidException as exc:
        raise BadRequestException(f"Chứng chỉ hành nghề không hợp lệ: {exc.detail}")
    return ResponseEnvelope.success_response(
        data=data,
        message="Phân ca làm việc cho bác sĩ thành công!",
        code=status.HTTP_201_CREATED,
    )


@staff_router.put(
    "/shifts/{shift_id}",
    response_model=ResponseEnvelope[ShiftResponse],
)
async def update_shift_endpoint(
    shift_id: int,
    payload: ShiftUpdateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await admin_shift_service.update_shift(shift_id, payload, db)
    return ResponseEnvelope.success_response(data=data, message="Cập nhật ca làm việc thành công")


@staff_router.get(
    "/doctor-leaves",
    response_model=ResponseEnvelope[List[DoctorLeaveResponse]],
)
async def get_doctor_leaves_endpoint(
    doctor_id: Optional[int] = Query(None),
    trang_thai: Optional[str] = Query(None),
    current_user: TaiKhoan = Depends(_require_staff_or_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await admin_shift_service.get_leaves_admin(db, doctor_id, trang_thai)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách nghỉ phép thành công")


@staff_router.post(
    "/doctor-leaves",
    response_model=ResponseEnvelope[DoctorLeaveResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_doctor_leave_endpoint(
    payload: DoctorLeaveCreateRequest,
    current_user: TaiKhoan = Depends(_require_staff_or_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await admin_shift_service.create_leave_admin(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message="Đăng ký nghỉ phép thành công!",
        code=status.HTTP_201_CREATED,
    )


@staff_router.post(
    "/doctor-leaves/{leave_id}/approve",
    response_model=ResponseEnvelope[DoctorLeaveResponse],
)
async def approve_doctor_leave_endpoint(
    leave_id: int,
    payload: DoctorLeaveApproveRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await admin_shift_service.approve_leave_admin(leave_id, payload, current_user, db)
    msg = "Đã duyệt đơn nghỉ phép và khóa ca trực liên quan!" if payload.hanh_dong == "DA_DUYET" else "Đã từ chối đơn nghỉ phép."
    return ResponseEnvelope.success_response(data=data, message=msg)


@staff_router.get("/roles")
async def get_roles_matrix_endpoint(
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await bff_admin_service.get_bootstrap_data(db)
    roles = data.get("roles", [])
    return ResponseEnvelope.success_response(data=roles, message="Lấy danh sách vai trò thành công")


@staff_router.put("/roles")
async def update_roles_matrix_endpoint(
    payload: dict,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    items = payload.get("items", payload if isinstance(payload, list) else [payload])
    audit_entry = payload.get("auditEntry", {
        "hanhDong": "UPDATE_ROLES_MATRIX",
        "doiTuong": "roles",
        "mucDich": "Cập nhật ma trận phân quyền vai trò",
    })
    res = await bff_admin_service.update_collection(
        db=db,
        collection_key="roles",
        items=items,
        audit_entry=audit_entry,
        user_id=current_user.id,
    )
    return ResponseEnvelope.success_response(data=res.get("roles", items), message="Cập nhật ma trận vai trò thành công")


@staff_router.get("/staff")
async def get_staff_list_endpoint(
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await bff_admin_service.get_bootstrap_data(db)
    staff = data.get("staffList", [])
    return ResponseEnvelope.success_response(data=staff, message="Lấy danh sách nhân sự thành công")


@staff_router.put("/staff")
async def update_staff_list_endpoint(
    payload: dict,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db),
):
    items = payload.get("items", payload if isinstance(payload, list) else [payload])
    audit_entry = payload.get("auditEntry", {
        "hanhDong": "UPDATE_STAFF_LIST",
        "doiTuong": "staffList",
        "mucDich": "Cập nhật hồ sơ nhân sự và chứng chỉ hành nghề",
    })
    res = await bff_admin_service.update_collection(
        db=db,
        collection_key="staffList",
        items=items,
        audit_entry=audit_entry,
        user_id=current_user.id,
    )
    return ResponseEnvelope.success_response(data=res.get("staffList", items), message="Cập nhật danh sách nhân sự thành công")
