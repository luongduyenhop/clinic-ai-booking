import logging
from datetime import date
from typing import List, Optional
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
)
from app.core.security import get_password_hash
from app.models.appointment import (
    LichKham,
    TrangThaiLichEnum,
)
from app.models.user import BacSi, ChuyenKhoa, NguoiDung, PhongKham, TaiKhoan, VaiTroEnum, BenhNhan
from app.schemas.admin import (
    DoctorAdminCreateRequest,
    DoctorAdminUpdateRequest,
    DoctorAdminResponse,
    PatientAdminItemResponse,
    PatientAdminDetailResponse,
    PatientStatusUpdateRequest,
    PatientAppointmentBrief,
)

logger = logging.getLogger(__name__)


class AdminDoctorService:
    """Dịch vụ chuyên trách Quản trị Bác sĩ và Danh bạ Bệnh nhân (SRP)"""

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


admin_doctor_service = AdminDoctorService()
