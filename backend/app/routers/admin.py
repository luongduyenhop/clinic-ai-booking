from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import ForbiddenException
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan, VaiTroEnum
from app.schemas.admin import (
    DoctorAdminCreateRequest,
    DoctorAdminUpdateRequest,
    DoctorAdminResponse,
    RoomCreateRequest,
    RoomResponse,
    ShiftCreateRequest,
    ShiftToggleLockRequest,
    ShiftResponse,
    EmergencyLeaveDeclareRequest,
    EmergencyLeaveSummaryResponse,
    ReassignQueueRequest,
    ReassignQueueResponse,
    PostponeAndCancelResponse,
    ServiceCreateRequest,
    ServiceUpdateRequest,
    ServiceItemAdminResponse,
    AdminDashboardStatsResponse,
    DepartmentCreateRequest,
    DepartmentUpdateRequest,
    DepartmentAdminResponse,
    RosterTemplateCreateRequest,
    RosterTemplateUpdateRequest,
    RosterTemplateResponse,
    RosterBatchGenerateRequest,
    RosterBatchGenerateResponse,
    DoctorLeaveCreateRequest,
    DoctorLeaveResponse,
    DoctorLeaveApproveRequest,
    AffectedBookingItem,
    ConceptCreateRequest,
    ConceptUpdateRequest,
    ConceptAdminResponse,
    RedFlagCreateRequest,
    RedFlagUpdateRequest,
    RedFlagAdminResponse,
    AIAccuracyReportResponse,
    AdminAnalyticsReportResponse,
    PatientAdminItemResponse,
    PatientAdminDetailResponse,
    PatientStatusUpdateRequest,
    DoctorScheduleMatrixResponse,
    DoctorTimesheetReportResponse,
    ServiceExportResponse,
    TopDiseasesResponse,
    TopServicesResponse,
    DoctorPerformanceResponse,
    RoomWorkloadResponse,
    TopMedicinesResponse,
)
from app.schemas.clinical import AmendmentResponse
from app.services.admin_service import admin_service

router = APIRouter(prefix="/admin", tags=["7. Quản Trị Phòng Khám & Phân Ca (Admin Portal)"])


def _require_admin(current_user: TaiKhoan = Depends(get_current_user)):
    """Kiểm tra phân quyền: Chỉ tài khoản Admin mới được thao tác cấu hình hệ thống"""
    if current_user.vai_tro != VaiTroEnum.ADMIN.value:
        raise ForbiddenException("Chức năng quản trị chỉ dành riêng cho Quản trị viên (Admin)!")
    return current_user


