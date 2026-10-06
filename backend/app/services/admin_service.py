import logging
from datetime import date, datetime, time, timezone
from typing import List, Optional
from sqlalchemy import func, select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    ForbiddenException,
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
)
from app.models.medical import DichVu, LuotKham
from app.models.user import BacSi, ChuyenKhoa, NguoiDung, TaiKhoan, VaiTroEnum
from app.schemas.admin import (
    DoctorAdminCreateRequest,
    DoctorAdminUpdateRequest,
    DoctorAdminResponse,
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
)

logger = logging.getLogger(__name__)


class AdminService:
    """Nghiệp vụ Quản trị Phòng khám (Admin Portal - Back-Office Management)"""

    # --- 1. Quản lý Bác sĩ ---
    async def get_doctors_admin(self, db: AsyncSession) -> List[DoctorAdminResponse]:
        """Lấy danh sách bác sĩ đầy đủ phục vụ quản trị và phân ca"""
        stmt = (
            select(BacSi)
            .options(
                selectinload(BacSi.nguoi_dung).selectinload(NguoiDung.tai_khoan),
                selectinload(BacSi.chuyen_khoa),
            )
            .order_by(BacSi.id)
        )
        doctors = (await db.execute(stmt)).scalars().all()
        today = date.today()

        res = []
        for doc in doctors:
            # Đếm số lịch khám của bác sĩ trong ngày hôm nay
            stmt_count = select(func.count(LichKham.id)).where(
                LichKham.bac_si_id == doc.id,
                LichKham.ngay_kham == today,
                LichKham.trang_thai.notin_([TrangThaiLichEnum.DA_HUY.value, TrangThaiLichEnum.TU_DONG_HUY.value])
            )
            cnt = (await db.execute(stmt_count)).scalar() or 0

            res.append(
                DoctorAdminResponse(
                    id=doc.id,
                    ho_ten=doc.nguoi_dung.ho_ten,
                    email=doc.nguoi_dung.tai_khoan.email if doc.nguoi_dung.tai_khoan else "",
                    so_dien_thoai=doc.nguoi_dung.so_dien_thoai,
                    chuyen_khoa_id=doc.chuyen_khoa_id,
                    ten_chuyen_khoa=doc.chuyen_khoa.ten_chuyen_khoa if doc.chuyen_khoa else "Chưa gán",
                    phong_kham=doc.chuyen_khoa.vi_tri_phong if doc.chuyen_khoa else "Chưa xếp",
                    hoc_vi=doc.hoc_vi,
                    chung_chi_hanh_nghe=doc.chung_chi_hanh_nghe,
                    nam_kinh_nghiem=doc.nam_kinh_nghiem,
                    gia_kham_mac_dinh=float(doc.gia_kham_mac_dinh),
                    is_active=doc.is_active,
                    so_luong_lich_hom_nay=cnt,
                )
            )
        return res

    async def create_doctor_admin(self, payload: DoctorAdminCreateRequest, db: AsyncSession) -> DoctorAdminResponse:
        """Tạo mới tài khoản và hồ sơ bác sĩ"""
        # Kiểm tra trùng email
        stmt_acc = select(TaiKhoan).where(TaiKhoan.email == payload.email)
        if (await db.execute(stmt_acc)).scalar_one_or_none():
            raise ConflictException(f"Email {payload.email} đã được đăng ký trong hệ thống!")

        # Kiểm tra trùng chứng chỉ hành nghề
        stmt_cchn = select(BacSi).where(BacSi.chung_chi_hanh_nghe == payload.chung_chi_hanh_nghe)
        if (await db.execute(stmt_cchn)).scalar_one_or_none():
            raise ConflictException(f"Chứng chỉ hành nghề {payload.chung_chi_hanh_nghe} đã tồn tại!")

        # Kiểm tra chuyên khoa hợp lệ
        stmt_ck = select(ChuyenKhoa).where(ChuyenKhoa.id == payload.chuyen_khoa_id)
        ck = (await db.execute(stmt_ck)).scalar_one_or_none()
        if not ck:
            raise NotFoundException("Chuyên khoa được chọn không tồn tại!")

        # 1. Tạo NguoiDung
        nguoi_dung = NguoiDung(
            ho_ten=payload.ho_ten,
            so_dien_thoai=payload.so_dien_thoai,
            gioi_tinh="Khác",
        )
        db.add(nguoi_dung)
        await db.flush()

        # 2. Tạo TaiKhoan
        tai_khoan = TaiKhoan(
            nguoi_dung_id=nguoi_dung.id,
            email=payload.email,
            mat_khau_hash=get_password_hash(payload.mat_khau),
            vai_tro=VaiTroEnum.BAC_SI.value,
            is_active=True,
            is_verified=True,
        )
        db.add(tai_khoan)

        # 3. Tạo BacSi
        bac_si = BacSi(
            nguoi_dung_id=nguoi_dung.id,
            chuyen_khoa_id=ck.id,
            hoc_vi=payload.hoc_vi,
            chung_chi_hanh_nghe=payload.chung_chi_hanh_nghe,
            nam_kinh_nghiem=payload.nam_kinh_nghiem,
            gia_kham_mac_dinh=payload.gia_kham_mac_dinh,
            mo_ta_chuyen_sau=payload.mo_ta_chuyen_sau,
            is_active=True,
        )
        db.add(bac_si)
        await db.commit()
        await db.refresh(bac_si)

        return DoctorAdminResponse(
            id=bac_si.id,
            ho_ten=payload.ho_ten,
            email=payload.email,
            so_dien_thoai=payload.so_dien_thoai,
            chuyen_khoa_id=ck.id,
            ten_chuyen_khoa=ck.ten_chuyen_khoa,
            phong_kham=ck.vi_tri_phong,
            hoc_vi=payload.hoc_vi,
            chung_chi_hanh_nghe=payload.chung_chi_hanh_nghe,
            nam_kinh_nghiem=payload.nam_kinh_nghiem,
            gia_kham_mac_dinh=payload.gia_kham_mac_dinh,
            is_active=True,
            so_luong_lich_hom_nay=0,
        )

    async def update_doctor_admin(
        self, doctor_id: int, payload: DoctorAdminUpdateRequest, db: AsyncSession
    ) -> DoctorAdminResponse:
        """Cập nhật thông tin chuyên môn hoặc bật/tắt trạng thái nhận lịch hẹn (Bahmni Provider Availability)"""
        stmt = (
            select(BacSi)
            .options(
                selectinload(BacSi.nguoi_dung).selectinload(NguoiDung.tai_khoan),
                selectinload(BacSi.chuyen_khoa),
            )
            .where(BacSi.id == doctor_id)
        )
        doc = (await db.execute(stmt)).scalar_one_or_none()
        if not doc:
            raise NotFoundException(f"Không tìm thấy bác sĩ với ID {doctor_id}!")

        if payload.hoc_vi is not None:
            doc.hoc_vi = payload.hoc_vi
        if payload.chuyen_khoa_id is not None:
            doc.chuyen_khoa_id = payload.chuyen_khoa_id
        if payload.nam_kinh_nghiem is not None:
            doc.nam_kinh_nghiem = payload.nam_kinh_nghiem
        if payload.gia_kham_mac_dinh is not None:
            doc.gia_kham_mac_dinh = payload.gia_kham_mac_dinh
        if payload.mo_ta_chuyen_sau is not None:
            doc.mo_ta_chuyen_sau = payload.mo_ta_chuyen_sau
        if payload.is_active is not None:
            doc.is_active = payload.is_active

        await db.commit()
        await db.refresh(doc)

        return DoctorAdminResponse(
            id=doc.id,
            ho_ten=doc.nguoi_dung.ho_ten,
            email=doc.nguoi_dung.tai_khoan.email if doc.nguoi_dung.tai_khoan else "",
            so_dien_thoai=doc.nguoi_dung.so_dien_thoai,
            chuyen_khoa_id=doc.chuyen_khoa_id,
            ten_chuyen_khoa=doc.chuyen_khoa.ten_chuyen_khoa if doc.chuyen_khoa else "Chưa gán",
            phong_kham=doc.chuyen_khoa.vi_tri_phong if doc.chuyen_khoa else "Chưa xếp",
            hoc_vi=doc.hoc_vi,
            chung_chi_hanh_nghe=doc.chung_chi_hanh_nghe,
            nam_kinh_nghiem=doc.nam_kinh_nghiem,
            gia_kham_mac_dinh=float(doc.gia_kham_mac_dinh),
            is_active=doc.is_active,
            so_luong_lich_hom_nay=0,
        )

    # --- 2. Phân ca trực & Lịch làm việc (OpenEMR 7 Calendar) ---
    async def get_shifts(
        self, query_date: Optional[date], doctor_id: Optional[int], db: AsyncSession
    ) -> List[ShiftResponse]:
        """Lấy danh sách ca làm việc theo ngày và bác sĩ"""
        stmt = (
            select(LichLamViec)
            .options(
                selectinload(LichLamViec.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichLamViec.bac_si).selectinload(BacSi.chuyen_khoa),
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

            res.append(
                ShiftResponse(
                    id=s.id,
                    bac_si_id=s.bac_si_id,
                    ten_bac_si=s.bac_si.nguoi_dung.ho_ten if s.bac_si and s.bac_si.nguoi_dung else "",
                    chuyen_khoa=s.bac_si.chuyen_khoa.ten_chuyen_khoa if s.bac_si and s.bac_si.chuyen_khoa else "",
                    phong_kham=s.bac_si.chuyen_khoa.vi_tri_phong if s.bac_si and s.bac_si.chuyen_khoa else "",
                    ngay_lam_viec=s.ngay_lam_viec,
                    ca_lam_viec=s.ca_lam_viec,
                    gio_bat_dau=s.gio_bat_dau,
                    gio_ket_thuc=s.gio_ket_thuc,
                    gioi_han_ca_kham=s.gioi_han_ca_kham,
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
        2. Giờ bắt đầu và kết thúc chuẩn theo ca sáng/chiều.
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

        # Kiểm tra trùng ca trực
        stmt_dup = select(LichLamViec).where(
            LichLamViec.bac_si_id == payload.bac_si_id,
            LichLamViec.ngay_lam_viec == payload.ngay_lam_viec,
            LichLamViec.ca_lam_viec == payload.ca_lam_viec,
        )
        if (await db.execute(stmt_dup)).scalar_one_or_none():
            raise ConflictException(
                f"Bác sĩ {doc.nguoi_dung.ho_ten} đã được phân ca {payload.ca_lam_viec} vào ngày {payload.ngay_lam_viec}!"
            )

        # Thiết lập giờ chuẩn nếu không chỉ định
        if payload.ca_lam_viec == CaLamViecEnum.SANG.value:
            s_time = payload.gio_bat_dau or time(7, 30)
            e_time = payload.gio_ket_thuc or time(11, 30)
        else:
            s_time = payload.gio_bat_dau or time(13, 30)
            e_time = payload.gio_ket_thuc or time(17, 0)

        shift = LichLamViec(
            bac_si_id=payload.bac_si_id,
            ngay_lam_viec=payload.ngay_lam_viec,
            ca_lam_viec=payload.ca_lam_viec,
            gio_bat_dau=s_time,
            gio_ket_thuc=e_time,
            gioi_han_ca_kham=payload.gioi_han_ca_kham,
            is_active=True,
        )
        db.add(shift)
        await db.commit()
        await db.refresh(shift)

        return ShiftResponse(
            id=shift.id,
            bac_si_id=doc.id,
            ten_bac_si=doc.nguoi_dung.ho_ten,
            chuyen_khoa=doc.chuyen_khoa.ten_chuyen_khoa if doc.chuyen_khoa else "",
            phong_kham=doc.chuyen_khoa.vi_tri_phong if doc.chuyen_khoa else "",
            ngay_lam_viec=shift.ngay_lam_viec,
            ca_lam_viec=shift.ca_lam_viec,
            gio_bat_dau=shift.gio_bat_dau,
            gio_ket_thuc=shift.gio_ket_thuc,
            gioi_han_ca_kham=shift.gioi_han_ca_kham,
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

        return ShiftResponse(
            id=shift.id,
            bac_si_id=shift.bac_si_id,
            ten_bac_si=shift.bac_si.nguoi_dung.ho_ten if shift.bac_si and shift.bac_si.nguoi_dung else "",
            chuyen_khoa=shift.bac_si.chuyen_khoa.ten_chuyen_khoa if shift.bac_si and shift.bac_si.chuyen_khoa else "",
            phong_kham=shift.bac_si.chuyen_khoa.vi_tri_phong if shift.bac_si and shift.bac_si.chuyen_khoa else "",
            ngay_lam_viec=shift.ngay_lam_viec,
            ca_lam_viec=shift.ca_lam_viec,
            gio_bat_dau=shift.gio_bat_dau,
            gio_ket_thuc=shift.gio_ket_thuc,
            gioi_han_ca_kham=shift.gioi_han_ca_kham,
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


    # --- 3. Danh mục Dịch vụ & Giá ---
    async def get_services_admin(self, db: AsyncSession) -> List[ServiceItemAdminResponse]:
        """Lấy danh mục dịch vụ cận lâm sàng & khám niêm yết"""
        stmt = (
            select(DichVu)
            .options(selectinload(DichVu.chuyen_khoa))
            .order_by(DichVu.id)
        )
        items = (await db.execute(stmt)).scalars().all()
        return [
            ServiceItemAdminResponse(
                id=item.id,
                ma_dich_vu=item.ma_dich_vu,
                ten_dich_vu=item.ten_dich_vu,
                chuyen_khoa_id=item.chuyen_khoa_id,
                ten_chuyen_khoa=item.chuyen_khoa.ten_chuyen_khoa if item.chuyen_khoa else None,
                don_gia=float(item.don_gia),
                don_vi_tinh=item.don_vi_tinh,
                quy_trinh_thuc_hien=item.quy_trinh_thuc_hien,
                is_active=item.is_active,
            )
            for item in items
        ]

    async def create_service_admin(self, payload: ServiceCreateRequest, db: AsyncSession) -> ServiceItemAdminResponse:
        """Tạo dịch vụ mới"""
        stmt_dup = select(DichVu).where(DichVu.ma_dich_vu == payload.ma_dich_vu)
        if (await db.execute(stmt_dup)).scalar_one_or_none():
            raise ConflictException(f"Mã dịch vụ {payload.ma_dich_vu} đã tồn tại!")

        service = DichVu(
            ma_dich_vu=payload.ma_dich_vu,
            ten_dich_vu=payload.ten_dich_vu,
            chuyen_khoa_id=payload.chuyen_khoa_id,
            don_gia=payload.don_gia,
            don_vi_tinh=payload.don_vi_tinh,
            quy_trinh_thuc_hien=payload.quy_trinh_thuc_hien,
            is_active=True,
        )
        db.add(service)
        await db.commit()
        await db.refresh(service)

        return ServiceItemAdminResponse(
            id=service.id,
            ma_dich_vu=service.ma_dich_vu,
            ten_dich_vu=service.ten_dich_vu,
            chuyen_khoa_id=service.chuyen_khoa_id,
            ten_chuyen_khoa=None,
            don_gia=float(service.don_gia),
            don_vi_tinh=service.don_vi_tinh,
            quy_trinh_thuc_hien=service.quy_trinh_thuc_hien,
            is_active=service.is_active,
        )

    # --- 4. Dashboard KPIs Dữ liệu thật ---
    async def get_dashboard_stats(self, query_date: Optional[date], db: AsyncSession) -> AdminDashboardStatsResponse:
        """Thống kê vận hành thực tế từ PostgreSQL"""
        d = query_date or date.today()

        # 1. Thống kê lịch hẹn theo trạng thái
        stmt_apts = select(LichKham).where(LichKham.ngay_kham == d)
        apts = (await db.execute(stmt_apts)).scalars().all()

        tong_apts = len(apts)
        so_check_in = sum(1 for a in apts if a.trang_thai in ("da_tiep_nhan", "dang_kham", "da_kham"))
        so_dang_kham = sum(1 for a in apts if a.trang_thai == "dang_kham")
        so_hoan_tat = sum(1 for a in apts if a.trang_thai == "da_kham")
        so_huy = sum(1 for a in apts if a.trang_thai in ("da_huy", "tu_dong_huy"))
        so_noshow = sum(1 for a in apts if a.trang_thai == "no_show")

        # 2. Tính thời gian chờ trung bình từ HangDoiKham trong ngày
        stmt_queue = select(HangDoiKham).where(HangDoiKham.ngay_kham == d)
        tickets = (await db.execute(stmt_queue)).scalars().all()

        wait_times = []
        for t in tickets:
            if t.thoi_gian_bat_dau and t.thoi_gian_check_in:
                diff = (t.thoi_gian_bat_dau - t.thoi_gian_check_in).total_seconds() / 60.0
                if diff >= 0:
                    wait_times.append(diff)
            elif t.thoi_gian_check_in and t.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value:
                now = datetime.now(timezone.utc)
                cin = t.thoi_gian_check_in.replace(tzinfo=timezone.utc) if t.thoi_gian_check_in.tzinfo is None else t.thoi_gian_check_in
                diff = (now - cin).total_seconds() / 60.0
                if diff >= 0:
                    wait_times.append(diff)

        avg_wait = round(sum(wait_times) / len(wait_times), 1) if wait_times else 0.0

        # 3. Đếm bác sĩ và chuyên khoa hoạt động
        stmt_bs = select(func.count(BacSi.id)).where(BacSi.is_active.is_(True))
        active_doctors = (await db.execute(stmt_bs)).scalar() or 0

        stmt_ck = select(func.count(ChuyenKhoa.id)).where(ChuyenKhoa.is_active.is_(True))
        active_depts = (await db.execute(stmt_ck)).scalar() or 0

        # 4. Dự kiến doanh thu khám trong ngày
        stmt_revenue = (
            select(func.sum(BacSi.gia_kham_mac_dinh))
            .select_from(LichKham)
            .join(BacSi, LichKham.bac_si_id == BacSi.id)
            .where(
                LichKham.ngay_kham == d,
                LichKham.trang_thai.notin_([TrangThaiLichEnum.DA_HUY.value, TrangThaiLichEnum.TU_DONG_HUY.value])
            )
        )
        est_rev = (await db.execute(stmt_revenue)).scalar() or 0.0

        return AdminDashboardStatsResponse(
            ngay_bao_cao=d,
            tong_lich_hen_hom_nay=tong_apts,
            so_ca_da_check_in=so_check_in,
            so_ca_dang_kham=so_dang_kham,
            so_ca_hoan_tat_kham=so_hoan_tat,
            so_ca_da_huy=so_huy,
            so_ca_no_show=so_noshow,
            thoi_gian_cho_trung_binh_phut=avg_wait,
            tong_bac_si_hoat_dong=active_doctors,
            tong_chuyen_khoa=active_depts,
            doanh_thu_du_kien_hom_nay=float(est_rev),
        )


admin_service = AdminService()
