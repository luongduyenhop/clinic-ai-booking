import logging
from datetime import date, datetime
from typing import List, Optional
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictException, NotFoundException
from app.models.user import BenhNhan, NguoiDung
from app.schemas.reception import (
    ReceptionPatientCreateRequest,
    ReceptionPatientUpdateRequest,
    ReceptionPatientResponse,
    ReceptionPatientSearchItem,
)

logger = logging.getLogger(__name__)


class ReceptionService:
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
            if payload.cccd_so:
                nguoi_dung.cccd_so = payload.cccd_so
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
                cccd_so=payload.cccd_so,
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
        if payload.cccd_so is not None:
            u.cccd_so = payload.cccd_so

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


reception_service = ReceptionService()