# --- 1. Quản lý Bác sĩ ---
@router.get(
    "/doctors",
    response_model=ResponseEnvelope[List[DoctorAdminResponse]],
    summary="Xem danh sách toàn bộ bác sĩ kèm trạng thái nhận lịch hẹn (Bahmni Provider Availability)"
)
async def get_doctors(
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_doctors_admin(db)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách bác sĩ thành công")


@router.post(
    "/doctors",
    response_model=ResponseEnvelope[DoctorAdminResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Tạo mới hồ sơ và tài khoản Bác sĩ"
)
async def create_doctor(
    payload: DoctorAdminCreateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.create_doctor_admin(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Tạo mới bác sĩ {data.ho_ten} thành công!",
        code=status.HTTP_201_CREATED
    )


@router.put(
    "/doctors/{doctor_id}",
    response_model=ResponseEnvelope[DoctorAdminResponse],
    summary="Cập nhật thông tin hoặc bật/tắt nhận lịch của Bác sĩ"
)
async def update_doctor(
    doctor_id: int,
    payload: DoctorAdminUpdateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.update_doctor_admin(doctor_id, payload, db)
    return ResponseEnvelope.success_response(data=data, message="Cập nhật bác sĩ thành công")


# --- 1b. Quản lý Buồng khám Vật lý (Physical Clinic Rooms) ---
@router.get(
    "/rooms",
    response_model=ResponseEnvelope[List[RoomResponse]],
    summary="Danh sách buồng khám vật lý và phòng chức năng (Physical Clinic Rooms)"
)
async def get_rooms(
    loai_phong: Optional[str] = Query(None, description="Lọc theo loại phòng (kham_benh, xet_nghiem, chan_doan_hinh_anh)"),
    chuyen_khoa_id: Optional[int] = Query(None, description="Lọc theo mã chuyên khoa"),
    is_active: Optional[bool] = Query(None, description="Lọc theo trạng thái hoạt động"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_rooms_admin(db, loai_phong=loai_phong, chuyen_khoa_id=chuyen_khoa_id, is_active=is_active)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách buồng khám thành công")


@router.post(
    "/rooms",
    response_model=ResponseEnvelope[RoomResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Thêm mới buồng khám vật lý"
)
async def create_room(
    payload: RoomCreateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.create_room_admin(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Tạo mới buồng khám {data.ma_phong} - {data.ten_phong} thành công!",
        code=status.HTTP_201_CREATED
    )


# --- 2. Phân ca trực & Lịch làm việc (OpenEMR 7 Calendar) ---
@router.get(
    "/shifts",
    response_model=ResponseEnvelope[List[ShiftResponse]],
    summary="Lấy danh sách ca làm việc theo tuần/ngày và bác sĩ (OpenEMR Calendar View)"
)
async def get_shifts(
    query_date: Optional[date] = Query(None, description="Ngày lọc ca trực (YYYY-MM-DD)"),
    doctor_id: Optional[int] = Query(None, description="Lọc theo bác sĩ"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_shifts(query_date, doctor_id, db)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách ca làm việc thành công")


@router.post(
    "/shifts",
    response_model=ResponseEnvelope[ShiftResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Phân ca trực mới cho Bác sĩ (OpenEMR In Office Shift)"
)
async def create_shift(
    payload: ShiftCreateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.create_shift(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message="Phân ca làm việc cho bác sĩ thành công!",
        code=status.HTTP_201_CREATED
    )


@router.get(
    "/shifts/schedule-matrix",
    response_model=ResponseEnvelope[DoctorScheduleMatrixResponse],
    summary="Ma trận phân ca trực và tình trạng slot trực tuyến / vãng lai theo thời gian thực (tClinic Roster Matrix)"
)
async def get_doctor_schedule_matrix(
    tu_ngay: date = Query(..., description="Từ ngày (YYYY-MM-DD)"),
    den_ngay: date = Query(..., description="Đến ngày (YYYY-MM-DD)"),
    chuyen_khoa_id: Optional[int] = Query(None, description="Lọc theo chuyên khoa"),
    doctor_id: Optional[int] = Query(None, description="Lọc theo bác sĩ"),
    phong_kham_id: Optional[int] = Query(None, description="Lọc theo buồng khám"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_doctor_schedule_matrix(
        db, tu_ngay, den_ngay, chuyen_khoa_id, doctor_id, phong_kham_id
    )
    return ResponseEnvelope.success_response(data=data, message="Lấy ma trận phân ca trực thành công")


@router.get(
    "/shifts/export-report",
    response_model=ResponseEnvelope[DoctorTimesheetReportResponse],
    summary="Báo cáo chấm công và công suất phục vụ theo ca của từng bác sĩ (tClinic xuatbaocao)"
)
async def export_shift_timesheet_report(
    tu_ngay: date = Query(..., description="Từ ngày (YYYY-MM-DD)"),
    den_ngay: date = Query(..., description="Đến ngày (YYYY-MM-DD)"),
    chuyen_khoa_id: Optional[int] = Query(None, description="Lọc theo chuyên khoa"),
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.export_timesheet_report(db, tu_ngay, den_ngay, chuyen_khoa_id)
    return ResponseEnvelope.success_response(data=data, message="Xuất báo cáo chấm công phân ca thành công")



@router.put(
    "/shifts/{shift_id}/lock",
    response_model=ResponseEnvelope[ShiftResponse],
    summary="Khóa ca trực hoặc báo nghỉ đột xuất (OpenEMR Out of office rule)"
)
async def toggle_lock_shift(
    shift_id: int,
    payload: ShiftToggleLockRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.toggle_lock_shift(shift_id, payload, db)
    msg = "Đã mở lại ca trực" if data.is_active else f"Đã khóa ca trực: {data.ghi_chu_nghi}"
    return ResponseEnvelope.success_response(data=data, message=msg)


@router.post(
    "/shifts/{shift_id}/emergency-leave",
    response_model=ResponseEnvelope[EmergencyLeaveSummaryResponse],
    summary="Admin khai báo bác sĩ nghỉ đột xuất cho ca trực và thống kê bệnh nhân bị ảnh hưởng"
)
async def declare_emergency_leave(
    shift_id: int,
    payload: EmergencyLeaveDeclareRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.declare_emergency_leave(shift_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=data,
        message="Khai báo bác sĩ nghỉ đột xuất thành công! Vui lòng điều phối hàng đợi hoặc tạm hoãn lịch."
    )


@router.post(
    "/shifts/{shift_id}/reassign",
    response_model=ResponseEnvelope[ReassignQueueResponse],
    summary="Admin điều phối chuyển toàn bộ hàng đợi ca nghỉ sang Bác sĩ trực thay thế (cùng chuyên khoa)"
)
async def reassign_queue_to_replacement(
    shift_id: int,
    payload: ReassignQueueRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.reassign_queue_to_replacement(shift_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Đã điều phối hàng đợi thành công sang Bác sĩ {data.ten_bac_si_thay_the}!"
    )


@router.post(
    "/shifts/{shift_id}/postpone-and-cancel",
    response_model=ResponseEnvelope[PostponeAndCancelResponse],
    summary="Admin tạm hoãn hàng đợi và hủy lịch không có người thay thế (Bảo lưu quyền lợi No-fault)"
)
async def postpone_and_cancel_unassigned(
    shift_id: int,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.postpone_and_cancel_unassigned(shift_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=data,
        message="Đã tạm hoãn hàng đợi và hủy lịch hẹn an toàn!"
    )



# --- 3. Danh mục Dịch vụ & Bảng giá ---
@router.get(
    "/services",
    response_model=ResponseEnvelope[List[ServiceItemAdminResponse]],
    summary="Xem danh mục dịch vụ cận lâm sàng & khám niêm yết"
)
async def get_services(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_services_admin(db)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh mục dịch vụ thành công")


@router.get(
    "/services/export",
    response_model=ResponseEnvelope[ServiceExportResponse],
    summary="Xuất toàn bộ danh mục dịch vụ kỹ thuật y tế & bảng giá niêm yết (tClinic / Thông tư 22/2023/TT-BYT)"
)
async def export_services_catalog(
    chuyen_khoa_id: Optional[int] = Query(None, description="Lọc theo chuyên khoa"),
    ma_nhom_byt: Optional[str] = Query(None, description="Lọc theo nhóm Bộ Y Tế (XN, CDHA, TDCN, TT, KHAM)"),
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.export_services_catalog(db, chuyen_khoa_id, ma_nhom_byt)
    return ResponseEnvelope.success_response(data=data, message="Xuất danh mục bảng giá dịch vụ thành công")



@router.post(
    "/services",
    response_model=ResponseEnvelope[ServiceItemAdminResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Thêm mới dịch vụ y tế niêm yết"
)
async def create_service(
    payload: ServiceCreateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.create_service_admin(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Thêm dịch vụ {data.ten_dich_vu} thành công!",
        code=status.HTTP_201_CREATED
    )


@router.put(
    "/services/{service_id}",
    response_model=ResponseEnvelope[ServiceItemAdminResponse],
    summary="Cập nhật thông tin dịch vụ, giá niêm yết, thời gian trả kết quả (TAT) và buồng thực hiện"
)
async def update_service(
    service_id: int,
    payload: ServiceUpdateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.update_service_admin(service_id, payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Cập nhật dịch vụ {data.ten_dich_vu} thành công!"
    )


# --- 4. Dashboard KPIs Dữ liệu thật ---
@router.get(
    "/dashboard-stats",
    response_model=ResponseEnvelope[AdminDashboardStatsResponse],
    summary="Thống kê vận hành phòng khám thời gian thực (Live Database KPIs)"
)
async def get_dashboard_stats(
    query_date: Optional[date] = Query(None, description="Ngày báo cáo (mặc định hôm nay)"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_dashboard_stats(query_date, db)
    return ResponseEnvelope.success_response(data=data, message="Lấy số liệu thống kê vận hành thành công")


# --- 5. Duyệt Đính Chính Bệnh Án Toàn Viện (Four-Eyes Principle) ---
@router.get(
    "/amendments",
    response_model=ResponseEnvelope[List[AmendmentResponse]],
    summary="Ban Giám đốc Chuyên môn / Trưởng khoa xem toàn bộ biên bản đính chính toàn viện (Four-Eyes Principle)"
)
async def get_admin_amendments(
    trang_thai: Optional[str] = Query(None, description="Lọc theo trạng thái biên bản: CHO_PHE_DUYET, DA_PHE_DUYET, TU_CHOI"),
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_amendments_admin(db, trang_thai)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách biên bản đính chính thành công")


# ==============================================================================
# 6. GÓI 1: QUẢN LÝ DANH MỤC CHUYÊN KHOA KHÁM BỆNH (OpenMRS Department Catalog)
# ==============================================================================

@router.get(
    "/departments",
    response_model=ResponseEnvelope[List[DepartmentAdminResponse]],
    summary="Xem toàn bộ danh mục chuyên khoa kèm số bác sĩ và buồng khám (Admin Portal)"
)
async def get_departments(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_departments_admin(db)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh mục chuyên khoa thành công")


@router.post(
    "/departments",
    response_model=ResponseEnvelope[DepartmentAdminResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Thêm mới chuyên khoa khám bệnh"
)
async def create_department(
    payload: DepartmentCreateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.create_department_admin(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Tạo mới chuyên khoa {data.ten_chuyen_khoa} thành công!",
        code=status.HTTP_201_CREATED
    )


@router.put(
    "/departments/{department_id}",
    response_model=ResponseEnvelope[DepartmentAdminResponse],
    summary="Cập nhật thông tin hoặc trạng thái chuyên khoa"
)
async def update_department(
    department_id: int,
    payload: DepartmentUpdateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.update_department_admin(department_id, payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Cập nhật chuyên khoa {data.ten_chuyen_khoa} thành công!"
    )


# ==============================================================================
# 7. GÓI 2: QUẢN LÝ LỊCH LÀM VIỆC ĐỊNH KỲ CỦA BÁC SĨ (Bahmni Weekly Roster)
# ==============================================================================

@router.get(
    "/rosters",
    response_model=ResponseEnvelope[List[RosterTemplateResponse]],
    summary="Xem danh sách khuôn mẫu phân ca trực tuần của bác sĩ (Bahmni Provider Roster)"
)
async def get_roster_templates(
    doctor_id: Optional[int] = Query(None, description="Lọc theo bác sĩ"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_roster_templates_admin(db, doctor_id)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách mẫu ca trực tuần thành công")


@router.post(
    "/rosters",
    response_model=ResponseEnvelope[RosterTemplateResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Tạo mẫu ca trực định kỳ trong tuần cho bác sĩ"
)
async def create_roster_template(
    payload: RosterTemplateCreateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.create_roster_template_admin(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Tạo mẫu ca trực {data.ten_thu_tieng_viet} cho BS {data.ten_bac_si} thành công!",
        code=status.HTTP_201_CREATED
    )


@router.put(
    "/rosters/{roster_id}",
    response_model=ResponseEnvelope[RosterTemplateResponse],
    summary="Cập nhật thông tin mẫu ca trực tuần"
)
async def update_roster_template(
    roster_id: int,
    payload: RosterTemplateUpdateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.update_roster_template_admin(roster_id, payload, db)
    return ResponseEnvelope.success_response(data=data, message="Cập nhật mẫu ca trực thành công")


@router.delete(
    "/rosters/{roster_id}",
    response_model=ResponseEnvelope[None],
    summary="Xóa mẫu ca trực tuần"
)
async def delete_roster_template(
    roster_id: int,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    await admin_service.delete_roster_template_admin(roster_id, db)
    return ResponseEnvelope.success_response(data=None, message="Xóa mẫu ca trực thành công")


@router.post(
    "/rosters/generate-shifts",
    response_model=ResponseEnvelope[RosterBatchGenerateResponse],
    summary="Phát sinh ca trực tự động theo mẫu lịch tuần (Bahmni Batch Shift Generator)"
)
async def generate_shifts_from_roster(
    payload: RosterBatchGenerateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.generate_shifts_from_roster(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Phát sinh ca trực tự động hoàn tất! Đã tạo {data.so_ca_tao_thanh_cong} ca."
    )


# ==============================================================================
# 8. GÓI 3: QUẢN LÝ NGÀY NGHỈ & NGHỈ ĐỘT XUẤT CỦA BÁC SĨ (Absence Management)
# ==============================================================================

@router.get(
    "/leaves",
    response_model=ResponseEnvelope[List[DoctorLeaveResponse]],
    summary="Danh sách đơn nghỉ phép và lịch nghỉ đột xuất của bác sĩ (OpenMRS/Bahmni Absence)"
)
async def get_leaves(
    doctor_id: Optional[int] = Query(None, description="Lọc theo bác sĩ"),
    trang_thai: Optional[str] = Query(None, description="Lọc theo trạng thái (CHO_DUYET, DA_DUYET, TU_CHOI)"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_leaves_admin(db, doctor_id, trang_thai)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách nghỉ phép thành công")


@router.post(
    "/leaves",
    response_model=ResponseEnvelope[DoctorLeaveResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký lịch nghỉ phép (kế hoạch) hoặc khai báo nghỉ đột xuất"
)
async def create_leave(
    payload: DoctorLeaveCreateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.create_leave_admin(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message="Đăng ký nghỉ phép thành công!",
        code=status.HTTP_201_CREATED
    )


@router.post(
    "/leaves/{leave_id}/approve",
    response_model=ResponseEnvelope[DoctorLeaveResponse],
    summary="Admin phê duyệt hoặc từ chối đơn nghỉ phép của bác sĩ"
)
async def approve_leave(
    leave_id: int,
    payload: DoctorLeaveApproveRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.approve_leave_admin(leave_id, payload, current_user, db)
    msg = "Đã duyệt đơn nghỉ phép và khóa ca trực liên quan!" if payload.hanh_dong == "DA_DUYET" else "Đã từ chối đơn nghỉ phép."
    return ResponseEnvelope.success_response(data=data, message=msg)


@router.get(
    "/leaves/{leave_id}/affected-bookings",
    response_model=ResponseEnvelope[List[AffectedBookingItem]],
    summary="Xem danh sách bệnh nhân bị ảnh hưởng bởi ca nghỉ để hỗ trợ dời lịch hẹn"
)
async def get_leave_affected_bookings(
    leave_id: int,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_leave_affected_bookings(leave_id, db)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách bệnh nhân bị ảnh hưởng thành công")


# ==============================================================================
# 9. GÓI 4: QUẢN TRỊ ÁNH XẠ TRIỆU CHỨNG - CHUYÊN KHOA & ĐÁNH GIÁ AI
# ==============================================================================

@router.get(
    "/ai/concepts",
    response_model=ResponseEnvelope[List[ConceptAdminResponse]],
    summary="Danh sách khái niệm triệu chứng ánh xạ chuyên khoa (OpenMRS Concept Dictionary)"
)
async def get_concepts(
    loai_khai_niem: Optional[str] = Query(None, description="Lọc theo loại: trieu_chung, benh_icd10, dich_vu"),
    chuyen_khoa_id: Optional[int] = Query(None, description="Lọc theo chuyên khoa"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_concepts_admin(db, loai_khai_niem, chuyen_khoa_id)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách khái niệm y khoa thành công")


@router.post(
    "/ai/concepts",
    response_model=ResponseEnvelope[ConceptAdminResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Thêm mới triệu chứng ánh xạ chuyên khoa"
)
async def create_concept(
    payload: ConceptCreateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.create_concept_admin(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Thêm khái niệm {data.ten_khai_niem} thành công!",
        code=status.HTTP_201_CREATED
    )


@router.put(
    "/ai/concepts/{concept_id}",
    response_model=ResponseEnvelope[ConceptAdminResponse],
    summary="Cập nhật khái niệm triệu chứng"
)
async def update_concept(
    concept_id: int,
    payload: ConceptUpdateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.update_concept_admin(concept_id, payload, db)
    return ResponseEnvelope.success_response(data=data, message=f"Cập nhật khái niệm {data.ten_khai_niem} thành công!")


@router.delete(
    "/ai/concepts/{concept_id}",
    response_model=ResponseEnvelope[None],
    summary="Xóa khái niệm triệu chứng"
)
async def delete_concept(
    concept_id: int,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    await admin_service.delete_concept_admin(concept_id, db)
    return ResponseEnvelope.success_response(data=None, message="Xóa khái niệm thành công")


@router.get(
    "/ai/red-flags",
    response_model=ResponseEnvelope[List[RedFlagAdminResponse]],
    summary="Danh sách quy tắc từ khóa cảnh báo cấp cứu (Red Flags Rules - BYT)"
)
async def get_red_flags(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_red_flags_admin(db)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách từ khóa cấp cứu thành công")


@router.post(
    "/ai/red-flags",
    response_model=ResponseEnvelope[RedFlagAdminResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Thêm mới từ khóa cảnh báo cấp cứu"
)
async def create_red_flag(
    payload: RedFlagCreateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.create_red_flag_admin(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Thêm từ khóa cấp cứu '{data.tu_khoa}' thành công!",
        code=status.HTTP_201_CREATED
    )


@router.put(
    "/ai/red-flags/{rule_id}",
    response_model=ResponseEnvelope[RedFlagAdminResponse],
    summary="Cập nhật từ khóa cảnh báo cấp cứu"
)
async def update_red_flag(
    rule_id: int,
    payload: RedFlagUpdateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.update_red_flag_admin(rule_id, payload, db)
    return ResponseEnvelope.success_response(data=data, message="Cập nhật quy tắc cấp cứu thành công")


@router.delete(
    "/ai/red-flags/{rule_id}",
    response_model=ResponseEnvelope[None],
    summary="Xóa quy tắc từ khóa cấp cứu"
)
async def delete_red_flag(
    rule_id: int,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    await admin_service.delete_red_flag_admin(rule_id, db)
    return ResponseEnvelope.success_response(data=None, message="Xóa quy tắc cấp cứu thành công")


@router.get(
    "/ai/accuracy",
    response_model=ResponseEnvelope[AIAccuracyReportResponse],
    summary="Báo cáo độ chính xác phân luồng AI đối soát chẩn đoán thực tế của bác sĩ"
)
async def get_ai_accuracy(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_ai_accuracy_report(db)
    return ResponseEnvelope.success_response(data=data, message="Lấy số liệu độ chính xác AI thành công")


# ==============================================================================
# 10. GÓI 5: XEM BÁO CÁO THỐNG KÊ CHUYÊN SÂU (Analytics & Intelligence)
# ==============================================================================

@router.get(
    "/reports/analytics",
    response_model=ResponseEnvelope[AdminAnalyticsReportResponse],
    summary="Báo cáo thống kê lượt đặt, phân rã nguyên nhân hủy và độ chính xác AI"
)
async def get_analytics_report(
    tu_ngay: Optional[date] = Query(None, description="Từ ngày (YYYY-MM-DD)"),
    den_ngay: Optional[date] = Query(None, description="Đến ngày (YYYY-MM-DD)"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_analytics_report_admin(db, tu_ngay, den_ngay)
    return ResponseEnvelope.success_response(data=data, message="Lấy báo cáo phân tích thống kê thành công")


@router.get(
    "/analytics/top-diseases",
    response_model=ResponseEnvelope[TopDiseasesResponse],
    summary="Top 10 mặt bệnh thường gặp nhất theo mã ICD-10 (tClinic /dashboard/top-10-benh-icd10)"
)
async def get_top_diseases(
    tu_ngay: Optional[date] = Query(None, description="Từ ngày (YYYY-MM-DD)"),
    den_ngay: Optional[date] = Query(None, description="Đến ngày (YYYY-MM-DD)"),
    limit: int = Query(10, ge=1, le=50, description="Số lượng bệnh trả về"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_top_icd10_diseases(db, tu_ngay, den_ngay, limit)
    return ResponseEnvelope.success_response(data=data, message="Lấy thống kê Top bệnh ICD-10 thành công")


@router.get(
    "/analytics/top-services",
    response_model=ResponseEnvelope[TopServicesResponse],
    summary="Top dịch vụ cận lâm sàng / kỹ thuật có doanh thu cao nhất (tClinic /dashboard/top-10-dich-vu-doanh-thu)"
)
async def get_top_services(
    tu_ngay: Optional[date] = Query(None, description="Từ ngày (YYYY-MM-DD)"),
    den_ngay: Optional[date] = Query(None, description="Đến ngày (YYYY-MM-DD)"),
    limit: int = Query(10, ge=1, le=50, description="Số lượng dịch vụ trả về"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_top_services_analytics(db, tu_ngay, den_ngay, limit)
    return ResponseEnvelope.success_response(data=data, message="Lấy thống kê Top dịch vụ kỹ thuật thành công")


@router.get(
    "/analytics/doctor-performance",
    response_model=ResponseEnvelope[DoctorPerformanceResponse],
    summary="Thống kê năng suất, thời gian khám trung bình và doanh thu theo bác sĩ (tClinic /dashboard/khambenh/bacsi)"
)
async def get_doctor_performance(
    tu_ngay: Optional[date] = Query(None, description="Từ ngày (YYYY-MM-DD)"),
    den_ngay: Optional[date] = Query(None, description="Đến ngày (YYYY-MM-DD)"),
    chuyen_khoa_id: Optional[int] = Query(None, description="Lọc theo chuyên khoa"),
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_doctor_performance_analytics(db, tu_ngay, den_ngay, chuyen_khoa_id)
    return ResponseEnvelope.success_response(data=data, message="Lấy báo cáo hiệu suất bác sĩ thành công")


@router.get(
    "/analytics/room-workload",
    response_model=ResponseEnvelope[RoomWorkloadResponse],
    summary="Thống kê phụ tải buồng khám để điều phối lưu lượng (tClinic /dashboard/dangky/phongkham)"
)
async def get_room_workload(
    tu_ngay: Optional[date] = Query(None, description="Từ ngày (YYYY-MM-DD)"),
    den_ngay: Optional[date] = Query(None, description="Đến ngày (YYYY-MM-DD)"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_room_workload_analytics(db, tu_ngay, den_ngay)
    return ResponseEnvelope.success_response(data=data, message="Lấy thống kê phụ tải buồng khám thành công")


@router.get(
    "/analytics/top-medicines",
    response_model=ResponseEnvelope[TopMedicinesResponse],
    summary="Top thuốc kê đơn theo số lượt kê và số lượng (tClinic /dashboard/donthuoc)"
)
async def get_top_medicines(
    tu_ngay: Optional[date] = Query(None, description="Từ ngày (YYYY-MM-DD)"),
    den_ngay: Optional[date] = Query(None, description="Đến ngày (YYYY-MM-DD)"),
    limit: int = Query(10, ge=1, le=50, description="Số lượng thuốc trả về"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_top_medicines_analytics(db, tu_ngay, den_ngay, limit)
    return ResponseEnvelope.success_response(data=data, message="Lấy thống kê Top thuốc kê đơn thành công")




# ==============================================================================
# 11. GÓI 6: QUẢN TRỊ HỒ SƠ BỆNH NHÂN (OpenMRS Master Patient Directory)
# ==============================================================================

@router.get(
    "/patients",
    response_model=ResponseEnvelope[List[PatientAdminItemResponse]],
    summary="Tra cứu danh sách bệnh nhân tập trung (OpenMRS Patient Directory)"
)
async def get_patients(
    search: Optional[str] = Query(None, description="Tìm theo tên, SĐT, CCCD hoặc Mã bệnh nhân"),
    page: int = Query(1, ge=1, description="Trang số"),
    page_size: int = Query(20, ge=1, le=100, description="Kích thước trang"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_patients_admin(db, search, page, page_size)
    return ResponseEnvelope.success_response(data=data, message="Lấy danh sách bệnh nhân thành công")


@router.get(
    "/patients/{patient_id}",
    response_model=ResponseEnvelope[PatientAdminDetailResponse],
    summary="Xem chi tiết hồ sơ bệnh nhân, dị ứng, tiền sử và lịch sử khám"
)
async def get_patient_detail(
    patient_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.get_patient_detail_admin(patient_id, db)
    return ResponseEnvelope.success_response(data=data, message="Lấy chi tiết hồ sơ bệnh nhân thành công")


@router.put(
    "/patients/{patient_id}/status",
    response_model=ResponseEnvelope[PatientAdminDetailResponse],
    summary="Cập nhật quyền đặt lịch hoặc điều chỉnh điểm tín nhiệm bệnh nhân"
)
async def update_patient_status(
    patient_id: int,
    payload: PatientStatusUpdateRequest,
    current_user: TaiKhoan = Depends(_require_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await admin_service.update_patient_status_admin(patient_id, payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Cập nhật hồ sơ bệnh nhân {data.ho_ten} thành công!"
    )


# ==============================================================================
# 12. TẦNG ĐẤU NỐI BFF (BACKEND-FOR-FRONTEND) ĐỒNG BỘ 19 TRANG QUẢN TRỊ REACT
# ==============================================================================
from typing import Any
from pydantic import BaseModel
from app.core.dependencies import get_optional_current_user
from app.services.bff_admin_service import bff_admin_service


class BffCollectionUpdatePayload(BaseModel):
    collectionKey: Optional[str] = None
    items: Any = None
    auditEntry: Optional[dict] = None


class BffCatalogUpdatePayload(BaseModel):
    subKey: Optional[str] = None
    items: Any = None
    auditEntry: Optional[dict] = None


@router.get(
    "/bootstrap",
    response_model=ResponseEnvelope[dict],
    summary="Nạp toàn bộ dữ liệu quản trị phòng khám (19 phân hệ HIS) từ PostgreSQL"
)
async def get_admin_bootstrap(
    current_user: Optional[TaiKhoan] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await bff_admin_service.get_bootstrap_data(db)
    return ResponseEnvelope.success_response(
        data=data,
        message="Đồng bộ dữ liệu hệ thống từ PostgreSQL thành công!",
    )


@router.put(
    "/collections/{collection_key}",
    response_model=ResponseEnvelope[dict],
    summary="Lưu trữ thao tác CRUD của một phân hệ quản trị xuống PostgreSQL kèm Audit Log"
)
async def update_admin_collection(
    collection_key: str,
    payload: BffCollectionUpdatePayload,
    current_user: Optional[TaiKhoan] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.id if current_user else None
    data = await bff_admin_service.update_collection(
        db=db,
        collection_key=collection_key,
        items=payload.items,
        audit_entry=payload.auditEntry,
        user_id=user_id,
    )
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Đã lưu dữ liệu phân hệ '{collection_key}' vào PostgreSQL thành công!",
    )


@router.put(
    "/catalogs/{sub_key}",
    response_model=ResponseEnvelope[dict],
    summary="Lưu trữ danh mục hệ thống (khoaPhong, dichVu, benhICD, thuoc, diaChi, chung) xuống PostgreSQL"
)
async def update_admin_catalog_subcollection(
    sub_key: str,
    payload: BffCatalogUpdatePayload,
    current_user: Optional[TaiKhoan] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.id if current_user else None
    data = await bff_admin_service.update_catalog_subcollection(
        db=db,
        sub_key=sub_key,
        items=payload.items,
        audit_entry=payload.auditEntry,
        user_id=user_id,
    )
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Đã cập nhật danh mục '{sub_key}' vào PostgreSQL thành công!",
    )


@router.post(
    "/reset-demo",
    response_model=ResponseEnvelope[dict],
    summary="Khôi phục dữ liệu mẫu ban đầu trên PostgreSQL"
)
async def reset_admin_demo_data(
    current_user: Optional[TaiKhoan] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = await bff_admin_service.reset_demo_data(db)
    return ResponseEnvelope.success_response(
        data=data,
        message="Đã khôi phục dữ liệu mẫu gốc trên PostgreSQL thành công!",
    )

