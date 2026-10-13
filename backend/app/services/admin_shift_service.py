import logging
from datetime import date, datetime, time, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
)
from app.core.security import get_password_hash
from app.models.appointment import (
    LichLamViec,
    LichKham,
    HangDoiKham,
    CaLamViecEnum,
    TrangThaiLichEnum,
    TrangThaiHangDoiEnum,
    LichDinhKyBacSi,
    NghiPhepBacSi,
    TrangThaiNghiPhepEnum,
    PhanTichAI,
    DanhGiaAI,
)
from app.models.medical import DichVu, LuotKham, BienBanDinhChinh, ChiDinh, KhaiNiem, TuKhoaCapCuu
from app.models.user import BacSi, ChuyenKhoa, NguoiDung, PhongKham, TaiKhoan, VaiTroEnum, BenhNhan
from app.schemas.clinical import AmendmentResponse
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
    AIAccuracySpecialtyItem,
    AdminAnalyticsReportResponse,
    CancellationReasonBreakdown,
    SpecialtyBookingStat,
    PatientAdminItemResponse,
    PatientAdminDetailResponse,
    PatientStatusUpdateRequest,
    PatientAppointmentBrief,
)

logger = logging.getLogger(__name__)


class AdminShiftService:
    """Dịch vụ chuyên trách Phân ca trực, Lịch làm việc tuần và Quản lý vắng mặt (SRP)"""

    # --- 2. Phân ca trực & Lịch làm việc (OpenEMR 7 Calendar) ---
    async def get_shifts(
        self, query_date: Optional[date], doctor_id: Optional[int], db: AsyncSession
    ) -> List[ShiftResponse]:
        """Lấy danh sách ca làm việc theo ngày và bác sĩ kèm thông tin buồng khám và hạn mức quota"""
        stmt = (
            select(LichLamViec)
            .options(
                selectinload(LichLamViec.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichLamViec.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(LichLamViec.phong_kham),
            )
        )
        if query_date:
            stmt = stmt.where(LichLamViec.ngay_lam_viec == query_date)
        if doctor_id:
            stmt = stmt.where(LichLamViec.bac_si_id == doctor_id)

        stmt = stmt.order_by(LichLamViec.ngay_lam_viec, LichLamViec.ca_lam_viec)
        shifts = (await db.execute(stmt)).scalars().all()

        res = []
        for s in shifts:
            # Đếm số lịch khám đã đặt trong ca này
            stmt_booked = select(func.count(LichKham.id)).where(
                LichKham.bac_si_id == s.bac_si_id,
                LichKham.ngay_kham == s.ngay_lam_viec,
                LichKham.trang_thai.notin_([TrangThaiLichEnum.DA_HUY.value, TrangThaiLichEnum.TU_DONG_HUY.value]),
                LichKham.gio_kham >= s.gio_bat_dau,
                LichKham.gio_kham < s.gio_ket_thuc,
            )
            booked_count = (await db.execute(stmt_booked)).scalar() or 0

            phong_display = ""
            ma_phong = None
            ten_phong = None
            tang_phong = None
            if s.phong_kham:
                phong_display = f"{s.phong_kham.ma_phong} - {s.phong_kham.ten_phong}"
                ma_phong = s.phong_kham.ma_phong
                ten_phong = s.phong_kham.ten_phong
                tang_phong = s.phong_kham.tang
            elif s.bac_si and s.bac_si.chuyen_khoa:
                phong_display = s.bac_si.chuyen_khoa.vi_tri_phong or ""

            res.append(
                ShiftResponse(
                    id=s.id,
                    bac_si_id=s.bac_si_id,
                    ten_bac_si=s.bac_si.nguoi_dung.ho_ten if s.bac_si and s.bac_si.nguoi_dung else "",
                    chuyen_khoa=s.bac_si.chuyen_khoa.ten_chuyen_khoa if s.bac_si and s.bac_si.chuyen_khoa else "",
                    phong_kham=phong_display,
                    phong_kham_id=s.phong_kham_id,
                    ma_phong=ma_phong,
                    ten_phong=ten_phong,
                    tang_phong=tang_phong,
                    ngay_lam_viec=s.ngay_lam_viec,
                    ca_lam_viec=s.ca_lam_viec,
                    gio_bat_dau=s.gio_bat_dau,
                    gio_ket_thuc=s.gio_ket_thuc,
                    gioi_han_ca_kham=s.gioi_han_ca_kham,
                    han_muc_dat_truoc=s.han_muc_dat_truoc or 6,
                    han_muc_vang_lai=s.han_muc_vang_lai or 2,
                    so_luong_da_dat=booked_count,
                    is_active=s.is_active,
                    ghi_chu_nghi=s.ghi_chu_nghi,
                )
            )
        return res

    async def create_shift(self, payload: ShiftCreateRequest, db: AsyncSession) -> ShiftResponse:
        """
        Phân ca trực mới với các kiểm tra bất biến OpenEMR:
        1. Bác sĩ không được có 2 ca trùng nhau trong cùng ngày (Unique constraint).
        2. Buồng khám vật lý không được xung đột (1 phòng chỉ 1 bác sĩ trực trong cùng ca).
        3. Phân bổ hạn mức kép: Đặt hẹn trước (online) vs Vãng lai (walk-in).
        4. Giờ bắt đầu và kết thúc chuẩn theo ca sáng/chiều.
        """
        # Kiểm tra bác sĩ tồn tại
        stmt_bs = (
            select(BacSi)
            .options(
                selectinload(BacSi.nguoi_dung),
                selectinload(BacSi.chuyen_khoa),
            )
            .where(BacSi.id == payload.bac_si_id)
        )
        doc = (await db.execute(stmt_bs)).scalar_one_or_none()
        if not doc:
            raise NotFoundException(f"Không tìm thấy bác sĩ với ID {payload.bac_si_id}!")

        # INT-05 Credential Guard: Chặn phân ca cho bác sĩ có giấy phép EXPIRED hoặc SUSPENDED
        from app.services.credential_service import credential_service
        await credential_service.check_doctor_license_valid(db, payload.bac_si_id)

        # Kiểm tra trùng ca trực của bác sĩ
        stmt_dup = select(LichLamViec).where(
            LichLamViec.bac_si_id == payload.bac_si_id,
            LichLamViec.ngay_lam_viec == payload.ngay_lam_viec,
            LichLamViec.ca_lam_viec == payload.ca_lam_viec,
        )
        if (await db.execute(stmt_dup)).scalar_one_or_none():
            raise ConflictException(
                f"Bác sĩ {doc.nguoi_dung.ho_ten} đã được phân ca {payload.ca_lam_viec} vào ngày {payload.ngay_lam_viec}!"
            )

        # Kiểm tra buồng khám vật lý (Physical Room Verification & Criteria Check)
        target_room_id = payload.phong_kham_id or doc.phong_kham_id
        room = None
        if target_room_id:
            stmt_room = (
                select(PhongKham)
                .options(selectinload(PhongKham.chuyen_khoa))
                .where(PhongKham.id == target_room_id)
            )
            room = (await db.execute(stmt_room)).scalar_one_or_none()
            if not room:
                raise NotFoundException(f"Không tìm thấy buồng khám với ID {target_room_id}!")
            if not room.is_active:
                raise BadRequestException(f"Buồng khám '{room.ten_phong}' đang tạm dừng hoạt động hoặc bảo trì!")

            # Tiêu chí 1: Buồng khám phải là loại khám bệnh lâm sàng
            if room.loai_phong != "kham_benh":
                loai_phong_label = {
                    "xet_nghiem": "Phòng xét nghiệm cận lâm sàng",
                    "chan_doan_hinh_anh": "Phòng chẩn đoán hình ảnh",
                    "thu_thuat": "Phòng thủ thuật chuyên môn",
                }.get(room.loai_phong, room.loai_phong)
                raise BadRequestException(
                    f"Không thể phân ca khám cho buồng '{room.ten_phong}' vì đây là {loai_phong_label}, không phải buồng khám bệnh lâm sàng!"
                )

            # Tiêu chí 2: Tương thích chuyên khoa lâm sàng
            if room.chuyen_khoa_id and doc.chuyen_khoa_id and room.chuyen_khoa_id != doc.chuyen_khoa_id:
                ten_ck_room = room.chuyen_khoa.ten_chuyen_khoa if room.chuyen_khoa else f"CK #{room.chuyen_khoa_id}"
                ten_ck_doc = doc.chuyen_khoa.ten_chuyen_khoa if doc.chuyen_khoa else f"CK #{doc.chuyen_khoa_id}"
                raise BadRequestException(
                    f"Sai lệch chuyên khoa: Buồng '{room.ten_phong}' thuộc chuyên khoa '{ten_ck_room}', không tương thích với chuyên khoa của BS {doc.nguoi_dung.ho_ten} ('{ten_ck_doc}')!"
                )

            # Tiêu chí 3: Kiểm tra xung đột buồng khám trong cùng buổi
            stmt_conflict_room = select(LichLamViec).where(
                LichLamViec.phong_kham_id == target_room_id,
                LichLamViec.ngay_lam_viec == payload.ngay_lam_viec,
                LichLamViec.ca_lam_viec == payload.ca_lam_viec,
                LichLamViec.is_active == True,
            )
            conflict_shift = (await db.execute(stmt_conflict_room)).scalar_one_or_none()
            if conflict_shift:
                stmt_c_doc = select(BacSi).options(selectinload(BacSi.nguoi_dung)).where(BacSi.id == conflict_shift.bac_si_id)
                c_doc = (await db.execute(stmt_c_doc)).scalar_one_or_none()
                c_doc_name = c_doc.nguoi_dung.ho_ten if c_doc and c_doc.nguoi_dung else f"BS #{conflict_shift.bac_si_id}"
                raise ConflictException(
                    f"Xung đột buồng khám: Buồng '{room.ma_phong} - {room.ten_phong}' đã được phân cho bác sĩ {c_doc_name} trong ca {payload.ca_lam_viec} ngày {payload.ngay_lam_viec}!"
                )

        # Thiết lập giờ chuẩn nếu không chỉ định
        if payload.ca_lam_viec == CaLamViecEnum.SANG.value:
            s_time = payload.gio_bat_dau or time(7, 30)
            e_time = payload.gio_ket_thuc or time(11, 30)
        else:
            s_time = payload.gio_bat_dau or time(13, 30)
            e_time = payload.gio_ket_thuc or time(17, 0)

        # Tính toán hạn mức đặt hẹn trước vs vãng lai
        gioi_han = payload.gioi_han_ca_kham
        han_muc_dat_truoc = payload.han_muc_dat_truoc if payload.han_muc_dat_truoc is not None else max(1, int(gioi_han * 0.75))
        han_muc_vang_lai = payload.han_muc_vang_lai if payload.han_muc_vang_lai is not None else max(1, gioi_han - han_muc_dat_truoc)

        shift = LichLamViec(
            bac_si_id=payload.bac_si_id,
            phong_kham_id=target_room_id,
            ngay_lam_viec=payload.ngay_lam_viec,
            ca_lam_viec=payload.ca_lam_viec,
            gio_bat_dau=s_time,
            gio_ket_thuc=e_time,
            gioi_han_ca_kham=gioi_han,
            han_muc_dat_truoc=han_muc_dat_truoc,
            han_muc_vang_lai=han_muc_vang_lai,
            is_active=True,
        )
        db.add(shift)
        await db.commit()
        await db.refresh(shift)

        phong_display = f"{room.ma_phong} - {room.ten_phong}" if room else (doc.chuyen_khoa.vi_tri_phong if doc.chuyen_khoa else "")

        return ShiftResponse(
            id=shift.id,
            bac_si_id=doc.id,
            ten_bac_si=doc.nguoi_dung.ho_ten,
            chuyen_khoa=doc.chuyen_khoa.ten_chuyen_khoa if doc.chuyen_khoa else "",
            phong_kham=phong_display,
            phong_kham_id=shift.phong_kham_id,
            ma_phong=room.ma_phong if room else None,
            ten_phong=room.ten_phong if room else None,
            tang_phong=room.tang if room else None,
            ngay_lam_viec=shift.ngay_lam_viec,
            ca_lam_viec=shift.ca_lam_viec,
            gio_bat_dau=shift.gio_bat_dau,
            gio_ket_thuc=shift.gio_ket_thuc,
            gioi_han_ca_kham=shift.gioi_han_ca_kham,
            han_muc_dat_truoc=shift.han_muc_dat_truoc or han_muc_dat_truoc,
            han_muc_vang_lai=shift.han_muc_vang_lai or han_muc_vang_lai,
            so_luong_da_dat=0,
            is_active=shift.is_active,
            ghi_chu_nghi=None,
        )

    async def toggle_lock_shift(
        self, shift_id: int, payload: ShiftToggleLockRequest, db: AsyncSession
    ) -> ShiftResponse:
        """Khóa ca trực hoặc mở lại (OpenEMR Out of office rule: giữ nguyên các lịch đã đặt để xử lý dời lịch)"""
        stmt = (
            select(LichLamViec)
            .options(
                selectinload(LichLamViec.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichLamViec.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(LichLamViec.phong_kham),
            )
            .where(LichLamViec.id == shift_id)
        )
        shift = (await db.execute(stmt)).scalar_one_or_none()
        if not shift:
            raise NotFoundException(f"Không tìm thấy ca làm việc với ID {shift_id}!")

        shift.is_active = payload.is_active
        shift.ghi_chu_nghi = payload.ghi_chu_nghi
        await db.commit()
        await db.refresh(shift)

        phong_display = ""
        ma_phong = None
        ten_phong = None
        tang_phong = None
        if shift.phong_kham:
            phong_display = f"{shift.phong_kham.ma_phong} - {shift.phong_kham.ten_phong}"
            ma_phong = shift.phong_kham.ma_phong
            ten_phong = shift.phong_kham.ten_phong
            tang_phong = shift.phong_kham.tang
        elif shift.bac_si and shift.bac_si.chuyen_khoa:
            phong_display = shift.bac_si.chuyen_khoa.vi_tri_phong or ""

        return ShiftResponse(
            id=shift.id,
            bac_si_id=shift.bac_si_id,
            ten_bac_si=shift.bac_si.nguoi_dung.ho_ten if shift.bac_si and shift.bac_si.nguoi_dung else "",
            chuyen_khoa=shift.bac_si.chuyen_khoa.ten_chuyen_khoa if shift.bac_si and shift.bac_si.chuyen_khoa else "",
            phong_kham=phong_display,
            phong_kham_id=shift.phong_kham_id,
            ma_phong=ma_phong,
            ten_phong=ten_phong,
            tang_phong=tang_phong,
            ngay_lam_viec=shift.ngay_lam_viec,
            ca_lam_viec=shift.ca_lam_viec,
            gio_bat_dau=shift.gio_bat_dau,
            gio_ket_thuc=shift.gio_ket_thuc,
            gioi_han_ca_kham=shift.gioi_han_ca_kham,
            han_muc_dat_truoc=shift.han_muc_dat_truoc or 6,
            han_muc_vang_lai=shift.han_muc_vang_lai or 2,
            so_luong_da_dat=0,
            is_active=shift.is_active,
            ghi_chu_nghi=shift.ghi_chu_nghi,
        )

    async def declare_emergency_leave(
        self, shift_id: int, payload: EmergencyLeaveDeclareRequest, admin_user: TaiKhoan, db: AsyncSession
    ) -> EmergencyLeaveSummaryResponse:
        """Khai báo bác sĩ nghỉ đột xuất cho ca trực và thống kê bệnh nhân bị ảnh hưởng"""
        stmt = (
            select(LichLamViec)
            .options(
                selectinload(LichLamViec.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichLamViec.bac_si).selectinload(BacSi.chuyen_khoa),
            )
            .where(LichLamViec.id == shift_id)
            .with_for_update()
        )
        shift = (await db.execute(stmt)).scalar_one_or_none()
        if not shift:
            raise NotFoundException(f"Không tìm thấy ca làm việc với ID {shift_id}!")

        if not shift.is_active:
            raise ConflictException("Ca làm việc này đã được đánh dấu nghỉ/khóa trước đó!")

        # 1. Đánh dấu nghỉ đột xuất
        shift.is_active = False
        shift.ghi_chu_nghi = f"Nghỉ đột xuất: {payload.ly_do_nghi}"

        # 2. Đếm số vé chờ khám (N1)
        stmt_cho = select(func.count(HangDoiKham.id)).where(
            HangDoiKham.bac_si_id == shift.bac_si_id,
            HangDoiKham.ngay_kham == shift.ngay_lam_viec,
            HangDoiKham.ca_kham == shift.ca_lam_viec,
            HangDoiKham.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value,
        )
        n_cho = (await db.execute(stmt_cho)).scalar() or 0

        # 3. Đếm số ca đang khám dở (N2)
        stmt_dang = select(func.count(HangDoiKham.id)).where(
            HangDoiKham.bac_si_id == shift.bac_si_id,
            HangDoiKham.ngay_kham == shift.ngay_lam_viec,
            HangDoiKham.ca_kham == shift.ca_lam_viec,
            HangDoiKham.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value,
        )
        n_dang = (await db.execute(stmt_dang)).scalar() or 0

        # 4. Đếm số lịch hẹn chưa check-in trong ca (N3)
        stmt_lich = select(func.count(LichKham.id)).where(
            LichKham.bac_si_id == shift.bac_si_id,
            LichKham.ngay_kham == shift.ngay_lam_viec,
            LichKham.gio_kham >= shift.gio_bat_dau,
            LichKham.gio_kham < shift.gio_ket_thuc,
            LichKham.trang_thai.in_([
                TrangThaiLichEnum.CHO_XAC_NHAN.value,
                TrangThaiLichEnum.DA_XAC_NHAN.value,
            ]),
        )
        n_lich = (await db.execute(stmt_lich)).scalar() or 0

        await db.commit()
        await db.refresh(shift)

        logger.warning(
            f"🚨 [AUDIT - EMERGENCY_LEAVE] Shift: {shift.id} | Bác sĩ: {shift.bac_si_id} | Admin: {admin_user.id} | "
            f"N1(chờ)={n_cho}, N2(đang khám)={n_dang}, N3(lịch hẹn)={n_lich}"
        )

        return EmergencyLeaveSummaryResponse(
            lich_lam_viec_id=shift.id,
            bac_si_id=shift.bac_si_id,
            ten_bac_si=shift.bac_si.nguoi_dung.ho_ten if shift.bac_si and shift.bac_si.nguoi_dung else "",
            chuyen_khoa=shift.bac_si.chuyen_khoa.ten_chuyen_khoa if shift.bac_si and shift.bac_si.chuyen_khoa else "",
            ngay_lam_viec=shift.ngay_lam_viec,
            ca_lam_viec=shift.ca_lam_viec,
            is_active=shift.is_active,
            ly_do_nghi=shift.ghi_chu_nghi,
            so_ve_cho_kham=n_cho,
            so_ve_dang_kham=n_dang,
            so_lich_chua_checkin=n_lich,
        )

    async def reassign_queue_to_replacement(
        self, shift_id: int, payload: ReassignQueueRequest, admin_user: TaiKhoan, db: AsyncSession
    ) -> ReassignQueueResponse:
        """Điều phối toàn bộ hàng đợi của ca nghỉ sang Bác sĩ trực thay thế"""
        # 1. Khóa ca làm việc gốc
        stmt_goc = (
            select(LichLamViec)
            .options(
                selectinload(LichLamViec.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichLamViec.bac_si).selectinload(BacSi.chuyen_khoa),
            )
            .where(LichLamViec.id == shift_id)
            .with_for_update()
        )
        shift_goc = (await db.execute(stmt_goc)).scalar_one_or_none()
        if not shift_goc:
            raise NotFoundException(f"Không tìm thấy ca làm việc gốc với ID {shift_id}!")

        if shift_goc.is_active:
            raise ConflictException("Ca làm việc này chưa được khai báo nghỉ đột xuất!")

        # 2. Kiểm tra Bác sĩ thay thế
        stmt_bs_thay = (
            select(BacSi)
            .options(
                selectinload(BacSi.nguoi_dung),
                selectinload(BacSi.chuyen_khoa),
            )
            .where(BacSi.id == payload.bac_si_thay_the_id)
        )
        bs_thay = (await db.execute(stmt_bs_thay)).scalar_one_or_none()
        if not bs_thay:
            raise NotFoundException(f"Không tìm thấy bác sĩ thay thế với ID {payload.bac_si_thay_the_id}!")

        if bs_thay.id == shift_goc.bac_si_id:
            raise BadRequestException("Bác sĩ thay thế không thể là chính bác sĩ đang nghỉ!")

        # 3. Invariant: Cùng chuyên khoa
        if bs_thay.chuyen_khoa_id != shift_goc.bac_si.chuyen_khoa_id:
            raise BadRequestException(
                f"Bác sĩ thay thế thuộc chuyên khoa '{bs_thay.chuyen_khoa.ten_chuyen_khoa if bs_thay.chuyen_khoa else ''}', "
                f"không cùng chuyên khoa với bác sĩ nghỉ ('{shift_goc.bac_si.chuyen_khoa.ten_chuyen_khoa if shift_goc.bac_si.chuyen_khoa else ''}')!"
            )

        # 4. Kiểm tra ca trực của BS thay thế trong cùng buổi
        stmt_shift_thay = (
            select(LichLamViec)
            .where(
                LichLamViec.bac_si_id == bs_thay.id,
                LichLamViec.ngay_lam_viec == shift_goc.ngay_lam_viec,
                LichLamViec.ca_lam_viec == shift_goc.ca_lam_viec,
            )
            .with_for_update()
        )
        shift_thay = (await db.execute(stmt_shift_thay)).scalar_one_or_none()
        if not shift_thay or not shift_thay.is_active:
            raise ConflictException(
                f"Bác sĩ thay thế {bs_thay.nguoi_dung.ho_ten} không có ca trực đang hoạt động trong ca {shift_goc.ca_lam_viec} ngày {shift_goc.ngay_lam_viec}!"
            )

        # 5. Lấy danh sách vé CHO_KHAM cần chuyển
        stmt_ve_cho = (
            select(HangDoiKham)
            .where(
                HangDoiKham.bac_si_id == shift_goc.bac_si_id,
                HangDoiKham.ngay_kham == shift_goc.ngay_lam_viec,
                HangDoiKham.ca_kham == shift_goc.ca_lam_viec,
                HangDoiKham.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value,
            )
            .order_by(HangDoiKham.thoi_gian_check_in.asc())
            .with_for_update()
        )
        ve_cho_list = (await db.execute(stmt_ve_cho)).scalars().all()

        # 6. Kiểm tra tải (Capacity Check)
        stmt_count_thay = select(func.count(HangDoiKham.id)).where(
            HangDoiKham.bac_si_id == bs_thay.id,
            HangDoiKham.ngay_kham == shift_goc.ngay_lam_viec,
            HangDoiKham.ca_kham == shift_goc.ca_lam_viec,
            HangDoiKham.trang_thai.in_([
                TrangThaiHangDoiEnum.CHO_KHAM.value,
                TrangThaiHangDoiEnum.DANG_KHAM.value,
                TrangThaiHangDoiEnum.DA_KHAM.value,
            ]),
        )
        so_hien_tai = (await db.execute(stmt_count_thay)).scalar() or 0
        if so_hien_tai + len(ve_cho_list) > shift_thay.gioi_han_ca_kham:
            raise ConflictException(
                f"Bác sĩ thay thế {bs_thay.nguoi_dung.ho_ten} sẽ bị quá tải! "
                f"Hiện tại: {so_hien_tai}, Cần chuyển: {len(ve_cho_list)}, Giới hạn ca: {shift_thay.gioi_han_ca_kham}."
            )

        # 7. Tính STT cơ sở cho bác sĩ thay thế
        stmt_max_stt = select(func.coalesce(func.max(HangDoiKham.so_thu_tu_kham), 0)).where(
            HangDoiKham.bac_si_id == bs_thay.id,
            HangDoiKham.ngay_kham == shift_goc.ngay_lam_viec,
            HangDoiKham.ca_kham == shift_goc.ca_lam_viec,
        )
        curr_max_stt = (await db.execute(stmt_max_stt)).scalar() or 0

        # 8. Cập nhật từng vé CHO_KHAM sang BS thay thế với STT mới
        ten_goc = shift_goc.bac_si.nguoi_dung.ho_ten
        ten_moi = bs_thay.nguoi_dung.ho_ten
        count_cho = 0
        for ve in ve_cho_list:
            curr_max_stt += 1
            ve.bac_si_id = bs_thay.id
            ve.so_thu_tu_kham = curr_max_stt
            ve.ghi_chu_dieu_phoi = f"Điều phối từ BS {ten_goc} sang BS {ten_moi} do nghỉ đột xuất"
            if ve.lich_kham_id:
                stmt_lk_item = select(LichKham).where(LichKham.id == ve.lich_kham_id)
                lk_item = (await db.execute(stmt_lk_item)).scalar_one_or_none()
                if lk_item:
                    lk_item.bac_si_id = bs_thay.id
            count_cho += 1

        # 9. Xử lý ca DANG_KHAM (Bàn giao tiếp quản)
        stmt_dang_kham = (
            select(HangDoiKham)
            .where(
                HangDoiKham.bac_si_id == shift_goc.bac_si_id,
                HangDoiKham.ngay_kham == shift_goc.ngay_lam_viec,
                HangDoiKham.ca_kham == shift_goc.ca_lam_viec,
                HangDoiKham.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value,
            )
            .with_for_update()
        )
        dang_kham_list = (await db.execute(stmt_dang_kham)).scalars().all()
        count_dang = 0
        for ve_dang in dang_kham_list:
            ve_dang.bac_si_id = bs_thay.id
            ve_dang.ghi_chu_dieu_phoi = f"BS {ten_moi} tiếp quản do BS {ten_goc} nghỉ đột xuất"
            if ve_dang.lich_kham_id:
                stmt_lk = select(LichKham).where(LichKham.id == ve_dang.lich_kham_id)
                lk = (await db.execute(stmt_lk)).scalar_one_or_none()
                if lk:
                    lk.bac_si_id = bs_thay.id

                stmt_luot = select(LuotKham).where(LuotKham.lich_kham_id == ve_dang.lich_kham_id)
                luot = (await db.execute(stmt_luot)).scalar_one_or_none()
                if luot:
                    luot.tiep_quan_boi_id = bs_thay.id
                    luot.ly_do_tiep_quan = f"Bàn giao ca do BS {ten_goc} nghỉ đột xuất"
            count_dang += 1

        # 10. Chuyển các lịch hẹn chưa check-in trong ca sang BS thay thế
        stmt_lich_chua_den = (
            select(LichKham)
            .where(
                LichKham.bac_si_id == shift_goc.bac_si_id,
                LichKham.ngay_kham == shift_goc.ngay_lam_viec,
                LichKham.gio_kham >= shift_goc.gio_bat_dau,
                LichKham.gio_kham < shift_goc.gio_ket_thuc,
                LichKham.trang_thai.in_([
                    TrangThaiLichEnum.CHO_XAC_NHAN.value,
                    TrangThaiLichEnum.DA_XAC_NHAN.value,
                ]),
            )
            .with_for_update()
        )
        lich_chua_den_list = (await db.execute(stmt_lich_chua_den)).scalars().all()
        count_lich = 0
        for lk_cd in lich_chua_den_list:
            lk_cd.bac_si_id = bs_thay.id
            count_lich += 1

        await db.commit()

        logger.info(
            f"✅ [QUEUE REASSIGNED] Shift: {shift_id} | Chuyển từ BS {shift_goc.bac_si_id} sang BS {bs_thay.id} | "
            f"Vé chờ: {count_cho}, Đang khám: {count_dang}, Lịch hẹn: {count_lich}"
        )

        return ReassignQueueResponse(
            lich_lam_viec_id=shift_id,
            bac_si_goc_id=shift_goc.bac_si_id,
            ten_bac_si_goc=ten_goc,
            bac_si_thay_the_id=bs_thay.id,
            ten_bac_si_thay_the=ten_moi,
            so_ve_cho_kham_da_chuyen=count_cho,
            so_ve_dang_kham_ban_giao=count_dang,
            so_lich_chua_checkin_da_chuyen=count_lich,
            ghi_chu=f"Đã điều phối thành công sang Bác sĩ {ten_moi}",
        )

    async def postpone_and_cancel_unassigned(
        self, shift_id: int, admin_user: TaiKhoan, db: AsyncSession
    ) -> PostponeAndCancelResponse:
        """Tạm hoãn hàng đợi và hủy lịch không có người thay thế (Bảo vệ quyền lợi bệnh nhân No-fault)"""
        stmt = (
            select(LichLamViec)
            .where(LichLamViec.id == shift_id)
            .with_for_update()
        )
        shift = (await db.execute(stmt)).scalar_one_or_none()
        if not shift:
            raise NotFoundException(f"Không tìm thấy ca làm việc với ID {shift_id}!")

        if shift.is_active:
            raise ConflictException("Ca làm việc này chưa được khai báo nghỉ đột xuất!")

        # 1. Tạm hoãn các vé CHO_KHAM trong hàng đợi
        stmt_ve_cho = (
            select(HangDoiKham)
            .where(
                HangDoiKham.bac_si_id == shift.bac_si_id,
                HangDoiKham.ngay_kham == shift.ngay_lam_viec,
                HangDoiKham.ca_kham == shift.ca_lam_viec,
                HangDoiKham.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value,
            )
            .with_for_update()
        )
        ve_cho_list = (await db.execute(stmt_ve_cho)).scalars().all()
        count_hoan = 0
        for ve in ve_cho_list:
            ve.trang_thai = TrangThaiHangDoiEnum.TAM_HOAN.value
            ve.ghi_chu_dieu_phoi = "Tạm hoãn do Bác sĩ nghỉ đột xuất không có người trực thay thế"
            count_hoan += 1

        # 2. Hủy các lịch hẹn chưa đến (No-fault policy: bảo toàn điểm tín nhiệm)
        stmt_lich = (
            select(LichKham)
            .where(
                LichKham.bac_si_id == shift.bac_si_id,
                LichKham.ngay_kham == shift.ngay_lam_viec,
                LichKham.gio_kham >= shift.gio_bat_dau,
                LichKham.gio_kham < shift.gio_ket_thuc,
                LichKham.trang_thai.in_([
                    TrangThaiLichEnum.CHO_XAC_NHAN.value,
                    TrangThaiLichEnum.DA_XAC_NHAN.value,
                ]),
            )
            .with_for_update()
        )
        lich_list = (await db.execute(stmt_lich)).scalars().all()
        count_huy = 0
        for lk in lich_list:
            lk.trang_thai = TrangThaiLichEnum.TU_DONG_HUY.value
            lk.ghi_chu = "Phòng khám hủy do Bác sĩ nghỉ đột xuất (Bảo lưu điểm tín nhiệm)"
            count_huy += 1

        await db.commit()

        logger.warning(
            f"⚠️ [QUEUE POSTPONED & CANCELLED] Shift: {shift_id} | Vé tạm hoãn: {count_hoan} | Lịch hủy: {count_huy}"
        )

        return PostponeAndCancelResponse(
            lich_lam_viec_id=shift_id,
            bac_si_id=shift.bac_si_id,
            so_ve_tam_hoan=count_hoan,
            so_lich_da_huy=count_huy,
            ghi_chu="Đã tạm hoãn hàng đợi và hủy lịch hẹn an toàn (No-fault cancellation)",
        )




    # GÓI 2: QUẢN LÝ LỊCH ĐỊNH KỲ TUẦN CỦA BÁC SĨ (Bahmni Weekly Roster)
    # =========================================================================
    DAY_NAME_VN = {
        2: "Thứ 2",
        3: "Thứ 3",
        4: "Thứ 4",
        5: "Thứ 5",
        6: "Thứ 6",
        7: "Thứ 7",
        8: "Chủ Nhật"
    }

    async def get_roster_templates_admin(self, db: AsyncSession, doctor_id: Optional[int] = None) -> List[RosterTemplateResponse]:
        """Lấy danh sách khuôn mẫu lịch tuần định kỳ"""
        stmt = (
            select(LichDinhKyBacSi)
            .options(
                selectinload(LichDinhKyBacSi.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichDinhKyBacSi.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(LichDinhKyBacSi.phong_kham)
            )
            .order_by(LichDinhKyBacSi.thu_trong_tuan.asc(), LichDinhKyBacSi.ca_lam_viec.asc())
        )
        if doctor_id:
            stmt = stmt.where(LichDinhKyBacSi.bac_si_id == doctor_id)
        rows = (await db.execute(stmt)).scalars().all()
        results = []
        for r in rows:
            results.append(RosterTemplateResponse(
                id=r.id,
                bac_si_id=r.bac_si_id,
                ten_bac_si=r.bac_si.nguoi_dung.ho_ten if r.bac_si and r.bac_si.nguoi_dung else "BS",
                chuyen_khoa=r.bac_si.chuyen_khoa.ten_chuyen_khoa if r.bac_si and r.bac_si.chuyen_khoa else "Đa khoa",
                thu_trong_tuan=r.thu_trong_tuan,
                ten_thu_tieng_viet=self.DAY_NAME_VN.get(r.thu_trong_tuan, f"Thứ {r.thu_trong_tuan}"),
                ca_lam_viec=r.ca_lam_viec,
                gio_bat_dau=r.gio_bat_dau,
                gio_ket_thuc=r.gio_ket_thuc,
                phong_kham_id=r.phong_kham_id,
                ten_phong_kham=f"{r.phong_kham.ma_phong} - {r.phong_kham.ten_phong}" if r.phong_kham else None,
                thoi_luong_slot_phut=r.thoi_luong_slot_phut,
                gioi_han_ca_kham=r.gioi_han_ca_kham,
                han_muc_dat_truoc=r.han_muc_dat_truoc,
                han_muc_vang_lai=r.han_muc_vang_lai,
                is_active=r.is_active
            ))
        return results

    async def create_roster_template_admin(self, payload: RosterTemplateCreateRequest, db: AsyncSession) -> RosterTemplateResponse:
        """Tạo mới mẫu phân ca tuần cho bác sĩ"""
        doc = await db.get(BacSi, payload.bac_si_id)
        if not doc:
            raise NotFoundException(f"Không tìm thấy bác sĩ có ID {payload.bac_si_id}")

        existing = (await db.execute(
            select(LichDinhKyBacSi).where(
                LichDinhKyBacSi.bac_si_id == payload.bac_si_id,
                LichDinhKyBacSi.thu_trong_tuan == payload.thu_trong_tuan,
                LichDinhKyBacSi.ca_lam_viec == payload.ca_lam_viec
            )
        )).scalar_one_or_none()
        if existing:
            raise ConflictException(f"Bác sĩ đã có mẫu ca {payload.ca_lam_viec} vào {self.DAY_NAME_VN.get(payload.thu_trong_tuan)}!")

        gio_bd = payload.gio_bat_dau or (time(7, 30) if payload.ca_lam_viec == "sang" else time(13, 30))
        gio_kt = payload.gio_ket_thuc or (time(11, 30) if payload.ca_lam_viec == "sang" else time(17, 0))

        tmpl = LichDinhKyBacSi(
            bac_si_id=payload.bac_si_id,
            thu_trong_tuan=payload.thu_trong_tuan,
            ca_lam_viec=payload.ca_lam_viec,
            gio_bat_dau=gio_bd,
            gio_ket_thuc=gio_kt,
            phong_kham_id=payload.phong_kham_id or doc.phong_kham_id,
            thoi_luong_slot_phut=payload.thoi_luong_slot_phut,
            gioi_han_ca_kham=payload.gioi_han_ca_kham,
            han_muc_dat_truoc=payload.han_muc_dat_truoc,
            han_muc_vang_lai=payload.han_muc_vang_lai,
            is_active=True
        )
        db.add(tmpl)
        await db.commit()
        await db.refresh(tmpl)
        return (await self.get_roster_templates_admin(db, doctor_id=payload.bac_si_id))[0]

    async def update_roster_template_admin(self, roster_id: int, payload: RosterTemplateUpdateRequest, db: AsyncSession) -> RosterTemplateResponse:
        """Cập nhật mẫu phân ca tuần"""
        tmpl = await db.get(LichDinhKyBacSi, roster_id)
        if not tmpl:
            raise NotFoundException(f"Không tìm thấy mẫu ca ID {roster_id}")
        if payload.phong_kham_id is not None:
            tmpl.phong_kham_id = payload.phong_kham_id if payload.phong_kham_id > 0 else None
        if payload.thoi_luong_slot_phut is not None:
            tmpl.thoi_luong_slot_phut = payload.thoi_luong_slot_phut
        if payload.gioi_han_ca_kham is not None:
            tmpl.gioi_han_ca_kham = payload.gioi_han_ca_kham
        if payload.han_muc_dat_truoc is not None:
            tmpl.han_muc_dat_truoc = payload.han_muc_dat_truoc
        if payload.han_muc_vang_lai is not None:
            tmpl.han_muc_vang_lai = payload.han_muc_vang_lai
        if payload.is_active is not None:
            tmpl.is_active = payload.is_active
        await db.commit()
        await db.refresh(tmpl)
        res = await self.get_roster_templates_admin(db, doctor_id=tmpl.bac_si_id)
        return [r for r in res if r.id == tmpl.id][0]

    async def delete_roster_template_admin(self, roster_id: int, db: AsyncSession):
        """Xóa mẫu phân ca tuần"""
        tmpl = await db.get(LichDinhKyBacSi, roster_id)
        if not tmpl:
            raise NotFoundException(f"Không tìm thấy mẫu ca ID {roster_id}")
        await db.delete(tmpl)
        await db.commit()

    async def generate_shifts_from_roster(self, payload: RosterBatchGenerateRequest, db: AsyncSession) -> RosterBatchGenerateResponse:
        """Phát sinh ca trực hàng loạt từ các mẫu tuần theo chuẩn Bahmni Batch Generator"""
        from datetime import timedelta
        if payload.den_ngay < payload.tu_ngay:
            raise BadRequestException("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu!")

        stmt = select(LichDinhKyBacSi).where(LichDinhKyBacSi.is_active == True)
        if payload.bac_si_ids:
            stmt = stmt.where(LichDinhKyBacSi.bac_si_id.in_(payload.bac_si_ids))
        templates = (await db.execute(stmt)).scalars().all()
        if not templates:
            return RosterBatchGenerateResponse(
                tu_ngay=payload.tu_ngay,
                den_ngay=payload.den_ngay,
                tong_so_ngay=(payload.den_ngay - payload.tu_ngay).days + 1,
                so_ca_tao_thanh_cong=0,
                so_ca_bo_qua_da_ton_tai=0,
                so_ca_xung_dot_phong=0,
                chi_tiet=["Không có mẫu lịch tuần nào đang hoạt động!"]
            )

        so_tao = 0
        so_da_co = 0
        so_trung_phong = 0
        details = []

        cur = payload.tu_ngay
        total_days = (payload.den_ngay - payload.tu_ngay).days + 1

        while cur <= payload.den_ngay:
            # cur.weekday(): 0 -> Thứ 2 (2), 6 -> CN (8)
            thu_num = cur.weekday() + 2
            matching_tmpls = [t for t in templates if t.thu_trong_tuan == thu_num]

            for t in matching_tmpls:
                # 1. Kiểm tra đã có ca của bác sĩ này vào ngày này & ca này chưa
                shift_exist = (await db.execute(
                    select(LichLamViec).where(
                        LichLamViec.bac_si_id == t.bac_si_id,
                        LichLamViec.ngay_lam_viec == cur,
                        LichLamViec.ca_lam_viec == t.ca_lam_viec
                    )
                )).scalar_one_or_none()
                if shift_exist:
                    so_da_co += 1
                    continue

                # 2. Kiểm tra buồng khám có bị trùng với bác sĩ khác không
                if t.phong_kham_id:
                    room_conflict = (await db.execute(
                        select(LichLamViec).where(
                            LichLamViec.phong_kham_id == t.phong_kham_id,
                            LichLamViec.ngay_lam_viec == cur,
                            LichLamViec.ca_lam_viec == t.ca_lam_viec,
                            LichLamViec.is_active == True
                        )
                    )).scalar_one_or_none()
                    if room_conflict:
                        so_trung_phong += 1
                        details.append(f"Bỏ qua ca ngày {cur} của BS ID {t.bac_si_id}: Buồng khám ID {t.phong_kham_id} đã có bác sĩ khác trực")
                        continue

                # 3. Tạo mới LichLamViec
                new_shift = LichLamViec(
                    bac_si_id=t.bac_si_id,
                    ngay_lam_viec=cur,
                    ca_lam_viec=t.ca_lam_viec,
                    gio_bat_dau=t.gio_bat_dau,
                    gio_ket_thuc=t.gio_ket_thuc,
                    gioi_han_ca_kham=t.gioi_han_ca_kham,
                    phong_kham_id=t.phong_kham_id,
                    han_muc_dat_truoc=t.han_muc_dat_truoc,
                    han_muc_vang_lai=t.han_muc_vang_lai,
                    is_active=True
                )
                db.add(new_shift)
                so_tao += 1

            cur += timedelta(days=1)

        await db.commit()
        details.append(f"Đã phát sinh thành công {so_tao} ca trực mới, bỏ qua {so_da_co} ca đã tồn tại, tránh {so_trung_phong} xung đột phòng.")
        return RosterBatchGenerateResponse(
            tu_ngay=payload.tu_ngay,
            den_ngay=payload.den_ngay,
            tong_so_ngay=total_days,
            so_ca_tao_thanh_cong=so_tao,
            so_ca_bo_qua_da_ton_tai=so_da_co,
            so_ca_xung_dot_phong=so_trung_phong,
            chi_tiet=details
        )

    # =========================================================================


    # GÓI 3: QUẢN LÝ NGÀY NGHỈ & LỊCH NGHỈ ĐỘT XUẤT CỦA BÁC SĨ (Absence Management)
    # =========================================================================
    async def get_leaves_admin(
        self,
        db: AsyncSession,
        doctor_id: Optional[int] = None,
        trang_thai: Optional[str] = None
    ) -> List[DoctorLeaveResponse]:
        stmt = (
            select(NghiPhepBacSi)
            .options(
                selectinload(NghiPhepBacSi.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(NghiPhepBacSi.bac_si).selectinload(BacSi.chuyen_khoa),
            )
            .order_by(NghiPhepBacSi.created_at.desc())
        )
        if doctor_id:
            stmt = stmt.where(NghiPhepBacSi.bac_si_id == doctor_id)
        if trang_thai:
            stmt = stmt.where(NghiPhepBacSi.trang_thai == trang_thai)
        rows = (await db.execute(stmt)).scalars().all()
        results = []
        for r in rows:
            results.append(DoctorLeaveResponse(
                id=r.id,
                bac_si_id=r.bac_si_id,
                ten_bac_si=r.bac_si.nguoi_dung.ho_ten if r.bac_si and r.bac_si.nguoi_dung else "BS",
                chuyen_khoa=r.bac_si.chuyen_khoa.ten_chuyen_khoa if r.bac_si and r.bac_si.chuyen_khoa else "Đa khoa",
                loai_nghi=r.loai_nghi,
                tu_ngay=r.tu_ngay,
                den_ngay=r.den_ngay,
                ca_lam_viec=r.ca_lam_viec,
                ly_do=r.ly_do,
                trang_thai=r.trang_thai,
                ghi_chu_duyet=r.ghi_chu_duyet,
                so_ca_anh_huong=r.so_ca_anh_huong,
                so_lich_anh_huong=r.so_lich_anh_huong,
                created_at=r.created_at
            ))
        return results

    async def create_leave_admin(self, payload: DoctorLeaveCreateRequest, db: AsyncSession) -> DoctorLeaveResponse:
        """Đăng ký lịch nghỉ phép mới (Planned hoặc Emergency)"""
        doc = await db.get(BacSi, payload.bac_si_id)
        if not doc:
            raise NotFoundException(f"Không tìm thấy bác sĩ ID {payload.bac_si_id}")
        if payload.den_ngay < payload.tu_ngay:
            raise BadRequestException("Ngày kết thúc nghỉ phải lớn hơn hoặc bằng ngày bắt đầu!")

        # Đếm số ca và lịch hẹn bị ảnh hưởng
        shift_stmt = select(LichLamViec.id).where(
            LichLamViec.bac_si_id == payload.bac_si_id,
            LichLamViec.ngay_lam_viec >= payload.tu_ngay,
            LichLamViec.ngay_lam_viec <= payload.den_ngay,
            LichLamViec.is_active == True
        )
        if payload.ca_lam_viec:
            shift_stmt = shift_stmt.where(LichLamViec.ca_lam_viec == payload.ca_lam_viec)
        shift_ids = (await db.execute(shift_stmt)).scalars().all()

        apt_cnt = 0
        if shift_ids:
            apt_cnt = (await db.execute(
                select(func.count(LichKham.id)).where(
                    LichKham.bac_si_id == payload.bac_si_id,
                    LichKham.ngay_kham >= payload.tu_ngay,
                    LichKham.ngay_kham <= payload.den_ngay,
                    LichKham.trang_thai.in_([TrangThaiLichEnum.CHO_XAC_NHAN.value, TrangThaiLichEnum.DA_XAC_NHAN.value, TrangThaiLichEnum.DA_TIEP_NHAN.value])
                )
            )).scalar() or 0

        leave = NghiPhepBacSi(
            bac_si_id=payload.bac_si_id,
            loai_nghi=payload.loai_nghi,
            tu_ngay=payload.tu_ngay,
            den_ngay=payload.den_ngay,
            ca_lam_viec=payload.ca_lam_viec,
            ly_do=payload.ly_do,
            trang_thai=TrangThaiNghiPhepEnum.CHO_DUYET.value if payload.loai_nghi == "NGHI_PHEP" else TrangThaiNghiPhepEnum.DA_DUYET.value,
            so_ca_anh_huong=len(shift_ids),
            so_lich_anh_huong=apt_cnt
        )
        db.add(leave)
        await db.commit()
        await db.refresh(leave)

        # Nếu là nghỉ đột xuất, khóa luôn các ca đó
        if payload.loai_nghi == "NGHI_DOT_XUAT" and shift_ids:
            for s_id in shift_ids:
                s = await db.get(LichLamViec, s_id)
                if s:
                    s.is_active = False
                    s.ghi_chu_nghi = f"Nghỉ đột xuất: {payload.ly_do}"
            await db.commit()

        leaves = await self.get_leaves_admin(db, doctor_id=payload.bac_si_id)
        return [l for l in leaves if l.id == leave.id][0]

    async def approve_leave_admin(
        self,
        leave_id: int,
        payload: DoctorLeaveApproveRequest,
        admin_user: TaiKhoan,
        db: AsyncSession
    ) -> DoctorLeaveResponse:
        """Phê duyệt hoặc từ chối đơn nghỉ phép của bác sĩ"""
        leave = await db.get(NghiPhepBacSi, leave_id)
        if not leave:
            raise NotFoundException(f"Không tìm thấy đơn nghỉ phép ID {leave_id}")

        leave.trang_thai = payload.hanh_dong
        leave.nguoi_duyet_id = admin_user.id
        leave.ghi_chu_duyet = payload.ghi_chu

        if payload.hanh_dong == "DA_DUYET":
            # Khóa tất cả ca làm việc trong khoảng ngày đó
            stmt = select(LichLamViec).where(
                LichLamViec.bac_si_id == leave.bac_si_id,
                LichLamViec.ngay_lam_viec >= leave.tu_ngay,
                LichLamViec.ngay_lam_viec <= leave.den_ngay,
                LichLamViec.is_active == True
            )
            if leave.ca_lam_viec:
                stmt = stmt.where(LichLamViec.ca_lam_viec == leave.ca_lam_viec)
            shifts = (await db.execute(stmt)).scalars().all()
            for s in shifts:
                s.is_active = False
                s.ghi_chu_nghi = f"Nghỉ phép theo kế hoạch: {leave.ly_do}"

        await db.commit()
        await db.refresh(leave)
        leaves = await self.get_leaves_admin(db, doctor_id=leave.bac_si_id)
        return [l for l in leaves if l.id == leave.id][0]

    async def get_leave_affected_bookings(self, leave_id: int, db: AsyncSession) -> List[AffectedBookingItem]:
        """Lấy danh sách các lịch hẹn bị ảnh hưởng để nhân viên hỗ trợ dời lịch cho bệnh nhân"""
        leave = await db.get(NghiPhepBacSi, leave_id)
        if not leave:
            raise NotFoundException(f"Không tìm thấy đơn nghỉ phép ID {leave_id}")

        stmt = (
            select(LichKham)
            .options(
                selectinload(LichKham.benh_nhan).selectinload(BenhNhan.nguoi_dung)
            )
            .where(
                LichKham.bac_si_id == leave.bac_si_id,
                LichKham.ngay_kham >= leave.tu_ngay,
                LichKham.ngay_kham <= leave.den_ngay,
                LichKham.trang_thai.in_([
                    TrangThaiLichEnum.CHO_XAC_NHAN.value,
                    TrangThaiLichEnum.DA_XAC_NHAN.value,
                    TrangThaiLichEnum.DA_TIEP_NHAN.value
                ])
            )
            .order_by(LichKham.ngay_kham.asc(), LichKham.gio_kham.asc())
        )
        rows = (await db.execute(stmt)).scalars().all()
        results = []
        for r in rows:
            results.append(AffectedBookingItem(
                lich_kham_id=r.id,
                ma_lich_kham=r.ma_lich_kham,
                ten_benh_nhan=r.benh_nhan.nguoi_dung.ho_ten if r.benh_nhan and r.benh_nhan.nguoi_dung else "Bệnh nhân",
                so_dien_thoai=r.benh_nhan.nguoi_dung.so_dien_thoai if r.benh_nhan and r.benh_nhan.nguoi_dung else None,
                ngay_kham=r.ngay_kham,
                gio_kham=r.gio_kham,
                trang_thai=r.trang_thai
            ))
        return results

    # =========================================================================


admin_shift_service = AdminShiftService()
