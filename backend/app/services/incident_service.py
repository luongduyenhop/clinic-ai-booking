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
    TrangThaiHangDoiEnum,
    TrangThaiNghiPhepEnum,
    TrangThaiLichEnum,
    LoaiHangDoiEnum,
)
from app.models.user import BacSi, ChuyenKhoa, TaiKhoan, VaiTroEnum, BenhNhan, NguoiDung
from app.schemas.incident import (
    DoctorAbsenceIncidentResponse,
    DoctorAlternativeItem,
    RebalanceQueueRequest,
    RebalanceQueueResponse,
    RebalanceTicketItem,
)
from app.services.load_balancing_service import load_balancing_service

logger = logging.getLogger(__name__)


class IncidentService:
    """Nghiệp vụ Xử lý Sự cố & Điều phối Hàng đợi khi Bác sĩ vắng mặt đột xuất (FC-13, FC-14)"""

    async def get_doctor_absences_incidents(
        self,
        query_date: Optional[date],
        current_user: TaiKhoan,
        db: AsyncSession,
    ) -> List[DoctorAbsenceIncidentResponse]:
        """Xem danh sách các ca nghỉ của bác sĩ cần điều phối trong ngày (FC-13)"""
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

            # Đếm số bệnh nhân bị ảnh hưởng đang chờ khám
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

            # Tìm danh sách bác sĩ thay thế cùng chuyên khoa có lịch trực
            alternatives: List[DoctorAlternativeItem] = []
            if ck_id:
                stmt_alt = (
                    select(BacSi)
                    .join(LichLamViec, LichLamViec.bac_si_id == BacSi.id)
                    .options(selectinload(BacSi.nguoi_dung), selectinload(BacSi.chuyen_khoa))
                    .where(
                        BacSi.chuyen_khoa_id == ck_id,
                        BacSi.id != leave.bac_si_id,
                        BacSi.is_active == True,
                        LichLamViec.ngay_lam_viec == target_date,
                        LichLamViec.is_active == True,
                    )
                )
                if leave.ca_lam_viec:
                    stmt_alt = stmt_alt.where(LichLamViec.ca_lam_viec == leave.ca_lam_viec)
                alt_doctors = (await db.execute(stmt_alt)).scalars().all()

                for ad in alt_doctors:
                    stmt_ad_load = select(func.count(HangDoiKham.id)).where(
                        HangDoiKham.bac_si_id == ad.id,
                        HangDoiKham.ngay_kham == target_date,
                        HangDoiKham.trang_thai.in_([
                            TrangThaiHangDoiEnum.CHO_KHAM.value,
                            TrangThaiHangDoiEnum.DANG_KHAM.value,
                        ]),
                    )
                    load = (await db.execute(stmt_ad_load)).scalar() or 0
                    alternatives.append(
                        DoctorAlternativeItem(
                            bac_si_id=ad.id,
                            ten_bac_si=ad.nguoi_dung.ho_ten if ad.nguoi_dung else f"BS {ad.id}",
                            phong_kham=ad.chuyen_khoa.vi_tri_phong if ad.chuyen_khoa else None,
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
        """Thực hiện chuyển hàng đợi từ bác sĩ vắng mặt sang bác sĩ khác (FC-14)"""
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

        now = datetime.now(timezone.utc)
        today = date.today()

        # Tìm các vé cần chuyển
        stmt_tickets = (
            select(HangDoiKham)
            .options(
                selectinload(HangDoiKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(HangDoiKham.lich_kham),
            )
            .where(
                HangDoiKham.bac_si_id == leave.bac_si_id,
                HangDoiKham.ngay_kham == today,
                HangDoiKham.trang_thai.in_([
                    TrangThaiHangDoiEnum.CHO_KHAM.value,
                    TrangThaiHangDoiEnum.TAM_HOAN.value,
                ]),
            )
            .with_for_update()
        )
        if payload.ticket_ids:
            stmt_tickets = stmt_tickets.where(HangDoiKham.id.in_(payload.ticket_ids))

        tickets_to_move = (await db.execute(stmt_tickets)).scalars().all()
        if not tickets_to_move:
            return RebalanceQueueResponse(
                ok=True,
                nghi_phep_bac_si_id=leave.id,
                so_ve_chuyen=0,
                chi_tiet=[],
            )

        details: List[RebalanceTicketItem] = []

        # Nếu lễ tân chỉ định đích danh bác sĩ nhận
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
            # 1. Xác định bác sĩ nhận (hoặc tự động cân bằng tải)
            if specified_doc:
                rec_doc_id = specified_doc.id
                rec_doc_name = specified_doc.nguoi_dung.ho_ten if specified_doc.nguoi_dung else f"BS {rec_doc_id}"
            else:
                rec_doc_id = await load_balancing_service.assign_optimal_doctor(
                    chuyen_khoa_id=absent_bs.chuyen_khoa_id,
                    ca_kham=old_ticket.ca_kham,
                    ngay_kham=today,
                    db=db,
                )
                rec_bs = (await db.execute(select(BacSi).options(selectinload(BacSi.nguoi_dung)).where(BacSi.id == rec_doc_id))).scalar_one()
                rec_doc_name = rec_bs.nguoi_dung.ho_ten if rec_bs.nguoi_dung else f"BS {rec_doc_id}"

            # 2. Đóng vé cũ bằng DA_DONG_VE
            old_ticket.trang_thai = TrangThaiHangDoiEnum.DA_DONG_VE.value
            old_ticket.ghi_chu_dieu_phoi = f"{old_ticket.ghi_chu_dieu_phoi or ''} | Điều phối sang BS ID {rec_doc_id} lúc {now.strftime('%H:%M:%S')}".strip(" | ")

            # 3. Tính số thứ tự mới cho bác sĩ nhận
            stmt_max = select(func.coalesce(func.max(HangDoiKham.so_thu_tu_kham), 0)).where(
                HangDoiKham.bac_si_id == rec_doc_id,
                HangDoiKham.ngay_kham == today,
                HangDoiKham.ca_kham == old_ticket.ca_kham,
            )
            max_stt = (await db.execute(stmt_max)).scalar()
            new_stt = max_stt + 1

            # 4. Tạo vé mới cho bác sĩ nhận
            new_ticket = HangDoiKham(
                lich_kham_id=old_ticket.lich_kham_id,
                benh_nhan_id=old_ticket.benh_nhan_id,
                bac_si_id=rec_doc_id,
                ngay_kham=today,
                ca_kham=old_ticket.ca_kham,
                so_thu_tu_kham=new_stt,
                loai_hang_doi=old_ticket.loai_hang_doi,
                muc_do_uu_tien=old_ticket.muc_do_uu_tien,
                trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
                thoi_gian_check_in=old_ticket.thoi_gian_check_in,
                thoi_gian_xep_hang_lai=now,
                so_lan_goi=0,
                nguoi_tiep_nhan_id=current_user.id,
                ghi_chu_dieu_phoi=f"Tiếp nhận điều phối từ BS ID {leave.bac_si_id} (Vé cũ #{old_ticket.id})",
            )
            db.add(new_ticket)
            await db.flush()

            # Cập nhật lịch hẹn nếu có
            if old_ticket.lich_kham:
                old_ticket.lich_kham.bac_si_id = rec_doc_id

            bn_name = old_ticket.benh_nhan.nguoi_dung.ho_ten if old_ticket.benh_nhan and old_ticket.benh_nhan.nguoi_dung else f"BN {old_ticket.benh_nhan_id}"
            details.append(
                RebalanceTicketItem(
                    old_ticket_id=old_ticket.id,
                    new_ticket_id=new_ticket.id,
                    benh_nhan_id=old_ticket.benh_nhan_id,
                    ten_benh_nhan=bn_name,
                    bac_si_giao_id=leave.bac_si_id,
                    bac_si_nhan_id=rec_doc_id,
                    ten_bac_si_nhan=rec_doc_name,
                    so_thu_tu_moi=new_stt,
                )
            )

        leave.so_ca_anh_huong += len(details)
        leave.trang_thai = TrangThaiNghiPhepEnum.DA_XU_LY.value

        await db.commit()

        return RebalanceQueueResponse(
            ok=True,
            nghi_phep_bac_si_id=leave.id,
            so_ve_chuyen=len(details),
            chi_tiet=details,
        )


incident_service = IncidentService()
