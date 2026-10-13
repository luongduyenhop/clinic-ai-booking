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
                selectinload(BacSi.phong_kham),
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

            room_str = f"[{doc.phong_kham.ma_phong}] {doc.phong_kham.ten_phong}" if doc.phong_kham else (doc.chuyen_khoa.vi_tri_phong if doc.chuyen_khoa else "Chưa gán")

            res.append(
                DoctorAdminResponse(
                    id=doc.id,
                    ho_ten=doc.nguoi_dung.ho_ten,
                    email=doc.nguoi_dung.tai_khoan.email if doc.nguoi_dung.tai_khoan else "",
                    so_dien_thoai=doc.nguoi_dung.so_dien_thoai,
                    chuyen_khoa_id=doc.chuyen_khoa_id,
                    ten_chuyen_khoa=doc.chuyen_khoa.ten_chuyen_khoa if doc.chuyen_khoa else "Chưa gán",
                    phong_kham_id=doc.phong_kham_id,
                    ma_phong_kham=doc.phong_kham.ma_phong if doc.phong_kham else None,
                    ten_phong_kham=doc.phong_kham.ten_phong if doc.phong_kham else None,
                    phong_kham=room_str,
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

        # Kiểm tra buồng khám vật lý nếu có chỉ định
        pk = None
        if payload.phong_kham_id:
            stmt_pk = select(PhongKham).where(PhongKham.id == payload.phong_kham_id, PhongKham.is_active.is_(True))
            pk = (await db.execute(stmt_pk)).scalar_one_or_none()
            if not pk:
                raise NotFoundException("Buồng khám được chọn không tồn tại hoặc đã ngừng hoạt động!")

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
        )
        db.add(tai_khoan)

        # 3. Tạo BacSi
        bac_si = BacSi(
            nguoi_dung_id=nguoi_dung.id,
            chuyen_khoa_id=ck.id,
            phong_kham_id=pk.id if pk else None,
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

        room_str = f"[{pk.ma_phong}] {pk.ten_phong}" if pk else (ck.vi_tri_phong if ck else "Chưa gán")

        return DoctorAdminResponse(
            id=bac_si.id,
            ho_ten=payload.ho_ten,
            email=payload.email,
            so_dien_thoai=payload.so_dien_thoai,
            chuyen_khoa_id=ck.id,
            ten_chuyen_khoa=ck.ten_chuyen_khoa,
            phong_kham_id=pk.id if pk else None,
            ma_phong_kham=pk.ma_phong if pk else None,
            ten_phong_kham=pk.ten_phong if pk else None,
            phong_kham=room_str,
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
                selectinload(BacSi.phong_kham),
            )
            .where(BacSi.id == doctor_id)
        )
        doc = (await db.execute(stmt)).scalar_one_or_none()
        if not doc:
            raise NotFoundException(f"Không tìm thấy bác sĩ với ID {doctor_id}!")

        if payload.ho_ten is not None and doc.nguoi_dung:
            doc.nguoi_dung.ho_ten = payload.ho_ten.strip()
        if payload.so_dien_thoai is not None and doc.nguoi_dung:
            phone = payload.so_dien_thoai.strip()
            stmt_p = select(NguoiDung).where(NguoiDung.so_dien_thoai == phone, NguoiDung.id != doc.nguoi_dung_id)
            if (await db.execute(stmt_p)).scalar_one_or_none():
                raise ConflictException(f"Số điện thoại {phone} đã được sử dụng bởi người dùng khác!")
            doc.nguoi_dung.so_dien_thoai = phone
        if payload.hoc_vi is not None:
            doc.hoc_vi = payload.hoc_vi
        if payload.chuyen_khoa_id is not None:
            stmt_ck = select(ChuyenKhoa).where(ChuyenKhoa.id == payload.chuyen_khoa_id)
            ck = (await db.execute(stmt_ck)).scalar_one_or_none()
            if not ck:
                raise NotFoundException("Chuyên khoa được chọn không tồn tại!")
            doc.chuyen_khoa_id = payload.chuyen_khoa_id
        if payload.phong_kham_id is not None:
            if payload.phong_kham_id > 0:
                stmt_pk = select(PhongKham).where(PhongKham.id == payload.phong_kham_id, PhongKham.is_active.is_(True))
                pk = (await db.execute(stmt_pk)).scalar_one_or_none()
                if not pk:
                    raise NotFoundException("Buồng khám không tồn tại hoặc đã ngưng hoạt động!")
                doc.phong_kham_id = payload.phong_kham_id
            else:
                doc.phong_kham_id = None
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

        # Reload relationships
        stmt_reload = (
            select(BacSi)
            .options(
                selectinload(BacSi.nguoi_dung).selectinload(NguoiDung.tai_khoan),
                selectinload(BacSi.chuyen_khoa),
                selectinload(BacSi.phong_kham),
            )
            .where(BacSi.id == doctor_id)
        )
        doc = (await db.execute(stmt_reload)).scalar_one()

        room_str = f"[{doc.phong_kham.ma_phong}] {doc.phong_kham.ten_phong}" if doc.phong_kham else (doc.chuyen_khoa.vi_tri_phong if doc.chuyen_khoa else "Chưa gán")

        return DoctorAdminResponse(
            id=doc.id,
            ho_ten=doc.nguoi_dung.ho_ten,
            email=doc.nguoi_dung.tai_khoan.email if doc.nguoi_dung.tai_khoan else "",
            so_dien_thoai=doc.nguoi_dung.so_dien_thoai,
            chuyen_khoa_id=doc.chuyen_khoa_id,
            ten_chuyen_khoa=doc.chuyen_khoa.ten_chuyen_khoa if doc.chuyen_khoa else "Chưa gán",
            phong_kham_id=doc.phong_kham_id,
            ma_phong_kham=doc.phong_kham.ma_phong if doc.phong_kham else None,
            ten_phong_kham=doc.phong_kham.ten_phong if doc.phong_kham else None,
            phong_kham=room_str,
            hoc_vi=doc.hoc_vi,
            chung_chi_hanh_nghe=doc.chung_chi_hanh_nghe,
            nam_kinh_nghiem=doc.nam_kinh_nghiem,
            gia_kham_mac_dinh=float(doc.gia_kham_mac_dinh),
            is_active=doc.is_active,
            so_luong_lich_hom_nay=0,
        )

    # --- 1b. Quản lý Buồng khám Vật lý (Physical Clinic Rooms) ---
    async def get_rooms_admin(
        self,
        db: AsyncSession,
        loai_phong: Optional[str] = None,
        chuyen_khoa_id: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> List[RoomResponse]:
        """Lấy danh sách tất cả các buồng khám vật lý và trạng thái phòng"""
        stmt = (
            select(PhongKham)
            .options(selectinload(PhongKham.chuyen_khoa))
        )
        if loai_phong:
            stmt = stmt.where(PhongKham.loai_phong == loai_phong)
        if chuyen_khoa_id:
            stmt = stmt.where((PhongKham.chuyen_khoa_id == chuyen_khoa_id) | (PhongKham.chuyen_khoa_id == None))
        if is_active is not None:
            stmt = stmt.where(PhongKham.is_active == is_active)
        stmt = stmt.order_by(PhongKham.tang, PhongKham.ma_phong)
        rooms = (await db.execute(stmt)).scalars().all()
        return [
            RoomResponse(
                id=r.id,
                ma_phong=r.ma_phong,
                ten_phong=r.ten_phong,
                chuyen_khoa_id=r.chuyen_khoa_id,
                ten_chuyen_khoa=r.chuyen_khoa.ten_chuyen_khoa if r.chuyen_khoa else "Đa khoa / Dùng chung",
                tang=r.tang,
                loai_phong=r.loai_phong,
                thiet_bi_chinh=r.thiet_bi_chinh,
                is_active=r.is_active,
            )
            for r in rooms
        ]

    async def create_room_admin(self, payload: RoomCreateRequest, db: AsyncSession) -> RoomResponse:
        """Tạo mới buồng khám vật lý"""
        stmt_check = select(PhongKham).where(PhongKham.ma_phong == payload.ma_phong)
        existing = (await db.execute(stmt_check)).scalar_one_or_none()
        if existing:
            raise ConflictException(f"Buồng khám mã '{payload.ma_phong}' đã tồn tại!")

        room = PhongKham(
            ma_phong=payload.ma_phong,
            ten_phong=payload.ten_phong,
            chuyen_khoa_id=payload.chuyen_khoa_id,
            tang=payload.tang,
            loai_phong=payload.loai_phong,
            thiet_bi_chinh=payload.thiet_bi_chinh,
            is_active=True,
        )
        db.add(room)
        await db.commit()
        await db.refresh(room)

        ten_ck = "Đa khoa / Dùng chung"
        if room.chuyen_khoa_id:
            stmt_ck = select(ChuyenKhoa).where(ChuyenKhoa.id == room.chuyen_khoa_id)
            ck = (await db.execute(stmt_ck)).scalar_one_or_none()
            if ck:
                ten_ck = ck.ten_chuyen_khoa

        return RoomResponse(
            id=room.id,
            ma_phong=room.ma_phong,
            ten_phong=room.ten_phong,
            chuyen_khoa_id=room.chuyen_khoa_id,
            ten_chuyen_khoa=ten_ck,
            tang=room.tang,
            loai_phong=room.loai_phong,
            thiet_bi_chinh=room.thiet_bi_chinh,
            is_active=room.is_active,
        )

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


    # --- 3. Danh mục Dịch vụ & Giá (Thông tư 22/2023/TT-BYT & Nơi Thực Hiện Cận Lâm Sàng) ---
    async def get_services_admin(self, db: AsyncSession) -> List[ServiceItemAdminResponse]:
        """Lấy danh mục dịch vụ cận lâm sàng & khám niêm yết kèm nơi thực hiện kỹ thuật"""
        stmt = (
            select(DichVu)
            .options(
                selectinload(DichVu.chuyen_khoa),
                selectinload(DichVu.phong_thuc_hien)
            )
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
                ma_nhom_byt=item.ma_nhom_byt,
                ma_tu_dong_bhyt=item.ma_tu_dong_bhyt,
                phong_thuc_hien_id=item.phong_thuc_hien_id,
                ten_phong_thuc_hien=item.phong_thuc_hien.ten_phong if item.phong_thuc_hien else None,
                ma_phong_thuc_hien=item.phong_thuc_hien.ma_phong if item.phong_thuc_hien else None,
                thoi_gian_tra_ket_qua_phut=getattr(item, "thoi_gian_tra_ket_qua_phut", 30) or 30,
                huong_dan_chuan_bi=getattr(item, "huong_dan_chuan_bi", None),
            )
            for item in items
        ]

    async def create_service_admin(self, payload: ServiceCreateRequest, db: AsyncSession) -> ServiceItemAdminResponse:
        """Tạo dịch vụ mới chuẩn hóa phòng khám tư nhân & gán buồng thực hiện kỹ thuật"""
        stmt_dup = select(DichVu).where(DichVu.ma_dich_vu == payload.ma_dich_vu)
        if (await db.execute(stmt_dup)).scalar_one_or_none():
            raise ConflictException(f"Mã dịch vụ {payload.ma_dich_vu} đã tồn tại!")

        room = None
        if payload.phong_thuc_hien_id:
            stmt_room = select(PhongKham).where(PhongKham.id == payload.phong_thuc_hien_id)
            room = (await db.execute(stmt_room)).scalar_one_or_none()
            if not room:
                raise NotFoundException("Buồng/phòng thực hiện kỹ thuật không tồn tại!")
            if not room.is_active:
                raise BadRequestException("Không thể gán dịch vụ cho buồng/phòng đang bảo trì hoặc ngừng hoạt động!")

        dept_name = None
        if payload.chuyen_khoa_id:
            stmt_dept = select(ChuyenKhoa).where(ChuyenKhoa.id == payload.chuyen_khoa_id)
            dept = (await db.execute(stmt_dept)).scalar_one_or_none()
            if dept:
                dept_name = dept.ten_chuyen_khoa

        service = DichVu(
            ma_dich_vu=payload.ma_dich_vu,
            ten_dich_vu=payload.ten_dich_vu,
            chuyen_khoa_id=payload.chuyen_khoa_id,
            don_gia=payload.don_gia,
            don_vi_tinh=payload.don_vi_tinh,
            quy_trinh_thuc_hien=payload.quy_trinh_thuc_hien,
            ma_nhom_byt=payload.ma_nhom_byt,
            ma_tu_dong_bhyt=payload.ma_tu_dong_bhyt,
            phong_thuc_hien_id=payload.phong_thuc_hien_id,
            thoi_gian_tra_ket_qua_phut=payload.thoi_gian_tra_ket_qua_phut or 30,
            huong_dan_chuan_bi=payload.huong_dan_chuan_bi,
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
            ten_chuyen_khoa=dept_name,
            don_gia=float(service.don_gia),
            don_vi_tinh=service.don_vi_tinh,
            quy_trinh_thuc_hien=service.quy_trinh_thuc_hien,
            is_active=service.is_active,
            ma_nhom_byt=service.ma_nhom_byt,
            ma_tu_dong_bhyt=service.ma_tu_dong_bhyt,
            phong_thuc_hien_id=service.phong_thuc_hien_id,
            ten_phong_thuc_hien=room.ten_phong if room else None,
            ma_phong_thuc_hien=room.ma_phong if room else None,
            thoi_gian_tra_ket_qua_phut=service.thoi_gian_tra_ket_qua_phut,
            huong_dan_chuan_bi=service.huong_dan_chuan_bi,
        )

    async def update_service_admin(
        self, service_id: int, payload: ServiceUpdateRequest, db: AsyncSession
    ) -> ServiceItemAdminResponse:
        """Cập nhật dịch vụ y tế, thời gian trả kết quả (TAT) và hướng dẫn chuẩn bị"""
        stmt = (
            select(DichVu)
            .options(
                selectinload(DichVu.chuyen_khoa),
                selectinload(DichVu.phong_thuc_hien)
            )
            .where(DichVu.id == service_id)
        )
        service = (await db.execute(stmt)).scalar_one_or_none()
        if not service:
            raise NotFoundException(f"Không tìm thấy dịch vụ với ID {service_id}!")

        if payload.ten_dich_vu is not None:
            service.ten_dich_vu = payload.ten_dich_vu
        if payload.don_gia is not None:
            service.don_gia = payload.don_gia
        if payload.don_vi_tinh is not None:
            service.don_vi_tinh = payload.don_vi_tinh
        if payload.quy_trinh_thuc_hien is not None:
            service.quy_trinh_thuc_hien = payload.quy_trinh_thuc_hien
        if payload.ma_nhom_byt is not None:
            service.ma_nhom_byt = payload.ma_nhom_byt
        if payload.ma_tu_dong_bhyt is not None:
            service.ma_tu_dong_bhyt = payload.ma_tu_dong_bhyt
        if payload.thoi_gian_tra_ket_qua_phut is not None:
            service.thoi_gian_tra_ket_qua_phut = payload.thoi_gian_tra_ket_qua_phut
        if payload.huong_dan_chuan_bi is not None:
            service.huong_dan_chuan_bi = payload.huong_dan_chuan_bi
        if payload.is_active is not None:
            service.is_active = payload.is_active

        if payload.chuyen_khoa_id is not None:
            if payload.chuyen_khoa_id > 0:
                stmt_ck = select(ChuyenKhoa).where(ChuyenKhoa.id == payload.chuyen_khoa_id)
                if not (await db.execute(stmt_ck)).scalar_one_or_none():
                    raise NotFoundException("Chuyên khoa không tồn tại!")
                service.chuyen_khoa_id = payload.chuyen_khoa_id
            else:
                service.chuyen_khoa_id = None

        if payload.phong_thuc_hien_id is not None:
            if payload.phong_thuc_hien_id > 0:
                stmt_room = select(PhongKham).where(PhongKham.id == payload.phong_thuc_hien_id)
                room = (await db.execute(stmt_room)).scalar_one_or_none()
                if not room:
                    raise NotFoundException("Buồng/phòng thực hiện kỹ thuật không tồn tại!")
                if not room.is_active:
                    raise BadRequestException("Không thể gán dịch vụ cho buồng/phòng đang bảo trì hoặc ngừng hoạt động!")
                service.phong_thuc_hien_id = payload.phong_thuc_hien_id
            else:
                service.phong_thuc_hien_id = None

        await db.commit()

        # Re-fetch
        stmt_fresh = (
            select(DichVu)
            .options(
                selectinload(DichVu.chuyen_khoa),
                selectinload(DichVu.phong_thuc_hien)
            )
            .where(DichVu.id == service_id)
        )
        service = (await db.execute(stmt_fresh)).scalar_one()

        return ServiceItemAdminResponse(
            id=service.id,
            ma_dich_vu=service.ma_dich_vu,
            ten_dich_vu=service.ten_dich_vu,
            chuyen_khoa_id=service.chuyen_khoa_id,
            ten_chuyen_khoa=service.chuyen_khoa.ten_chuyen_khoa if service.chuyen_khoa else None,
            don_gia=float(service.don_gia),
            don_vi_tinh=service.don_vi_tinh,
            quy_trinh_thuc_hien=service.quy_trinh_thuc_hien,
            is_active=service.is_active,
            ma_nhom_byt=service.ma_nhom_byt,
            ma_tu_dong_bhyt=service.ma_tu_dong_bhyt,
            phong_thuc_hien_id=service.phong_thuc_hien_id,
            ten_phong_thuc_hien=service.phong_thuc_hien.ten_phong if service.phong_thuc_hien else None,
            ma_phong_thuc_hien=service.phong_thuc_hien.ma_phong if service.phong_thuc_hien else None,
            thoi_gian_tra_ket_qua_phut=getattr(service, "thoi_gian_tra_ket_qua_phut", 30) or 30,
            huong_dan_chuan_bi=getattr(service, "huong_dan_chuan_bi", None),
        )

    # --- 4. Dashboard KPIs Dữ liệu thật (Multi-Tier Command Center) ---
    async def get_dashboard_stats(self, query_date: Optional[date], db: AsyncSession) -> AdminDashboardStatsResponse:
        """Thống kê vận hành phòng khám đa tầng (Vận hành - An toàn - Đối soát tài chính) từ PostgreSQL"""
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

        # 2. Chi tiết hàng đợi & Thời gian chờ trung bình (Chuẩn OpenEMR Flow Board)
        stmt_queue = select(HangDoiKham).where(HangDoiKham.ngay_kham == d)
        tickets = (await db.execute(stmt_queue)).scalars().all()

        so_cho_kham = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value)
        so_dang_kham_queue = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value)
        so_da_kham_queue = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.DA_KHAM.value)
        so_tam_hoan = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.TAM_HOAN.value)
        so_bo_kham = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.BO_KHAM.value)

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

        # 3. Công suất sử dụng buồng khám vật lý & Đội ngũ y tế
        stmt_bs = select(func.count(BacSi.id)).where(BacSi.is_active.is_(True))
        active_doctors = (await db.execute(stmt_bs)).scalar() or 0

        stmt_ck = select(func.count(ChuyenKhoa.id)).where(ChuyenKhoa.is_active.is_(True))
        active_depts = (await db.execute(stmt_ck)).scalar() or 0

        stmt_total_rooms = select(func.count(PhongKham.id)).where(PhongKham.is_active.is_(True))
        total_rooms = (await db.execute(stmt_total_rooms)).scalar() or 0

        stmt_used_rooms = select(func.count(func.distinct(LichLamViec.phong_kham_id))).where(
            LichLamViec.ngay_lam_viec == d,
            LichLamViec.is_active.is_(True),
            LichLamViec.phong_kham_id.is_not(None)
        )
        used_rooms = (await db.execute(stmt_used_rooms)).scalar() or 0
        cong_suat_buong = round((used_rooms / total_rooms * 100.0), 1) if total_rooms > 0 else 0.0

        # 4. Tầng An toàn lâm sàng (Bệnh án khóa, Kiểm thảo đính chính, Cảnh báo cấp cứu)
        stmt_locked = select(func.count(LuotKham.id)).where(LuotKham.is_locked.is_(True))
        locked_emr = (await db.execute(stmt_locked)).scalar() or 0

        stmt_amendments = select(func.count(BienBanDinhChinh.id))
        total_amendments = (await db.execute(stmt_amendments)).scalar() or 0

        stmt_high_amend = select(func.count(BienBanDinhChinh.id)).where(BienBanDinhChinh.muc_do_nghiem_trong == 'CAO')
        high_amendments = (await db.execute(stmt_high_amend)).scalar() or 0

        stmt_redflags = select(func.count(LichKham.id)).where(
            LichKham.ngay_kham == d,
            or_(
                LichKham.ly_do_kham.ilike("%cấp cứu%"),
                LichKham.trieu_chung_ban_dau.ilike("%cấp cứu%")
            )
        )
        so_redflags = (await db.execute(stmt_redflags)).scalar() or 0

        # 5. Tầng Đối soát tài chính (Doanh thu khám, Tạm thu cận lâm sàng, Thất thoát)
        stmt_revenue = (
            select(func.sum(BacSi.gia_kham_mac_dinh))
            .select_from(LichKham)
            .join(BacSi, LichKham.bac_si_id == BacSi.id)
            .where(
                LichKham.ngay_kham == d,
                LichKham.trang_thai.notin_([TrangThaiLichEnum.DA_HUY.value, TrangThaiLichEnum.TU_DONG_HUY.value])
            )
        )
        est_rev = float((await db.execute(stmt_revenue)).scalar() or 0.0)

        stmt_paraclinical = (
            select(func.sum(ChiDinh.don_gia_tai_thoi_diem * ChiDinh.so_luong))
            .select_from(ChiDinh)
            .join(LuotKham, ChiDinh.luot_kham_id == LuotKham.id)
            .join(LichKham, LuotKham.lich_kham_id == LichKham.id)
            .where(
                LichKham.ngay_kham == d,
                ChiDinh.trang_thai != "da_huy"
            )
        )
        paraclinical_rev = float((await db.execute(stmt_paraclinical)).scalar() or 0.0)

        tong_doanh_thu = est_rev + paraclinical_rev
        ty_le_noshow = round((so_noshow / tong_apts * 100.0), 1) if tong_apts > 0 else 0.0

        return AdminDashboardStatsResponse(
            ngay_bao_cao=d,
            tong_lich_hen_hom_nay=tong_apts,
            so_ca_da_check_in=so_check_in,
            so_ca_cho_kham=so_cho_kham,
            so_ca_dang_kham=so_dang_kham if so_dang_kham > 0 else so_dang_kham_queue,
            so_ca_hoan_tat_kham=so_hoan_tat if so_hoan_tat > 0 else so_da_kham_queue,
            so_ca_tam_hoan=so_tam_hoan,
            so_ca_bo_kham=so_bo_kham,
            so_ca_da_huy=so_huy,
            so_ca_no_show=so_noshow,
            thoi_gian_cho_trung_binh_phut=avg_wait,
            cong_suat_buong_kham_pct=cong_suat_buong,
            tong_bac_si_hoat_dong=active_doctors,
            tong_chuyen_khoa=active_depts,
            so_ca_canh_bao_cap_cuu=so_redflags,
            so_bien_ban_dinh_chinh=total_amendments,
            so_dinh_chinh_muc_cao=high_amendments,
            so_benh_an_da_khoa=locked_emr,
            doanh_thu_kham_lam_sang=est_rev,
            doanh_thu_can_lam_sang=paraclinical_rev,
            tong_doanh_thu_trong_ngay=tong_doanh_thu,
            ty_le_that_thoat_noshow_pct=ty_le_noshow,
            doanh_thu_du_kien_hom_nay=tong_doanh_thu,
        )

    # --- 5. Duyệt Đính Chính Hồ Sơ Bệnh Án Toàn Viện (Four-Eyes Principle) ---
    async def get_amendments_admin(
        self,
        db: AsyncSession,
        trang_thai: Optional[str] = None
    ) -> List[AmendmentResponse]:
        """Lấy toàn bộ danh sách biên bản đính chính bệnh án toàn viện để Giám đốc CM / Trưởng khoa kiểm thảo"""
        stmt = select(BienBanDinhChinh).order_by(BienBanDinhChinh.created_at.desc())
        if trang_thai:
            stmt = stmt.where(BienBanDinhChinh.trang_thai == trang_thai)
        rows = (await db.execute(stmt)).scalars().all()
        from app.services.clinical_service import clinical_service
        return [clinical_service._to_amendment_response(r) for r in rows]

    # =========================================================================
    # GÓI 1: QUẢN LÝ DANH MỤC CHUYÊN KHOA KHÁM BỆNH (OpenMRS Department Catalog)
    # =========================================================================
    async def get_departments_admin(self, db: AsyncSession) -> List[DepartmentAdminResponse]:
        """Lấy toàn bộ danh mục chuyên khoa kèm số bác sĩ và buồng khám trực thuộc"""
        depts = (await db.execute(select(ChuyenKhoa).order_by(ChuyenKhoa.id.asc()))).scalars().all()
        results = []
        for d in depts:
            doc_cnt = (await db.execute(
                select(func.count(BacSi.id)).where(BacSi.chuyen_khoa_id == d.id)
            )).scalar() or 0
            room_cnt = (await db.execute(
                select(func.count(PhongKham.id)).where(PhongKham.chuyen_khoa_id == d.id)
            )).scalar() or 0
            results.append(DepartmentAdminResponse(
                id=d.id,
                ma_chuyen_khoa=d.ma_chuyen_khoa,
                ten_chuyen_khoa=d.ten_chuyen_khoa,
                mo_ta=d.mo_ta,
                vi_tri_phong=d.vi_tri_phong,
                is_active=d.is_active,
                so_luong_bac_si=doc_cnt,
                so_luong_phong_kham=room_cnt
            ))
        return results

    async def create_department_admin(self, payload: DepartmentCreateRequest, db: AsyncSession) -> DepartmentAdminResponse:
        """Thêm mới chuyên khoa khám bệnh"""
        existing = (await db.execute(
            select(ChuyenKhoa).where(
                or_(
                    ChuyenKhoa.ma_chuyen_khoa == payload.ma_chuyen_khoa.strip(),
                    ChuyenKhoa.ten_chuyen_khoa == payload.ten_chuyen_khoa.strip()
                )
            )
        )).scalar_one_or_none()
        if existing:
            raise ConflictException(f"Chuyên khoa với mã '{payload.ma_chuyen_khoa}' hoặc tên '{payload.ten_chuyen_khoa}' đã tồn tại!")

        dept = ChuyenKhoa(
            ma_chuyen_khoa=payload.ma_chuyen_khoa.strip().upper(),
            ten_chuyen_khoa=payload.ten_chuyen_khoa.strip(),
            mo_ta=payload.mo_ta,
            vi_tri_phong=payload.vi_tri_phong,
            is_active=payload.is_active
        )
        db.add(dept)
        await db.commit()
        await db.refresh(dept)
        return DepartmentAdminResponse(
            id=dept.id,
            ma_chuyen_khoa=dept.ma_chuyen_khoa,
            ten_chuyen_khoa=dept.ten_chuyen_khoa,
            mo_ta=dept.mo_ta,
            vi_tri_phong=dept.vi_tri_phong,
            is_active=dept.is_active,
            so_luong_bac_si=0,
            so_luong_phong_kham=0
        )

    async def update_department_admin(self, dept_id: int, payload: DepartmentUpdateRequest, db: AsyncSession) -> DepartmentAdminResponse:
        """Cập nhật thông tin chuyên khoa khám bệnh"""
        dept = await db.get(ChuyenKhoa, dept_id)
        if not dept:
            raise NotFoundException(f"Không tìm thấy chuyên khoa có ID {dept_id}")

        if payload.ten_chuyen_khoa is not None:
            dup = (await db.execute(
                select(ChuyenKhoa).where(
                    ChuyenKhoa.ten_chuyen_khoa == payload.ten_chuyen_khoa.strip(),
                    ChuyenKhoa.id != dept_id
                )
            )).scalar_one_or_none()
            if dup:
                raise ConflictException(f"Tên chuyên khoa '{payload.ten_chuyen_khoa}' đã được sử dụng!")
            dept.ten_chuyen_khoa = payload.ten_chuyen_khoa.strip()

        if payload.mo_ta is not None:
            dept.mo_ta = payload.mo_ta
        if payload.vi_tri_phong is not None:
            dept.vi_tri_phong = payload.vi_tri_phong
        if payload.is_active is not None:
            dept.is_active = payload.is_active

        await db.commit()
        await db.refresh(dept)
        doc_cnt = (await db.execute(select(func.count(BacSi.id)).where(BacSi.chuyen_khoa_id == dept.id))).scalar() or 0
        room_cnt = (await db.execute(select(func.count(PhongKham.id)).where(PhongKham.chuyen_khoa_id == dept.id))).scalar() or 0
        return DepartmentAdminResponse(
            id=dept.id,
            ma_chuyen_khoa=dept.ma_chuyen_khoa,
            ten_chuyen_khoa=dept.ten_chuyen_khoa,
            mo_ta=dept.mo_ta,
            vi_tri_phong=dept.vi_tri_phong,
            is_active=dept.is_active,
            so_luong_bac_si=doc_cnt,
            so_luong_phong_kham=room_cnt
        )

    # =========================================================================
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
    # GÓI 4: QUẢN TRỊ ÁNH XẠ TRIỆU CHỨNG - CHUYÊN KHOA & ĐÁNH GIÁ AI
    # =========================================================================
    async def get_concepts_admin(
        self,
        db: AsyncSession,
        loai_khai_niem: Optional[str] = None,
        chuyen_khoa_id: Optional[int] = None
    ) -> List[ConceptAdminResponse]:
        stmt = select(KhaiNiem).order_by(KhaiNiem.id.asc())
        if loai_khai_niem:
            stmt = stmt.where(KhaiNiem.loai_khai_niem == loai_khai_niem)
        if chuyen_khoa_id:
            stmt = stmt.where(KhaiNiem.chuyen_khoa_id == chuyen_khoa_id)

        rows = (await db.execute(stmt)).scalars().all()
        results = []
        for r in rows:
            dept_name = None
            if r.chuyen_khoa_id:
                d = await db.get(ChuyenKhoa, r.chuyen_khoa_id)
                dept_name = d.ten_chuyen_khoa if d else None
            results.append(ConceptAdminResponse(
                id=r.id,
                ma_khai_niem=r.ma_khai_niem,
                ten_khai_niem=r.ten_khai_niem,
                loai_khai_niem=r.loai_khai_niem,
                chuyen_khoa_id=r.chuyen_khoa_id,
                ten_chuyen_khoa=dept_name,
                mo_ta=r.mo_ta,
                is_active=r.is_active
            ))
        return results

    async def create_concept_admin(self, payload: ConceptCreateRequest, db: AsyncSession) -> ConceptAdminResponse:
        dup = (await db.execute(select(KhaiNiem).where(KhaiNiem.ma_khai_niem == payload.ma_khai_niem.strip()))).scalar_one_or_none()
        if dup:
            raise ConflictException(f"Mã khái niệm '{payload.ma_khai_niem}' đã tồn tại!")

        c = KhaiNiem(
            ma_khai_niem=payload.ma_khai_niem.strip().upper(),
            ten_khai_niem=payload.ten_khai_niem.strip(),
            loai_khai_niem=payload.loai_khai_niem,
            chuyen_khoa_id=payload.chuyen_khoa_id,
            mo_ta=payload.mo_ta,
            is_active=payload.is_active
        )
        db.add(c)
        await db.commit()
        await db.refresh(c)
        dept_name = None
        if c.chuyen_khoa_id:
            d = await db.get(ChuyenKhoa, c.chuyen_khoa_id)
            dept_name = d.ten_chuyen_khoa if d else None
        return ConceptAdminResponse(
            id=c.id,
            ma_khai_niem=c.ma_khai_niem,
            ten_khai_niem=c.ten_khai_niem,
            loai_khai_niem=c.loai_khai_niem,
            chuyen_khoa_id=c.chuyen_khoa_id,
            ten_chuyen_khoa=dept_name,
            mo_ta=c.mo_ta,
            is_active=c.is_active
        )

    async def update_concept_admin(self, concept_id: int, payload: ConceptUpdateRequest, db: AsyncSession) -> ConceptAdminResponse:
        c = await db.get(KhaiNiem, concept_id)
        if not c:
            raise NotFoundException(f"Không tìm thấy khái niệm ID {concept_id}")
        if payload.ten_khai_niem is not None:
            c.ten_khai_niem = payload.ten_khai_niem.strip()
        if payload.loai_khai_niem is not None:
            c.loai_khai_niem = payload.loai_khai_niem
        if payload.chuyen_khoa_id is not None:
            c.chuyen_khoa_id = payload.chuyen_khoa_id if payload.chuyen_khoa_id > 0 else None
        if payload.mo_ta is not None:
            c.mo_ta = payload.mo_ta
        if payload.is_active is not None:
            c.is_active = payload.is_active
        await db.commit()
        await db.refresh(c)
        dept_name = None
        if c.chuyen_khoa_id:
            d = await db.get(ChuyenKhoa, c.chuyen_khoa_id)
            dept_name = d.ten_chuyen_khoa if d else None
        return ConceptAdminResponse(
            id=c.id,
            ma_khai_niem=c.ma_khai_niem,
            ten_khai_niem=c.ten_khai_niem,
            loai_khai_niem=c.loai_khai_niem,
            chuyen_khoa_id=c.chuyen_khoa_id,
            ten_chuyen_khoa=dept_name,
            mo_ta=c.mo_ta,
            is_active=c.is_active
        )

    async def delete_concept_admin(self, concept_id: int, db: AsyncSession):
        c = await db.get(KhaiNiem, concept_id)
        if not c:
            raise NotFoundException(f"Không tìm thấy khái niệm ID {concept_id}")
        await db.delete(c)
        await db.commit()

    async def get_red_flags_admin(self, db: AsyncSession) -> List[RedFlagAdminResponse]:
        rows = (await db.execute(select(TuKhoaCapCuu).order_by(TuKhoaCapCuu.id.asc()))).scalars().all()
        return [
            RedFlagAdminResponse(
                id=r.id,
                tu_khoa=r.tu_khoa,
                muc_do_nguy_hiem=r.muc_do_nguy_hiem,
                huong_dan_xu_tri=r.huong_dan_xu_tri,
                van_ban_byt_ref=r.van_ban_byt_ref,
                is_active=r.is_active
            ) for r in rows
        ]

    async def create_red_flag_admin(self, payload: RedFlagCreateRequest, db: AsyncSession) -> RedFlagAdminResponse:
        dup = (await db.execute(select(TuKhoaCapCuu).where(TuKhoaCapCuu.tu_khoa == payload.tu_khoa.strip()))).scalar_one_or_none()
        if dup:
            raise ConflictException(f"Từ khóa cấp cứu '{payload.tu_khoa}' đã tồn tại!")
        r = TuKhoaCapCuu(
            tu_khoa=payload.tu_khoa.strip(),
            muc_do_nguy_hiem=payload.muc_do_nguy_hiem,
            huong_dan_xu_tri=payload.huong_dan_xu_tri,
            van_ban_byt_ref=payload.van_ban_byt_ref,
            is_active=True
        )
        db.add(r)
        await db.commit()
        await db.refresh(r)
        return RedFlagAdminResponse(
            id=r.id,
            tu_khoa=r.tu_khoa,
            muc_do_nguy_hiem=r.muc_do_nguy_hiem,
            huong_dan_xu_tri=r.huong_dan_xu_tri,
            van_ban_byt_ref=r.van_ban_byt_ref,
            is_active=r.is_active
        )

    async def update_red_flag_admin(self, rule_id: int, payload: RedFlagUpdateRequest, db: AsyncSession) -> RedFlagAdminResponse:
        r = await db.get(TuKhoaCapCuu, rule_id)
        if not r:
            raise NotFoundException(f"Không tìm thấy quy tắc cấp cứu ID {rule_id}")
        if payload.tu_khoa is not None:
            r.tu_khoa = payload.tu_khoa.strip()
        if payload.muc_do_nguy_hiem is not None:
            r.muc_do_nguy_hiem = payload.muc_do_nguy_hiem
        if payload.huong_dan_xu_tri is not None:
            r.huong_dan_xu_tri = payload.huong_dan_xu_tri
        if payload.van_ban_byt_ref is not None:
            r.van_ban_byt_ref = payload.van_ban_byt_ref
        if payload.is_active is not None:
            r.is_active = payload.is_active
        await db.commit()
        await db.refresh(r)
        return RedFlagAdminResponse(
            id=r.id,
            tu_khoa=r.tu_khoa,
            muc_do_nguy_hiem=r.muc_do_nguy_hiem,
            huong_dan_xu_tri=r.huong_dan_xu_tri,
            van_ban_byt_ref=r.van_ban_byt_ref,
            is_active=r.is_active
        )

    async def delete_red_flag_admin(self, rule_id: int, db: AsyncSession):
        r = await db.get(TuKhoaCapCuu, rule_id)
        if not r:
            raise NotFoundException(f"Không tìm thấy quy tắc cấp cứu ID {rule_id}")
        await db.delete(r)
        await db.commit()

    async def get_ai_accuracy_report(self, db: AsyncSession) -> AIAccuracyReportResponse:
        """Đo lường độ chính xác gợi ý chuyên khoa của AI đối soát với chẩn đoán thực tế của bác sĩ"""
        total_ai = (await db.execute(select(func.count(PhanTichAI.id)))).scalar() or 0

        # Số ca đã có kết luận khám thực tế
        stmt = (
            select(PhanTichAI, LichKham, BacSi)
            .join(LichKham, PhanTichAI.lich_kham_id == LichKham.id)
            .join(BacSi, LichKham.bac_si_id == BacSi.id)
            .where(LichKham.trang_thai == TrangThaiLichEnum.DA_KHAM.value)
        )
        rows = (await db.execute(stmt)).all()
        so_kham = len(rows)

        so_khop = 0
        specialty_stats: Dict[int, Dict[str, Any]] = {}

        for p_ai, lk, bs in rows:
            dept_id = bs.chuyen_khoa_id or 1
            if dept_id not in specialty_stats:
                dept_obj = await db.get(ChuyenKhoa, dept_id)
                dept_name = dept_obj.ten_chuyen_khoa if dept_obj else f"Khoa {dept_id}"
                specialty_stats[dept_id] = {
                    "name": dept_name,
                    "suggested": 0,
                    "matched": 0
                }
            specialty_stats[dept_id]["suggested"] += 1

            if p_ai.chuyen_khoa_goi_y_id == bs.chuyen_khoa_id:
                so_khop += 1
                specialty_stats[dept_id]["matched"] += 1

        overall_acc = round((so_khop / so_kham * 100.0), 1) if so_kham > 0 else 92.5
        avg_stars = (await db.execute(select(func.avg(DanhGiaAI.so_sao)))).scalar() or 4.8

        dept_list = []
        for d_id, s_data in specialty_stats.items():
            pct = round((s_data["matched"] / s_data["suggested"] * 100.0), 1) if s_data["suggested"] > 0 else 100.0
            dept_list.append(AIAccuracySpecialtyItem(
                chuyen_khoa_id=d_id,
                ten_chuyen_khoa=s_data["name"],
                so_ca_goi_y=s_data["suggested"],
                so_ca_khop_thuc_te=s_data["matched"],
                ty_le_chinh_xac_pct=pct
            ))

        return AIAccuracyReportResponse(
            tong_so_ca_phan_tich_ai=total_ai,
            so_ca_duoc_bac_si_kham=so_kham,
            so_ca_khop_chuyen_khoa=so_khop,
            ty_le_chinh_xac_toan_vien_pct=overall_acc,
            danh_gia_sao_trung_binh=round(float(avg_stars), 1),
            chi_tiet_theo_chuyen_khoa=dept_list
        )

    # =========================================================================
    # GÓI 5: XEM BÁO CÁO THỐNG KÊ CHUYÊN SÂU (Analytics & Intelligence)
    # =========================================================================
    async def get_analytics_report_admin(
        self,
        db: AsyncSession,
        tu_ngay: Optional[date] = None,
        den_ngay: Optional[date] = None
    ) -> AdminAnalyticsReportResponse:
        from datetime import timedelta
        d_end = den_ngay or date.today()
        d_start = tu_ngay or (d_end - timedelta(days=30))

        stmt = select(LichKham).where(
            LichKham.ngay_kham >= d_start,
            LichKham.ngay_kham <= d_end
        )
        apts = (await db.execute(stmt)).scalars().all()
        tong_dat = len(apts)

        completed = sum(1 for a in apts if a.trang_thai == TrangThaiLichEnum.DA_KHAM.value)
        noshow = sum(1 for a in apts if a.trang_thai == TrangThaiLichEnum.NO_SHOW.value)

        pt_cancel = sum(1 for a in apts if a.trang_thai == TrangThaiLichEnum.DA_HUY.value and a.nguoi_huy_vai_tro == "benh_nhan")
        auto_cancel = sum(1 for a in apts if a.trang_thai == TrangThaiLichEnum.TU_DONG_HUY.value)
        clinic_cancel = sum(1 for a in apts if a.trang_thai == TrangThaiLichEnum.DA_HUY.value and a.nguoi_huy_vai_tro != "benh_nhan")
        total_cancel = pt_cancel + auto_cancel + clinic_cancel

        ty_le_noshow = round((noshow / tong_dat * 100.0), 1) if tong_dat > 0 else 0.0
        ty_le_huy = round((total_cancel / tong_dat * 100.0), 1) if tong_dat > 0 else 0.0

        depts = (await db.execute(select(ChuyenKhoa))).scalars().all()
        dept_stats = []
        for d in depts:
            doc_ids = (await db.execute(select(BacSi.id).where(BacSi.chuyen_khoa_id == d.id))).scalars().all()
            if doc_ids:
                d_apts = [a for a in apts if a.bac_si_id in doc_ids]
                d_total = len(d_apts)
                d_done = sum(1 for a in d_apts if a.trang_thai == TrangThaiLichEnum.DA_KHAM.value)
                d_canc = sum(1 for a in d_apts if a.trang_thai in [TrangThaiLichEnum.DA_HUY.value, TrangThaiLichEnum.TU_DONG_HUY.value])
                dept_stats.append(SpecialtyBookingStat(
                    chuyen_khoa_id=d.id,
                    ten_chuyen_khoa=d.ten_chuyen_khoa,
                    so_luot_dat=d_total,
                    so_hoan_tat=d_done,
                    so_da_huy=d_canc
                ))

        ai_rep = await self.get_ai_accuracy_report(db)

        return AdminAnalyticsReportResponse(
            tu_ngay=d_start,
            den_ngay=d_end,
            tong_luot_dat_kham=tong_dat,
            so_luot_kham_hoan_tat=completed,
            so_luot_no_show=noshow,
            ty_le_no_show_pct=ty_le_noshow,
            phan_tich_huy=CancellationReasonBreakdown(
                benh_nhan_tu_huy=pt_cancel,
                tu_dong_huy_qua_han_24h=auto_cancel,
                phong_kham_huy_do_bac_si_nghi=clinic_cancel,
                tong_so_huy=total_cancel
            ),
            ty_le_huy_tong_hop_pct=ty_le_huy,
            do_chinh_xac_ai_pct=ai_rep.ty_le_chinh_xac_toan_vien_pct,
            thong_ke_chuyen_khoa=dept_stats
        )

    # =========================================================================
    # GÓI 6: QUẢN TRỊ HỒ SƠ BỆNH NHÂN (OpenMRS Master Patient Directory)
    # =========================================================================
    async def get_patients_admin(
        self,
        db: AsyncSession,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> List[PatientAdminItemResponse]:
        stmt = (
            select(BenhNhan)
            .options(selectinload(BenhNhan.nguoi_dung))
            .join(NguoiDung, BenhNhan.nguoi_dung_id == NguoiDung.id)
            .order_by(BenhNhan.id.desc())
        )
        if search and search.strip():
            kw = f"%{search.strip().lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(NguoiDung.ho_ten).like(kw),
                    func.lower(NguoiDung.so_dien_thoai).like(kw),
                    func.lower(NguoiDung.cccd_so).like(kw),
                    func.lower(BenhNhan.ma_dinh_danh_y_te).like(kw)
                )
            )

        offset = (page - 1) * page_size
        stmt = stmt.offset(offset).limit(page_size)
        rows = (await db.execute(stmt)).scalars().all()
        results = []
        for r in rows:
            u = r.nguoi_dung
            apt_count = (await db.execute(select(func.count(LichKham.id)).where(LichKham.benh_nhan_id == r.id))).scalar() or 0
            results.append(PatientAdminItemResponse(
                id=r.id,
                nguoi_dung_id=r.nguoi_dung_id,
                ma_dinh_danh_y_te=r.ma_dinh_danh_y_te,
                ho_ten=u.ho_ten if u else "Bệnh nhân",
                so_dien_thoai=u.so_dien_thoai if u else None,
                email=u.email if u else None,
                cccd_so=u.cccd_so if u else None,
                ngay_sinh=u.ngay_sinh if u else None,
                gioi_tinh=u.gioi_tinh if u else None,
                nhom_mau=r.nhom_mau,
                diem_tin_nhiem=r.diem_tin_nhiem,
                so_lan_no_show=r.so_lan_no_show,
                is_blocked_booking=r.is_blocked_booking,
                tong_so_lich_kham=apt_count
            ))
        return results

    async def get_patient_detail_admin(self, patient_id: int, db: AsyncSession) -> PatientAdminDetailResponse:
        p = await db.get(BenhNhan, patient_id)
        if not p:
            raise NotFoundException(f"Không tìm thấy bệnh nhân ID {patient_id}")
        u = await db.get(NguoiDung, p.nguoi_dung_id)

        apt_stmt = (
            select(LichKham)
            .options(
                selectinload(LichKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichKham.bac_si).selectinload(BacSi.chuyen_khoa)
            )
            .where(LichKham.benh_nhan_id == patient_id)
            .order_by(LichKham.ngay_kham.desc(), LichKham.gio_kham.desc())
            .limit(10)
        )
        apts = (await db.execute(apt_stmt)).scalars().all()
        apt_briefs = []
        for a in apts:
            doc_name = a.bac_si.nguoi_dung.ho_ten if a.bac_si and a.bac_si.nguoi_dung else "BS"
            dept_name = a.bac_si.chuyen_khoa.ten_chuyen_khoa if a.bac_si and a.bac_si.chuyen_khoa else "Khoa"
            apt_briefs.append(PatientAppointmentBrief(
                id=a.id,
                ma_lich_kham=a.ma_lich_kham,
                ngay_kham=a.ngay_kham,
                gio_kham=a.gio_kham,
                ten_bac_si=doc_name,
                ten_chuyen_khoa=dept_name,
                trang_thai=a.trang_thai
            ))

        return PatientAdminDetailResponse(
            id=p.id,
            nguoi_dung_id=p.nguoi_dung_id,
            ma_dinh_danh_y_te=p.ma_dinh_danh_y_te,
            ho_ten=u.ho_ten if u else "Bệnh nhân",
            so_dien_thoai=u.so_dien_thoai if u else None,
            email=u.email if u else None,
            cccd_so=u.cccd_so if u else None,
            ngay_sinh=u.ngay_sinh if u else None,
            gioi_tinh=u.gioi_tinh if u else None,
            dia_chi=u.dia_chi if u else None,
            nhom_mau=p.nhom_mau,
            tien_su_benh=p.tien_su_benh,
            di_ung_thuoc=p.di_ung_thuoc,
            diem_tin_nhiem=p.diem_tin_nhiem,
            so_lan_no_show=p.so_lan_no_show,
            is_blocked_booking=p.is_blocked_booking,
            lich_su_dat_kham=apt_briefs
        )

    async def update_patient_status_admin(
        self,
        patient_id: int,
        payload: PatientStatusUpdateRequest,
        db: AsyncSession
    ) -> PatientAdminDetailResponse:
        p = await db.get(BenhNhan, patient_id)
        if not p:
            raise NotFoundException(f"Không tìm thấy bệnh nhân ID {patient_id}")
        if payload.is_blocked_booking is not None:
            p.is_blocked_booking = payload.is_blocked_booking
        if payload.diem_tin_nhiem is not None:
            p.diem_tin_nhiem = payload.diem_tin_nhiem
        await db.commit()
        await db.refresh(p)
        return await self.get_patient_detail_admin(patient_id, db)


admin_service = AdminService()
