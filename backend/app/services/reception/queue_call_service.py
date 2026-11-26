import logging
import uuid
from datetime import date, datetime, time, timezone, timedelta
from typing import List, Optional, Union, Any, Tuple
from sqlalchemy import func, select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import (
    BadRequestException,
    ForbiddenException,
    NotFoundException,
    ConflictException,
)
from app.models.appointment import (
    HangDoiKham,
    LichKham,
    LichLamViec,
    LichDinhKyBacSi,
    CaLamViecEnum,
    LoaiHangDoiEnum,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
    DanhSachCho,
    TrangThaiWaitlistEnum,
    LyDoUuTienEnum,
)
from app.models.user import BacSi, BenhNhan, ChuyenKhoa, NguoiDung, TaiKhoan, VaiTroEnum, PhongKham
from app.services.appointment.appointment_service import clinic_now
from app.models.specialized import DangKyGoiKham, GoiDichVu
from app.models.medical import KhoaSoCaTruc
from app.schemas.queue import (
    ReceptionWaitlistItem,
    ReceptionWaitlistResponse,
    CheckInRequest,
    WalkInCheckInRequest,
    WalkInQuickRequest,
    QueueTicketResponse,
    CloseTicketRequest,
    TransferTicketRequest,
    CloseTicketResponse,
    CallNextResponse,
    DoctorQueueBoardResponse,
    PatientFlowBoardItem,
    PatientFlowBoardResponse,
    AppointmentReceptionSearchResult,
    HourlyCheckInDensityItem,
    UpcomingAppointmentSummaryItem,
    LongWaitingTicketItem,
    ReceptionActivityItem,
    ShiftDashboardResponse,
    RoomStatusItem,
    RoomStatusDashboardResponse,
    ReceptionAppointmentItem,
    ReceptionAppointmentsResponse,
    RosterItem,
    RoomResourceItem,
    RosterTemplateItem,
    PatientPackageItem,
    PatientPastVisitItem,
    PatientHistorySummaryResponse,
    ProcessNoShowResponse,
    ReceptionReportKpiItem,
    DepartmentDistributionItem,
    ReceptionReportSummaryResponse,
    ReceptionAuditLogItem,
    ReceptionAuditLogPagination,
    ReceptionAuditLogResponse,
    PreCloseAuditWarningSummary,
    PreCloseExaminingDetailItem,
    PreCloseWaitingDetailItem,
    PreCloseDeferredDetailItem,
    PreCloseNoShowDetailItem,
    PreCloseWaitlistDetailItem,
    PreCloseCashierAuditDetail,
    PreCloseAuditDetailGroup,
    PreCloseActionRecommendation,
    PreCloseShiftAuditResponse,
    CloseReceptionShiftRequest,
    CloseReceptionShiftResponse,
)

logger = logging.getLogger(__name__)

