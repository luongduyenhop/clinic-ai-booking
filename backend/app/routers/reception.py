import asyncio
import json
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from sqlalchemy import select
from app.core.exceptions import ForbiddenException
from app.core.response import ResponseEnvelope
from app.models.user import BenhNhan, TaiKhoan, VaiTroEnum
from app.schemas.queue import (
    ReceptionWaitlistResponse,
    CheckInRequest,
    WalkInCheckInRequest,
    WalkInQuickRequest,
    QueueTicketResponse,
    PostponeTicketRequest,
    TransferTicketRequest,
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
    ReceptionReportSummaryResponse,
    ReceptionAuditLogResponse,
    PreCloseShiftAuditResponse,
    CloseReceptionShiftRequest,
    CloseReceptionShiftResponse,
)
from app.schemas.incident import (
    DoctorAbsenceIncidentResponse,
    DoctorAbsenceAffectedPatientsResponse,
    RebalanceQueueRequest,
    RebalanceQueueResponse,
    CancelIncidentTicketsRequest,
    CancelIncidentTicketsResponse,
)
from app.services.queue_service import queue_service
from app.services.incident_service import incident_service
from app.schemas.reception import (
    ReceptionPatientCreateRequest,
    ReceptionPatientUpdateRequest,
    ReceptionPatientResponse,
    ReceptionPatientSearchItem,
    CccdQrParseRequest,
    CccdQrParsedResponse,
    EncounterCreateRequest,
    EncounterResponse,
)
from app.services.reception_service import reception_service

router = APIRouter(prefix="/reception", tags=["6. Tiếp Đón & Điều Phối Hàng Đợi (Bahmni Queue Module)"])

require_reception_admin = require_roles([VaiTroEnum.LE_TAN, VaiTroEnum.ADMIN])
require_reception_staff = require_roles([VaiTroEnum.LE_TAN, VaiTroEnum.ADMIN, VaiTroEnum.BAC_SI, VaiTroEnum.THU_NGAN])
require_queue_view = require_roles([VaiTroEnum.LE_TAN, VaiTroEnum.ADMIN, VaiTroEnum.BAC_SI, VaiTroEnum.THU_NGAN, VaiTroEnum.KY_THUAT_VIEN])



