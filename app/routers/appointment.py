from datetime import date
from typing import List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan, BenhNhan, BacSi, NguoiDung, ChuyenKhoa
from app.models.appointment import LichKham
from app.schemas.appointment import (
    DoctorScheduleSlotsResponse,
    AppointmentCreateRequest,
    AppointmentCancelRequest,
    AppointmentResponse,
    DoctorBriefResponse,
    PatientBriefResponse
)
from app.services.appointment_service import appointment_service

router = APIRouter(prefix="/appointments", tags=["2. Đặt Lịch & Điều Phối Slot (Package B)"])


@router.get(
    "/doctors/{doctor_id}/slots",
    response_model=ResponseEnvelope[DoctorScheduleSlotsResponse],
    summary="Xem lịch làm việc và tính toán các slot 30 phút còn trống (UC-B02)"
)
async def get_doctor_slots(
    doctor_id: int,
    query_date: date = Query(..., description="Ngày cần tra cứu lịch khám (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db)
):
    result = await appointment_service.get_doctor_available_slots(doctor_id, query_date, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy danh sách khung giờ khám thành công"
    )


@router.post(
    "",
    response_model=ResponseEnvelope[AppointmentResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Đặt lịch khám trực tuyến - Có cơ chế khóa Pessimistic Locking chống Race Condition (UC-B03)"
)
async def create_booking(
    payload: AppointmentCreateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await appointment_service.create_booking(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Đặt lịch khám thành công! Mã hẹn đã được khởi tạo.",
        code=status.HTTP_201_CREATED
    )


@router.post(
    "/{appointment_id}/cancel",
    response_model=ResponseEnvelope[dict],
    summary="Hủy lịch hẹn khám - Ràng buộc an toàn y tế tối thiểu 02 tiếng (UC-B05)"
)
async def cancel_booking(
    appointment_id: int,
    payload: AppointmentCancelRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await appointment_service.cancel_booking(appointment_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=result["message"]
    )


@router.get(
    "/my-appointments",
    response_model=ResponseEnvelope[List[AppointmentResponse]],
    summary="Bệnh nhân tra cứu lịch sử và danh sách lịch hẹn của bản thân (UC-B04)"
)
async def get_my_appointments(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Lấy thông tin Bệnh nhân
    stmt_bn = select(BenhNhan, NguoiDung).join(NguoiDung, BenhNhan.nguoi_dung_id == NguoiDung.id).where(
        BenhNhan.nguoi_dung_id == current_user.nguoi_dung_id
    )
    bn_row = (await db.execute(stmt_bn)).first()
    if not bn_row:
        return ResponseEnvelope.success_response(data=[], message="Chưa có lịch hẹn nào")
    benh_nhan, bn_info = bn_row

    # Truy vấn danh sách lịch hẹn sắp xếp theo ngày giờ mới nhất
    stmt_lk = (
        select(LichKham, BacSi, NguoiDung, ChuyenKhoa)
        .join(BacSi, LichKham.bac_si_id == BacSi.id)
        .join(NguoiDung, BacSi.nguoi_dung_id == NguoiDung.id)
        .outerjoin(ChuyenKhoa, BacSi.chuyen_khoa_id == ChuyenKhoa.id)
        .where(LichKham.benh_nhan_id == benh_nhan.id)
        .order_by(LichKham.ngay_kham.desc(), LichKham.gio_kham.desc())
    )
    rows = (await db.execute(stmt_lk)).all()

    appointments = []
    for lk, bs, bs_info, ck in rows:
        appointments.append(
            AppointmentResponse(
                id=lk.id,
                ma_lich_kham=lk.ma_lich_kham,
                ngay_kham=lk.ngay_kham,
                gio_kham=lk.gio_kham,
                so_thu_tu=lk.so_thu_tu,
                trang_thai=lk.trang_thai,
                ly_do_kham=lk.ly_do_kham,
                trieu_chung_ban_dau=lk.trieu_chung_ban_dau,
                bac_si=DoctorBriefResponse(
                    id=bs.id,
                    ho_ten=bs_info.ho_ten,
                    chuyen_khoa=ck.ten_chuyen_khoa if ck else "Nội khoa",
                    hoc_vi=bs.hoc_vi
                ),
                benh_nhan=PatientBriefResponse(
                    id=benh_nhan.id,
                    ho_ten=bn_info.ho_ten,
                    so_dien_thoai=bn_info.so_dien_thoai
                )
            )
        )

    return ResponseEnvelope.success_response(
        data=appointments,
        message="Lấy danh sách lịch hẹn thành công"
    )
