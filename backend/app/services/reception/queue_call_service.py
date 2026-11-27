import logging
from typing import Iterable, Optional
from sqlalchemy import func, select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    ForbiddenException,
    NotFoundException,
    ConflictException,
)
from app.models.appointment import (
    HangDoiKham,
    LichKham,
    LichLamViec,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
)
from app.models.user import BacSi, BenhNhan, TaiKhoan, VaiTroEnum, PhongKham
from app.services.appointment.appointment_service import clinic_now
from app.services.reception.doctor_schedule_guard import (
    find_room_shift_doctor,
    is_doctor_on_approved_leave,
    validate_doctor_shift_available,
)
from app.services.reception.timezone_utils import utc_now
from app.schemas.queue import (
    QueueTicketResponse,
    TransferTicketRequest,
    CloseTicketResponse,
    CallNextResponse,
)

logger = logging.getLogger(__name__)


def _require_reception_or_admin(user: TaiKhoan, message: str) -> None:
    """Kiểm tra người dùng có vai trò Lễ tân hoặc Admin."""
    if user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
        raise ForbiddenException(message)


def _validate_ticket_transition(
    ticket: HangDoiKham,
    allowed_statuses: Iterable[str],
    action_label: str,
) -> None:
    """Đảm bảo vé hàng đợi đang ở trạng thái hợp lệ trước khi chuyển trạng thái."""
    if ticket.trang_thai not in allowed_statuses:
        raise ConflictException(
            f"Không thể {action_label} phiếu khám ở trạng thái '{ticket.trang_thai}'!"
        )


async def call_next_patient(
    self,
    doctor_user: TaiKhoan,
    db: AsyncSession,
) -> CallNextResponse:
    stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == doctor_user.nguoi_dung_id)
    bac_si = (await db.execute(stmt_bs)).scalar_one_or_none()
    if not bac_si:
        if doctor_user.vai_tro == VaiTroEnum.ADMIN.value:
            raise ForbiddenException("Tài khoản Quản trị viên chưa được liên kết hồ sơ Bác sĩ để gọi khám!")
        raise ForbiddenException("Chức năng gọi số khám chỉ dành cho Bác sĩ!")

    doctor_id = bac_si.id
    today = clinic_now().date()
    now = utc_now()

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
    logger.info(
        f"📢 [QUEUE CALLED] Bác sĩ {doctor_id} gọi bệnh nhân STT #{ticket_stt_called} (Ticket: {ticket_id_called})"
    )
    return CallNextResponse(
        message=f"Đã gọi thành công bệnh nhân STT #{ticket_stt_called} vào phòng khám!",
        ticket=ticket_response,
        so_nguoi_con_lai=remaining,
    )


async def _get_ticket_entity(self, ticket_id: int, db: AsyncSession, for_update: bool = False) -> Optional[HangDoiKham]:
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
    if doctor_user.vai_tro not in (
        VaiTroEnum.BAC_SI.value,
        VaiTroEnum.LE_TAN.value,
        VaiTroEnum.ADMIN.value,
    ):
        raise ForbiddenException("Chỉ Bác sĩ phụ trách, Lễ tân hoặc Admin mới có quyền tạm hoãn phiếu khám!")

    ticket = await self._get_ticket_entity(ticket_id, db, for_update=True)
    if not ticket:
        raise NotFoundException(f"Không tìm thấy phiếu hàng đợi với ID {ticket_id}!")

    if doctor_user.vai_tro == VaiTroEnum.BAC_SI.value:
        stmt_bs = select(BacSi).where(BacSi.nguoi_dung_id == doctor_user.nguoi_dung_id)
        bac_si = (await db.execute(stmt_bs)).scalar_one_or_none()
        if not bac_si or ticket.bac_si_id != bac_si.id:
            raise ForbiddenException("Bác sĩ chỉ được tạm hoãn phiếu khám thuộc hàng đợi của mình!")

    _validate_ticket_transition(
        ticket,
        (TrangThaiHangDoiEnum.CHO_KHAM.value, TrangThaiHangDoiEnum.DANG_KHAM.value),
        "tạm hoãn",
    )

    ticket_id_postponed = ticket.id
    ticket.trang_thai = TrangThaiHangDoiEnum.TAM_HOAN.value
    ticket.muc_do_uu_tien = 6
    if ticket.lich_kham and ticket.lich_kham.trang_thai == TrangThaiLichEnum.DANG_KHAM.value:
        ticket.lich_kham.trang_thai = TrangThaiLichEnum.DA_TIEP_NHAN.value
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
    _require_reception_or_admin(receptionist_user, "Chỉ Lễ tân hoặc Admin mới có quyền phục hồi vé tạm hoãn!")

    ticket = await self._get_ticket_entity(ticket_id, db, for_update=True)
    if not ticket:
        raise NotFoundException(f"Không tìm thấy phiếu hàng đợi với ID {ticket_id}!")

    _validate_ticket_transition(ticket, (TrangThaiHangDoiEnum.TAM_HOAN.value,), "phục hồi")

    now = utc_now()
    ticket_id_restored = ticket.id
    ticket.trang_thai = TrangThaiHangDoiEnum.CHO_KHAM.value
    ticket.thoi_gian_xep_hang_lai = now
    ticket.muc_do_uu_tien = 4
    ticket.ghi_chu_dieu_phoi = f"{ticket.ghi_chu_dieu_phoi or ''} | Phục hồi hàng đợi lúc {clinic_now().strftime('%H:%M:%S')} (bắt đầu tính lại thời gian chờ).".strip(
        " | "
    )
    await db.commit()
    return await self._get_ticket_with_relations(ticket_id_restored, db)


async def close_ticket(
    self,
    ticket_id: int,
    ly_do: Optional[str],
    current_user: TaiKhoan,
    db: AsyncSession,
) -> CloseTicketResponse:
    _require_reception_or_admin(current_user, "Chỉ Lễ tân hoặc Admin mới có quyền đóng vé hàng đợi!")

    ticket = await self._get_ticket_entity(ticket_id, db, for_update=True)
    if not ticket:
        raise NotFoundException(f"Không tìm thấy phiếu hàng đợi với ID {ticket_id}!")

    _validate_ticket_transition(
        ticket,
        (TrangThaiHangDoiEnum.CHO_KHAM.value, TrangThaiHangDoiEnum.TAM_HOAN.value),
        "đóng vé",
    )

    now = utc_now()
    ticket.trang_thai = TrangThaiHangDoiEnum.DA_DONG_VE.value
    ticket.muc_do_uu_tien = 7
    ticket.thoi_gian_ket_thuc = now
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
    _require_reception_or_admin(current_user, "Chỉ Lễ tân hoặc Admin mới có quyền cập nhật trạng thái bỏ khám!")

    ticket = await self._get_ticket_entity(ticket_id, db, for_update=True)
    if not ticket:
        raise NotFoundException(f"Không tìm thấy phiếu hàng đợi với ID {ticket_id}!")

    _validate_ticket_transition(
        ticket,
        (TrangThaiHangDoiEnum.CHO_KHAM.value, TrangThaiHangDoiEnum.TAM_HOAN.value),
        "cập nhật bỏ khám",
    )

    now = utc_now()
    ticket.trang_thai = TrangThaiHangDoiEnum.BO_KHAM.value
    ticket.muc_do_uu_tien = 7
    ticket.thoi_gian_ket_thuc = now

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
    _require_reception_or_admin(
        receptionist_user, "Chỉ Lễ tân hoặc Quản trị viên mới có quyền điều chuyển buồng khám!"
    )

    ticket = await self._get_ticket_entity(ticket_id, db, for_update=True)
    if not ticket:
        raise NotFoundException(f"Không tìm thấy phiếu hàng đợi với ID {ticket_id}!")

    _validate_ticket_transition(
        ticket,
        (
            TrangThaiHangDoiEnum.CHO_KHAM.value,
            TrangThaiHangDoiEnum.TAM_HOAN.value,
            TrangThaiHangDoiEnum.DANG_KHAM.value,
        ),
        "điều chuyển",
    )

    stmt_room = (
        select(PhongKham).options(selectinload(PhongKham.chuyen_khoa)).where(PhongKham.id == payload.phong_kham_id)
    )
    target_room = (await db.execute(stmt_room)).scalar_one_or_none()
    if not target_room:
        raise NotFoundException(f"Không tìm thấy buồng khám đích với ID {payload.phong_kham_id}!")

    target_doctor_id = payload.bac_si_id
    target_shift_id = None
    if target_doctor_id:
        target_shift = await validate_doctor_shift_available(
            target_doctor_id, ticket.ngay_kham, ticket.ca_kham, db
        )
        if target_shift:
            target_shift_id = target_shift.id
    else:
        target_shift_id, target_doctor_id = await find_room_shift_doctor(
            target_room.id, ticket.ngay_kham, ticket.ca_kham, db
        )
        if not target_doctor_id:
            has_any_schedule_for_day = (
                await db.execute(
                    select(LichLamViec.id).where(LichLamViec.ngay_lam_viec == ticket.ngay_kham).limit(1)
                )
            ).scalar_one_or_none() is not None
            if has_any_schedule_for_day:
                raise ConflictException(
                    f"Phòng {target_room.ten_phong} không có bác sĩ trực hợp lệ trong ca {ticket.ca_kham} "
                    f"ngày {ticket.ngay_kham.strftime('%d/%m/%Y')}!"
                )
            stmt_doc = select(BacSi).where(BacSi.phong_kham_id == target_room.id, BacSi.is_active.is_(True))
            for doc in (await db.execute(stmt_doc)).scalars().all():
                if not await is_doctor_on_approved_leave(doc.id, ticket.ngay_kham, ticket.ca_kham, db):
                    target_doctor_id = doc.id
                    break

    stmt_max_stt = select(func.coalesce(func.max(HangDoiKham.so_thu_tu_kham), 0)).where(
        and_(
            HangDoiKham.ngay_kham == ticket.ngay_kham,
            HangDoiKham.ca_kham == ticket.ca_kham,
            or_(
                HangDoiKham.phong_kham_id == target_room.id,
                HangDoiKham.bac_si_id == target_doctor_id,
            ),
        )
    )
    next_stt = (await db.execute(stmt_max_stt)).scalar() + 1

    old_room_id = ticket.phong_kham_id
    ticket.phong_kham_id = target_room.id
    if target_shift_id:
        ticket.lich_lam_viec_id = target_shift_id
    if target_doctor_id:
        ticket.bac_si_id = target_doctor_id
    ticket.so_thu_tu_kham = next_stt
    ticket.thoi_gian_xep_hang_lai = utc_now()
    if ticket.trang_thai in (TrangThaiHangDoiEnum.DANG_KHAM.value, TrangThaiHangDoiEnum.TAM_HOAN.value):
        ticket.trang_thai = TrangThaiHangDoiEnum.CHO_KHAM.value
        if ticket.lich_kham and ticket.lich_kham.trang_thai == TrangThaiLichEnum.DANG_KHAM.value:
            ticket.lich_kham.trang_thai = TrangThaiLichEnum.DA_TIEP_NHAN.value

    if target_doctor_id and ticket.lich_kham:
        ticket.lich_kham.bac_si_id = target_doctor_id

    note_transfer = f"Chuyển từ buồng #{old_room_id} sang {target_room.ten_phong} (STT #{next_stt}): {payload.ly_do}"
    ticket.ghi_chu_dieu_phoi = (
        f"{ticket.ghi_chu_dieu_phoi or ''} | {note_transfer}" if ticket.ghi_chu_dieu_phoi else note_transfer
    )

    await db.commit()
    return await self._get_ticket_with_relations(ticket.id, db)
