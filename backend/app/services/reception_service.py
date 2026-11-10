from datetime import date, datetime, timezone
from typing import List, Optional
from sqlalchemy import select, or_, func, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.models.user import BenhNhan, NguoiDung
from app.models.production_models import PatientProduction, EncounterProduction
from app.schemas.reception import (
    ReceptionPatientCreateRequest,
    ReceptionPatientUpdateRequest,
    ReceptionPatientResponse,
    ReceptionPatientSearchItem,
    CccdQrParsedResponse,
    EncounterCreateRequest,
    EncounterResponse,
)


class ReceptionService:
    def parse_vietnam_cccd_qr(self, qr_string: str) -> CccdQrParsedResponse:
        parts = [p.strip() for p in (qr_string or "").split("|")]
        if len(parts) < 6:
            raise BadRequestException("Chuỗi QR CCCD không đúng định dạng chuẩn 7 trường của Bộ Công An")

        cccd_number = parts[0]
        cmnd_number = parts[1] if parts[1] else None
        full_name = parts[2]
        dob_raw = parts[3]
        gender_raw = parts[4]
        address = parts[5]
        issue_raw = parts[6] if len(parts) > 6 else None

        dob = None
        if len(dob_raw) == 8 and dob_raw.isdigit():
            day = int(dob_raw[:2])
            month = int(dob_raw[2:4])
            year = int(dob_raw[4:])
            dob = date(year, month, day)

        issue_date = None
        if issue_raw and len(issue_raw) == 8 and issue_raw.isdigit():
            day = int(issue_raw[:2])
            month = int(issue_raw[2:4])
            year = int(issue_raw[4:])
            issue_date = date(year, month, day)

        gender_norm = "OTHER"
        if gender_raw.lower() in ("nam", "male", "m"):
            gender_norm = "MALE"
        elif gender_raw.lower() in ("nữ", "nu", "female", "f"):
            gender_norm = "FEMALE"

        return CccdQrParsedResponse(
            cccd_number=cccd_number,
            cmnd_number=cmnd_number,
            full_name=full_name,
            date_of_birth=dob,
            gender=gender_norm,
            address=address,
            issue_date=issue_date,
        )

    async def search_patients(
        self,
        db: AsyncSession,
        search: Optional[str] = None,
        page: int = 1,
        page_size: int = 10
    ) -> List[ReceptionPatientSearchItem]:
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
                    func.lower(NguoiDung.so_dien_thoai).like(kw),
                    func.lower(NguoiDung.ho_ten).like(kw),
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
            results.append(ReceptionPatientSearchItem(
                id=r.id,
                nguoi_dung_id=r.nguoi_dung_id,
                ma_dinh_danh_y_te=r.ma_dinh_danh_y_te,
                ho_ten=u.ho_ten if u else "Bệnh nhân",
                so_dien_thoai=u.so_dien_thoai if u else None,
                ngay_sinh=u.ngay_sinh if u else None,
                gioi_tinh=u.gioi_tinh if u else None,
                dia_chi=u.dia_chi if u else None,
                di_ung_thuoc=r.di_ung_thuoc,
                tien_su_benh=r.tien_su_benh,
                cccd_so=u.cccd_so if u else None,
            ))
        return results

    async def get_patient_detail(
        self,
        patient_id: int,
        db: AsyncSession
    ) -> ReceptionPatientResponse:
        p = await db.get(BenhNhan, patient_id)
        if not p:
            raise NotFoundException(f"Không tìm thấy hồ sơ bệnh nhân ID {patient_id}")
        u = await db.get(NguoiDung, p.nguoi_dung_id)

        return ReceptionPatientResponse(
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
        )

    async def create_patient(
        self,
        payload: ReceptionPatientCreateRequest,
        db: AsyncSession
    ) -> ReceptionPatientResponse:
        clean_phone = payload.so_dien_thoai.strip()
        clean_cccd = payload.cccd_so.strip() if payload.cccd_so else None

        if clean_cccd:
            stmt_cccd_nd = select(NguoiDung).where(NguoiDung.cccd_so == clean_cccd)
            existing_cccd_nd = (await db.execute(stmt_cccd_nd)).scalar_one_or_none()
            if existing_cccd_nd:
                raise ConflictException(f"Bệnh nhân với số CCCD {clean_cccd} đã tồn tại trong hệ thống (Invariant PAT-1)")

            stmt_cccd_prod = select(PatientProduction).where(PatientProduction.cccd_number == clean_cccd)
            existing_cccd_prod = (await db.execute(stmt_cccd_prod)).scalar_one_or_none()
            if existing_cccd_prod:
                raise ConflictException(f"Bệnh nhân với số CCCD {clean_cccd} đã tồn tại trong hệ thống (Invariant PAT-1)")

        stmt_nd = select(NguoiDung).where(NguoiDung.so_dien_thoai == clean_phone)
        existing_nd = (await db.execute(stmt_nd)).scalar_one_or_none()

        if existing_nd:
            stmt_bn = select(BenhNhan).where(BenhNhan.nguoi_dung_id == existing_nd.id)
            existing_bn = (await db.execute(stmt_bn)).scalar_one_or_none()
            if existing_bn:
                raise ConflictException(f"Bệnh nhân với số điện thoại {clean_phone} đã tồn tại trong hệ thống (Mã: {existing_bn.ma_dinh_danh_y_te})")
            nguoi_dung = existing_nd
            nguoi_dung.ho_ten = payload.ho_ten.strip()
            if payload.ngay_sinh:
                nguoi_dung.ngay_sinh = payload.ngay_sinh
            elif payload.nam_sinh:
                nguoi_dung.ngay_sinh = date(payload.nam_sinh, 1, 1)
            if payload.gioi_tinh:
                nguoi_dung.gioi_tinh = payload.gioi_tinh
            if payload.dia_chi:
                nguoi_dung.dia_chi = payload.dia_chi
            if clean_cccd:
                nguoi_dung.cccd_so = clean_cccd
        else:
            birth_date = payload.ngay_sinh
            if not birth_date and payload.nam_sinh:
                birth_date = date(payload.nam_sinh, 1, 1)
            nguoi_dung = NguoiDung(
                ho_ten=payload.ho_ten.strip(),
                so_dien_thoai=clean_phone,
                ngay_sinh=birth_date,
                gioi_tinh=payload.gioi_tinh or "Khác",
                dia_chi=payload.dia_chi,
                cccd_so=clean_cccd,
            )
            db.add(nguoi_dung)
            await db.flush()

        ma_y_te = f"BN-{datetime.now().strftime('%Y%m')}-{nguoi_dung.id:04d}"
        benh_nhan = BenhNhan(
            nguoi_dung_id=nguoi_dung.id,
            ma_dinh_danh_y_te=ma_y_te,
            nhom_mau=payload.nhom_mau or "O+",
            di_ung_thuoc=payload.di_ung_thuoc or "Không",
            tien_su_benh=payload.tien_su_benh or "Không",
        )
        db.add(benh_nhan)

        gender_prod = "OTHER"
        if (payload.gioi_tinh or "").lower() in ("nam", "male"):
            gender_prod = "MALE"
        elif (payload.gioi_tinh or "").lower() in ("nữ", "nu", "female"):
            gender_prod = "FEMALE"

        patient_prod = PatientProduction(
            patient_code=ma_y_te,
            cccd_number=clean_cccd,
            full_name=payload.ho_ten.strip(),
            date_of_birth=nguoi_dung.ngay_sinh or date(2000, 1, 1),
            gender=gender_prod,
            phone_number=clean_phone,
            address=payload.dia_chi or "Không rõ",
        )
        db.add(patient_prod)

        await db.commit()
        await db.refresh(benh_nhan)
        await db.refresh(nguoi_dung)

        return await self.get_patient_detail(benh_nhan.id, db)

    async def update_patient(
        self,
        patient_id: int,
        payload: ReceptionPatientUpdateRequest,
        db: AsyncSession
    ) -> ReceptionPatientResponse:
        p = await db.get(BenhNhan, patient_id)
        if not p:
            raise NotFoundException(f"Không tìm thấy hồ sơ bệnh nhân ID {patient_id}")
        u = await db.get(NguoiDung, p.nguoi_dung_id)
        if not u:
            raise NotFoundException("Không tìm thấy thông tin tài khoản người dùng của bệnh nhân")

        if payload.so_dien_thoai and payload.so_dien_thoai.strip():
            clean_phone = payload.so_dien_thoai.strip()
            if clean_phone != u.so_dien_thoai:
                stmt_nd = select(NguoiDung).where(
                    NguoiDung.so_dien_thoai == clean_phone,
                    NguoiDung.id != u.id
                )
                existing_nd = (await db.execute(stmt_nd)).scalar_one_or_none()
                if existing_nd:
                    raise ConflictException(f"Số điện thoại {clean_phone} đã được sử dụng bởi người dùng khác")
                u.so_dien_thoai = clean_phone

        if payload.cccd_so and payload.cccd_so.strip():
            clean_cccd = payload.cccd_so.strip()
            if clean_cccd != u.cccd_so:
                stmt_cccd = select(NguoiDung).where(
                    NguoiDung.cccd_so == clean_cccd,
                    NguoiDung.id != u.id
                )
                existing_cccd = (await db.execute(stmt_cccd)).scalar_one_or_none()
                if existing_cccd:
                    raise ConflictException(f"Số CCCD {clean_cccd} đã thuộc về bệnh nhân khác")
                u.cccd_so = clean_cccd

        if payload.ho_ten and payload.ho_ten.strip():
            u.ho_ten = payload.ho_ten.strip()
        if payload.ngay_sinh:
            u.ngay_sinh = payload.ngay_sinh
        elif payload.nam_sinh:
            u.ngay_sinh = date(payload.nam_sinh, 1, 1)
        if payload.gioi_tinh:
            u.gioi_tinh = payload.gioi_tinh
        if payload.dia_chi is not None:
            u.dia_chi = payload.dia_chi

        if payload.nhom_mau is not None:
            p.nhom_mau = payload.nhom_mau
        if payload.di_ung_thuoc is not None:
            p.di_ung_thuoc = payload.di_ung_thuoc
        if payload.tien_su_benh is not None:
            p.tien_su_benh = payload.tien_su_benh

        await db.commit()
        await db.refresh(p)
        await db.refresh(u)
        return await self.get_patient_detail(p.id, db)

    async def create_encounter(
        self,
        payload: EncounterCreateRequest,
        db: AsyncSession
    ) -> EncounterResponse:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        stmt_max_q = select(func.coalesce(func.max(EncounterProduction.queue_number), 0)).where(
            EncounterProduction.clinic_room_number == payload.clinic_room_number,
            EncounterProduction.created_at >= today_start,
        )
        max_q = (await db.execute(stmt_max_q)).scalar_one()
        next_queue_num = max_q + 1

        encounter_code = f"ENC-{datetime.now().strftime('%Y%m%d')}-{payload.clinic_room_number}-{next_queue_num:03d}"

        encounter = EncounterProduction(
            encounter_code=encounter_code,
            patient_id=payload.patient_id,
            doctor_id=payload.doctor_id,
            appointment_id=payload.appointment_id,
            queue_number=next_queue_num,
            clinic_room_number=payload.clinic_room_number,
            status="WAITING_FOR_EXAMINATION",
            chief_complaint=payload.chief_complaint,
        )
        db.add(encounter)
        await db.commit()
        await db.refresh(encounter)

        return EncounterResponse(
            id=encounter.id,
            encounter_code=encounter.encounter_code,
            patient_id=encounter.patient_id,
            doctor_id=encounter.doctor_id,
            appointment_id=encounter.appointment_id,
            queue_number=encounter.queue_number,
            clinic_room_number=encounter.clinic_room_number,
            status=encounter.status,
            chief_complaint=encounter.chief_complaint,
            created_at=encounter.created_at,
        )


reception_service = ReceptionService()