async def call_next_patient(
    self,
    doctor_user: TaiKhoan,
    db: AsyncSession,
) -> CallNextResponse:
    stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == doctor_user.nguoi_dung_id)
    bac_si = (await db.execute(stmt_bs)).scalar_one_or_none()
    if not bac_si and doctor_user.vai_tro != VaiTroEnum.ADMIN.value:
        raise ForbiddenException("Chức năng gọi số khám chỉ dành cho Bác sĩ!")

    doctor_id = bac_si.id if bac_si else 1
    today = clinic_now().date()
    now = datetime.now(timezone.utc)

    stmt_current_active = (
        select(HangDoiKham)
        .where(
            HangDoiKham.bac_si_id == doctor_id,
            HangDoiKham.ngay_kham == today,
            HangDoiKham.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value,
        )
        .with_for_update()
    )
    current_active = (await db.execute(stmt_current_active)).scalars().first()
    if current_active:
        raise ConflictException(
            f"Bác sĩ hiện đang có một ca khám chưa hoàn tất (STT #{current_active.so_thu_tu_kham}). "
            f"Vui lòng hoàn tất hoặc tạm hoãn ca hiện tại trước khi gọi bệnh nhân tiếp theo!"
        )

    stmt_candidate = (
        select(HangDoiKham)
        .options(
            selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
            selectinload(HangDoiKham.bac_si).selectinload(BacSi.nguoi_dung),
            selectinload(HangDoiKham.bac_si).selectinload(BacSi.chuyen_khoa),
        )
        .where(
            HangDoiKham.bac_si_id == doctor_id,
            HangDoiKham.ngay_kham == today,
            HangDoiKham.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value,
        )
        .order_by(
            HangDoiKham.muc_do_uu_tien.asc(),
            func.coalesce(HangDoiKham.thoi_gian_xep_hang_lai, HangDoiKham.thoi_gian_check_in).asc(),
            HangDoiKham.so_thu_tu_kham.asc(),
        )
        .with_for_update()
        .limit(1)
    )
    candidate = (await db.execute(stmt_candidate)).scalar_one_or_none()

    if not candidate:
        return CallNextResponse(
            message="Hàng đợi hiện tại không còn bệnh nhân nào đang chờ!",
            ticket=None,
            so_nguoi_con_lai=0,
        )

    candidate.trang_thai = TrangThaiHangDoiEnum.DANG_KHAM.value
    candidate.thoi_gian_goi_kham = now
    candidate.thoi_gian_bat_dau = now
    candidate.so_lan_goi += 1

    if candidate.lich_kham_id:
        stmt_lich = select(LichKham).where(LichKham.id == candidate.lich_kham_id)
        lich = (await db.execute(stmt_lich)).scalar_one_or_none()
        if lich:
            lich.trang_thai = TrangThaiLichEnum.DANG_KHAM.value

    ticket_id_called = candidate.id
    ticket_stt_called = candidate.so_thu_tu_kham
    await db.commit()

    stmt_count = select(func.count(HangDoiKham.id)).where(
        HangDoiKham.bac_si_id == doctor_id,
        HangDoiKham.ngay_kham == today,
        HangDoiKham.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value,
    )
    remaining = (await db.execute(stmt_count)).scalar() or 0

    ticket_response = await self._get_ticket_with_relations(ticket_id_called, db)
    logger.info(f"📢 [QUEUE CALLED] Bác sĩ {doctor_id} gọi bệnh nhân STT #{ticket_stt_called} (Ticket: {ticket_id_called})")
    return CallNextResponse(
        message=f"Đã gọi thành công bệnh nhân STT #{ticket_stt_called} vào phòng khám!",
        ticket=ticket_response,
        so_nguoi_con_lai=remaining,
    )

async def _get_ticket_entity(
    self, ticket_id: int, db: AsyncSession, for_update: bool = False
) -> Optional[HangDoiKham]:
    stmt = (
        select(HangDoiKham)
        .options(
            selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
            selectinload(HangDoiKham.bac_si).selectinload(BacSi.nguoi_dung),
            selectinload(HangDoiKham.bac_si).selectinload(BacSi.chuyen_khoa),
            selectinload(HangDoiKham.lich_kham),
        )
        .where(HangDoiKham.id == ticket_id)
    )
    if for_update:
        stmt = stmt.with_for_update()
    return (await db.execute(stmt)).scalar_one_or_none()

async def postpone_ticket(
    self,
    ticket_id: int,
    doctor_user: TaiKhoan,
    db: AsyncSession,
    reason: Optional[str] = None,
) -> QueueTicketResponse:
    ticket = await self._get_ticket_entity(ticket_id, db, for_update=True)
    if not ticket:
        raise NotFoundException(f"Không tìm thấy phiếu hàng đợi với ID {ticket_id}!")

    ticket_id_postponed = ticket.id
    ticket.trang_thai = TrangThaiHangDoiEnum.TAM_HOAN.value
    ticket.muc_do_uu_tien = 6
    note = f": {reason}" if reason else " do gọi 3 lần không vào."
    ticket.ghi_chu_dieu_phoi = f"Tạm hoãn lúc {clinic_now().strftime('%H:%M:%S')}{note}"
    await db.commit()
    return await self._get_ticket_with_relations(ticket_id_postponed, db)

