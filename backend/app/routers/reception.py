from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from sqlalchemy import select
from app.core.exceptions import ForbiddenException
from app.core.response import ResponseEnvelope
from app.models.user import BenhNhan, TaiKhoan, VaiTroEnum
from app.schemas.queue import (
    CheckInRequest,
    WalkInCheckInRequest,
    WalkInQuickRequest,
    QueueTicketResponse,
    CloseTicketRequest,
    CloseTicketResponse,
    DoctorQueueBoardResponse,
    PatientFlowBoardResponse,
    AppointmentReceptionSearchResult,
    ShiftDashboardResponse,
    RoomStatusDashboardResponse,
    ReceptionAppointmentsResponse,
    RosterItem,
    RoomResourceItem,
    RosterTemplateItem,
    PatientPackageItem,
    PatientHistorySummaryResponse,
    ProcessNoShowResponse,
)
from app.schemas.incident import (
    DoctorAbsenceIncidentResponse,
    RebalanceQueueRequest,
    RebalanceQueueResponse,
)
from app.services.queue_service import queue_service
from app.services.incident_service import incident_service

router = APIRouter(prefix="/reception", tags=["6. Tiếp Đón & Điều Phối Hàng Đợi (Bahmni Queue Module)"])

RECEPTION_STAFF_ROLES = (
    VaiTroEnum.LE_TAN.value,
    VaiTroEnum.ADMIN.value,
    VaiTroEnum.BAC_SI.value,
    VaiTroEnum.THU_NGAN.value,
)

RECEPTION_ADMIN_ROLES = (
    VaiTroEnum.LE_TAN.value,
    VaiTroEnum.ADMIN.value,
)

QUEUE_VIEW_ROLES = (
    VaiTroEnum.LE_TAN.value,
    VaiTroEnum.ADMIN.value,
    VaiTroEnum.BAC_SI.value,
    VaiTroEnum.THU_NGAN.value,
    VaiTroEnum.KY_THUAT_VIEN.value,
)



