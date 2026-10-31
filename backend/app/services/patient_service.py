from typing import List
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.models.medical import ChiDinh, DanhGiaDichVu, DonThuoc, LuotKham
from app.models.user import BacSi, BenhNhan, HoSoNguoiThan, NguoiDung, TaiKhoan, VaiTroEnum
from app.schemas.patient import (
    FamilyMemberCreateRequest,
    FamilyMemberResponse,
    FamilyMemberUpdateRequest,
    PatientDiagnosisResponse,
    PatientVitalSignsResponse,
    PatientMedicalRecordSummaryResponse,
    PatientLabAttachmentResponse,
    PatientLabResultDetailResponse,
    PatientLabResultResponse,
    PatientPrescriptionItemResponse,
    PatientPrescriptionResponse,
    PatientProfileResponse,
    PatientProfileUpdateRequest,
    ServiceFeedbackCreateRequest,
    ServiceFeedbackResponse,
)


class PatientService:
    """Tầng nghiệp vụ chuyên biệt phục vụ Cổng Khách hàng / Bệnh nhân (Patient Portal)"""

    async def _get_current_benh_nhan(self, user: TaiKhoan, db: AsyncSession) -> BenhNhan:
        if user.vai_tro != VaiTroEnum.BENH_NHAN.value:
            raise ForbiddenException("Chỉ bệnh nhân được truy cập hồ sơ cá nhân")
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
                selectinload(LuotKham.danh_sach_chi_dinh).selectinload(ChiDinh.dich_vu),
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
                ngay_kham=enc.thoi_gian_bat_dau.date() if enc.thoi_gian_bat_dau else (enc.created_at.date() if enc.created_at else None),
                thoi_gian_bat_dau=enc.thoi_gian_bat_dau,
                thoi_gian_ket_thuc=enc.thoi_gian_ket_thuc,
                ly_do_vao_kham=enc.ly_do_vao_kham,
                trieu_chung=enc.trieu_chung,
                benh_su=enc.benh_su,
                ket_luan_dieu_tri=enc.ket_luan_dieu_tri,
                bac_si_id=bs.id if bs else None,
                bac_si_ho_ten=bs_name,
                bac_si_hoc_vi=bs.hoc_vi if bs else None,
                chuyen_khoa=dept_name,
                phong_kham="Phòng khám chuyên khoa",
                chan_doan_chinh=main_diag,
                ma_icd10=icd_code,
                sinh_hieu=PatientVitalSignsResponse(
                    mach_lan_phut=enc.mach_lan_phut,
                    nhiet_do_c=float(enc.nhiet_do_c) if enc.nhiet_do_c is not None else None,
                    huyet_ap_tam_thu=enc.huyet_ap_tam_thu,
                    huyet_ap_tam_truong=enc.huyet_ap_tam_truong,
                    nhip_tho_lan_phut=enc.nhip_tho_lan_phut,
                    can_nang_kg=float(enc.can_nang_kg) if enc.can_nang_kg is not None else None,
                    chieu_cao_cm=float(enc.chieu_cao_cm) if enc.chieu_cao_cm is not None else None,
                    spo2=float(enc.spo2) if enc.spo2 is not None else None,
                    bmi=float(enc.bmi) if enc.bmi is not None else None,
                ),
                danh_sach_chan_doan=[
                    PatientDiagnosisResponse(
                        ma_icd10=diagnosis.ma_icd10,
                        ten_benh_chan_doan=diagnosis.ten_benh_chan_doan,
                        loai_chan_doan=diagnosis.loai_chan_doan,
                        ghi_chu_chuyen_mon=diagnosis.ghi_chu_chuyen_mon,
                    )
                    for diagnosis in enc.danh_sach_chan_doan or []
                ],
                loi_dan_bac_si=enc.loi_dan_bac_si,
                ngay_hen_tai_kham=enc.ngay_hen_tai_kham,
                chi_dinh_cls=[{
                    "id": order.id,
                    "ten_dich_vu": order.dich_vu.ten_dich_vu if order.dich_vu else "Dịch vụ",
                    "trang_thai": order.trang_thai,
                    "ngay_tra": order.thoi_gian_tra_ket_qua.isoformat() if order.thoi_gian_tra_ket_qua else None,
                    "ket_luan": order.ket_qua_chi_tiet,
                    "chi_so": order.tri_so_chi_tiet or {},
                    "tep_dinh_kem": list(order.file_dinh_kem_urls or []) + ([order.tep_dinh_kem_url] if order.tep_dinh_kem_url else []),
                } for order in enc.danh_sach_chi_dinh or [] if order.trang_thai == "da_co_ket_qua"],
                don_thuoc_chi_tiet=[{
                    "ma_don": rx.ma_don_thuoc or rx.ma_don_quoc_gia or str(rx.id),
                    "loi_dan": rx.loi_dan_uong_thuoc,
                    "thuoc": [{
                        "ten": item.ten_thuoc, "ham_luong": item.ham_luong,
                        "so_luong": item.so_luong, "don_vi": item.don_vi_tinh,
                        "sang": item.lieu_sang, "trua": item.lieu_trua,
                        "chieu": item.lieu_chieu, "toi": item.lieu_toi,
                        "cach_dung": item.cach_dung, "so_ngay": item.so_ngay_dung,
                    } for item in rx.danh_sach_chi_tiet],
                } for rx in active_rx],
                tong_so_chi_dinh_cls=len(enc.danh_sach_chi_dinh or []),
                co_don_thuoc=has_rx,
                so_loai_thuoc=rx_items_count,
                trang_thai_luot_kham="DA_KHOA_HO_SO" if enc.is_locked else "DANG_KHAM",
            ))

        return results

    async def get_patient_prescriptions(
        self, user: TaiKhoan, db: AsyncSession, page: int = 1, page_size: int = 20
    ) -> tuple[List[PatientPrescriptionResponse], int]:
        """Trả đơn thuốc của chính bệnh nhân đang đăng nhập, chống IDOR."""
        bn = await self._get_current_benh_nhan(user, db)
        filters = (LuotKham.benh_nhan_id == bn.id, DonThuoc.trang_thai != "SUPERSEDED")
        count_stmt = select(func.count()).select_from(DonThuoc).join(LuotKham, DonThuoc.luot_kham_id == LuotKham.id).where(*filters)
        total = (await db.execute(count_stmt)).scalar_one()
        stmt = (
            select(DonThuoc)
            .join(LuotKham, DonThuoc.luot_kham_id == LuotKham.id)
            .where(*filters)
            .options(
                selectinload(DonThuoc.danh_sach_chi_tiet),
                selectinload(DonThuoc.bac_si_ke_don).selectinload(BacSi.nguoi_dung),
                selectinload(DonThuoc.luot_kham).selectinload(LuotKham.danh_sach_chan_doan),
            )
            .order_by(desc(DonThuoc.ngay_ke_don), desc(DonThuoc.id))
            .offset((page - 1) * page_size).limit(page_size)
        )
        prescriptions = (await db.execute(stmt)).scalars().all()
        results = []
        for rx in prescriptions:
            diagnoses = rx.luot_kham.danh_sach_chan_doan or []
            primary = next((d for d in diagnoses if d.loai_chan_doan.lower() == "chinh"), None)
            primary = primary or (diagnoses[0] if diagnoses else None)
            doctor = rx.bac_si_ke_don
            results.append(PatientPrescriptionResponse(
                id=rx.id,
                luot_kham_id=rx.luot_kham_id,
                ma_don_thuoc=rx.ma_don_thuoc or rx.ma_don_quoc_gia or f"DT-{rx.id:06d}",
                ngay_ke_don=rx.ngay_ke_don,
                bac_si_ho_ten=doctor.nguoi_dung.ho_ten if doctor and doctor.nguoi_dung else "Bác sĩ kê đơn",
                chan_doan=primary.ten_benh_chan_doan if primary else "Chưa cập nhật chẩn đoán",
                trang_thai=rx.trang_thai,
                da_ky_so=bool(rx.chu_ky_so and rx.ngay_ky),
                ngay_ky=rx.ngay_ky,
                loi_dan_uong_thuoc=rx.loi_dan_uong_thuoc,
                danh_sach_thuoc=[PatientPrescriptionItemResponse(
                    id=item.id,
                    ten_thuoc=item.ten_thuoc,
                    ham_luong=item.ham_luong,
                    don_vi_tinh=item.don_vi_tinh,
                    so_luong=item.so_luong,
                    lieu_sang=item.lieu_sang or "",
                    lieu_trua=item.lieu_trua or "",
                    lieu_chieu=item.lieu_chieu or "",
                    lieu_toi=item.lieu_toi or "",
                    cach_dung=item.cach_dung,
                    so_ngay_dung=item.so_ngay_dung,
                ) for item in rx.danh_sach_chi_tiet],
            ))
        return results, total

    async def get_patient_lab_results(
        self, user: TaiKhoan, db: AsyncSession, page: int = 1, page_size: int = 20
    ) -> tuple[List[PatientLabResultResponse], int]:
        """Trả kết quả CLS và URL file chất lượng gốc của chính bệnh nhân."""
        bn = await self._get_current_benh_nhan(user, db)
        filters = (LuotKham.benh_nhan_id == bn.id, ChiDinh.trang_thai == "da_co_ket_qua")
        count_stmt = select(func.count()).select_from(ChiDinh).join(LuotKham, ChiDinh.luot_kham_id == LuotKham.id).where(*filters)
        total = (await db.execute(count_stmt)).scalar_one()
        stmt = (
            select(ChiDinh)
            .join(LuotKham, ChiDinh.luot_kham_id == LuotKham.id)
            .where(*filters)
            .options(
                selectinload(ChiDinh.dich_vu),
                selectinload(ChiDinh.ket_qua),
                selectinload(ChiDinh.phieu_ket_qua),
            )
            .order_by(desc(ChiDinh.thoi_gian_tra_ket_qua), desc(ChiDinh.id))
            .offset((page - 1) * page_size).limit(page_size)
        )
        orders = (await db.execute(stmt)).scalars().all()
        results = []
        for order in orders:
            detail_data = order.tri_so_chi_tiet or (order.ket_qua.tri_so_chi_tiet if order.ket_qua else {}) or {}
            details = []
            if isinstance(detail_data, dict):
                for name, value in detail_data.items():
                    if isinstance(value, dict):
                        details.append(PatientLabResultDetailResponse(
                            ten_chi_so=str(name),
                            gia_tri=str(value.get("gia_tri", value.get("value", ""))),
                            khoang_tham_chieu=value.get("khoang_tham_chieu", value.get("reference")),
                        ))
                    else:
                        details.append(PatientLabResultDetailResponse(ten_chi_so=str(name), gia_tri=str(value)))

            urls = list(order.file_dinh_kem_urls or [])
            if order.tep_dinh_kem_url:
                urls.append(order.tep_dinh_kem_url)
            if order.ket_qua:
                urls.extend(order.ket_qua.file_dinh_kem_urls or [])
            if order.phieu_ket_qua:
                urls.extend(order.phieu_ket_qua.tep_dinh_kem_urls or [])
            unique_urls = list(dict.fromkeys(str(url) for url in urls if url))
            attachments = [PatientLabAttachmentResponse(
                url=url,
                ten_tep=url.split("?")[0].rstrip("/").split("/")[-1] or f"ket-qua-{order.id}",
                loai_tep="HINH_ANH" if url.lower().split("?")[0].endswith((".jpg", ".jpeg", ".png", ".webp", ".dicom", ".dcm")) else "TAI_LIEU",
            ) for url in unique_urls]
            service = order.dich_vu
            service_code = service.ma_dich_vu if service else f"CLS-{order.id:06d}"
            service_name = service.ten_dich_vu if service else "Kết quả cận lâm sàng"
            result_text = order.ket_qua_chi_tiet or (order.ket_qua.ket_qua_chi_tiet if order.ket_qua else None)
            result_time = order.thoi_gian_tra_ket_qua or (order.ket_qua.thoi_gian_duyet if order.ket_qua else None) or order.created_at
            results.append(PatientLabResultResponse(
                id=order.id,
                luot_kham_id=order.luot_kham_id,
                ma_dich_vu=service_code,
                ten_dich_vu=service_name,
                ngay_tra_ket_qua=result_time,
                loai_ket_qua="CHAN_DOAN_HINH_ANH" if attachments else "XET_NGHIEM",
                trang_thai=order.trang_thai,
                ket_luan=result_text or "Đã có kết quả",
                phan_loai=order.ket_qua_phan_loai or "BINH_THUONG",
                chi_tiet=details,
                tep_dinh_kem=attachments,
            ))
        return results, total

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
