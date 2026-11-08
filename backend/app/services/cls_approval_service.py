import json
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import ConflictException, NotFoundException
from app.models.appointment import HangDoiKham, TrangThaiHangDoiEnum
from app.models.medical import ChiDinh, KetQuaCLS, LuotKham, PhieuKetQuaCLS
from app.models.user import BacSi, BenhNhan, NguoiDung, TaiKhoan, VaiTroEnum
from app.schemas.cls_approval import (
    ClsApprovalResponse,
    ClsApprover,
    ClsReportClinic,
    ClsReportLabRow,
    ClsReportPatient,
    ClsReportResponse,
    ReturnedClsResult,
    ReturnedClsResultsResponse,
)
from app.services.audit_trail_service import audit_trail_service
from app.services.cls_result_state import PHIEU_CHO_DUYET, PHIEU_DA_DUYET, is_phieu_approved, latest_phieu
from app.services.cls_service_group import XET_NGHIEM, clinic_day_range, nhom_dich_vu_of
from app.services.typesafe_triage_service import typesafe_triage_service

LOAI_PHIEU_XET_NGHIEM = "XET_NGHIEM"
LOAI_PHIEU_HINH_ANH = "HINH_ANH"

_FEED_OVERLAP = timedelta(seconds=5)
_FEED_LIMIT = 200


def _approver_of(detail: Optional[Dict[str, Any]]) -> Optional[ClsApprover]:
    duyet = (detail or {}).get("duyet") or {}
    if not duyet.get("nguoi_dung_id"):
        return None
    return ClsApprover(nguoi_dung_id=duyet["nguoi_dung_id"], ho_ten=duyet.get("ho_ten") or "", vai_tro=duyet.get("vai_tro") or "")


def _to_returned(
    order: ChiDinh,
    thoi_gian_duyet: Optional[datetime],
    kq_detail: Optional[Dict[str, Any]],
    phieu: Optional[PhieuKetQuaCLS] = None,
) -> ReturnedClsResult:
    dv = order.dich_vu
    effective_duyet = thoi_gian_duyet or order.thoi_gian_tra_ket_qua or order.updated_at or order.created_at or datetime.now(timezone.utc)
    if effective_duyet.tzinfo is None:
        effective_duyet = effective_duyet.replace(tzinfo=timezone.utc)

    detail = dict(order.tri_so_chi_tiet or kq_detail or {})
    if not detail and order.ket_qua_chi_tiet:
        try:
            parsed = json.loads(order.ket_qua_chi_tiet)
            if isinstance(parsed, dict):
                detail = parsed
            else:
                detail = {"ket_luan": order.ket_qua_chi_tiet}
        except Exception:
            detail = {"ket_luan": order.ket_qua_chi_tiet}
    elif order.ket_qua_chi_tiet and not any(k in detail for k in ("ket_luan", "mo_ta", "ghi_chu")):
        detail["ket_luan"] = order.ket_qua_chi_tiet

    resolved_phieu = phieu or order.__dict__.get("phieu_ket_qua")
    if resolved_phieu:
        if resolved_phieu.mo_ta_hinh_anh and "mo_ta" not in detail:
            detail["mo_ta"] = resolved_phieu.mo_ta_hinh_anh
        if resolved_phieu.ket_luan and "ket_luan" not in detail:
            detail["ket_luan"] = resolved_phieu.ket_luan
        if resolved_phieu.de_nghi and "de_nghi" not in detail:
            detail["de_nghi"] = resolved_phieu.de_nghi
        if resolved_phieu.thiet_bi_thuc_hien and "thiet_bi" not in detail:
            detail["thiet_bi"] = resolved_phieu.thiet_bi_thuc_hien
        if resolved_phieu.loai_ket_qua and "loai" not in detail:
            detail["loai"] = resolved_phieu.loai_ket_qua

    urls = list(order.file_dinh_kem_urls or [])
    if not urls and order.tep_dinh_kem_url:
        urls = [order.tep_dinh_kem_url]
    if not urls and resolved_phieu and resolved_phieu.tep_dinh_kem_urls:
        urls = list(resolved_phieu.tep_dinh_kem_urls)

    approver = _approver_of(kq_detail or detail)
    nguoi_duyet_ten = None
    ktv = order.__dict__.get("ky_thuat_vien")
    if approver and approver.ho_ten:
        nguoi_duyet_ten = approver.ho_ten
    elif ktv and ktv.ho_ten:
        nguoi_duyet_ten = ktv.ho_ten

    return ReturnedClsResult(
        chi_dinh_id=order.id,
        luot_kham_id=order.luot_kham_id,
        ten_dich_vu=dv.ten_dich_vu if dv else "Dịch vụ cận lâm sàng",
        nhom_dich_vu=nhom_dich_vu_of(dv.ma_nhom_byt, dv.ma_dich_vu) if dv else None,
        trang_thai=order.trang_thai,
        ket_qua_phan_loai=order.ket_qua_phan_loai,
        ket_qua_chi_tiet=detail,
        tep_dinh_kem_urls=urls,
        thoi_gian_tra_ket_qua=order.thoi_gian_tra_ket_qua or effective_duyet,
        thoi_gian_duyet=effective_duyet,
        nguoi_duyet=nguoi_duyet_ten,
    )