@router.get(
    "/search-appointments",
    response_model=ResponseEnvelope[List[AppointmentReceptionSearchResult]],
    summary="Tìm kiếm lịch hẹn tại quầy tiếp đón theo mã hẹn, số điện thoại hoặc họ tên"
)
async def search_appointments(
    q: str = Query(..., min_length=1, description="Từ khóa: mã hẹn APT, SĐT, hoặc họ tên"),
    query_date: Optional[date] = Query(None, description="Ngày khám cần tra cứu (mặc định hôm nay)"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.vai_tro not in RECEPTION_STAFF_ROLES:
        raise ForbiddenException("Chỉ nhân viên phòng khám mới có quyền tìm kiếm lịch hẹn tại quầy tiếp đón!")
    results = await queue_service.search_appointments(q, query_date, db)
    return ResponseEnvelope.success_response(
        data=results,
        message=f"Tìm thấy {len(results)} lịch hẹn phù hợp"
    )


@router.post(
    "/walk-in-quick",
    response_model=ResponseEnvelope[QueueTicketResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Tiếp nhận nhanh bệnh nhân vãng lai không đặt trước (nhập họ tên, SĐT, chọn bác sĩ)"
)
async def check_in_walk_in_quick(
    payload: WalkInQuickRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.check_in_walk_in_quick(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Tiếp nhận bệnh nhân vãng lai thành công! Số thứ tự #{result.so_thu_tu_kham}.",
        code=status.HTTP_201_CREATED
    )


@router.post(
    "/check-in",
    response_model=ResponseEnvelope[QueueTicketResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Lễ tân thực hiện Check-in tại quầy cho bệnh nhân có hẹn trước"
)
async def check_in_patient(
    payload: CheckInRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.check_in_patient(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Check-in thành công! Bệnh nhân được cấp số thứ tự khám #{result.so_thu_tu_kham}.",
        code=status.HTTP_201_CREATED
    )


@router.post(
    "/walk-in",
    response_model=ResponseEnvelope[QueueTicketResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Tiếp nhận và cấp số thứ tự cho bệnh nhân vãng lai không đặt hẹn trước"
)
async def check_in_walk_in(
    payload: WalkInCheckInRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.check_in_walk_in(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Tiếp nhận bệnh nhân vãng lai thành công! Số thứ tự #{result.so_thu_tu_kham}.",
        code=status.HTTP_201_CREATED
    )


@router.get(
    "/queue/{doctor_id}",
    response_model=ResponseEnvelope[DoctorQueueBoardResponse],
    summary="Xem màn hình bảng hàng đợi phòng khám theo thời gian thực"
)
async def get_doctor_queue(
    doctor_id: int,
    query_date: Optional[date] = Query(None, description="Ngày cần tra cứu hàng đợi (YYYY-MM-DD)"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.vai_tro not in QUEUE_VIEW_ROLES:
        raise ForbiddenException("Bạn không có quyền xem thông tin hàng đợi phòng khám!")
    result = await queue_service.get_doctor_queue_board(doctor_id, query_date, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy dữ liệu bảng hàng đợi phòng khám thành công"
    )


@router.post(
    "/queue/{ticket_id}/restore",
    response_model=ResponseEnvelope[QueueTicketResponse],
    summary="Lễ tân phục hồi vé tạm hoãn khi bệnh nhân quay lại phòng khám"
)
async def restore_ticket(
    ticket_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.restore_ticket(ticket_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Đã phục hồi vé khám vào hàng đợi thành công"
    )


@router.get(
    "/flow-board",
    response_model=ResponseEnvelope[PatientFlowBoardResponse],
    summary="Bảng điều phối luân chuyển bệnh nhân toàn diện tại phòng khám (OpenEMR Patient Flow Board)"
)
async def get_patient_flow_board(
    doctor_id: Optional[int] = Query(None, description="Lọc theo bác sĩ (tùy chọn)"),
    query_date: Optional[date] = Query(None, description="Ngày cần theo dõi (mặc định hôm nay)"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.vai_tro not in RECEPTION_STAFF_ROLES:
        raise ForbiddenException("Chỉ nhân viên phòng khám mới có quyền xem Patient Flow Board!")
    result = await queue_service.get_patient_flow_board(doctor_id, query_date, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy dữ liệu Patient Flow Board thành công"
    )


@router.patch(
    "/queue/{ticket_id}/close",
    response_model=ResponseEnvelope[CloseTicketResponse],
    summary="Lễ tân chủ động đóng vé hàng đợi vì lý do hành chính (DA_DONG_VE)"
)
async def close_ticket(
    ticket_id: int,
    payload: Optional[CloseTicketRequest] = None,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    ly_do = payload.ly_do if payload else None
    result = await queue_service.close_ticket(ticket_id, ly_do, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Đã đóng vé hàng đợi thành công"
    )


@router.patch(
    "/queue/{ticket_id}/leave",
    response_model=ResponseEnvelope[CloseTicketResponse],
    summary="Cập nhật trạng thái bệnh nhân xin bỏ về không khám (BO_KHAM)"
)
async def patient_leave_queue(
    ticket_id: int,
    payload: Optional[CloseTicketRequest] = None,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    ly_do = payload.ly_do if payload else None
    result = await queue_service.patient_leave_queue(ticket_id, ly_do, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Đã cập nhật trạng thái bệnh nhân bỏ khám"
    )


# =========================================================================
# FC-10: DASHBOARD VẬN HÀNH CA TRỰC LỄ TÂN
# =========================================================================
@router.get(
    "/dashboard/shift-summary",
    response_model=ResponseEnvelope[ShiftDashboardResponse],
    summary="Báo cáo chỉ số vận hành tổng thể ca trực của Lễ tân (FC-10)"
)
async def get_shift_dashboard(
    query_date: Optional[date] = Query(None, description="Ngày cần xem báo cáo (mặc định hôm nay)"),
    ca_kham: Optional[str] = Query(None, description="Ca khám: sang hoặc chieu (mặc định theo giờ hiện tại)"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.vai_tro not in RECEPTION_STAFF_ROLES:
        raise ForbiddenException("Chỉ nhân viên phòng khám mới có quyền xem Dashboard ca trực tiếp đón!")
    result = await queue_service.get_shift_dashboard(query_date, ca_kham, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy dữ liệu Dashboard ca trực thành công"
    )


# =========================================================================
# FC-11: GIÁM SÁT TÌNH TRẠNG BUỒNG KHÁM THỜI GIAN THỰC
# =========================================================================
@router.get(
    "/dashboard/room-status",
    response_model=ResponseEnvelope[RoomStatusDashboardResponse],
    summary="Giám sát tình trạng các buồng khám vật lý thời gian thực (FC-11)"
)
async def get_room_status_dashboard(
    query_date: Optional[date] = Query(None, description="Ngày cần xem buồng khám (mặc định hôm nay)"),
    ca_kham: Optional[str] = Query(None, description="Ca khám: sang hoặc chieu"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.vai_tro not in RECEPTION_STAFF_ROLES:
        raise ForbiddenException("Chỉ nhân viên phòng khám mới có quyền xem trạng thái buồng khám!")
    result = await queue_service.get_room_status_dashboard(query_date, ca_kham, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy trạng thái buồng khám thành công"
    )


# =========================================================================
# FC-12: TRA CỨU DANH SÁCH LỊCH HẸN TOÀN DIỆN CHO LỄ TÂN
# =========================================================================
@router.get(
    "/appointments",
    response_model=ResponseEnvelope[ReceptionAppointmentsResponse],
    summary="Tra cứu và lọc lịch hẹn đa chiều góc nhìn Lễ tân (FC-12)"
)
async def get_reception_appointments(
    query_date: Optional[date] = Query(None, description="Lọc theo ngày khám"),
    ca_kham: Optional[str] = Query(None, description="Lọc theo ca khám: sang hoặc chieu"),
    bac_si_id: Optional[int] = Query(None, description="Lọc theo bác sĩ"),
    chuyen_khoa_id: Optional[int] = Query(None, description="Lọc theo chuyên khoa"),
    trang_thai: Optional[str] = Query(None, description="Lọc theo trạng thái lịch"),
    search: Optional[str] = Query(None, description="Từ khóa: tên bệnh nhân, SĐT, mã hẹn"),
    page: int = Query(1, ge=1, description="Số trang"),
    page_size: int = Query(20, ge=1, le=100, description="Kích thước trang"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.vai_tro not in RECEPTION_STAFF_ROLES:
        raise ForbiddenException("Chỉ Lễ tân, Bác sĩ, Thu ngân hoặc Quản trị viên mới có quyền tra cứu danh sách lịch hẹn tại quầy!")
    result = await queue_service.get_reception_appointments(
        query_date=query_date,
        ca_kham=ca_kham,
        bac_si_id=bac_si_id,
        chuyen_khoa_id=chuyen_khoa_id,
        trang_thai=trang_thai,
        search=search,
        page=page,
        page_size=page_size,
        db=db
    )
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy danh sách lịch hẹn thành công"
    )


# =========================================================================
# FC-13: TRUNG TÂM SỰ CỐ BÁC SĨ NGHỈ ĐỘT XUẤT
# =========================================================================
@router.get(
    "/incidents/doctor-absences",
    response_model=ResponseEnvelope[List[DoctorAbsenceIncidentResponse]],
    summary="Theo dõi sự cố bác sĩ nghỉ phép/đột xuất và bệnh nhân bị ảnh hưởng (FC-13)"
)
async def get_doctor_absences_incidents(
    query_date: Optional[date] = Query(None, description="Ngày cần rà soát sự cố (mặc định hôm nay)"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.vai_tro not in RECEPTION_ADMIN_ROLES:
        raise ForbiddenException("Chỉ Lễ tân hoặc Quản trị viên mới có quyền xem sự cố bác sĩ nghỉ đột xuất!")
    result = await incident_service.get_doctor_absences_incidents(query_date, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Tìm thấy {len(result)} sự cố bác sĩ nghỉ cần xử lý"
    )


# =========================================================================
# FC-14: ĐIỀU PHỐI TẢI HÀNG ĐỢI HÀNG LOẠT (REBALANCE QUEUE)
# =========================================================================
@router.post(
    "/incidents/rebalance-queue",
    response_model=ResponseEnvelope[RebalanceQueueResponse],
    summary="Điều chuyển hàng loạt bệnh nhân chờ giữa các bác sĩ cùng chuyên khoa (FC-14)"
)
async def rebalance_queue(
    payload: RebalanceQueueRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.vai_tro not in RECEPTION_ADMIN_ROLES:
        raise ForbiddenException("Chỉ Lễ tân hoặc Quản trị viên mới có quyền điều chuyển hàng đợi bác sĩ!")
    result = await incident_service.rebalance_queue(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Đã điều chuyển thành công {result.so_luong_chuyen_thanh_cong} bệnh nhân"
    )


# =========================================================================
# FC-15: TRA CỨU TÀI NGUYÊN CA TRỰC, BUỒNG KHÁM, ROSTER TEMPLATE
# =========================================================================
@router.get(
    "/resources/roster",
    response_model=ResponseEnvelope[List[RosterItem]],
    summary="Tra cứu lịch phân ca trực thực tế của Bác sĩ (FC-15)"
)
async def get_roster_resources(
    query_date: Optional[date] = Query(None, description="Ngày cần xem lịch trực (mặc định hôm nay)"),
    ca_kham: Optional[str] = Query(None, description="Lọc theo ca làm việc: sang hoặc chieu"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.vai_tro not in RECEPTION_STAFF_ROLES:
        raise ForbiddenException("Chỉ nhân viên phòng khám mới có quyền tra cứu lịch phân ca trực!")
    result = await queue_service.get_roster_resources(query_date, ca_kham, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Lấy danh sách phân ca trực thành công ({len(result)} ca)"
    )


@router.get(
    "/resources/rooms",
    response_model=ResponseEnvelope[List[RoomResourceItem]],
    summary="Tra cứu danh mục buồng khám vật lý và phân bổ chuyên khoa (FC-15)"
)
async def get_rooms_resources(
    chuyen_khoa_id: Optional[int] = Query(None, description="Lọc theo chuyên khoa"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.vai_tro not in RECEPTION_STAFF_ROLES:
        raise ForbiddenException("Chỉ nhân viên phòng khám mới có quyền tra cứu danh mục buồng khám!")
    result = await queue_service.get_rooms_resources(chuyen_khoa_id, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Lấy danh mục buồng khám thành công ({len(result)} phòng)"
    )


@router.get(
    "/resources/roster-template",
    response_model=ResponseEnvelope[List[RosterTemplateItem]],
    summary="Tra cứu khuôn mẫu phân ca trực định kỳ theo tuần (FC-15)"
)
async def get_roster_template_resources(
    thu_trong_tuan: Optional[int] = Query(None, ge=2, le=8, description="Lọc theo thứ trong tuần (2: Thứ 2, 8: CN)"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.vai_tro not in RECEPTION_STAFF_ROLES:
        raise ForbiddenException("Chỉ nhân viên phòng khám mới có quyền tra cứu khung phân ca trực định kỳ!")
    result = await queue_service.get_roster_template_resources(thu_trong_tuan, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Lấy khung mẫu ca trực định kỳ thành công ({len(result)} mục)"
    )


# =========================================================================

async def _verify_patient_history_and_package_access(
    benh_nhan_id: int,
    current_user: TaiKhoan,
    db: AsyncSession
) -> None:
    """Ngăn chặn lỗ hổng IDOR: Cho phép nhân viên y tế tra cứu, bệnh nhân chỉ được xem hồ sơ của chính mình."""
    staff_roles = {
        VaiTroEnum.LE_TAN.value,
        VaiTroEnum.THU_NGAN.value,
        VaiTroEnum.ADMIN.value,
        VaiTroEnum.BAC_SI.value,
        VaiTroEnum.KY_THUAT_VIEN.value,
    }
    if current_user.vai_tro in staff_roles:
        return

    if current_user.vai_tro == VaiTroEnum.BENH_NHAN.value:
        stmt = select(BenhNhan.id).where(BenhNhan.nguoi_dung_id == current_user.nguoi_dung_id)
        own_bn_id = (await db.execute(stmt)).scalar_one_or_none()
        if own_bn_id != benh_nhan_id:
            raise ForbiddenException("Bạn không có quyền truy cập hồ sơ của bệnh nhân khác!")
        return

    raise ForbiddenException("Bạn không có quyền truy cập thông tin bệnh nhân!")

# FC-17: TRA CỨU GÓI KHÁM & TÓM TẮT LỊCH SỬ BỆNH NHÂN TẠI QUẦY TIẾP ĐÓN
# =========================================================================
@router.get(
    "/patients/{benh_nhan_id}/packages",
    response_model=ResponseEnvelope[List[PatientPackageItem]],
    summary="Tra cứu danh sách gói khám đã mua của bệnh nhân (FC-17)"
)
async def get_patient_packages(
    benh_nhan_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await _verify_patient_history_and_package_access(benh_nhan_id, current_user, db)
    result = await queue_service.get_patient_packages(benh_nhan_id, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Tìm thấy {len(result)} gói khám của bệnh nhân"
    )


@router.get(
    "/patients/{benh_nhan_id}/history-summary",
    response_model=ResponseEnvelope[PatientHistorySummaryResponse],
    summary="Tóm tắt lịch sử khám, tình trạng no-show và gói dịch vụ tại quầy (FC-17)"
)
async def get_patient_history_summary(
    benh_nhan_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    await _verify_patient_history_and_package_access(benh_nhan_id, current_user, db)
    result = await queue_service.get_patient_history_summary(benh_nhan_id, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy tóm tắt hồ sơ tiếp đón bệnh nhân thành công"
    )


# =========================================================================
# FC-18: QUÉT & XỬ LÝ BỆNH NHÂN VẮNG MẶT NO-SHOW CUỐI CA
# =========================================================================
@router.post(
    "/process-no-shows",
    response_model=ResponseEnvelope[ProcessNoShowResponse],
    summary="Lễ tân quét và xử lý lịch hẹn vắng mặt no-show cuối ca trực (FC-18)"
)
async def process_no_shows_end_of_shift(
    query_date: Optional[date] = Query(None, description="Ngày rà soát no-show (mặc định hôm nay)"),
    ca_kham: Optional[str] = Query(None, description="Ca làm việc cần chốt: sang hoặc chieu"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.vai_tro not in RECEPTION_ADMIN_ROLES:
        raise ForbiddenException("Chỉ Lễ tân hoặc Quản trị viên mới có quyền xử lý lịch hẹn no-show!")
    result = await queue_service.process_no_shows_end_of_shift(query_date, ca_kham, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Đã xử lý {result.tong_so_no_show} lịch hẹn no-show ({result.so_benh_nhan_bi_khoa_moi} bệnh nhân bị khóa đặt hẹn)"
    )


