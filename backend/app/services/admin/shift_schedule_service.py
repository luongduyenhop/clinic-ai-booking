from datetime import date, time
from typing import Dict, List, Optional

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
)
from app.models.appointment import (
    CaLamViecEnum,
    LichKham,
    LichLamViec,
    NghiPhepBacSi,
    TrangThaiLichEnum,
    TrangThaiNghiPhepEnum,
)
from app.models.user import BacSi, BenhNhan, PhongKham
from app.schemas.admin import (
    DoctorScheduleMatrixCell,
    DoctorScheduleMatrixResponse,
    DoctorScheduleSlotItem,
    DoctorTimesheetReportItem,
    DoctorTimesheetReportResponse,
    ShiftCreateRequest,
    ShiftResponse,
    ShiftToggleLockRequest,
)


def _build_shift_response(
    shift: LichLamViec,
    doc: Optional[BacSi],
    room: Optional[PhongKham],
    booked_count: int = 0,
    default_specialty: str = "",
    fallback_online_limit: Optional[int] = 6,
    fallback_walkin_limit: Optional[int] = 2,
) -> ShiftResponse:
    effective_room = room or getattr(shift, "phong_kham", None)
    if effective_room:
        phong_display = f"{effective_room.ma_phong} - {effective_room.ten_phong}"
        ma_phong = effective_room.ma_phong
        ten_phong = effective_room.ten_phong
        tang_phong = effective_room.tang
    elif doc and doc.chuyen_khoa:
        phong_display = doc.chuyen_khoa.vi_tri_phong or ""
        ma_phong = None
        ten_phong = None
        tang_phong = None
    else:
        phong_display = ""
        ma_phong = None
        ten_phong = None
        tang_phong = None

    dat_truoc = (
        shift.han_muc_dat_truoc
        if fallback_online_limit is None
        else (shift.han_muc_dat_truoc or fallback_online_limit)
    )
    vang_lai = (
        shift.han_muc_vang_lai
        if fallback_walkin_limit is None
        else (shift.han_muc_vang_lai or fallback_walkin_limit)
    )

    return ShiftResponse(
        id=shift.id,
        bac_si_id=doc.id if doc else shift.bac_si_id,
        ten_bac_si=doc.nguoi_dung.ho_ten if doc and doc.nguoi_dung else "",
        chuyen_khoa=doc.chuyen_khoa.ten_chuyen_khoa if doc and doc.chuyen_khoa else default_specialty,
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
        han_muc_dat_truoc=dat_truoc,
        han_muc_vang_lai=vang_lai,
        so_luong_da_dat=booked_count,
        is_active=shift.is_active,
        ghi_chu_nghi=shift.ghi_chu_nghi,
    )