async def restore_ticket(
    self,
    ticket_id: int,
    receptionist_user: TaiKhoan,
    db: AsyncSession,
) -> QueueTicketResponse:
    if receptionist_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
        raise ForbiddenException("Chỉ Lễ tân hoặc Admin mới có quyền phục hồi vé tạm hoãn!")

    ticket = await self._get_ticket_entity(ticket_id, db, for_update=True)
    if not ticket:
        raise NotFoundException(f"Không tìm thấy phiếu hàng đợi với ID {ticket_id}!")

    now = datetime.now(timezone.utc)
    ticket_id_restored = ticket.id
    ticket.trang_thai = TrangThaiHangDoiEnum.CHO_KHAM.value
    ticket.thoi_gian_xep_hang_lai = now
    ticket.muc_do_uu_tien = 4
    ticket.ghi_chu_dieu_phoi = f"{ticket.ghi_chu_dieu_phoi or ''} | Phục hồi hàng đợi lúc {clinic_now().strftime('%H:%M:%S')} (bắt đầu tính lại thời gian chờ).".strip(" | ")
    await db.commit()
    return await self._get_ticket_with_relations(ticket_id_restored, db)

async def close_ticket(
    self,
    ticket_id: int,
    ly_do: Optional[str],
    current_user: TaiKhoan,
    db: AsyncSession,
) -> CloseTicketResponse:
    if current_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
        raise ForbiddenException("Chỉ Lễ tân hoặc Admin mới có quyền đóng vé hàng đợi!")

    ticket = await self._get_ticket_entity(ticket_id, db, for_update=True)
    if not ticket:
        raise NotFoundException(f"Không tìm thấy phiếu hàng đợi với ID {ticket_id}!")

    if ticket.trang_thai not in (TrangThaiHangDoiEnum.CHO_KHAM.value, TrangThaiHangDoiEnum.TAM_HOAN.value):
        raise ConflictException(f"Không thể đóng vé ở trạng thái '{ticket.trang_thai}'! Chỉ áp dụng cho vé đang chờ khám hoặc tạm hoãn.")

    now = datetime.now(timezone.utc)
    ticket.trang_thai = TrangThaiHangDoiEnum.DA_DONG_VE.value
    ticket.muc_do_uu_tien = 7
    note = f"Đóng vé hành chính lúc {clinic_now().strftime('%H:%M:%S')}"
    if ly_do:
        note += f": {ly_do}"
    ticket.ghi_chu_dieu_phoi = f"{ticket.ghi_chu_dieu_phoi or ''} | {note}".strip(" | ")

    await db.commit()
    await db.refresh(ticket)
    return CloseTicketResponse(
        ticket_id=ticket.id,
        trang_thai=ticket.trang_thai,
        ghi_chu_dieu_phoi=ticket.ghi_chu_dieu_phoi,
        thoi_gian_dong=now,
    )

async def patient_leave_queue(

    self,

    ticket_id: int,

    ly_do: Optional[str],

    current_user: TaiKhoan,

    db: AsyncSession,

) -> CloseTicketResponse:

    if current_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):

        raise ForbiddenException("Chỉ Lễ tân hoặc Admin mới có quyền cập nhật trạng thái bỏ khám!")

    ticket = await self._get_ticket_entity(ticket_id, db, for_update=True)

    if not ticket:

        raise NotFoundException(f"Không tìm thấy phiếu hàng đợi với ID {ticket_id}!")

    if ticket.trang_thai not in (TrangThaiHangDoiEnum.CHO_KHAM.value, TrangThaiHangDoiEnum.TAM_HOAN.value):

        raise ConflictException(f"Không thể đổi trạng thái vé ở '{ticket.trang_thai}'! Chỉ áp dụng cho vé đang chờ khám hoặc tạm hoãn.")

    now = datetime.now(timezone.utc)

    ticket.trang_thai = TrangThaiHangDoiEnum.BO_KHAM.value
    ticket.muc_do_uu_tien = 7

    note = f"Bệnh nhân xin bỏ về lúc {clinic_now().strftime('%H:%M:%S')}"

    if ly_do:

        note += f": {ly_do}"

    ticket.ghi_chu_dieu_phoi = f"{ticket.ghi_chu_dieu_phoi or ''} | {note}".strip(" | ")

    await db.commit()

    await db.refresh(ticket)

    return CloseTicketResponse(

        ticket_id=ticket.id,

        trang_thai=ticket.trang_thai,

        ghi_chu_dieu_phoi=ticket.ghi_chu_dieu_phoi,

        thoi_gian_dong=now,

    )