@router.get(
    "/search-appointments",
    response_model=ResponseEnvelope[List[AppointmentReceptionSearchResult]],
    summary="Tìm kiếm lịch hẹn tại quầy tiếp đón theo mã hẹn, số điện thoại hoặc họ tên"
)
async def search_appointments(
    q: str = Query(..., min_length=1, description="Từ khóa: mã hẹn APT, SĐT, hoặc họ tên"),
    query_date: Optional[date] = Query(None, description="Ngày khám cần tra cứu (mặc định hôm nay)"),
    current_user: TaiKhoan = Depends(require_reception_staff),
    db: AsyncSession = Depends(get_db)
):
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
    current_user: TaiKhoan = Depends(require_reception_admin),
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
    current_user: TaiKhoan = Depends(require_reception_admin),
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
    current_user: TaiKhoan = Depends(require_reception_admin),
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
    ca_kham: Optional[str] = Query(None, description="Lọc theo ca khám: sang hoặc chieu"),
    current_user: TaiKhoan = Depends(require_queue_view),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.get_doctor_queue_board(doctor_id, query_date, ca_kham, db)
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
    current_user: TaiKhoan = Depends(require_reception_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.restore_ticket(ticket_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Đã phục hồi vé khám vào hàng đợi thành công"
    )


@router.post(
    "/queue/{ticket_id}/postpone",
    response_model=ResponseEnvelope[QueueTicketResponse],
    summary="Lễ tân tạm hoãn vé khám cho bệnh nhân khi chưa có mặt hoặc theo yêu cầu điều phối"
)
async def postpone_ticket(
    ticket_id: int,
    payload: Optional[PostponeTicketRequest] = None,
    current_user: TaiKhoan = Depends(require_reception_admin),
    db: AsyncSession = Depends(get_db)
):
    reason = payload.ly_do if payload else None
    result = await queue_service.postpone_ticket(ticket_id, current_user, db, reason=reason)
    return ResponseEnvelope.success_response(
        data=result,
        message="Đã chuyển phiếu khám sang trạng thái tạm hoãn thành công"
    )


@router.post(
    "/queue/{ticket_id}/transfer",
    response_model=ResponseEnvelope[QueueTicketResponse],
    summary="Lễ tân điều chuyển buồng khám / bác sĩ cho một lượt khám trong hàng đợi (FC-14)"
)
async def transfer_ticket(
    ticket_id: int,
    payload: TransferTicketRequest,
    current_user: TaiKhoan = Depends(require_reception_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.transfer_ticket(ticket_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Đã điều chuyển lượt khám sang buồng {result.phong_kham or ''} thành công"
    )


@router.get(
    "/flow-board",
    response_model=ResponseEnvelope[PatientFlowBoardResponse],
    summary="Bảng điều phối luân chuyển bệnh nhân toàn diện tại phòng khám (OpenEMR Patient Flow Board)"
)
async def get_patient_flow_board(
    doctor_id: Optional[int] = Query(None, description="Lọc theo bác sĩ (tùy chọn)"),
    query_date: Optional[date] = Query(None, description="Ngày cần theo dõi (mặc định hôm nay)"),
    current_user: TaiKhoan = Depends(require_reception_staff),
    db: AsyncSession = Depends(get_db)
):
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
    current_user: TaiKhoan = Depends(require_reception_admin),
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
    current_user: TaiKhoan = Depends(require_reception_admin),
    db: AsyncSession = Depends(get_db)
):
    ly_do = payload.ly_do if payload else None
    result = await queue_service.patient_leave_queue(ticket_id, ly_do, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Đã cập nhật trạng thái bệnh nhân bỏ khám"
    )


@router.get(
    "/dashboard/shift-summary",
    response_model=ResponseEnvelope[ShiftDashboardResponse],
    summary="Báo cáo chỉ số vận hành tổng thể ca trực của Lễ tân (FC-10)"
)
async def get_shift_dashboard(
    query_date: Optional[date] = Query(None, description="Ngày cần xem báo cáo (mặc định hôm nay)"),
    ca_kham: Optional[str] = Query(None, description="Ca khám: sang hoặc chieu (mặc định theo giờ hiện tại)"),
    current_user: TaiKhoan = Depends(require_reception_staff),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.get_shift_dashboard(query_date, ca_kham, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy dữ liệu Dashboard ca trực thành công"
    )


@router.get(
    "/dashboard/room-status",
    response_model=ResponseEnvelope[RoomStatusDashboardResponse],
    summary="Giám sát tình trạng các buồng khám vật lý thời gian thực (FC-11)"
)
async def get_room_status_dashboard(
    query_date: Optional[date] = Query(None, description="Ngày cần xem buồng khám (mặc định hôm nay)"),
    ca_kham: Optional[str] = Query(None, description="Ca khám: sang hoặc chieu"),
    current_user: TaiKhoan = Depends(require_reception_staff),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.get_room_status_dashboard(query_date, ca_kham, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy trạng thái buồng khám thành công"
    )


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
    current_user: TaiKhoan = Depends(require_reception_staff),
    db: AsyncSession = Depends(get_db)
):
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


@router.get(
    "/incidents/doctor-absences",
    response_model=ResponseEnvelope[List[DoctorAbsenceIncidentResponse]],
    summary="Theo dõi sự cố bác sĩ nghỉ phép/đột xuất và bệnh nhân bị ảnh hưởng (FC-13)"
)
async def get_doctor_absences_incidents(
    query_date: Optional[date] = Query(None, description="Ngày cần rà soát sự cố (mặc định hôm nay)"),
    current_user: TaiKhoan = Depends(require_reception_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await incident_service.get_doctor_absences_incidents(query_date, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Tìm thấy {len(result)} sự cố bác sĩ nghỉ cần xử lý"
    )


@router.post(
    "/incidents/rebalance-queue",
    response_model=ResponseEnvelope[RebalanceQueueResponse],
    summary="Điều chuyển hàng loạt bệnh nhân chờ giữa các bác sĩ cùng chuyên khoa (FC-14)"
)
async def rebalance_queue(
    payload: RebalanceQueueRequest,
    current_user: TaiKhoan = Depends(require_reception_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await incident_service.rebalance_queue(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Đã điều chuyển thành công {result.so_ve_chuyen} bệnh nhân"
    )


@router.get(
    "/incidents/{incident_id}/affected-patients",
    response_model=ResponseEnvelope[DoctorAbsenceAffectedPatientsResponse],
    summary="Xem chi tiết danh sách bệnh nhân hàng đợi & hàng chờ bị kẹt do bác sĩ nghỉ đột xuất"
)
async def get_incident_affected_patients(
    incident_id: int,
    current_user: TaiKhoan = Depends(require_reception_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await incident_service.get_affected_patients(incident_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Tìm thấy {result.tong_so_kẹt} bệnh nhân bị ảnh hưởng ({len(result.hang_doi)} hàng đợi, {len(result.hang_cho_waitlist)} hàng chờ)"
    )


@router.post(
    "/incidents/cancel-tickets",
    response_model=ResponseEnvelope[CancelIncidentTicketsResponse],
    summary="Hủy lượt hàng đợi & hàng chờ do bệnh nhân không đồng ý đổi bác sĩ khi có sự cố"
)
async def cancel_incident_tickets(
    payload: CancelIncidentTicketsRequest,
    current_user: TaiKhoan = Depends(require_reception_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await incident_service.cancel_incident_tickets(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=result.thong_diep
    )


@router.get(
    "/resources/roster",
    response_model=ResponseEnvelope[List[RosterItem]],
    summary="Tra cứu lịch phân ca trực thực tế của Bác sĩ (FC-15)"
)
async def get_roster_resources(
    query_date: Optional[date] = Query(None, description="Ngày cần xem lịch trực (mặc định hôm nay)"),
    ca_kham: Optional[str] = Query(None, description="Lọc theo ca làm việc: sang hoặc chieu"),
    chuyen_khoa_id: Optional[int] = Query(None, description="Lọc theo chuyên khoa"),
    current_user: TaiKhoan = Depends(require_reception_staff),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.get_roster_resources(
        query_date=query_date,
        ca_kham=ca_kham,
        chuyen_khoa_id=chuyen_khoa_id,
        db=db,
    )
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
    current_user: TaiKhoan = Depends(require_reception_staff),
    db: AsyncSession = Depends(get_db)
):
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
    current_user: TaiKhoan = Depends(require_reception_staff),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.get_roster_template_resources(thu_trong_tuan, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Lấy khung mẫu ca trực định kỳ thành công ({len(result)} mục)"
    )



async def _verify_patient_history_and_package_access(
    benh_nhan_id: int,
    current_user: TaiKhoan,
    db: AsyncSession
) -> None:
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


@router.get(
    "/patients",
    response_model=ResponseEnvelope[List[ReceptionPatientSearchItem]],
    summary="Tìm kiếm danh bạ bệnh nhân tại quầy tiếp đón theo SĐT, họ tên hoặc mã BN"
)
async def search_patients_reception(
    search: Optional[str] = Query(None, description="Tìm theo SĐT, họ tên, CCCD hoặc mã BN"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_user: TaiKhoan = Depends(require_reception_staff),
    db: AsyncSession = Depends(get_db)
):
    data = await reception_service.search_patients(db, search, page, page_size)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Tìm thấy {len(data)} bệnh nhân phù hợp"
    )


@router.get(
    "/patients/{benh_nhan_id}",
    response_model=ResponseEnvelope[ReceptionPatientResponse],
    summary="Xem chi tiết hồ sơ bệnh nhân hành chính tại quầy tiếp đón"
)
async def get_patient_detail_reception(
    benh_nhan_id: int,
    current_user: TaiKhoan = Depends(require_reception_staff),
    db: AsyncSession = Depends(get_db)
):
    data = await reception_service.get_patient_detail(benh_nhan_id, db)
    return ResponseEnvelope.success_response(
        data=data,
        message="Lấy thông tin hồ sơ bệnh nhân thành công"
    )


@router.post(
    "/patients",
    response_model=ResponseEnvelope[ReceptionPatientResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Tạo mới nhanh hồ sơ bệnh nhân tại quầy lễ tân"
)
async def create_patient_reception(
    payload: ReceptionPatientCreateRequest,
    current_user: TaiKhoan = Depends(require_reception_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await reception_service.create_patient(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Tạo mới hồ sơ bệnh nhân {data.ho_ten} thành công!",
        code=status.HTTP_201_CREATED
    )


@router.put(
    "/patients/{benh_nhan_id}",
    response_model=ResponseEnvelope[ReceptionPatientResponse],
    summary="Cập nhật thông tin hành chính bệnh nhân tại quầy tiếp đón"
)
async def update_patient_reception(
    benh_nhan_id: int,
    payload: ReceptionPatientUpdateRequest,
    current_user: TaiKhoan = Depends(require_reception_admin),
    db: AsyncSession = Depends(get_db)
):
    data = await reception_service.update_patient(benh_nhan_id, payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Cập nhật hồ sơ bệnh nhân {data.ho_ten} thành công!"
    )
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Cập nhật hồ sơ bệnh nhân {data.ho_ten} thành công!"
    )

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


@router.post(
    "/process-no-shows",
    response_model=ResponseEnvelope[ProcessNoShowResponse],
    summary="Lễ tân quét và xử lý lịch hẹn vắng mặt no-show cuối ca trực (FC-18)"
)
async def process_no_shows_end_of_shift(
    query_date: Optional[date] = Query(None, description="Ngày rà soát no-show (mặc định hôm nay)"),
    ca_kham: Optional[str] = Query(None, description="Ca làm việc cần chốt: sang hoặc chieu"),
    current_user: TaiKhoan = Depends(require_reception_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.process_no_shows_end_of_shift(query_date, ca_kham, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Đã xử lý {result.tong_so_no_show} lịch hẹn no-show ({result.so_benh_nhan_bi_khoa_moi} bệnh nhân bị khóa đặt hẹn)"
    )




@router.get(
    "/waitlist",
    response_model=ResponseEnvelope[ReceptionWaitlistResponse],
    summary="Tra cứu danh sách người bệnh đang chờ slot trong ngày (Waitlist) của Lễ tân"
)
async def get_reception_waitlist(
    query_date: Optional[date] = Query(None, description="Ngày khám cần xem (mặc định hôm nay)"),
    ca_kham: Optional[str] = Query(None, description="Lọc theo ca khám (sang/chieu)"),
    bac_si_id: Optional[int] = Query(None, description="Lọc theo bác sĩ"),
    chuyen_khoa_id: Optional[int] = Query(None, description="Lọc theo chuyên khoa"),
    current_user: TaiKhoan = Depends(require_reception_staff),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.get_reception_waitlist(query_date, ca_kham, bac_si_id, chuyen_khoa_id, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Lấy danh sách chờ thành công ({result.total} người bệnh)"
    )


@router.post(
    "/waitlist/{waitlist_id}/check-in",
    response_model=ResponseEnvelope[QueueTicketResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Lễ tân tiếp nhận chính thức bệnh nhân từ Danh sách chờ vào Hàng đợi khám"
)
async def check_in_from_waitlist(
    waitlist_id: int,
    current_user: TaiKhoan = Depends(require_reception_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.check_in_from_waitlist(waitlist_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Tiếp nhận bệnh nhân từ danh sách chờ thành công! Đã cấp số thứ tự khám: #{result.so_thu_tu_kham} ({result.ma_so_thu_tu})",
        code=status.HTTP_201_CREATED
    )


@router.delete(
    "/waitlist/{waitlist_id}",
    response_model=ResponseEnvelope[dict],
    summary="Lễ tân hủy lượt chờ của người bệnh trong Danh sách chờ"
)
async def cancel_waitlist_entry(
    waitlist_id: int,
    current_user: TaiKhoan = Depends(require_reception_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.cancel_waitlist_entry(waitlist_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=result["message"]
    )



@router.get(
    "/reports/summary",
    response_model=ResponseEnvelope[ReceptionReportSummaryResponse],
    summary="Báo cáo đối soát vận hành tiếp đón & phân bổ chuyên khoa (Phân hệ 9)"
)
async def get_reception_report_summary(
    query_date: Optional[date] = Query(None, description="Ngày đối soát (mặc định hôm nay)"),
    ca_kham: Optional[str] = Query(None, description="Ca khám ('sang' hoặc 'chieu', bỏ trống là toàn ngày)"),
    current_user: TaiKhoan = Depends(require_reception_staff),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.get_reception_report_summary(query_date, ca_kham, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy dữ liệu báo cáo đối soát tiếp đón thành công"
    )


@router.get(
    "/reports/audit-logs",
    response_model=ResponseEnvelope[ReceptionAuditLogResponse],
    summary="Nhật ký kiểm toán thao tác tiếp đón & điều phối hàng đợi (Phân hệ 9)"
)
async def get_reception_audit_logs(
    query_date: Optional[date] = Query(None, description="Ngày tra cứu nhật ký (mặc định hôm nay)"),
    action_type: Optional[str] = Query(None, description="Lọc theo loại thao tác"),
    search: Optional[str] = Query(None, description="Từ khóa tìm kiếm (Tên BN, SĐT, Số vé, Lễ tân...)"),
    page: int = Query(1, ge=1, description="Trang hiện tại"),
    page_size: int = Query(10, ge=1, le=100, description="Kích thước trang"),
    current_user: TaiKhoan = Depends(require_reception_staff),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.get_reception_audit_logs(query_date, action_type, search, page, page_size, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Lấy danh sách nhật ký kiểm toán thành công ({len(result.items)} bản ghi)"
    )



@router.get(
    "/shift/pre-close-audit",
    response_model=ResponseEnvelope[PreCloseShiftAuditResponse],
    summary="Đối soát và quét việc chưa xong trước khi đóng ca trực Lễ tân"
)
async def get_shift_pre_close_audit(
    ca_kham: str = Query(..., description="Ca khám: 'sang' hoặc 'chieu'"),
    query_date: Optional[date] = Query(None, description="Ngày đối soát (mặc định hôm nay)"),
    current_user: TaiKhoan = Depends(require_reception_staff),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.get_shift_pre_close_audit(ca_kham, query_date, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Đối soát trước đóng ca {ca_kham} thành công"
    )


@router.post(
    "/shift/close",
    response_model=ResponseEnvelope[CloseReceptionShiftResponse],
    summary="Thực hiện Đóng ca trực Lễ tân & Bàn giao ca"
)
async def close_reception_shift(
    payload: CloseReceptionShiftRequest,
    current_user: TaiKhoan = Depends(require_reception_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.close_reception_shift(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Đóng ca trực {result.ca_kham_dong} thành công! Đã chuyển {result.so_ve_chuyen_ca_chieu} vé sang ca chiều, đóng {result.so_ve_dong} vé tồn và chốt {result.so_lich_chot_no_show} lịch No-show."
    )


@router.post(
    "/parse-cccd-qr",
    response_model=ResponseEnvelope[CccdQrParsedResponse],
    status_code=status.HTTP_200_OK,
)
async def parse_cccd_qr_endpoint(
    payload: CccdQrParseRequest,
    current_user: TaiKhoan = Depends(require_reception_staff),
):
    result = reception_service.parse_vietnam_cccd_qr(payload.qr_string)
    return ResponseEnvelope.success_response(
        data=result,
        message="Bóc tách thông tin QR CCCD thành công"
    )


@router.post(
    "/register-patient",
    response_model=ResponseEnvelope[ReceptionPatientResponse],
    status_code=status.HTTP_201_CREATED,
)
async def register_patient_endpoint(
    payload: ReceptionPatientCreateRequest,
    current_user: TaiKhoan = Depends(require_reception_admin),
    db: AsyncSession = Depends(get_db),
):
    data = await reception_service.create_patient(payload, db)
    return ResponseEnvelope.success_response(
        data=data,
        message=f"Đăng ký hồ sơ bệnh nhân {data.ho_ten} thành công!",
        code=status.HTTP_201_CREATED
    )


@router.post(
    "/create-encounter",
    response_model=ResponseEnvelope[EncounterResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_encounter_endpoint(
    payload: EncounterCreateRequest,
    current_user: TaiKhoan = Depends(require_reception_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await reception_service.create_encounter(payload, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Tiếp đón và tạo lượt khám thành công! Số thứ tự #{result.queue_number}.",
        code=status.HTTP_201_CREATED
    )


@router.get(
    "/queue/stream",
)
async def queue_stream_endpoint(
    clinic_room_number: Optional[str] = Query(None),
    current_user: TaiKhoan = Depends(require_queue_view),
    db: AsyncSession = Depends(get_db),
):
    async def event_generator():
        for _ in range(3):
            data = {
                "timestamp": str(date.today()),
                "clinic_room_number": clinic_room_number or "ALL",
                "status": "STREAMING",
            }
            yield f"data: {json.dumps(data)}\n\n"
            await asyncio.sleep(0.5)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )



