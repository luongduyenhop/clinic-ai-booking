import logging
from datetime import date, datetime, timezone
from typing import List, Optional
from sqlalchemy import func, select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestException, ConflictException, ForbiddenException, NotFoundException
from app.models.appointment import (
    HangDoiKham,
    LichKham,
    LichLamViec,
    NghiPhepBacSi,
    DanhSachCho,
    TrangThaiHangDoiEnum,
    TrangThaiNghiPhepEnum,
    TrangThaiLichEnum,
    TrangThaiWaitlistEnum,
    LoaiHangDoiEnum,
)
from app.models.user import BacSi, ChuyenKhoa, TaiKhoan, VaiTroEnum, BenhNhan, NguoiDung, PhongKham
from app.schemas.incident import (
    DoctorAbsenceIncidentResponse,
    DoctorAlternativeItem,
    RebalanceQueueRequest,
    RebalanceQueueResponse,
    RebalanceTicketItem,
    AffectedPatientItem,
    AffectedWaitlistItem,
    DoctorAbsenceAffectedPatientsResponse,
    CancelIncidentTicketsRequest,
    CancelIncidentTicketsResponse,
)
from app.services.load_balancing_service import load_balancing_service

logger = logging.getLogger(__name__)


class IncidentService:

    async def get_doctor_absences_incidents(
        self,
        query_date: Optional[date],
        current_user: TaiKhoan,
        db: AsyncSession,
    ) -> List[DoctorAbsenceIncidentResponse]:
        if current_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chức năng chỉ dành cho Lễ tân hoặc Quản trị viên!")

        target_date = query_date or date.today()

        stmt = (
            select(NghiPhepBacSi)
            .options(
                selectinload(NghiPhepBacSi.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(NghiPhepBacSi.bac_si).selectinload(BacSi.chuyen_khoa),
            )
            .where(
                NghiPhepBacSi.tu_ngay <= target_date,
                NghiPhepBacSi.den_ngay >= target_date,
                NghiPhepBacSi.trang_thai.in_([
                    TrangThaiNghiPhepEnum.DA_DUYET.value,
                    TrangThaiNghiPhepEnum.CHO_DUYET.value,
                ]),
            )
            .order_by(NghiPhepBacSi.id.desc())
        )
        leaves = (await db.execute(stmt)).scalars().all()

        results: List[DoctorAbsenceIncidentResponse] = []
        for leave in leaves:
            bs = leave.bac_si
            ck_id = bs.chuyen_khoa_id if bs else None
            ck_name = bs.chuyen_khoa.ten_chuyen_khoa if bs and bs.chuyen_khoa else None

            stmt_queue = select(func.count(HangDoiKham.id)).where(
                HangDoiKham.bac_si_id == leave.bac_si_id,
                HangDoiKham.ngay_kham == target_date,
                HangDoiKham.trang_thai.in_([
                    TrangThaiHangDoiEnum.CHO_KHAM.value,
                    TrangThaiHangDoiEnum.TAM_HOAN.value,
                ]),
            )
            if leave.ca_lam_viec:
                stmt_queue = stmt_queue.where(HangDoiKham.ca_kham == leave.ca_lam_viec)
            so_cho = (await db.execute(stmt_queue)).scalar() or 0

            alternatives: List[DoctorAlternativeItem] = []
            if ck_id:
                stmt_alt = (
                    select(BacSi, LichLamViec)
                    .join(LichLamViec, LichLamViec.bac_si_id == BacSi.id)
                    .options(
                        selectinload(BacSi.nguoi_dung),
                        selectinload(BacSi.chuyen_khoa),
                        selectinload(BacSi.phong_kham),
                        selectinload(LichLamViec.phong_kham),
                    )
                    .where(
                        BacSi.chuyen_khoa_id == ck_id,
                        BacSi.id != leave.bac_si_id,
                        BacSi.is_active.is_(True),
                        BacSi.trang_thai_giay_phep == "ACTIVE",
                        LichLamViec.ngay_lam_viec == target_date,
                        LichLamViec.is_active.is_(True),
                    )
                )
                if leave.ca_lam_viec:
                    stmt_alt = stmt_alt.where(LichLamViec.ca_lam_viec == leave.ca_lam_viec)

                alt_rows = (await db.execute(stmt_alt)).all()
                if alt_rows:
                    alt_doc_ids = [bs_item.id for bs_item, _ in alt_rows]

                    stmt_leaves_check = (
                        select(NghiPhepBacSi.bac_si_id)
                        .where(
                            NghiPhepBacSi.bac_si_id.in_(alt_doc_ids),
                            NghiPhepBacSi.trang_thai == TrangThaiNghiPhepEnum.DA_DUYET.value,
                            NghiPhepBacSi.tu_ngay <= target_date,
                            NghiPhepBacSi.den_ngay >= target_date,
                        )
                    )
                    if leave.ca_lam_viec:
                        stmt_leaves_check = stmt_leaves_check.where(
                            or_(
                                NghiPhepBacSi.ca_lam_viec.is_(None),
                                NghiPhepBacSi.ca_lam_viec == leave.ca_lam_viec,
                            )
                        )
                    on_leave_bs_ids = set((await db.execute(stmt_leaves_check)).scalars().all())

                    valid_shifts = [(b, s) for b, s in alt_rows if b.id not in on_leave_bs_ids]

                    seen_bs = set()
                    for ad, shift in valid_shifts:
                        if ad.id in seen_bs:
                            continue
                        seen_bs.add(ad.id)

                        stmt_ad_load = select(func.count(HangDoiKham.id)).where(
                            HangDoiKham.bac_si_id == ad.id,
                            HangDoiKham.ngay_kham == target_date,
                            HangDoiKham.trang_thai.in_([
                                TrangThaiHangDoiEnum.CHO_KHAM.value,
                                TrangThaiHangDoiEnum.DANG_KHAM.value,
                            ]),
                        )
                        if leave.ca_lam_viec:
                            stmt_ad_load = stmt_ad_load.where(HangDoiKham.ca_kham == leave.ca_lam_viec)

                        load = (await db.execute(stmt_ad_load)).scalar() or 0

                        room_name = None
                        if shift.phong_kham and shift.phong_kham.ten_phong:
                            room_name = shift.phong_kham.ten_phong
                        elif ad.phong_kham and ad.phong_kham.ten_phong:
                            room_name = ad.phong_kham.ten_phong
                        elif ad.chuyen_khoa and ad.chuyen_khoa.vi_tri_phong:
                            room_name = ad.chuyen_khoa.vi_tri_phong

                        alternatives.append(
                            DoctorAlternativeItem(
                                bac_si_id=ad.id,
                                ten_bac_si=ad.nguoi_dung.ho_ten if ad.nguoi_dung else f"BS {ad.id}",
                                phong_kham=room_name,
                                so_benh_nhan_cho=load,
                            )
                        )

            results.append(
                DoctorAbsenceIncidentResponse(
                    nghi_phep_id=leave.id,
                    bac_si_id=leave.bac_si_id,
                    ten_bac_si=bs.nguoi_dung.ho_ten if bs and bs.nguoi_dung else f"BS {leave.bac_si_id}",
                    chuyen_khoa_id=ck_id,
                    ten_chuyen_khoa=ck_name,
                    tu_ngay=leave.tu_ngay,
                    den_ngay=leave.den_ngay,
                    ca_lam_viec=leave.ca_lam_viec,
                    ly_do=leave.ly_do,
                    trang_thai=leave.trang_thai,
                    so_benh_nhan_cho=so_cho,
                    danh_sach_bac_si_thay_the=alternatives,
                )
            )

        return results

    async def rebalance_queue(
        self,
        payload: RebalanceQueueRequest,
        current_user: TaiKhoan,
        db: AsyncSession,
    ) -> RebalanceQueueResponse:
        if current_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chức năng chỉ dành cho Lễ tân hoặc Quản trị viên!")

        stmt_leave = (
            select(NghiPhepBacSi)
            .options(selectinload(NghiPhepBacSi.bac_si))
            .where(NghiPhepBacSi.id == payload.nghi_phep_bac_si_id)
            .with_for_update()
        )
        leave = (await db.execute(stmt_leave)).scalar_one_or_none()
        if not leave:
            raise NotFoundException(f"Không tìm thấy đơn nghỉ phép ID {payload.nghi_phep_bac_si_id}!")

        absent_bs = leave.bac_si
        if not absent_bs:
            raise NotFoundException("Không tìm thấy thông tin bác sĩ vắng mặt!")

        target_phong_kham_id = leave.phong_kham_id or absent_bs.phong_kham_id
        user_phong_kham_id = getattr(current_user, "phong_kham_id", None)
        if current_user.vai_tro != VaiTroEnum.ADMIN.value and user_phong_kham_id is not None:
            if target_phong_kham_id != user_phong_kham_id:
                raise ForbiddenException("Bạn không có quyền điều phối hàng đợi của phòng khám này!")

        now = datetime.now(timezone.utc)

        stmt_tickets = (
            select(HangDoiKham)
            .options(
                selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(HangDoiKham.lich_kham),
            )
            .where(
                HangDoiKham.bac_si_id == leave.bac_si_id,
                HangDoiKham.trang_thai.in_([
                    TrangThaiHangDoiEnum.CHO_KHAM.value,
                    TrangThaiHangDoiEnum.TAM_HOAN.value,
                ]),
            )
            .with_for_update()
        )
        target_ticket_ids = payload.ticket_ids or []
        assignment_map = {}
        if payload.assignments:
            for item in payload.assignments:
                target_ticket_ids.append(item.ticket_id)
                if item.bac_si_nhan_id:
                    assignment_map[item.ticket_id] = item.bac_si_nhan_id

        if target_ticket_ids:
            stmt_tickets = stmt_tickets.where(HangDoiKham.id.in_(target_ticket_ids))
        else:
            stmt_tickets = stmt_tickets.where(
                HangDoiKham.ngay_kham >= leave.tu_ngay,
                HangDoiKham.ngay_kham <= leave.den_ngay,
            )
            if leave.ca_lam_viec:
                stmt_tickets = stmt_tickets.where(HangDoiKham.ca_kham == leave.ca_lam_viec)

        tickets_to_move = (await db.execute(stmt_tickets)).scalars().all()
        if not tickets_to_move:
            return RebalanceQueueResponse(
                ok=True,
                nghi_phep_bac_si_id=leave.id,
                so_ve_chuyen=0,
                chi_tiet=[],
            )

        details: List[RebalanceTicketItem] = []

        specified_doc = None
        if payload.bac_si_nhan_id:
            stmt_doc = (
                select(BacSi)
                .options(selectinload(BacSi.nguoi_dung))
                .where(BacSi.id == payload.bac_si_nhan_id)
            )
            specified_doc = (await db.execute(stmt_doc)).scalar_one_or_none()
            if not specified_doc:
                raise NotFoundException(f"Không tìm thấy bác sĩ nhận ID {payload.bac_si_nhan_id}!")

        for old_ticket in tickets_to_move:
            target_date = old_ticket.ngay_kham

            ticket_doc = None
            if old_ticket.id in assignment_map:
                stmt_assign = (
                    select(BacSi)
                    .options(selectinload(BacSi.nguoi_dung))
                    .where(BacSi.id == assignment_map[old_ticket.id])
                )
                ticket_doc = (await db.execute(stmt_assign)).scalar_one_or_none()
                if not ticket_doc:
                    raise NotFoundException(f"Không tìm thấy bác sĩ nhận ID {assignment_map[old_ticket.id]} cho vé #{old_ticket.id}!")
            elif specified_doc:
                ticket_doc = specified_doc

            if ticket_doc:
                await self._validate_target_doctor(
                    target_bs=ticket_doc,
                    absent_bs=absent_bs,
                    target_date=target_date,
                    ca_kham=old_ticket.ca_kham,
                    db=db,
                )
                rec_doc_id = ticket_doc.id
                rec_doc_name = ticket_doc.nguoi_dung.ho_ten if ticket_doc.nguoi_dung else f"BS {rec_doc_id}"
                rec_phong_kham_id = ticket_doc.phong_kham_id
            else:
                rec_doc_id = await load_balancing_service.assign_optimal_doctor(
                    chuyen_khoa_id=absent_bs.chuyen_khoa_id,
                    ca_kham=old_ticket.ca_kham,
                    ngay_kham=target_date,
                    db=db,
                )
                rec_bs = (await db.execute(select(BacSi).options(selectinload(BacSi.nguoi_dung)).where(BacSi.id == rec_doc_id))).scalar_one()
                rec_doc_name = rec_bs.nguoi_dung.ho_ten if rec_bs.nguoi_dung else f"BS {rec_doc_id}"
                rec_phong_kham_id = rec_bs.phong_kham_id

            stmt_max = select(func.coalesce(func.max(HangDoiKham.so_thu_tu_kham), 0)).where(
                HangDoiKham.bac_si_id == rec_doc_id,
                HangDoiKham.ngay_kham == target_date,
                HangDoiKham.ca_kham == old_ticket.ca_kham,
            )
            max_stt = (await db.execute(stmt_max)).scalar()
            new_stt = max_stt + 1

            old_ticket.bac_si_id = rec_doc_id
            if rec_phong_kham_id:
                old_ticket.phong_kham_id = rec_phong_kham_id
            old_ticket.so_thu_tu_kham = new_stt
            old_ticket.thoi_gian_xep_hang_lai = now
            old_ticket.trang_thai = TrangThaiHangDoiEnum.CHO_KHAM.value
            old_ticket.nguoi_tiep_nhan_id = current_user.id
            note_transfer = f"Điều phối sự cố từ BS {leave.bac_si_id} sang BS {rec_doc_id} (STT #{new_stt}) lúc {now.strftime('%H:%M:%S')}"
            old_ticket.ghi_chu_dieu_phoi = f"{old_ticket.ghi_chu_dieu_phoi or ''} | {note_transfer}".strip(" | ")

            if old_ticket.lich_kham:
                old_ticket.lich_kham.bac_si_id = rec_doc_id

            bn_name = old_ticket.benh_nhan.nguoi_dung.ho_ten if old_ticket.benh_nhan and old_ticket.benh_nhan.nguoi_dung else f"BN {old_ticket.benh_nhan_id}"
            details.append(
                RebalanceTicketItem(
                    old_ticket_id=old_ticket.id,
                    new_ticket_id=old_ticket.id,
                    benh_nhan_id=old_ticket.benh_nhan_id,
                    ten_benh_nhan=bn_name,
                    bac_si_giao_id=leave.bac_si_id,
                    bac_si_nhan_id=rec_doc_id,
                    ten_bac_si_nhan=rec_doc_name,
                    so_thu_tu_moi=new_stt,
                )
            )

        leave.so_ca_anh_huong += len(details)

        stmt_remain = select(func.count(HangDoiKham.id)).where(
            HangDoiKham.bac_si_id == leave.bac_si_id,
            HangDoiKham.ngay_kham >= leave.tu_ngay,
            HangDoiKham.ngay_kham <= leave.den_ngay,
            HangDoiKham.trang_thai.in_([TrangThaiHangDoiEnum.CHO_KHAM.value, TrangThaiHangDoiEnum.TAM_HOAN.value]),
        )
        if leave.ca_lam_viec:
            stmt_remain = stmt_remain.where(HangDoiKham.ca_kham == leave.ca_lam_viec)
        remain_count = (await db.execute(stmt_remain)).scalar() or 0
        if remain_count == 0:
            leave.trang_thai = TrangThaiNghiPhepEnum.DA_XU_LY.value

        await db.commit()

        return RebalanceQueueResponse(
            ok=True,
            nghi_phep_bac_si_id=leave.id,
            so_ve_chuyen=len(details),
            chi_tiet=details,
        )

    async def _validate_target_doctor(
        self,
        target_bs: BacSi,
        absent_bs: BacSi,
        target_date: date,
        ca_kham: str,
        db: AsyncSession
    ) -> None:
        if target_bs.chuyen_khoa_id != absent_bs.chuyen_khoa_id:
            doc_name = target_bs.nguoi_dung.ho_ten if target_bs.nguoi_dung else f"ID {target_bs.id}"
            raise BadRequestException(f"Bác sĩ tiếp nhận ({doc_name}) không cùng chuyên khoa với bác sĩ vắng mặt!")

        if not target_bs.is_active or target_bs.trang_thai_giay_phep != "ACTIVE":
            doc_name = target_bs.nguoi_dung.ho_ten if target_bs.nguoi_dung else f"ID {target_bs.id}"
            raise BadRequestException(f"Bác sĩ {doc_name} hiện không ở trạng thái sẵn sàng tiếp nhận khám!")

        stmt_shift = select(LichLamViec).where(
            LichLamViec.bac_si_id == target_bs.id,
            LichLamViec.ngay_lam_viec == target_date,
            LichLamViec.is_active.is_(True),
        )
        if ca_kham:
            stmt_shift = stmt_shift.where(LichLamViec.ca_lam_viec == ca_kham)
        active_shift = (await db.execute(stmt_shift)).scalars().first()
        if not active_shift:
            doc_name = target_bs.nguoi_dung.ho_ten if target_bs.nguoi_dung else f"ID {target_bs.id}"
            raise BadRequestException(f"Bác sĩ {doc_name} không có lịch trực hợp lệ trong ca {ca_kham} ngày {target_date}!")

        stmt_leave = select(NghiPhepBacSi).where(
            NghiPhepBacSi.bac_si_id == target_bs.id,
            NghiPhepBacSi.tu_ngay <= target_date,
            NghiPhepBacSi.den_ngay >= target_date,
            NghiPhepBacSi.trang_thai == TrangThaiNghiPhepEnum.DA_DUYET.value,
        )
        if ca_kham:
            stmt_leave = stmt_leave.where(
                or_(NghiPhepBacSi.ca_lam_viec == ca_kham, NghiPhepBacSi.ca_lam_viec.is_(None))
            )
        leave_rec = (await db.execute(stmt_leave)).scalars().first()
        if leave_rec:
            doc_name = target_bs.nguoi_dung.ho_ten if target_bs.nguoi_dung else f"ID {target_bs.id}"
            raise BadRequestException(f"Bác sĩ {doc_name} đang trong đơn nghỉ phép, không thể tiếp nhận điều phối!")

    async def get_affected_patients(
        self,
        incident_id: int,
        current_user: TaiKhoan,
        db: AsyncSession
    ) -> DoctorAbsenceAffectedPatientsResponse:
        if current_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chức năng chỉ dành cho Lễ tân hoặc Quản trị viên!")

        stmt_leave = (
            select(NghiPhepBacSi)
            .options(
                selectinload(NghiPhepBacSi.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(NghiPhepBacSi.bac_si).selectinload(BacSi.chuyen_khoa),
            )
            .where(NghiPhepBacSi.id == incident_id)
        )
        leave = (await db.execute(stmt_leave)).scalar_one_or_none()
        if not leave:
            raise NotFoundException(f"Không tìm thấy đơn nghỉ phép ID {incident_id}!")

        bs = leave.bac_si
        bs_name = bs.nguoi_dung.ho_ten if (bs and bs.nguoi_dung) else f"BS {leave.bac_si_id}"
        ck_name = bs.chuyen_khoa.ten_chuyen_khoa if (bs and bs.chuyen_khoa) else None

        stmt_tickets = (
            select(HangDoiKham)
            .options(
                selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(HangDoiKham.lich_kham),
            )
            .where(
                HangDoiKham.bac_si_id == leave.bac_si_id,
                HangDoiKham.ngay_kham >= leave.tu_ngay,
                HangDoiKham.ngay_kham <= leave.den_ngay,
                HangDoiKham.trang_thai.in_([
                    TrangThaiHangDoiEnum.CHO_KHAM.value,
                    TrangThaiHangDoiEnum.TAM_HOAN.value,
                ]),
            )
            .order_by(HangDoiKham.so_thu_tu_kham.asc())
        )
        if leave.ca_lam_viec:
            stmt_tickets = stmt_tickets.where(HangDoiKham.ca_kham == leave.ca_lam_viec)

        tickets = (await db.execute(stmt_tickets)).scalars().all()
        queue_items: List[AffectedPatientItem] = []
        for t in tickets:
            p_name = t.benh_nhan.nguoi_dung.ho_ten if (t.benh_nhan and t.benh_nhan.nguoi_dung) else "Bệnh nhân"
            p_phone = t.benh_nhan.nguoi_dung.so_dien_thoai if (t.benh_nhan and t.benh_nhan.nguoi_dung) else None
            apt_code = t.lich_kham.ma_lich_kham if t.lich_kham else None
            apt_time = t.lich_kham.gio_kham.strftime("%H:%M") if (t.lich_kham and t.lich_kham.gio_kham) else None
            queue_items.append(
                AffectedPatientItem(
                    ticket_id=t.id,
                    so_thu_tu_kham=t.so_thu_tu_kham,
                    benh_nhan_id=t.benh_nhan_id,
                    ten_benh_nhan=p_name,
                    so_dien_thoai=p_phone,
                    muc_do_uu_tien=t.muc_do_uu_tien,
                    trang_thai=t.trang_thai,
                    thoi_gian_check_in=t.thoi_gian_check_in,
                    loai_hang_doi=t.loai_hang_doi,
                    ma_lich_kham=apt_code,
                    gio_kham=apt_time,
                )
            )

        stmt_wl = (
            select(DanhSachCho)
            .options(
                selectinload(DanhSachCho.benh_nhan).selectinload(BenhNhan.nguoi_dung)
            )
            .where(
                DanhSachCho.bac_si_id == leave.bac_si_id,
                DanhSachCho.ngay_mong_muon >= leave.tu_ngay,
                DanhSachCho.ngay_mong_muon <= leave.den_ngay,
                DanhSachCho.trang_thai.in_([
                    TrangThaiWaitlistEnum.DANG_CHO.value,
                    TrangThaiWaitlistEnum.DA_THONG_BAO.value,
                ]),
            )
            .order_by(DanhSachCho.thu_tu_uu_tien.asc())
        )
        if leave.ca_lam_viec:
            stmt_wl = stmt_wl.where(DanhSachCho.ca_mong_muon == leave.ca_lam_viec)

        wl_entries = (await db.execute(stmt_wl)).scalars().all()
        wl_items: List[AffectedWaitlistItem] = []
        for w in wl_entries:
            w_name = w.benh_nhan.nguoi_dung.ho_ten if (w.benh_nhan and w.benh_nhan.nguoi_dung) else "Bệnh nhân"
            w_phone = w.benh_nhan.nguoi_dung.so_dien_thoai if (w.benh_nhan and w.benh_nhan.nguoi_dung) else None
            wl_items.append(
                AffectedWaitlistItem(
                    waitlist_id=w.id,
                    benh_nhan_id=w.benh_nhan_id,
                    ten_benh_nhan=w_name,
                    so_dien_thoai=w_phone,
                    thu_tu_uu_tien=w.thu_tu_uu_tien,
                    ca_mong_muon=w.ca_mong_muon,
                    ngay_mong_muon=w.ngay_mong_muon,
                )
            )

        return DoctorAbsenceAffectedPatientsResponse(
            nghi_phep_id=leave.id,
            bac_si_id=leave.bac_si_id,
            ten_bac_si=bs_name,
            ten_chuyen_khoa=ck_name,
            tu_ngay=leave.tu_ngay,
            den_ngay=leave.den_ngay,
            ca_lam_viec=leave.ca_lam_viec,
            tong_so_kẹt=len(queue_items) + len(wl_items),
            hang_doi=queue_items,
            hang_cho_waitlist=wl_items,
        )

    async def cancel_incident_tickets(
        self,
        payload: CancelIncidentTicketsRequest,
        current_user: TaiKhoan,
        db: AsyncSession
    ) -> CancelIncidentTicketsResponse:
        if current_user.vai_tro not in (VaiTroEnum.LE_TAN.value, VaiTroEnum.ADMIN.value):
            raise ForbiddenException("Chức năng chỉ dành cho Lễ tân hoặc Quản trị viên!")

        stmt_leave = select(NghiPhepBacSi).where(NghiPhepBacSi.id == payload.nghi_phep_bac_si_id).with_for_update()
        leave = (await db.execute(stmt_leave)).scalar_one_or_none()
        if not leave:
            raise NotFoundException(f"Không tìm thấy đơn nghỉ phép ID {payload.nghi_phep_bac_si_id}!")

        now = datetime.now(timezone.utc)
        cancel_reason = payload.ly_do or "Bệnh nhân không đồng ý đổi bác sĩ khi có sự cố bác sĩ nghỉ"

        so_ve_huy = 0
        so_lich_huy = 0
        if payload.ticket_ids:
            stmt_t = (
                select(HangDoiKham)
                .options(selectinload(HangDoiKham.lich_kham))
                .where(
                    HangDoiKham.id.in_(payload.ticket_ids),
                    HangDoiKham.bac_si_id == leave.bac_si_id,
                )
                .with_for_update()
            )
            tickets = (await db.execute(stmt_t)).scalars().all()
            for t in tickets:
                t.trang_thai = TrangThaiHangDoiEnum.DA_DONG_VE.value
                t.muc_do_uu_tien = 7
                t.thoi_gian_ket_thuc = now
                t.ghi_chu_dieu_phoi = f"{t.ghi_chu_dieu_phoi or ''} | Hủy do sự cố: {cancel_reason}".strip(" | ")
                so_ve_huy += 1

                if t.lich_kham and t.lich_kham.trang_thai in (
                    TrangThaiLichEnum.DA_TIEP_NHAN.value,
                    TrangThaiLichEnum.DA_XAC_NHAN.value,
                    TrangThaiLichEnum.CHO_XAC_NHAN.value
                ):
                    t.lich_kham.trang_thai = TrangThaiLichEnum.DA_HUY.value
                    t.lich_kham.ly_do_huy = f"Sự cố bác sĩ nghỉ: {cancel_reason}"
                    so_lich_huy += 1

        so_wl_huy = 0
        if payload.waitlist_ids:
            stmt_wl = (
                select(DanhSachCho)
                .where(
                    DanhSachCho.id.in_(payload.waitlist_ids),
                    DanhSachCho.bac_si_id == leave.bac_si_id,
                )
                .with_for_update()
            )
            waitlists = (await db.execute(stmt_wl)).scalars().all()
            for w in waitlists:
                w.trang_thai = TrangThaiWaitlistEnum.DA_HUY.value
                w.trieu_chung = f"{w.trieu_chung or ''} | Hủy do sự cố: {cancel_reason}".strip(" | ")
                so_wl_huy += 1

        stmt_remain = select(func.count(HangDoiKham.id)).where(
            HangDoiKham.bac_si_id == leave.bac_si_id,
            HangDoiKham.ngay_kham >= leave.tu_ngay,
            HangDoiKham.ngay_kham <= leave.den_ngay,
            HangDoiKham.trang_thai.in_([TrangThaiHangDoiEnum.CHO_KHAM.value, TrangThaiHangDoiEnum.TAM_HOAN.value]),
        )
        if leave.ca_lam_viec:
            stmt_remain = stmt_remain.where(HangDoiKham.ca_kham == leave.ca_lam_viec)
        remain_count = (await db.execute(stmt_remain)).scalar() or 0
        if remain_count == 0:
            leave.trang_thai = TrangThaiNghiPhepEnum.DA_XU_LY.value

        await db.commit()

        return CancelIncidentTicketsResponse(
            ok=True,
            so_ve_da_huy=so_ve_huy,
            so_waitlist_da_huy=so_wl_huy,
            so_lich_kham_da_huy=so_lich_huy,
            thong_diep=f"Đã hủy thành công {so_ve_huy} lượt hàng đợi và {so_wl_huy} lượt hàng chờ do sự cố.",
        )


incident_service = IncidentService()