async def transfer_ticket(

    self,

    ticket_id: int,

    payload: TransferTicketRequest,

    receptionist_user: TaiKhoan,

    db: AsyncSession,

) -> QueueTicketResponse:

    if receptionist_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):

        raise ForbiddenException("Chỉ Lễ tân hoặc Quản trị viên mới có quyền điều chuyển buồng khám!")

    ticket = await self._get_ticket_entity(ticket_id, db, for_update=True)

    if not ticket:

        raise NotFoundException(f"Không tìm thấy phiếu hàng đợi với ID {ticket_id}!")

    if ticket.trang_thai in (

        TrangThaiHangDoiEnum.DA_KHAM.value,

        TrangThaiHangDoiEnum.DA_DONG_VE.value,

        TrangThaiHangDoiEnum.BO_KHAM.value

    ):

        raise ConflictException(f"Không thể điều chuyển phiếu khám đã ở trạng thái {ticket.trang_thai}!")

    stmt_room = select(PhongKham).options(selectinload(PhongKham.chuyen_khoa)).where(PhongKham.id == payload.phong_kham_id)

    target_room = (await db.execute(stmt_room)).scalar_one_or_none()

    if not target_room:

        raise NotFoundException(f"Không tìm thấy buồng khám đích với ID {payload.phong_kham_id}!")

    target_doctor_id = payload.bac_si_id

    if not target_doctor_id:

        stmt_roster = (

            select(LichLamViec)

            .where(

                LichLamViec.phong_kham_id == target_room.id,

                LichLamViec.ngay_lam_viec == ticket.ngay_kham,

                LichLamViec.is_active.is_(True),

            )

        )

        roster = (await db.execute(stmt_roster)).scalars().first()

        if roster:

            target_doctor_id = roster.bac_si_id

        else:

            stmt_doc = select(BacSi).where(BacSi.phong_kham_id == target_room.id, BacSi.is_active.is_(True))

            doc = (await db.execute(stmt_doc)).scalars().first()

            if doc:

                target_doctor_id = doc.id

    stmt_max_stt = select(func.coalesce(func.max(HangDoiKham.so_thu_tu_kham), 0)).where(

        and_(

            HangDoiKham.ngay_kham == ticket.ngay_kham,

            HangDoiKham.ca_kham == ticket.ca_kham,

            or_(

                HangDoiKham.phong_kham_id == target_room.id,

                HangDoiKham.bac_si_id == target_doctor_id,

            )

        )

    )

    next_stt = (await db.execute(stmt_max_stt)).scalar() + 1

    old_room_id = ticket.phong_kham_id

    ticket.phong_kham_id = target_room.id

    if target_doctor_id:

        ticket.bac_si_id = target_doctor_id

    ticket.so_thu_tu_kham = next_stt

    ticket.thoi_gian_xep_hang_lai = clinic_now()

    if target_doctor_id and ticket.lich_kham:
        ticket.lich_kham.bac_si_id = target_doctor_id

    note_transfer = f"Chuyển từ buồng #{old_room_id} sang {target_room.ten_phong} (STT #{next_stt}): {payload.ly_do}"

    ticket.ghi_chu_dieu_phoi = f"{ticket.ghi_chu_dieu_phoi or ''} | {note_transfer}" if ticket.ghi_chu_dieu_phoi else note_transfer

    await db.commit()

    return await self._get_ticket_with_relations(ticket.id, db)