class ShiftScheduleMixin:
    async def _resolve_doctor_id(self, db: AsyncSession, doctor_id: Optional[int]) -> Optional[int]:
        if not doctor_id:
            return None
        stmt_direct = select(BacSi.id).where(BacSi.id == doctor_id)
        direct_id = (await db.execute(stmt_direct)).scalar_one_or_none()
        if direct_id is not None:
            return direct_id
        stmt_nd = select(BacSi.id).where(BacSi.nguoi_dung_id == doctor_id)
        resolved_id = (await db.execute(stmt_nd)).scalar_one_or_none()
        return resolved_id or doctor_id

    async def _load_validated_exam_room(
        self,
        target_room_id: int,
        db: AsyncSession,
        doc: Optional[BacSi] = None,
        check_specialty_match: bool = False,
    ) -> PhongKham:
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
        if room.loai_phong != "kham_benh":
            if check_specialty_match:
                loai_phong_label = {
                    "xet_nghiem": "Phòng xét nghiệm cận lâm sàng",
                    "chan_doan_hinh_anh": "Phòng chẩn đoán hình ảnh",
                    "thu_thuat": "Phòng thủ thuật chuyên môn",
                }.get(room.loai_phong, room.loai_phong)
                raise BadRequestException(
                    f"Không thể phân ca khám cho buồng '{room.ten_phong}' vì đây là {loai_phong_label}, không phải buồng khám bệnh lâm sàng!"
                )
            raise BadRequestException(
                f"Không thể phân ca khám cho buồng '{room.ten_phong}' vì đây không phải buồng khám bệnh lâm sàng!"
            )
        if check_specialty_match and doc and room.chuyen_khoa_id and doc.chuyen_khoa_id and room.chuyen_khoa_id != doc.chuyen_khoa_id:
            ten_ck_room = room.chuyen_khoa.ten_chuyen_khoa if room.chuyen_khoa else f"CK #{room.chuyen_khoa_id}"
            ten_ck_doc = doc.chuyen_khoa.ten_chuyen_khoa if doc.chuyen_khoa else f"CK #{doc.chuyen_khoa_id}"
            raise BadRequestException(
                f"Sai lệch chuyên khoa: Buồng '{room.ten_phong}' thuộc chuyên khoa '{ten_ck_room}', không tương thích với chuyên khoa của BS {doc.nguoi_dung.ho_ten} ('{ten_ck_doc}')!"
            )
        return room

    async def get_shifts(
        self, query_date: Optional[date], doctor_id: Optional[int], db: AsyncSession
    ) -> List[ShiftResponse]:
        stmt = select(LichLamViec).options(
            selectinload(LichLamViec.bac_si).selectinload(BacSi.nguoi_dung),
            selectinload(LichLamViec.bac_si).selectinload(BacSi.chuyen_khoa),
            selectinload(LichLamViec.phong_kham),
        )
        if query_date:
            stmt = stmt.where(LichLamViec.ngay_lam_viec == query_date)
        if doctor_id:
            resolved_doc_id = await self._resolve_doctor_id(db, doctor_id)
            stmt = stmt.where(LichLamViec.bac_si_id == resolved_doc_id)
        stmt = stmt.order_by(LichLamViec.ngay_lam_viec, LichLamViec.ca_lam_viec)
        shifts = (await db.execute(stmt)).scalars().all()

        results = []
        for s in shifts:
            stmt_booked = select(func.count(LichKham.id)).where(
                LichKham.bac_si_id == s.bac_si_id,
                LichKham.ngay_kham == s.ngay_lam_viec,
                LichKham.trang_thai.notin_([TrangThaiLichEnum.DA_HUY.value, TrangThaiLichEnum.TU_DONG_HUY.value]),
                LichKham.gio_kham >= s.gio_bat_dau,
                LichKham.gio_kham < s.gio_ket_thuc,
            )
            booked_count = (await db.execute(stmt_booked)).scalar() or 0
            results.append(_build_shift_response(s, s.bac_si, s.phong_kham, booked_count=booked_count))
        return results

    async def create_shift(self, payload: ShiftCreateRequest, db: AsyncSession) -> ShiftResponse:
        stmt_bs = (
            select(BacSi)
            .options(selectinload(BacSi.nguoi_dung), selectinload(BacSi.chuyen_khoa))
            .where(BacSi.id == payload.bac_si_id)
        )
        doc = (await db.execute(stmt_bs)).scalar_one_or_none()
        if not doc:
            raise NotFoundException(f"Không tìm thấy bác sĩ với ID {payload.bac_si_id}!")
        if not (doc.chung_chi_hanh_nghe or getattr(doc, "so_cchn", None)):
            raise BadRequestException(f"Bác sĩ {doc.nguoi_dung.ho_ten} chưa có Chứng chỉ hành nghề (CCHN) hợp lệ!")

        from app.services.auth.credential_service import credential_service

        await credential_service.check_doctor_license_valid(db, payload.bac_si_id)

        if payload.ca_lam_viec == CaLamViecEnum.SANG.value:
            s_time = payload.gio_bat_dau or time(7, 30)
            e_time = payload.gio_ket_thuc or time(11, 30)
        else:
            s_time = payload.gio_bat_dau or time(13, 30)
            e_time = payload.gio_ket_thuc or time(17, 0)

        stmt_dup = select(LichLamViec).where(
            LichLamViec.bac_si_id == payload.bac_si_id,
            LichLamViec.ngay_lam_viec == payload.ngay_lam_viec,
            LichLamViec.is_active.is_(True),
            or_(
                LichLamViec.ca_lam_viec == payload.ca_lam_viec,
                and_(LichLamViec.gio_bat_dau < e_time, LichLamViec.gio_ket_thuc > s_time),
            ),
        )
        if (await db.execute(stmt_dup)).scalar_one_or_none():
            raise ConflictException(
                f"Bác sĩ {doc.nguoi_dung.ho_ten} đã được phân ca {payload.ca_lam_viec} vào ngày {payload.ngay_lam_viec}!"
            )

        target_room_id = payload.phong_kham_id or doc.phong_kham_id
        room = None
        if target_room_id:
            room = await self._load_validated_exam_room(target_room_id, db, doc=doc, check_specialty_match=True)
            stmt_conflict_room = select(LichLamViec).where(
                LichLamViec.phong_kham_id == target_room_id,
                LichLamViec.ngay_lam_viec == payload.ngay_lam_viec,
                LichLamViec.is_active.is_(True),
                or_(
                    LichLamViec.ca_lam_viec == payload.ca_lam_viec,
                    and_(LichLamViec.gio_bat_dau < e_time, LichLamViec.gio_ket_thuc > s_time),
                ),
            )
            conflict_shift = (await db.execute(stmt_conflict_room)).scalar_one_or_none()
            if conflict_shift:
                stmt_c_doc = (
                    select(BacSi).options(selectinload(BacSi.nguoi_dung)).where(BacSi.id == conflict_shift.bac_si_id)
                )
                c_doc = (await db.execute(stmt_c_doc)).scalar_one_or_none()
                c_doc_name = c_doc.nguoi_dung.ho_ten if c_doc and c_doc.nguoi_dung else f"BS #{conflict_shift.bac_si_id}"
                raise ConflictException(
                    f"Xung đột buồng khám: Buồng '{room.ma_phong} - {room.ten_phong}' đã được phân cho bác sĩ {c_doc_name} trong ca {payload.ca_lam_viec} ngày {payload.ngay_lam_viec}!"
                )

        gioi_han = payload.gioi_han_ca_kham
        han_muc_dat_truoc = (
            payload.han_muc_dat_truoc if payload.han_muc_dat_truoc is not None else max(1, int(gioi_han * 0.75))
        )
        han_muc_vang_lai = (
            payload.han_muc_vang_lai if payload.han_muc_vang_lai is not None else max(1, gioi_han - han_muc_dat_truoc)
        )
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
        return _build_shift_response(
            shift,
            doc,
            room,
            booked_count=0,
            fallback_online_limit=han_muc_dat_truoc,
            fallback_walkin_limit=han_muc_vang_lai,
        )

    async def update_shift(self, shift_id: int, payload, db: AsyncSession) -> ShiftResponse:
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
            raise NotFoundException(f"Không tìm thấy ca trực với ID {shift_id}!")

        doc = shift.bac_si
        payload_room_id = getattr(payload, "phong_kham_id", None)
        target_room_id = payload_room_id if payload_room_id is not None else shift.phong_kham_id
        room = await self._load_validated_exam_room(target_room_id, db) if target_room_id else None

        s_time = getattr(payload, "gio_bat_dau", None) or shift.gio_bat_dau
        e_time = getattr(payload, "gio_ket_thuc", None) or shift.gio_ket_thuc
        payload_active = getattr(payload, "is_active", None)
        is_active_val = payload_active if payload_active is not None else shift.is_active

        if target_room_id and is_active_val:
            stmt_conflict = select(LichLamViec).where(
                LichLamViec.id != shift_id,
                LichLamViec.phong_kham_id == target_room_id,
                LichLamViec.ngay_lam_viec == shift.ngay_lam_viec,
                LichLamViec.is_active.is_(True),
                or_(
                    LichLamViec.ca_lam_viec == shift.ca_lam_viec,
                    and_(LichLamViec.gio_bat_dau < e_time, LichLamViec.gio_ket_thuc > s_time),
                ),
            )
            if (await db.execute(stmt_conflict)).scalar_one_or_none():
                raise ConflictException(
                    f"Xung đột buồng khám: Buồng '{room.ma_phong} - {room.ten_phong}' đã được phân cho bác sĩ khác trong khung giờ này!"
                )

        updatable_fields = (
            "phong_kham_id",
            "gio_bat_dau",
            "gio_ket_thuc",
            "gioi_han_ca_kham",
            "han_muc_dat_truoc",
            "han_muc_vang_lai",
            "is_active",
            "ghi_chu_nghi",
        )
        for attr in updatable_fields:
            if hasattr(payload, attr) and getattr(payload, attr) is not None:
                setattr(shift, attr, getattr(payload, attr))

        await db.commit()
        await db.refresh(shift)
        return _build_shift_response(
            shift,
            doc,
            room or shift.phong_kham,
            booked_count=shift.so_luong_da_dat,
            default_specialty="Chưa gán",
            fallback_online_limit=None,
            fallback_walkin_limit=None,
        )

    async def toggle_lock_shift(
        self, shift_id: int, payload: ShiftToggleLockRequest, db: AsyncSession
    ) -> ShiftResponse:
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
        return _build_shift_response(shift, shift.bac_si, shift.phong_kham, booked_count=0)

    async def get_doctor_schedule_matrix(
        self,
        db: AsyncSession,
        tu_ngay: date,
        den_ngay: date,
        chuyen_khoa_id: Optional[int] = None,
        doctor_id: Optional[int] = None,
        phong_kham_id: Optional[int] = None,
    ) -> DoctorScheduleMatrixResponse:
        if den_ngay < tu_ngay:
            raise BadRequestException("Ngày kết thúc 'den_ngay' không được nhỏ hơn ngày bắt đầu 'tu_ngay'!")
        stmt_docs = (
            select(BacSi)
            .options(selectinload(BacSi.nguoi_dung), selectinload(BacSi.chuyen_khoa))
            .where(BacSi.is_active.is_(True))
        )
        if doctor_id:
            resolved_doc_id = await self._resolve_doctor_id(db, doctor_id)
            stmt_docs = stmt_docs.where(BacSi.id == resolved_doc_id)
        if chuyen_khoa_id:
            stmt_docs = stmt_docs.where(BacSi.chuyen_khoa_id == chuyen_khoa_id)
        docs = (await db.execute(stmt_docs)).scalars().all()
        doc_ids = [d.id for d in docs]
        if not doc_ids:
            return DoctorScheduleMatrixResponse(
                tu_ngay=tu_ngay,
                den_ngay=den_ngay,
                tong_so_ca_phan_cong=0,
                tong_slot_con_trong=0,
                tong_slot_da_dat=0,
                matrix=[],
            )

        stmt_shifts = (
            select(LichLamViec)
            .options(selectinload(LichLamViec.phong_kham))
            .where(
                LichLamViec.bac_si_id.in_(doc_ids),
                LichLamViec.ngay_lam_viec >= tu_ngay,
                LichLamViec.ngay_lam_viec <= den_ngay,
            )
        )
        if phong_kham_id:
            stmt_shifts = stmt_shifts.where(LichLamViec.phong_kham_id == phong_kham_id)
        shifts = (await db.execute(stmt_shifts)).scalars().all()

        stmt_leaves = select(NghiPhepBacSi).where(
            NghiPhepBacSi.bac_si_id.in_(doc_ids),
            NghiPhepBacSi.den_ngay >= tu_ngay,
            NghiPhepBacSi.tu_ngay <= den_ngay,
            NghiPhepBacSi.trang_thai == TrangThaiNghiPhepEnum.DA_DUYET.value,
        )
        leaves = (await db.execute(stmt_leaves)).scalars().all()

        stmt_apts = (
            select(LichKham)
            .options(selectinload(LichKham.benh_nhan).selectinload(BenhNhan.nguoi_dung))
            .where(
                LichKham.bac_si_id.in_(doc_ids),
                LichKham.ngay_kham >= tu_ngay,
                LichKham.ngay_kham <= den_ngay,
                LichKham.trang_thai.notin_([TrangThaiLichEnum.DA_HUY.value, TrangThaiLichEnum.TU_DONG_HUY.value]),
            )
        )
        apts = (await db.execute(stmt_apts)).scalars().all()

        doc_map = {d.id: d for d in docs}
        leaves_by_doc: Dict[int, List[NghiPhepBacSi]] = {}
        for leave_item in leaves:
            leaves_by_doc.setdefault(leave_item.bac_si_id, []).append(leave_item)

        apts_by_shift: Dict[tuple, List[LichKham]] = {}
        for a in apts:
            ca_str = "sang" if a.gio_kham.hour < 12 else "chieu"
            apts_by_shift.setdefault((a.bac_si_id, a.ngay_kham, ca_str), []).append(a)

        matrix_cells: List[DoctorScheduleMatrixCell] = []
        tong_con_trong = 0
        tong_da_dat = 0
        for s in shifts:
            doc = doc_map.get(s.bac_si_id)
            if not doc:
                continue
            status_ca = "DANG_HOAT_DONG" if s.is_active else "DA_KHOA"
            ly_do = s.ghi_chu_nghi
            for leave_item in leaves_by_doc.get(s.bac_si_id, []):
                if leave_item.tu_ngay <= s.ngay_lam_viec <= leave_item.den_ngay:
                    if not leave_item.ca_lam_viec or leave_item.ca_lam_viec == s.ca_lam_viec:
                        status_ca = "NGHI_DOT_XUAT" if leave_item.loai_nghi == "NGHI_DOT_XUAT" else "NGHI_PHEP"
                        ly_do = leave_item.ly_do
                        break

            shift_apts = apts_by_shift.get((s.bac_si_id, s.ngay_lam_viec, s.ca_lam_viec), [])
            so_online = sum(1 for a in shift_apts if getattr(a, "nguon_dat", "online") != "vang_lai")
            so_vang_lai = sum(1 for a in shift_apts if getattr(a, "nguon_dat", "online") == "vang_lai")
            limit_online = s.han_muc_dat_truoc or 6
            limit_walkin = s.han_muc_vang_lai or 2
            slot_on_free = max(0, limit_online - so_online)
            slot_wl_free = max(0, limit_walkin - so_vang_lai)
            tong_con_trong += slot_on_free + slot_wl_free
            tong_da_dat += len(shift_apts)

            pts = [
                DoctorScheduleSlotItem(
                    lich_kham_id=a.id,
                    ma_lich_kham=a.ma_lich_kham,
                    ten_benh_nhan=(
                        a.benh_nhan.nguoi_dung.ho_ten if a.benh_nhan and a.benh_nhan.nguoi_dung else "Bệnh nhân"
                    ),
                    so_dien_thoai=(
                        a.benh_nhan.nguoi_dung.so_dien_thoai if a.benh_nhan and a.benh_nhan.nguoi_dung else None
                    ),
                    gio_kham=a.gio_kham,
                    trang_thai=a.trang_thai,
                    loai_kham=getattr(a, "nguon_dat", "dat_truoc") or "dat_truoc",
                )
                for a in shift_apts
            ]
            matrix_cells.append(
                DoctorScheduleMatrixCell(
                    ca_id=s.id,
                    bac_si_id=doc.id,
                    ten_bac_si=doc.nguoi_dung.ho_ten if doc.nguoi_dung else "BS",
                    hoc_vi=doc.hoc_vi or "BS",
                    chuyen_khoa_id=doc.chuyen_khoa_id,
                    chuyen_khoa=doc.chuyen_khoa.ten_chuyen_khoa if doc.chuyen_khoa else "Đa khoa",
                    ngay=s.ngay_lam_viec,
                    ca_lam_viec=s.ca_lam_viec,
                    phong_kham_id=s.phong_kham_id,
                    ten_phong_kham=s.phong_kham.ten_phong if s.phong_kham else None,
                    gio_bat_dau=s.gio_bat_dau,
                    gio_ket_thuc=s.gio_ket_thuc,
                    trang_thai_ca=status_ca,
                    ly_do_nghi=ly_do,
                    han_muc_dat_truoc=limit_online,
                    han_muc_vang_lai=limit_walkin,
                    so_luong_da_dat=so_online,
                    so_luong_vang_lai=so_vang_lai,
                    slot_online_con_trong=slot_on_free,
                    slot_vang_lai_con_trong=slot_wl_free,
                    is_full=(slot_on_free == 0 and slot_wl_free == 0),
                    danh_sach_benh_nhan=pts,
                )
            )
        return DoctorScheduleMatrixResponse(
            tu_ngay=tu_ngay,
            den_ngay=den_ngay,
            tong_so_ca_phan_cong=len(shifts),
            tong_slot_con_trong=tong_con_trong,
            tong_slot_da_dat=tong_da_dat,
            matrix=matrix_cells,
        )

    async def export_timesheet_report(
        self,
        db: AsyncSession,
        tu_ngay: date,
        den_ngay: date,
        chuyen_khoa_id: Optional[int] = None,
    ) -> DoctorTimesheetReportResponse:
        if den_ngay < tu_ngay:
            raise BadRequestException("Ngày kết thúc 'den_ngay' không được nhỏ hơn ngày bắt đầu 'tu_ngay'!")
        stmt_docs = (
            select(BacSi)
            .options(selectinload(BacSi.nguoi_dung), selectinload(BacSi.chuyen_khoa))
            .where(BacSi.is_active.is_(True))
        )
        if chuyen_khoa_id:
            stmt_docs = stmt_docs.where(BacSi.chuyen_khoa_id == chuyen_khoa_id)
        docs = (await db.execute(stmt_docs)).scalars().all()
        doc_ids = [d.id for d in docs]
        if not doc_ids:
            return DoctorTimesheetReportResponse(
                tu_ngay=tu_ngay,
                den_ngay=den_ngay,
                tong_bac_si=0,
                tong_ca_toan_vien=0,
                tong_luot_kham_toan_vien=0,
                danh_sach_cham_cong=[],
            )

        shifts = (
            await db.execute(
                select(LichLamViec).where(
                    LichLamViec.bac_si_id.in_(doc_ids),
                    LichLamViec.ngay_lam_viec >= tu_ngay,
                    LichLamViec.ngay_lam_viec <= den_ngay,
                )
            )
        ).scalars().all()
        leaves = (
            await db.execute(
                select(NghiPhepBacSi).where(
                    NghiPhepBacSi.bac_si_id.in_(doc_ids),
                    NghiPhepBacSi.den_ngay >= tu_ngay,
                    NghiPhepBacSi.tu_ngay <= den_ngay,
                    NghiPhepBacSi.trang_thai == TrangThaiNghiPhepEnum.DA_DUYET.value,
                )
            )
        ).scalars().all()
        apts = (
            await db.execute(
                select(LichKham).where(
                    LichKham.bac_si_id.in_(doc_ids),
                    LichKham.ngay_kham >= tu_ngay,
                    LichKham.ngay_kham <= den_ngay,
                    LichKham.trang_thai == TrangThaiLichEnum.DA_KHAM.value,
                )
            )
        ).scalars().all()

        report_items: List[DoctorTimesheetReportItem] = []
        for doc in docs:
            d_shifts = [s for s in shifts if s.bac_si_id == doc.id]
            d_leaves = [lv for lv in leaves if lv.bac_si_id == doc.id]
            d_apts = [a for a in apts if a.bac_si_id == doc.id]
            so_ca_tong = len(d_shifts)
            so_ca_xong = sum(1 for s in d_shifts if s.is_active and s.ngay_lam_viec <= date.today())
            so_ca_phep = sum(lv.so_ca_anh_huong for lv in d_leaves if lv.loai_nghi == "NGHI_PHEP")
            so_ca_dot_xuat = sum(lv.so_ca_anh_huong for lv in d_leaves if lv.loai_nghi == "NGHI_DOT_XUAT")
            so_kham = len(d_apts)
            max_capacity = so_ca_tong * 8
            fill_rate = round((so_kham / max_capacity * 100.0), 1) if max_capacity > 0 else 0.0
            report_items.append(
                DoctorTimesheetReportItem(
                    bac_si_id=doc.id,
                    ten_bac_si=doc.nguoi_dung.ho_ten if doc.nguoi_dung else f"BS {doc.id}",
                    chuyen_khoa=doc.chuyen_khoa.ten_chuyen_khoa if doc.chuyen_khoa else "Đa khoa",
                    tong_so_ca_phan_cong=so_ca_tong,
                    so_ca_hoan_thanh=so_ca_xong,
                    so_ca_nghi_phep=so_ca_phep,
                    so_ca_nghi_dot_xuat=so_ca_dot_xuat,
                    tong_luot_kham=so_kham,
                    ty_le_lap_day_pct=fill_rate,
                )
            )
        return DoctorTimesheetReportResponse(
            tu_ngay=tu_ngay,
            den_ngay=den_ngay,
            tong_bac_si=len(docs),
            tong_ca_toan_vien=len(shifts),
            tong_luot_kham_toan_vien=len(apts),
            danh_sach_cham_cong=report_items,
        )
