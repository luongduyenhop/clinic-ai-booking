from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ForbiddenException
from app.models.medical import ChiDinh, DonThuoc, LuotKham
from app.models.user import BacSi, BenhNhan, TaiKhoan, VaiTroEnum


def _to_utc_aware(dt_val: datetime | None) -> datetime | None:
    if dt_val is None:
        return None
    if dt_val.tzinfo is None:
        return dt_val.replace(tzinfo=timezone.utc)
    return dt_val.astimezone(timezone.utc)


def _compute_age(dob: date | None) -> int:
    if not dob:
        return 30
    today = date.today()
    age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
    return max(age, 0)


async def get_doctor_completed_encounters(
    db: AsyncSession,
    current_user: TaiKhoan,
    days: int = 30,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    if current_user.vai_tro not in (VaiTroEnum.BAC_SI.value, VaiTroEnum.ADMIN.value):
        raise ForbiddenException("Chỉ Bác sĩ hoặc Quản trị viên mới có quyền tra cứu lịch sử bệnh nhân đã khám!")

    stmt = (
        select(LuotKham)
        .options(
            selectinload(LuotKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
            selectinload(LuotKham.bac_si).selectinload(BacSi.nguoi_dung),
            selectinload(LuotKham.bac_si).selectinload(BacSi.chuyen_khoa),
            selectinload(LuotKham.hang_doi_kham),
            selectinload(LuotKham.kham_the_luc),
            selectinload(LuotKham.danh_sach_chan_doan),
            selectinload(LuotKham.danh_sach_chi_dinh).selectinload(ChiDinh.dich_vu),
            selectinload(LuotKham.don_thuoc).selectinload(DonThuoc.danh_sach_chi_tiet),
        )
        .where(LuotKham.is_locked.is_(True))
        .order_by(LuotKham.thoi_gian_khoa.desc(), LuotKham.id.desc())
    )

    if current_user.vai_tro == VaiTroEnum.BAC_SI.value:
        doctor = (
            await db.execute(select(BacSi).where(BacSi.nguoi_dung_id == current_user.nguoi_dung_id))
        ).scalar_one_or_none()
        if not doctor:
            raise ForbiddenException("Không tìm thấy hồ sơ Bác sĩ hợp lệ cho tài khoản hiện tại!")
        stmt = stmt.where(or_(LuotKham.bac_si_id == doctor.id, LuotKham.tiep_quan_boi_id == doctor.id))

    rows = (await db.execute(stmt.limit(max(limit * 2, 100)))).scalars().all()
    cutoff_utc = datetime.now(timezone.utc) - timedelta(days=max(days, 1))

    items: List[Dict[str, Any]] = []
    for lk in rows:
        anchor_dt = _to_utc_aware(lk.thoi_gian_khoa or lk.thoi_gian_ket_thuc or lk.thoi_gian_bat_dau)
        if anchor_dt and anchor_dt < cutoff_utc:
            continue

        bn = lk.benh_nhan
        bn_nd = bn.nguoi_dung if bn else None
        bs = lk.bac_si
        bs_nd = bs.nguoi_dung if bs else None
        ck = bs.chuyen_khoa if bs else None
        tl = lk.kham_the_luc
        hd = lk.hang_doi_kham

        mach = lk.mach_lan_phut if lk.mach_lan_phut is not None else (tl.mach if tl else None)
        ha_thu = lk.huyet_ap_tam_thu if lk.huyet_ap_tam_thu is not None else (tl.huyet_ap_tam_thu if tl else None)
        ha_truong = lk.huyet_ap_tam_truong if lk.huyet_ap_tam_truong is not None else (tl.huyet_ap_tam_truong if tl else None)
        nhiet_do = float(lk.nhiet_do_c) if lk.nhiet_do_c is not None else (float(tl.nhiet_do) if tl and tl.nhiet_do is not None else None)
        can_nang = float(lk.can_nang_kg) if lk.can_nang_kg is not None else (float(tl.can_nang) if tl and tl.can_nang is not None else None)
        chieu_cao = float(lk.chieu_cao_cm) if lk.chieu_cao_cm is not None else (float(tl.chieu_cao) if tl and tl.chieu_cao is not None else None)

        diagnoses = [
            {
                "id": cd.id,
                "ma_icd10": cd.ma_icd10,
                "ten_benh_chan_doan": cd.ten_benh_chan_doan,
                "loai_chan_doan": (cd.loai_chan_doan or "chinh").lower(),
                "ghi_chu_chuyen_mon": cd.ghi_chu_chuyen_mon,
            }
            for cd in (lk.danh_sach_chan_doan or [])
        ]

        orders = [
            {
                "id": od.id,
                "dich_vu_id": od.dich_vu_id,
                "ten_dich_vu": od.dich_vu.ten_dich_vu if od.dich_vu else f"Dịch vụ #{od.dich_vu_id}",
                "trang_thai": od.trang_thai,
                "ket_qua_chi_tiet": od.ket_qua_chi_tiet,
                "ket_qua_phan_loai": od.ket_qua_phan_loai,
            }
            for od in (lk.danh_sach_chi_dinh or [])
        ]

        rx = lk.don_thuoc
        rx_items = []
        if rx and rx.danh_sach_chi_tiet:
            rx_items = [
                {
                    "id": ct.id,
                    "thuoc_id": ct.thuoc_id,
                    "ten_thuoc": ct.ten_thuoc,
                    "hoat_chat": ct.hoat_chat,
                    "ham_luong": ct.ham_luong,
                    "don_vi_tinh": ct.don_vi_tinh,
                    "so_luong": ct.so_luong,
                    "cach_dung": ct.cach_dung,
                    "cach_dung_day_du": ct.cach_dung,
                    "so_ngay_dung": ct.so_ngay_dung,
                    "lieu_sang": ct.lieu_sang or "",
                    "lieu_trua": ct.lieu_trua or "",
                    "lieu_chieu": ct.lieu_chieu or "",
                    "lieu_toi": ct.lieu_toi or "",
                }
                for ct in rx.danh_sach_chi_tiet
            ]

        locked_dt = lk.thoi_gian_khoa or lk.thoi_gian_ket_thuc or lk.thoi_gian_bat_dau
        items.append(
            {
                "id": lk.id,
                "luot_kham_server_id": lk.id,
                "ma_kcb": lk.ma_kcb or f"LK-{lk.id}",
                "ticket_id": lk.hang_doi_kham_id,
                "so_thu_tu_kham": hd.so_thu_tu_kham if hd else None,
                "is_locked": True,
                "thoi_gian_bat_dau": lk.thoi_gian_bat_dau.isoformat() if lk.thoi_gian_bat_dau else None,
                "thoi_gian_ket_thuc": lk.thoi_gian_ket_thuc.isoformat() if lk.thoi_gian_ket_thuc else None,
                "thoi_gian_khoa": locked_dt.isoformat() if locked_dt else None,
                "ngay_kham": locked_dt.date().isoformat() if locked_dt else None,
                "ly_do_vao_kham": lk.ly_do_vao_kham,
                "trieu_chung": lk.trieu_chung,
                "benh_su": lk.benh_su,
                "kham_lam_sang_bo_phan": lk.kham_lam_sang_bo_phan,
                "ket_luan_dieu_tri": lk.ket_luan_dieu_tri,
                "loi_dan_bac_si": lk.loi_dan_bac_si,
                "loi_dan_uong_thuoc": rx.loi_dan_uong_thuoc if rx else None,
                "ngay_hen_tai_kham": lk.ngay_hen_tai_kham.isoformat() if lk.ngay_hen_tai_kham else None,
                "mach_lan_phut": mach,
                "huyet_ap_tam_thu": ha_thu,
                "huyet_ap_tam_truong": ha_truong,
                "nhiet_do_c": nhiet_do,
                "can_nang_kg": can_nang,
                "chieu_cao_cm": chieu_cao,
                "benh_nhan": {
                    "id": bn.id if bn else lk.benh_nhan_id,
                    "ma": bn.ma_dinh_danh_y_te if bn else f"BN-{lk.benh_nhan_id}",
                    "ho_ten": bn_nd.ho_ten if bn_nd else "Bệnh nhân",
                    "gioi_tinh": (bn_nd.gioi_tinh if bn_nd and bn_nd.gioi_tinh else "Nam"),
                    "ngay_sinh": bn_nd.ngay_sinh.isoformat() if bn_nd and bn_nd.ngay_sinh else None,
                    "tuoi": _compute_age(bn_nd.ngay_sinh if bn_nd else None),
                    "so_dien_thoai": bn_nd.so_dien_thoai if bn_nd else "",
                    "dia_chi": bn_nd.dia_chi if bn_nd else "",
                    "di_ung_thuoc": bn.di_ung_thuoc if bn else "",
                },
                "bac_si": {
                    "id": bs.id if bs else lk.bac_si_id,
                    "ho_ten": bs_nd.ho_ten if bs_nd else "Bác sĩ điều trị",
                    "hoc_vi": bs.hoc_vi if bs else None,
                },
                "ten_bac_si": bs_nd.ho_ten if bs_nd else "Bác sĩ điều trị",
                "ten_chuyen_khoa": ck.ten_chuyen_khoa if ck else "Khoa Khám bệnh",
                "danh_sach_chan_doan": diagnoses,
                "danh_sach_chi_dinh": orders,
                "danh_sach_thuoc": rx_items,
                "don_thuoc": {
                    "id": rx.id,
                    "ma_don_thuoc": rx.ma_don_thuoc,
                    "trang_thai": rx.trang_thai,
                    "loi_dan_uong_thuoc": rx.loi_dan_uong_thuoc,
                    "so_ngay_dung": rx.so_ngay_dung,
                    "danh_sach_chi_tiet": rx_items,
                }
                if rx
                else None,
            }
        )
        if len(items) >= limit:
            break

    return items