def _age_on(birthday: Optional[date], on: date) -> Optional[int]:
    if not birthday:
        return None
    return on.year - birthday.year - ((on.month, on.day) < (birthday.month, birthday.day))


class ClsApprovalService:
    async def approve(self, order_id: int, user: TaiKhoan, db: AsyncSession) -> ClsApprovalResponse:
        stmt = (
            select(ChiDinh)
            .options(
                selectinload(ChiDinh.dich_vu),
                selectinload(ChiDinh.ket_qua),
                selectinload(ChiDinh.luot_kham),
                selectinload(ChiDinh.phieu_ket_qua),
                selectinload(ChiDinh.ky_thuat_vien),
            )
            .where(ChiDinh.id == order_id)
            .with_for_update(of=ChiDinh)
        )
        order = (await db.execute(stmt)).scalar_one_or_none()
        if not order:
            raise NotFoundException(f"Không tìm thấy chỉ định cận lâm sàng ID {order_id}!")
        if order.trang_thai == "da_huy":
            raise ConflictException("Chỉ định này đã bị hủy bỏ!")

        phieu = await latest_phieu(order.id, db)
        if is_phieu_approved(phieu):
            raise ConflictException("Kết quả này đã được duyệt và trả trước đó!")
        kq = order.ket_qua or (await db.execute(select(KetQuaCLS).where(KetQuaCLS.chi_dinh_id == order.id))).scalar_one_or_none()
        if phieu is None or phieu.trang_thai != PHIEU_CHO_DUYET or kq is None:
            raise ConflictException("Chưa có kết quả hoàn tất để duyệt — hãy nhập và bấm Hoàn tất kết quả trước!")

        nguoi_dung = await db.get(NguoiDung, user.nguoi_dung_id)
        now = datetime.now(timezone.utc)
        approver = ClsApprover(
            nguoi_dung_id=user.nguoi_dung_id,
            ho_ten=nguoi_dung.ho_ten if nguoi_dung else user.email,
            vai_tro=user.vai_tro,
        )

        if phieu.loai_ket_qua == XET_NGHIEM:
            detail = dict(kq.tri_so_chi_tiet or {})
        else:
            detail = {
                "loai": phieu.loai_ket_qua,
                "mo_ta": phieu.mo_ta_hinh_anh,
                "ket_luan": phieu.ket_luan,
                "de_nghi": phieu.de_nghi,
                "thiet_bi": phieu.thiet_bi_thuc_hien,
            }
        detail["duyet"] = {**approver.model_dump(), "thoi_gian": now.isoformat()}
        attachments = list(order.file_dinh_kem_urls or [])

        kq.tri_so_chi_tiet = detail
        kq.thoi_gian_duyet = now
        phieu.trang_thai = PHIEU_DA_DUYET
        phieu.thoi_gian_duyet = now
        phieu.thoi_gian_tra_ket_qua = now

        order.trang_thai = "da_co_ket_qua"
        order.thoi_gian_tra_ket_qua = now
        order.ket_qua_chi_tiet = kq.ket_qua_chi_tiet
        order.ket_qua_phan_loai = kq.ket_qua_phan_loai or "BINH_THUONG"
        order.tri_so_chi_tiet = detail
        if attachments:
            order.tep_dinh_kem_url = attachments[0]
        order.ky_thuat_vien_id = order.ky_thuat_vien_id or phieu.ky_thuat_vien_id

        stmt_pending = select(ChiDinh).where(
            ChiDinh.luot_kham_id == order.luot_kham_id,
            ChiDinh.id != order.id,
            ChiDinh.trang_thai != "da_huy",
            ChiDinh.trang_thai != "da_co_ket_qua",
        )
        pending_order = (await db.execute(stmt_pending)).scalars().first()
        if not pending_order and order.luot_kham_id:
            lk = order.luot_kham or await db.get(LuotKham, order.luot_kham_id)
            if lk:
                ticket = None
                if lk.hang_doi_kham_id:
                    ticket = await db.get(HangDoiKham, lk.hang_doi_kham_id)
                if not ticket and lk.lich_kham_id:
                    stmt_t = (
                        select(HangDoiKham)
                        .where(
                            HangDoiKham.lich_kham_id == lk.lich_kham_id,
                            HangDoiKham.trang_thai.in_([
                                TrangThaiHangDoiEnum.TAM_HOAN.value,
                                TrangThaiHangDoiEnum.CHO_KHAM.value,
                            ]),
                        )
                        .order_by(HangDoiKham.id.desc())
                    )
                    ticket = (await db.execute(stmt_t)).scalars().first()
                if not ticket:
                    stmt_t = (
                        select(HangDoiKham)
                        .where(
                            HangDoiKham.benh_nhan_id == lk.benh_nhan_id,
                            HangDoiKham.trang_thai.in_([
                                TrangThaiHangDoiEnum.TAM_HOAN.value,
                                TrangThaiHangDoiEnum.CHO_KHAM.value,
                            ]),
                        )
                        .order_by(HangDoiKham.id.desc())
                    )
                    ticket = (await db.execute(stmt_t)).scalars().first()
                if ticket and ticket.trang_thai in (
                    TrangThaiHangDoiEnum.TAM_HOAN.value,
                    TrangThaiHangDoiEnum.CHO_KHAM.value,
                ):
                    service_name = order.dich_vu.ten_dich_vu if order.dich_vu else "Cận lâm sàng"
                    service_group = (
                        nhom_dich_vu_of(order.dich_vu.ma_nhom_byt, order.dich_vu.ma_dich_vu)
                        if order.dich_vu
                        else None
                    ) or (phieu.loai_ket_qua if phieu else "can_lam_sang")
                    result_summary = order.ket_qua_chi_tiet or phieu.ket_luan or phieu.mo_ta_hinh_anh or "Đã có kết quả"
                    wait_minutes = 0
                    if order.created_at:
                        diff = now - order.created_at
                        wait_minutes = max(0, int(diff.total_seconds() // 60))
                    score_res = await typesafe_triage_service.score_cls_return_priority(
                        service_name=service_name,
                        service_group=service_group,
                        result_summary=result_summary,
                        result_classification=order.ket_qua_phan_loai,
                        result_details=detail,
                        wait_time_minutes=wait_minutes,
                    )
                    ticket.trang_thai = TrangThaiHangDoiEnum.CHO_KHAM.value
                    ticket.muc_do_uu_tien = score_res.muc_do_uu_tien
                    ticket.thoi_gian_xep_hang_lai = now
                    ticket.ghi_chu_dieu_phoi = score_res.queue_note

        patient_id = order.luot_kham.benh_nhan_id if order.luot_kham else None
        if not patient_id and order.luot_kham_id:
            lk_rec = await db.get(LuotKham, order.luot_kham_id)
            patient_id = lk_rec.benh_nhan_id if lk_rec else None

        await audit_trail_service.log_access(
            db=db,
            user_id=user.id,
            user_role=user.vai_tro,
            patient_id=patient_id,
            action="EDIT",
            resource_type="KET_QUA_CLS",
            resource_id=order.id,
            purpose="Duyệt & trả kết quả cận lâm sàng cho bác sĩ chỉ định",
        )
        await db.commit()

        return ClsApprovalResponse(
            chi_dinh_id=order.id,
            luot_kham_id=order.luot_kham_id,
            trang_thai=order.trang_thai,
            trang_thai_ket_qua=PHIEU_DA_DUYET,
            thoi_gian_duyet=now,
            nguoi_duyet=approver,
            ket_qua=_to_returned(order, now, detail, phieu=phieu),
        )

    async def returned_results(
        self, user: TaiKhoan, since: Optional[datetime], db: AsyncSession
    ) -> ReturnedClsResultsResponse:
        server_time = datetime.now(timezone.utc)
        if since is None:
            since = clinic_day_range()[0]
        elif since.tzinfo is None:
            since = since.replace(tzinfo=timezone.utc)

        effective_time = func.coalesce(KetQuaCLS.thoi_gian_duyet, ChiDinh.thoi_gian_tra_ket_qua, ChiDinh.updated_at)
        stmt = (
            select(ChiDinh, KetQuaCLS.thoi_gian_duyet, KetQuaCLS.tri_so_chi_tiet)
            .outerjoin(KetQuaCLS, KetQuaCLS.chi_dinh_id == ChiDinh.id)
            .options(
                selectinload(ChiDinh.dich_vu),
                selectinload(ChiDinh.ky_thuat_vien),
                selectinload(ChiDinh.phieu_ket_qua),
            )
            .where(
                ChiDinh.trang_thai == "da_co_ket_qua",
                effective_time.is_not(None),
                effective_time >= since - _FEED_OVERLAP,
            )
            .order_by(effective_time.asc(), ChiDinh.id.asc())
            .limit(_FEED_LIMIT)
        )
        if user.vai_tro != VaiTroEnum.ADMIN.value:
            bac_si = (await db.execute(select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id))).scalar_one_or_none()
            if not bac_si:
                return ReturnedClsResultsResponse(items=[], server_time=server_time)
            stmt = stmt.where(ChiDinh.luot_kham.has(LuotKham.bac_si_id == bac_si.id))

        rows = (await db.execute(stmt)).all()
        items = [_to_returned(order, thoi_gian_duyet, kq_detail) for order, thoi_gian_duyet, kq_detail in rows]
        return ReturnedClsResultsResponse(items=items, server_time=server_time)

    async def get_report(self, order_id: int, user: TaiKhoan, db: AsyncSession) -> ClsReportResponse:
        stmt = (
            select(ChiDinh)
            .options(
                selectinload(ChiDinh.dich_vu),
                selectinload(ChiDinh.ket_qua),
                selectinload(ChiDinh.luot_kham).selectinload(LuotKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(ChiDinh.luot_kham).selectinload(LuotKham.bac_si).selectinload(BacSi.nguoi_dung),
            )
            .where(ChiDinh.id == order_id)
        )
        order = (await db.execute(stmt)).scalar_one_or_none()
        if not order:
            raise NotFoundException(f"Không tìm thấy chỉ định cận lâm sàng ID {order_id}!")
        phieu = await latest_phieu(order.id, db)
        kq = order.ket_qua
        if not is_phieu_approved(phieu) or kq is None or kq.thoi_gian_duyet is None:
            raise ConflictException("Chỉ in được phiếu kết quả đã duyệt & trả!")

        detail = kq.tri_so_chi_tiet or {}
        approver = _approver_of(detail) or ClsApprover(nguoi_dung_id=0, ho_ten="", vai_tro="")
        lk = order.luot_kham
        bn = lk.benh_nhan if lk else None
        nd = bn.nguoi_dung if bn else None
        bs = lk.bac_si if lk else None
        dv = order.dich_vu
        ktv = await self._technician_name(phieu, order, db)

        report = ClsReportResponse(
            ma_phieu=f"KQ-CLS-{order.id:06d}",
            chi_dinh_id=order.id,
            luot_kham_id=order.luot_kham_id,
            loai_phieu=LOAI_PHIEU_XET_NGHIEM if phieu.loai_ket_qua == XET_NGHIEM else LOAI_PHIEU_HINH_ANH,
            nhom_dich_vu=nhom_dich_vu_of(dv.ma_nhom_byt, dv.ma_dich_vu) if dv else None,
            ma_dich_vu=dv.ma_dich_vu if dv else f"DV-{order.dich_vu_id}",
            ten_dich_vu=dv.ten_dich_vu if dv else "Dịch vụ cận lâm sàng",
            phong_kham=ClsReportClinic(
                co_quan_chu_quan=settings.CLINIC_PARENT_AGENCY,
                ten=settings.CLINIC_NAME,
                dia_chi=settings.CLINIC_ADDRESS,
                dien_thoai=settings.CLINIC_PHONE,
            ),
            benh_nhan=ClsReportPatient(
                ma_benh_nhan=bn.ma_dinh_danh_y_te if bn else None,
                ho_ten=nd.ho_ten if nd else "Chưa xác định",
                gioi_tinh=nd.gioi_tinh if nd else None,
                ngay_sinh=nd.ngay_sinh if nd else None,
                tuoi=_age_on(nd.ngay_sinh if nd else None, kq.thoi_gian_duyet.date()),
                dia_chi=nd.dia_chi if nd else None,
                so_dien_thoai=nd.so_dien_thoai if nd else None,
            ),
            bac_si_chi_dinh=bs.nguoi_dung.ho_ten if bs and bs.nguoi_dung else None,
            chan_doan_so_bo=lk.chan_doan_so_bo if lk else None,
            ly_do_vao_kham=lk.ly_do_vao_kham if lk else None,
            thoi_gian_chi_dinh=order.created_at,
            thoi_gian_lay_mau=order.thoi_gian_lay_mau,
            thoi_gian_thuc_hien=order.thoi_gian_thuc_hien,
            ky_thuat_vien_thuc_hien=ktv,
            thiet_bi_thuc_hien=phieu.thiet_bi_thuc_hien,
            nguoi_duyet=approver,
            thoi_gian_duyet=kq.thoi_gian_duyet,
            ket_qua_phan_loai=order.ket_qua_phan_loai,
            ket_luan=phieu.ket_luan or detail.get("ket_luan"),
            ghi_chu=phieu.ghi_chu or detail.get("ghi_chu"),
            mo_ta_hinh_anh=phieu.mo_ta_hinh_anh,
            de_nghi=phieu.de_nghi,
            tep_dinh_kem_urls=list(order.file_dinh_kem_urls or []),
        )
        if report.loai_phieu == LOAI_PHIEU_XET_NGHIEM:
            entered = detail.get("chi_so") or {}
            report.chi_tiet = [
                ClsReportLabRow(
                    ma=row["ma"],
                    ten=row["ten"],
                    gia_tri=str(entered.get(row["ma"], row.get("gia_tri"))),
                    don_vi=row.get("don_vi"),
                    khoang_tham_chieu=row.get("khoang_tham_chieu"),
                    danh_gia=row.get("danh_gia") or "BINH_THUONG",
                    huong=row.get("huong"),
                    bat_thuong=(row.get("danh_gia") or "BINH_THUONG") != "BINH_THUONG",
                )
                for row in sorted(detail.get("chi_tiet") or [], key=lambda r: r.get("thu_tu", 0))
            ]
            report.so_bat_thuong = sum(1 for r in report.chi_tiet if r.bat_thuong)

        if bn:
            await audit_trail_service.log_access(
                db=db,
                user_id=user.id,
                user_role=user.vai_tro,
                patient_id=bn.id,
                action="EXPORT",
                resource_type="PHIEU_KET_QUA_CLS",
                resource_id=order.id,
                purpose="In phiếu kết quả cận lâm sàng",
            )
            await db.commit()
        return report

    @staticmethod
    async def _technician_name(phieu: PhieuKetQuaCLS, order: ChiDinh, db: AsyncSession) -> Optional[str]:
        user_id = phieu.ky_thuat_vien_id or order.ky_thuat_vien_id
        if not user_id:
            return None
        nguoi_dung = await db.get(NguoiDung, user_id)
        return nguoi_dung.ho_ten if nguoi_dung else None


cls_approval_service = ClsApprovalService()
