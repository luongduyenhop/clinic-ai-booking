from typing import List
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestException, NotFoundException
from app.models.medical import DanhGiaDichVu, DonThuoc, LuotKham
from app.models.user import BacSi, BenhNhan, HoSoNguoiThan, NguoiDung, TaiKhoan
from app.schemas.patient import (
    FamilyMemberCreateRequest,
    FamilyMemberResponse,
    FamilyMemberUpdateRequest,
    PatientMedicalRecordSummaryResponse,
    PatientProfileResponse,
    PatientProfileUpdateRequest,
    ServiceFeedbackCreateRequest,
    ServiceFeedbackResponse,
)


class PatientService:
    """Tầng nghiệp vụ chuyên biệt phục vụ Cổng Khách hàng / Bệnh nhân (Patient Portal)"""

    async def _get_current_benh_nhan(self, user: TaiKhoan, db: AsyncSession) -> BenhNhan:
        stmt = select(BenhNhan).where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
        bn = (await db.execute(stmt)).scalar_one_or_none()
        if not bn:
            raise NotFoundException("Không tìm thấy hồ sơ bệnh nhân liên kết với tài khoản này!")
        return bn

    # ── 1. Quản lý Hồ sơ cá nhân Bệnh nhân ──────────────────────────────
    async def get_patient_profile(self, user: TaiKhoan, db: AsyncSession) -> PatientProfileResponse:
        bn = await self._get_current_benh_nhan(user, db)
        nd = (await db.execute(select(NguoiDung).where(NguoiDung.id == user.nguoi_dung_id))).scalar_one_or_none()

        return PatientProfileResponse(
            id=bn.id,
            ma_dinh_danh_y_te=bn.ma_dinh_danh_y_te,
            ho_ten=nd.ho_ten if nd else "Bệnh nhân",
            so_dien_thoai=nd.so_dien_thoai if nd else None,
            email=user.email,
            ngay_sinh=nd.ngay_sinh if nd else None,
            gioi_tinh=nd.gioi_tinh if nd else None,
            dia_chi=nd.dia_chi if nd else None,
            cccd_so=nd.cccd_so if nd else None,
            nhom_mau=bn.nhom_mau,
            tien_su_benh=bn.tien_su_benh,
            di_ung_thuoc=bn.di_ung_thuoc,
            diem_tin_nhiem=bn.diem_tin_nhiem,
            so_lan_no_show=bn.so_lan_no_show,
            is_blocked_booking=bn.is_blocked_booking,
        )

    async def update_patient_profile(
        self,
        payload: PatientProfileUpdateRequest,
        user: TaiKhoan,
        db: AsyncSession,
    ) -> PatientProfileResponse:
        bn = await self._get_current_benh_nhan(user, db)
        nd = (await db.execute(select(NguoiDung).where(NguoiDung.id == user.nguoi_dung_id))).scalar_one_or_none()

        if nd:
            if payload.ho_ten is not None:
                nd.ho_ten = payload.ho_ten
            if payload.ngay_sinh is not None:
                nd.ngay_sinh = payload.ngay_sinh
            if payload.gioi_tinh is not None:
                nd.gioi_tinh = payload.gioi_tinh
            if payload.dia_chi is not None:
                nd.dia_chi = payload.dia_chi
            if payload.cccd_so is not None:
                nd.cccd_so = payload.cccd_so

        if payload.nhom_mau is not None:
            bn.nhom_mau = payload.nhom_mau
        if payload.tien_su_benh is not None:
            bn.tien_su_benh = payload.tien_su_benh
        if payload.di_ung_thuoc is not None:
            bn.di_ung_thuoc = payload.di_ung_thuoc

        await db.commit()
        await db.refresh(bn)
        return await self.get_patient_profile(user, db)

    # ── 2. Quản lý Hồ sơ người thân (Gia đình) ──────────────────────────
    async def get_family_members(self, user: TaiKhoan, db: AsyncSession) -> List[FamilyMemberResponse]:
        bn = await self._get_current_benh_nhan(user, db)
        stmt = (
            select(HoSoNguoiThan)
            .where(HoSoNguoiThan.benh_nhan_chinh_id == bn.id)
            .order_by(desc(HoSoNguoiThan.created_at))
        )
        members = (await db.execute(stmt)).scalars().all()
        return [FamilyMemberResponse.model_validate(m) for m in members]

    async def create_family_member(
        self,
        payload: FamilyMemberCreateRequest,
        user: TaiKhoan,
        db: AsyncSession,
    ) -> FamilyMemberResponse:
        bn = await self._get_current_benh_nhan(user, db)
        member = HoSoNguoiThan(
            benh_nhan_chinh_id=bn.id,
            ho_ten=payload.ho_ten,
            quan_he=payload.quan_he,
            ngay_sinh=payload.ngay_sinh,
            gioi_tinh=payload.gioi_tinh,
            so_dien_thoai=payload.so_dien_thoai,
            cccd_so=payload.cccd_so,
            tien_su_benh=payload.tien_su_benh,
            di_ung_thuoc=payload.di_ung_thuoc,
            nhom_mau=payload.nhom_mau,
            ghi_chu=payload.ghi_chu,
        )
        db.add(member)
        await db.commit()
        await db.refresh(member)
        return FamilyMemberResponse.model_validate(member)

    async def update_family_member(
        self,
        member_id: int,
        payload: FamilyMemberUpdateRequest,
        user: TaiKhoan,
        db: AsyncSession,
    ) -> FamilyMemberResponse:
        bn = await self._get_current_benh_nhan(user, db)
        stmt = select(HoSoNguoiThan).where(
            HoSoNguoiThan.id == member_id,
            HoSoNguoiThan.benh_nhan_chinh_id == bn.id,
        )
        member = (await db.execute(stmt)).scalar_one_or_none()
        if not member:
            raise NotFoundException("Không tìm thấy hồ sơ người thân hoặc bạn không có quyền sửa!")

        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(member, field, value)

        await db.commit()
        await db.refresh(member)
        return FamilyMemberResponse.model_validate(member)

    async def delete_family_member(
        self,
        member_id: int,
        user: TaiKhoan,
        db: AsyncSession,
    ) -> dict:
        bn = await self._get_current_benh_nhan(user, db)
        stmt = select(HoSoNguoiThan).where(
            HoSoNguoiThan.id == member_id,
            HoSoNguoiThan.benh_nhan_chinh_id == bn.id,
        )
        member = (await db.execute(stmt)).scalar_one_or_none()
        if not member:
            raise NotFoundException("Không tìm thấy hồ sơ người thân cần xóa!")

        await db.delete(member)
        await db.commit()
        return {"deleted": True, "member_id": member_id}

    # ── 3. Sổ khám bệnh điện tử cá nhân (EMR) ──────────────────────────
    async def get_patient_medical_records(
        self,
        user: TaiKhoan,
        db: AsyncSession,
    ) -> List[PatientMedicalRecordSummaryResponse]:
        bn = await self._get_current_benh_nhan(user, db)
        stmt = (
            select(LuotKham)
            .where(LuotKham.benh_nhan_id == bn.id)
            .options(
                selectinload(LuotKham.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LuotKham.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(LuotKham.danh_sach_chan_doan),
                selectinload(LuotKham.danh_sach_chi_dinh),
                selectinload(LuotKham.danh_sach_don_thuoc).selectinload(DonThuoc.danh_sach_chi_tiet),
            )
            .order_by(desc(LuotKham.thoi_gian_bat_dau))
        )
        encounters = (await db.execute(stmt)).scalars().all()

        results = []
        for enc in encounters:
            bs = enc.bac_si
            bs_name = bs.nguoi_dung.ho_ten if bs and bs.nguoi_dung else "Bác sĩ phụ trách"
            dept_name = bs.chuyen_khoa.ten_chuyen_khoa if bs and bs.chuyen_khoa else "Đa khoa"
            
            # Lấy chẩn đoán chính
            main_diag = "Chưa có chẩn đoán"
            icd_code = "N/A"
            for d in enc.danh_sach_chan_doan or []:
                if d.loai_chan_doan == "chinh":
                    main_diag = d.ten_benh_chan_doan
                    icd_code = d.ma_icd10
                    break
            if main_diag == "Chưa có chẩn đoán" and enc.danh_sach_chan_doan:
                main_diag = enc.danh_sach_chan_doan[0].ten_benh_chan_doan
                icd_code = enc.danh_sach_chan_doan[0].ma_icd10

            prescriptions = enc.danh_sach_don_thuoc or []
            active_rx = [rx for rx in prescriptions if rx.trang_thai != "SUPERSEDED"]
            has_rx = len(active_rx) > 0
            rx_items_count = len(active_rx[0].danh_sach_chi_tiet) if has_rx else 0

            results.append(PatientMedicalRecordSummaryResponse(
                luot_kham_id=enc.id,
                ngay_kham=enc.thoi_gian_bat_dau.date() if enc.thoi_gian_bat_dau else enc.ngay_hen_tai_kham,
                bac_si_ho_ten=bs_name,
                chuyen_khoa=dept_name,
                phong_kham="Phòng khám chuyên khoa",
                chan_doan_chinh=main_diag,
                ma_icd10=icd_code,
                loi_dan_bac_si=enc.loi_dan_bac_si,
                ngay_hen_tai_kham=enc.ngay_hen_tai_kham,
                tong_so_chi_dinh_cls=len(enc.danh_sach_chi_dinh or []),
                co_don_thuoc=has_rx,
                so_loai_thuoc=rx_items_count,
                trang_thai_luot_kham="DA_KHOA_HO_SO" if enc.is_locked else "DANG_KHAM",
            ))

        return results

    # ── 4. Khảo sát & Đánh giá dịch vụ sau khám ─────────────────────────
    async def create_service_feedback(
        self,
        payload: ServiceFeedbackCreateRequest,
        user: TaiKhoan,
        db: AsyncSession,
    ) -> ServiceFeedbackResponse:
        bn = await self._get_current_benh_nhan(user, db)
        stmt_enc = select(LuotKham).where(
            LuotKham.id == payload.luot_kham_id,
            LuotKham.benh_nhan_id == bn.id,
        )
        enc = (await db.execute(stmt_enc)).scalar_one_or_none()
        if not enc:
            raise NotFoundException("Không tìm thấy lượt khám tương ứng của bạn để đánh giá!")

        # Kiểm tra xem lượt khám đã được đánh giá chưa
        stmt_dup = select(DanhGiaDichVu).where(DanhGiaDichVu.luot_kham_id == payload.luot_kham_id)
        existing = (await db.execute(stmt_dup)).scalar_one_or_none()
        if existing:
            raise BadRequestException("Lượt khám này đã được bạn gửi đánh giá trước đó!")

        feedback = DanhGiaDichVu(
            luot_kham_id=payload.luot_kham_id,
            benh_nhan_id=bn.id,
            bac_si_id=enc.bac_si_id,
            so_sao_bac_si=payload.so_sao_bac_si,
            so_sao_phong_kham=payload.so_sao_phong_kham,
            tieu_chi_hai_long=payload.tieu_chi_hai_long or {},
            nhan_xet=payload.nhan_xet,
            an_danh=payload.an_danh,
        )
        db.add(feedback)
        await db.commit()
        await db.refresh(feedback)
        return ServiceFeedbackResponse.model_validate(feedback)


patient_service = PatientService()
