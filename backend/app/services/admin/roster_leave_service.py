from datetime import date, time, timedelta
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
)
from app.models.appointment import (
    LichDinhKyBacSi,
    LichKham,
    LichLamViec,
    NghiPhepBacSi,
    TrangThaiLichEnum,
    TrangThaiNghiPhepEnum,
)
from app.models.user import BacSi, BenhNhan, TaiKhoan
from app.schemas.admin import (
    AffectedBookingItem,
    DoctorLeaveApproveRequest,
    DoctorLeaveCreateRequest,
    DoctorLeaveResponse,
    RosterBatchGenerateRequest,
    RosterBatchGenerateResponse,
    RosterTemplateCreateRequest,
    RosterTemplateResponse,
    RosterTemplateUpdateRequest,
)


class RosterLeaveMixin:
    DAY_NAME_VN = {
        2: "Thứ 2",
        3: "Thứ 3",
        4: "Thứ 4",
        5: "Thứ 5",
        6: "Thứ 6",
        7: "Thứ 7",
        8: "Chủ Nhật",
    }

    async def _try_insert_generated_shift(
        self,
        db: AsyncSession,
        *,
        bac_si_id: int,
        target_date: date,
        ca_lam_viec: str,
        gio_bat_dau: time,
        gio_ket_thuc: time,
        gioi_han_ca_kham: int,
        phong_kham_id: Optional[int],
        han_muc_dat_truoc: Optional[int],
        han_muc_vang_lai: Optional[int],
    ) -> Tuple[str, Optional[str]]:
        shift_exist = (
            await db.execute(
                select(LichLamViec).where(
                    LichLamViec.bac_si_id == bac_si_id,
                    LichLamViec.ngay_lam_viec == target_date,
                    LichLamViec.ca_lam_viec == ca_lam_viec,
                )
            )
        ).scalar_one_or_none()
        if shift_exist:
            return "existing", None

        if phong_kham_id:
            room_conflict = (
                await db.execute(
                    select(LichLamViec).where(
                        LichLamViec.phong_kham_id == phong_kham_id,
                        LichLamViec.ngay_lam_viec == target_date,
                        LichLamViec.ca_lam_viec == ca_lam_viec,
                        LichLamViec.is_active.is_(True),
                    )
                )
            ).scalar_one_or_none()
            if room_conflict:
                return (
                    "room_conflict",
                    f"Bỏ qua ca ngày {target_date} của BS ID {bac_si_id}: Buồng khám ID {phong_kham_id} đã có bác sĩ khác trực",
                )

        db.add(
            LichLamViec(
                bac_si_id=bac_si_id,
                ngay_lam_viec=target_date,
                ca_lam_viec=ca_lam_viec,
                gio_bat_dau=gio_bat_dau,
                gio_ket_thuc=gio_ket_thuc,
                gioi_han_ca_kham=gioi_han_ca_kham,
                phong_kham_id=phong_kham_id,
                han_muc_dat_truoc=han_muc_dat_truoc,
                han_muc_vang_lai=han_muc_vang_lai,
                is_active=True,
            )
        )
        return "created", None

    async def _restore_shifts_for_approved_leave(self, leave: NghiPhepBacSi, db: AsyncSession) -> None:
        if leave.trang_thai != TrangThaiNghiPhepEnum.DA_DUYET.value:
            return
        stmt = select(LichLamViec).where(
            LichLamViec.bac_si_id == leave.bac_si_id,
            LichLamViec.ngay_lam_viec >= leave.tu_ngay,
            LichLamViec.ngay_lam_viec <= leave.den_ngay,
            LichLamViec.is_active.is_(False),
        )
        if leave.ca_lam_viec:
            stmt = stmt.where(LichLamViec.ca_lam_viec == leave.ca_lam_viec)
        for s in (await db.execute(stmt)).scalars().all():
            s.is_active = True
            s.ghi_chu_nghi = None

    async def get_roster_templates_admin(
        self, db: AsyncSession, doctor_id: Optional[int] = None
    ) -> List[RosterTemplateResponse]:
        stmt = (
            select(LichDinhKyBacSi)
            .options(
                selectinload(LichDinhKyBacSi.bac_si).selectinload(BacSi.nguoi_dung),
                selectinload(LichDinhKyBacSi.bac_si).selectinload(BacSi.chuyen_khoa),
                selectinload(LichDinhKyBacSi.phong_kham),
            )
            .order_by(LichDinhKyBacSi.thu_trong_tuan.asc(), LichDinhKyBacSi.ca_lam_viec.asc())
        )
        if doctor_id:
            resolved_doc_id = await self._resolve_doctor_id(db, doctor_id)
            stmt = stmt.where(LichDinhKyBacSi.bac_si_id == resolved_doc_id)
        rows = (await db.execute(stmt)).scalars().all()
        return [
            RosterTemplateResponse(
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
                is_active=r.is_active,
            )
            for r in rows
        ]

    async def create_roster_template_admin(
        self, payload: RosterTemplateCreateRequest, db: AsyncSession
    ) -> RosterTemplateResponse:
        doc = await db.get(BacSi, payload.bac_si_id)
        if not doc:
            raise NotFoundException(f"Không tìm thấy bác sĩ có ID {payload.bac_si_id}")
        existing = (
            await db.execute(
                select(LichDinhKyBacSi).where(
                    LichDinhKyBacSi.bac_si_id == payload.bac_si_id,
                    LichDinhKyBacSi.thu_trong_tuan == payload.thu_trong_tuan,
                    LichDinhKyBacSi.ca_lam_viec == payload.ca_lam_viec,
                )
            )
        ).scalar_one_or_none()
        if existing:
            raise ConflictException(
                f"Bác sĩ đã có mẫu ca {payload.ca_lam_viec} vào {self.DAY_NAME_VN.get(payload.thu_trong_tuan)}!"
            )

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
            is_active=True,
        )
        db.add(tmpl)
        await db.commit()
        await db.refresh(tmpl)
        return (await self.get_roster_templates_admin(db, doctor_id=payload.bac_si_id))[0]

    async def update_roster_template_admin(
        self, roster_id: int, payload: RosterTemplateUpdateRequest, db: AsyncSession
    ) -> RosterTemplateResponse:
        tmpl = await db.get(LichDinhKyBacSi, roster_id)
        if not tmpl:
            raise NotFoundException(f"Không tìm thấy mẫu ca ID {roster_id}")
        if payload.phong_kham_id is not None:
            tmpl.phong_kham_id = payload.phong_kham_id if payload.phong_kham_id > 0 else None
        for attr in ("thoi_luong_slot_phut", "gioi_han_ca_kham", "han_muc_dat_truoc", "han_muc_vang_lai", "is_active"):
            if getattr(payload, attr) is not None:
                setattr(tmpl, attr, getattr(payload, attr))
        await db.commit()
        await db.refresh(tmpl)
        res = await self.get_roster_templates_admin(db, doctor_id=tmpl.bac_si_id)
        return [r for r in res if r.id == tmpl.id][0]

    async def delete_roster_template_admin(self, roster_id: int, db: AsyncSession):
        tmpl = await db.get(LichDinhKyBacSi, roster_id)
        if not tmpl:
            raise NotFoundException(f"Không tìm thấy mẫu ca ID {roster_id}")
        await db.delete(tmpl)
        await db.commit()

    async def generate_shifts_from_roster(
        self, payload: RosterBatchGenerateRequest, db: AsyncSession
    ) -> RosterBatchGenerateResponse:
        if payload.den_ngay < payload.tu_ngay:
            raise BadRequestException("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu!")

        total_days = (payload.den_ngay - payload.tu_ngay).days + 1
        so_tao = 0
        so_da_co = 0
        so_trung_phong = 0
        details: List[str] = []

        if payload.template_type in ("COPY_PREVIOUS_WEEK", "INHERIT_WEEK") and payload.nguon_tu_ngay:
            src_start = payload.nguon_tu_ngay
            src_end = payload.nguon_den_ngay or (src_start + timedelta(days=6))
            stmt_src = select(LichLamViec).where(
                LichLamViec.ngay_lam_viec >= src_start,
                LichLamViec.ngay_lam_viec <= src_end,
                LichLamViec.is_active.is_(True),
            )
            if payload.bac_si_ids:
                stmt_src = stmt_src.where(LichLamViec.bac_si_id.in_(payload.bac_si_ids))
            source_shifts = (await db.execute(stmt_src)).scalars().all()
            if not source_shifts:
                return RosterBatchGenerateResponse(
                    tu_ngay=payload.tu_ngay,
                    den_ngay=payload.den_ngay,
                    tong_so_ngay=total_days,
                    so_ca_tao_thanh_cong=0,
                    so_ca_bo_qua_da_ton_tai=0,
                    so_ca_xung_dot_phong=0,
                    chi_tiet=[f"Không tìm thấy ca trực nguồn nào trong khoảng từ {src_start} đến {src_end}!"],
                )
            for s in source_shifts:
                target_date = payload.tu_ngay + timedelta(days=(s.ngay_lam_viec - src_start).days)
                if target_date > payload.den_ngay:
                    continue
                outcome, msg = await self._try_insert_generated_shift(
                    db,
                    bac_si_id=s.bac_si_id,
                    target_date=target_date,
                    ca_lam_viec=s.ca_lam_viec,
                    gio_bat_dau=s.gio_bat_dau,
                    gio_ket_thuc=s.gio_ket_thuc,
                    gioi_han_ca_kham=s.gioi_han_ca_kham,
                    phong_kham_id=s.phong_kham_id,
                    han_muc_dat_truoc=s.han_muc_dat_truoc,
                    han_muc_vang_lai=s.han_muc_vang_lai,
                )
                if outcome == "created":
                    so_tao += 1
                elif outcome == "existing":
                    so_da_co += 1
                else:
                    so_trung_phong += 1
                    if msg:
                        details.append(msg)
            await db.commit()
            details.append(
                f"Đã sao chép/kế thừa thành công {so_tao} ca trực từ tuần nguồn sang tuần đích, bỏ qua {so_da_co} ca đã có, tránh {so_trung_phong} xung đột buồng khám."
            )
            return RosterBatchGenerateResponse(
                tu_ngay=payload.tu_ngay,
                den_ngay=payload.den_ngay,
                tong_so_ngay=total_days,
                so_ca_tao_thanh_cong=so_tao,
                so_ca_bo_qua_da_ton_tai=so_da_co,
                so_ca_xung_dot_phong=so_trung_phong,
                chi_tiet=details,
            )

        stmt = select(LichDinhKyBacSi).where(LichDinhKyBacSi.is_active.is_(True))
        if payload.bac_si_ids:
            stmt = stmt.where(LichDinhKyBacSi.bac_si_id.in_(payload.bac_si_ids))
        templates = (await db.execute(stmt)).scalars().all()
        if not templates:
            return RosterBatchGenerateResponse(
                tu_ngay=payload.tu_ngay,
                den_ngay=payload.den_ngay,
                tong_so_ngay=total_days,
                so_ca_tao_thanh_cong=0,
                so_ca_bo_qua_da_ton_tai=0,
                so_ca_xung_dot_phong=0,
                chi_tiet=["Không có mẫu lịch tuần nào đang hoạt động!"],
            )

        cur = payload.tu_ngay
        while cur <= payload.den_ngay:
            thu_num = cur.weekday() + 2
            for t in (tmpl for tmpl in templates if tmpl.thu_trong_tuan == thu_num):
                outcome, msg = await self._try_insert_generated_shift(
                    db,
                    bac_si_id=t.bac_si_id,
                    target_date=cur,
                    ca_lam_viec=t.ca_lam_viec,
                    gio_bat_dau=t.gio_bat_dau,
                    gio_ket_thuc=t.gio_ket_thuc,
                    gioi_han_ca_kham=t.gioi_han_ca_kham,
                    phong_kham_id=t.phong_kham_id,
                    han_muc_dat_truoc=t.han_muc_dat_truoc,
                    han_muc_vang_lai=t.han_muc_vang_lai,
                )
                if outcome == "created":
                    so_tao += 1
                elif outcome == "existing":
                    so_da_co += 1
                else:
                    so_trung_phong += 1
                    if msg:
                        details.append(msg)
            cur += timedelta(days=1)

        await db.commit()
        details.append(
            f"Đã phát sinh thành công {so_tao} ca trực mới, bỏ qua {so_da_co} ca đã tồn tại, tránh {so_trung_phong} xung đột phòng."
        )
        return RosterBatchGenerateResponse(
            tu_ngay=payload.tu_ngay,
            den_ngay=payload.den_ngay,
            tong_so_ngay=total_days,
            so_ca_tao_thanh_cong=so_tao,
            so_ca_bo_qua_da_ton_tai=so_da_co,
            so_ca_xung_dot_phong=so_trung_phong,
            chi_tiet=details,
        )

    async def _count_leave_impacts(
        self,
        db: AsyncSession,
        bac_si_id: int,
        tu_ngay: date,
        den_ngay: date,
        ca_lam_viec: Optional[str] = None,
    ) -> tuple[int, int]:
        shift_stmt = select(func.count(LichLamViec.id)).where(
            LichLamViec.bac_si_id == bac_si_id,
            LichLamViec.ngay_lam_viec >= tu_ngay,
            LichLamViec.ngay_lam_viec <= den_ngay,
        )
        if ca_lam_viec:
            shift_stmt = shift_stmt.where(LichLamViec.ca_lam_viec == ca_lam_viec)
        shift_cnt = (await db.execute(shift_stmt)).scalar() or 0

        apt_stmt = select(func.count(LichKham.id)).where(
            LichKham.bac_si_id == bac_si_id,
            LichKham.ngay_kham >= tu_ngay,
            LichKham.ngay_kham <= den_ngay,
            LichKham.trang_thai.in_(
                [
                    TrangThaiLichEnum.CHO_XAC_NHAN.value,
                    TrangThaiLichEnum.DA_XAC_NHAN.value,
                    TrangThaiLichEnum.DA_TIEP_NHAN.value,
                    TrangThaiLichEnum.DANG_KHAM.value,
                ]
            ),
        )
        if ca_lam_viec:
            apt_stmt = apt_stmt.where(LichKham.ca_kham == ca_lam_viec)
        apt_cnt = (await db.execute(apt_stmt)).scalar() or 0
        return shift_cnt, apt_cnt

    async def get_leaves_admin(
        self,
        db: AsyncSession,
        doctor_id: Optional[int] = None,
        trang_thai: Optional[str] = None,
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
            resolved_doc_id = await self._resolve_doctor_id(db, doctor_id)
            stmt = stmt.where(NghiPhepBacSi.bac_si_id == resolved_doc_id)
        if trang_thai:
            stmt = stmt.where(NghiPhepBacSi.trang_thai == trang_thai)
        rows = (await db.execute(stmt)).scalars().all()

        results = []
        for r in rows:
            so_ca, so_lich = await self._count_leave_impacts(db, r.bac_si_id, r.tu_ngay, r.den_ngay, r.ca_lam_viec)
            results.append(
                DoctorLeaveResponse(
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
                    so_ca_anh_huong=so_ca,
                    so_lich_anh_huong=so_lich,
                    created_at=r.created_at,
                )
            )
        return results

    async def create_leave_admin(self, payload: DoctorLeaveCreateRequest, db: AsyncSession) -> DoctorLeaveResponse:
        doc = await db.get(BacSi, payload.bac_si_id)
        if not doc:
            raise NotFoundException(f"Không tìm thấy bác sĩ ID {payload.bac_si_id}")
        if payload.den_ngay < payload.tu_ngay:
            raise BadRequestException("Ngày kết thúc nghỉ phải lớn hơn hoặc bằng ngày bắt đầu!")

        shift_stmt = select(LichLamViec.id).where(
            LichLamViec.bac_si_id == payload.bac_si_id,
            LichLamViec.ngay_lam_viec >= payload.tu_ngay,
            LichLamViec.ngay_lam_viec <= payload.den_ngay,
            LichLamViec.is_active.is_(True),
        )
        if payload.ca_lam_viec:
            shift_stmt = shift_stmt.where(LichLamViec.ca_lam_viec == payload.ca_lam_viec)
        shift_ids = (await db.execute(shift_stmt)).scalars().all()
        so_ca, apt_cnt = await self._count_leave_impacts(
            db, payload.bac_si_id, payload.tu_ngay, payload.den_ngay, payload.ca_lam_viec
        )
        leave = NghiPhepBacSi(
            bac_si_id=payload.bac_si_id,
            loai_nghi=payload.loai_nghi,
            tu_ngay=payload.tu_ngay,
            den_ngay=payload.den_ngay,
            ca_lam_viec=payload.ca_lam_viec,
            ly_do=payload.ly_do,
            trang_thai=(
                TrangThaiNghiPhepEnum.CHO_DUYET.value
                if payload.loai_nghi == "NGHI_PHEP"
                else TrangThaiNghiPhepEnum.DA_DUYET.value
            ),
            so_ca_anh_huong=so_ca,
            so_lich_anh_huong=apt_cnt,
        )
        db.add(leave)
        await db.commit()
        await db.refresh(leave)

        if payload.loai_nghi == "NGHI_DOT_XUAT" and shift_ids:
            for s_id in shift_ids:
                s = await db.get(LichLamViec, s_id)
                if s:
                    s.is_active = False
                    s.ghi_chu_nghi = f"Nghỉ đột xuất: {payload.ly_do}"
            await db.commit()
        leaves = await self.get_leaves_admin(db, doctor_id=payload.bac_si_id)
        return [lv for lv in leaves if lv.id == leave.id][0]

    async def approve_leave_admin(
        self,
        leave_id: int,
        payload: DoctorLeaveApproveRequest,
        admin_user: TaiKhoan,
        db: AsyncSession,
    ) -> DoctorLeaveResponse:
        leave = await db.get(NghiPhepBacSi, leave_id)
        if not leave:
            raise NotFoundException(f"Không tìm thấy đơn nghỉ phép ID {leave_id}")
        leave.trang_thai = payload.hanh_dong
        leave.nguoi_duyet_id = admin_user.id
        leave.ghi_chu_duyet = payload.ghi_chu
        if payload.hanh_dong == "DA_DUYET":
            stmt = select(LichLamViec).where(
                LichLamViec.bac_si_id == leave.bac_si_id,
                LichLamViec.ngay_lam_viec >= leave.tu_ngay,
                LichLamViec.ngay_lam_viec <= leave.den_ngay,
                LichLamViec.is_active.is_(True),
            )
            if leave.ca_lam_viec:
                stmt = stmt.where(LichLamViec.ca_lam_viec == leave.ca_lam_viec)
            for s in (await db.execute(stmt)).scalars().all():
                s.is_active = False
                s.ghi_chu_nghi = f"Nghỉ phép theo kế hoạch: {leave.ly_do}"
        await db.commit()
        await db.refresh(leave)
        leaves = await self.get_leaves_admin(db, doctor_id=leave.bac_si_id)
        return [lv for lv in leaves if lv.id == leave.id][0]

    async def get_leave_affected_bookings(self, leave_id: int, db: AsyncSession) -> List[AffectedBookingItem]:
        leave = await db.get(NghiPhepBacSi, leave_id)
        if not leave:
            raise NotFoundException(f"Không tìm thấy đơn nghỉ phép ID {leave_id}")
        stmt = (
            select(LichKham)
            .options(
                selectinload(LichKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(LichKham.chuyen_khoa),
            )
            .where(
                LichKham.bac_si_id == leave.bac_si_id,
                LichKham.ngay_kham >= leave.tu_ngay,
                LichKham.ngay_kham <= leave.den_ngay,
                LichKham.trang_thai.in_(
                    [
                        TrangThaiLichEnum.CHO_XAC_NHAN.value,
                        TrangThaiLichEnum.DA_XAC_NHAN.value,
                        TrangThaiLichEnum.DA_TIEP_NHAN.value,
                        TrangThaiLichEnum.DANG_KHAM.value,
                    ]
                ),
            )
            .order_by(LichKham.ngay_kham.asc(), LichKham.gio_kham.asc())
        )
        if leave.ca_lam_viec:
            stmt = stmt.where(LichKham.ca_kham == leave.ca_lam_viec)
        rows = (await db.execute(stmt)).scalars().all()
        return [
            AffectedBookingItem(
                lich_kham_id=r.id,
                ma_lich_kham=r.ma_lich_kham,
                ten_benh_nhan=(
                    r.benh_nhan.nguoi_dung.ho_ten if r.benh_nhan and r.benh_nhan.nguoi_dung else "Bệnh nhân"
                ),
                so_dien_thoai=(
                    r.benh_nhan.nguoi_dung.so_dien_thoai if r.benh_nhan and r.benh_nhan.nguoi_dung else None
                ),
                ngay_kham=r.ngay_kham,
                gio_kham=r.gio_kham,
                chuyen_khoa=r.chuyen_khoa.ten_chuyen_khoa if r.chuyen_khoa else None,
                trang_thai=r.trang_thai,
            )
            for r in rows
        ]

    async def cancel_leave_admin(
        self,
        leave_id: int,
        admin_user: TaiKhoan,
        db: AsyncSession,
    ) -> DoctorLeaveResponse:
        leave = await db.get(NghiPhepBacSi, leave_id)
        if not leave:
            raise NotFoundException(f"Không tìm thấy đơn nghỉ phép ID {leave_id}")
        await self._restore_shifts_for_approved_leave(leave, db)
        leave.trang_thai = TrangThaiNghiPhepEnum.DA_HUY.value
        admin_email = getattr(admin_user, "email", "Admin")
        leave.ghi_chu_duyet = f"Đơn nghỉ phép đã bị hủy bởi quản trị viên ({admin_email})"
        await db.commit()
        await db.refresh(leave)
        leaves = await self.get_leaves_admin(db, doctor_id=leave.bac_si_id)
        return [lv for lv in leaves if lv.id == leave.id][0]

    async def delete_leave_admin(self, leave_id: int, db: AsyncSession) -> None:
        leave = await db.get(NghiPhepBacSi, leave_id)
        if not leave:
            raise NotFoundException(f"Không tìm thấy đơn nghỉ phép ID {leave_id}")
        await self._restore_shifts_for_approved_leave(leave, db)
        await db.delete(leave)
        await db.commit()
