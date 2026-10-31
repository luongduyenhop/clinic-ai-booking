"""Nhập kết quả xét nghiệm máu theo bộ chỉ số mẫu và tự cảnh báo chỉ số vượt ngưỡng.

Backend tự đánh giá từng chỉ số (không tin cờ do client gửi lên) và lưu vào `ket_qua_cls`;
khi trả kết quả thì ghi thêm các cột kết quả trên `chi_dinh` để các màn hình đang đọc chúng không bị vỡ.
`ket_qua_cls` có thể chứa bản nháp: kết quả chỉ được coi là đã trả khi `chi_dinh.trang_thai == "da_co_ket_qua"`.
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictException, NotFoundException, UnprocessableEntityException
from app.models.medical import ChiDinh, KetQuaCLS, LuotKham
from app.models.user import BenhNhan
from app.schemas.cls_lab_result import (
    LabIndicatorResult,
    LabIndicatorTemplate,
    LabResultResponse,
    LabResultSaved,
    LabResultSubmitRequest,
    LabTemplateResponse,
)
from app.services.cls_lab_templates import LabIndicator, LabTemplate, find_lab_template, normalize_gioi_tinh
from app.services.cls_service_group import XET_NGHIEM, nhom_dich_vu_of

# Đánh giá từng chỉ số
THAP = "THAP"
BINH_THUONG = "BINH_THUONG"
CAO = "CAO"
NGUY_HIEM = "NGUY_HIEM"

# Phân loại tổng hợp của chỉ định (cùng bộ giá trị với ket_qua_phan_loai bên Bàn khám)
PHAN_LOAI_BINH_THUONG = "BINH_THUONG"
PHAN_LOAI_BAT_THUONG = "BAT_THUONG"
PHAN_LOAI_NGUY_KICH = "NGUY_KICH"

_ARROW = {THAP: "▼", CAO: "▲"}


def danh_gia_chi_so(
    gia_tri: Decimal,
    thap: Optional[Decimal],
    cao: Optional[Decimal],
    nguy_kich_thap: Optional[Decimal] = None,
    nguy_kich_cao: Optional[Decimal] = None,
) -> Tuple[str, Optional[str]]:
    """Trả về (danh_gia, huong). Các ngưỡng là biên còn chấp nhận: bằng ngưỡng chưa bị nâng mức."""
    if nguy_kich_thap is not None and gia_tri < nguy_kich_thap:
        return NGUY_HIEM, THAP
    if nguy_kich_cao is not None and gia_tri > nguy_kich_cao:
        return NGUY_HIEM, CAO
    if thap is not None and gia_tri < thap:
        return THAP, THAP
    if cao is not None and gia_tri > cao:
        return CAO, CAO
    return BINH_THUONG, None


def phan_loai_tong_hop(danh_gias: List[str]) -> str:
    """Mức nặng nhất trong các chỉ số: có chỉ số nguy hiểm -> NGUY_KICH, có chỉ số thấp/cao -> BAT_THUONG"""
    if NGUY_HIEM in danh_gias:
        return PHAN_LOAI_NGUY_KICH
    if THAP in danh_gias or CAO in danh_gias:
        return PHAN_LOAI_BAT_THUONG
    return PHAN_LOAI_BINH_THUONG


def khoang_tham_chieu_text(thap: Optional[Decimal], cao: Optional[Decimal]) -> str:
    if thap is not None and cao is not None:
        return f"{_fmt(thap)} - {_fmt(cao)}"
    if cao is not None:
        return f"≤ {_fmt(cao)}"
    if thap is not None:
        return f"≥ {_fmt(thap)}"
    return ""


def _fmt(value: Decimal) -> str:
    return format(value.normalize(), "f")


def _num(value: Optional[Decimal]) -> Optional[float]:
    return None if value is None else float(value)


def _indicator_template(ind: LabIndicator, gioi_tinh: Optional[str], thu_tu: int) -> LabIndicatorTemplate:
    thap, cao = ind.khoang(gioi_tinh)
    return LabIndicatorTemplate(
        ma=ind.ma,
        ten=ind.ten,
        don_vi=ind.don_vi,
        thap=_num(thap),
        cao=_num(cao),
        nguy_kich_thap=_num(ind.nguy_kich_thap),
        nguy_kich_cao=_num(ind.nguy_kich_cao),
        khoang_tham_chieu=khoang_tham_chieu_text(thap, cao),
        thu_tu=thu_tu,
    )


def evaluate_lab_values(
    template: LabTemplate, gioi_tinh: Optional[str], values: Dict[str, Decimal]
) -> List[LabIndicatorResult]:
    """Đánh giá các chỉ số đã nhập theo thứ tự của mẫu; mã không có trong mẫu -> 422"""
    known = {ind.ma for ind in template.chi_so}
    unknown = sorted(set(values) - known)
    if unknown:
        raise UnprocessableEntityException(
            f"Chỉ số không thuộc mẫu {template.ten_mau}: {', '.join(unknown)}"
        )

    results: List[LabIndicatorResult] = []
    for thu_tu, ind in enumerate(template.chi_so):
        if ind.ma not in values:
            continue
        gia_tri = values[ind.ma]
        thap, cao = ind.khoang(gioi_tinh)
        danh_gia, huong = danh_gia_chi_so(gia_tri, thap, cao, ind.nguy_kich_thap, ind.nguy_kich_cao)
        results.append(
            LabIndicatorResult(
                ma=ind.ma,
                ten=ind.ten,
                gia_tri=float(gia_tri),
                don_vi=ind.don_vi,
                khoang_tham_chieu=khoang_tham_chieu_text(thap, cao),
                thap=_num(thap),
                cao=_num(cao),
                nguy_kich_thap=_num(ind.nguy_kich_thap),
                nguy_kich_cao=_num(ind.nguy_kich_cao),
                danh_gia=danh_gia,
                huong=huong,
                thu_tu=thu_tu,
            )
        )
    return results


def _summary_text(results: List[LabIndicatorResult], chi_so: Dict[str, str], ket_luan: Optional[str]) -> str:
    """Bản tóm tắt dạng chữ cho cột chi_dinh.ket_qua_chi_tiet (các màn hình cũ đọc dạng text)"""
    lines = []
    for r in results:
        flag = "" if r.danh_gia == BINH_THUONG else f" {_ARROW[r.huong]} {r.danh_gia}"
        lines.append(f"{r.ten} ({r.ma}): {chi_so[r.ma]} {r.don_vi}{flag}")
    if ket_luan:
        lines.append(f"Kết luận: {ket_luan}")
    return "\n".join(lines)


class ClsLabResultService:
    async def _load_lab_order(
        self, order_id: int, db: AsyncSession, for_update: bool = False
    ) -> Tuple[ChiDinh, LabTemplate, Optional[str]]:
        stmt = (
            select(ChiDinh)
            .options(
                selectinload(ChiDinh.dich_vu),
                selectinload(ChiDinh.ket_qua),
                selectinload(ChiDinh.luot_kham).selectinload(LuotKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
            )
            .where(ChiDinh.id == order_id)
        )
        if for_update:
            stmt = stmt.with_for_update(of=ChiDinh)
        order = (await db.execute(stmt)).scalar_one_or_none()
        if not order:
            raise NotFoundException(f"Không tìm thấy chỉ định cận lâm sàng ID {order_id}!")

        dv = order.dich_vu
        if not dv or nhom_dich_vu_of(dv.ma_nhom_byt, dv.ma_dich_vu) != XET_NGHIEM:
            raise UnprocessableEntityException("Chỉ định này không thuộc nhóm Xét nghiệm!")
        template = find_lab_template(dv.ma_dich_vu, dv.ten_dich_vu)
        if not template:
            raise UnprocessableEntityException(f"Chưa có bộ chỉ số mẫu cho dịch vụ {dv.ten_dich_vu}!")

        nguoi_dung = order.luot_kham.benh_nhan.nguoi_dung if order.luot_kham and order.luot_kham.benh_nhan else None
        gioi_tinh = normalize_gioi_tinh(nguoi_dung.gioi_tinh if nguoi_dung else None)
        return order, template, gioi_tinh

    @staticmethod
    def _saved_result(order: ChiDinh) -> Optional[LabResultSaved]:
        kq = order.ket_qua
        detail = (kq.tri_so_chi_tiet if kq else None) or {}
        if detail.get("loai") != XET_NGHIEM:
            return None
        return LabResultSaved(
            da_tra_ket_qua=order.trang_thai == "da_co_ket_qua",
            ket_qua_phan_loai=kq.ket_qua_phan_loai or PHAN_LOAI_BINH_THUONG,
            chi_so=detail.get("chi_so") or {},
            chi_tiet=detail.get("chi_tiet") or [],
            so_bat_thuong=detail.get("so_bat_thuong", 0),
            so_nguy_hiem=detail.get("so_nguy_hiem", 0),
            ket_luan=detail.get("ket_luan"),
            ghi_chu=detail.get("ghi_chu"),
            thoi_gian_tra_ket_qua=order.thoi_gian_tra_ket_qua if order.trang_thai == "da_co_ket_qua" else None,
        )

    async def get_lab_template(self, order_id: int, db: AsyncSession) -> LabTemplateResponse:
        """Bộ chỉ số mẫu (theo giới tính bệnh nhân) của chỉ định xét nghiệm, kèm kết quả đã lưu nếu có"""
        order, template, gioi_tinh = await self._load_lab_order(order_id, db)
        return LabTemplateResponse(
            chi_dinh_id=order.id,
            trang_thai=order.trang_thai,
            ma_dich_vu=order.dich_vu.ma_dich_vu,
            ten_dich_vu=order.dich_vu.ten_dich_vu,
            ma_mau=template.ma_mau,
            ten_mau=template.ten_mau,
            gioi_tinh_ap_dung=gioi_tinh,
            chi_so=[_indicator_template(ind, gioi_tinh, i) for i, ind in enumerate(template.chi_so)],
            ket_qua=self._saved_result(order),
        )

    async def submit_lab_result(
        self,
        order_id: int,
        payload: LabResultSubmitRequest,
        technician_user_id: int,
        db: AsyncSession,
    ) -> LabResultResponse:
        """Lưu nháp hoặc trả kết quả xét nghiệm; chỉ nhận chỉ định đang thực hiện (hoặc cập nhật kết quả đã trả)"""
        order, template, gioi_tinh = await self._load_lab_order(order_id, db, for_update=True)

        if order.trang_thai == "da_huy":
            raise ConflictException("Không thể nhập kết quả cho chỉ định đã bị hủy!")
        if order.trang_thai == "da_chi_dinh":
            raise ConflictException("Chỉ định chưa được tiếp nhận, hãy bấm Tiếp nhận & bắt đầu trước khi nhập kết quả!")
        if order.trang_thai == "da_co_ket_qua" and payload.luu_nhap:
            raise ConflictException("Kết quả đã trả cho bác sĩ, không thể lưu nháp — hãy bấm Cập nhật kết quả!")
        if order.trang_thai not in ("dang_thuc_hien", "da_co_ket_qua"):
            raise ConflictException(f"Không thể nhập kết quả ở trạng thái {order.trang_thai}!")

        results = evaluate_lab_values(template, gioi_tinh, payload.chi_so)
        danh_gias = [r.danh_gia for r in results]
        phan_loai = phan_loai_tong_hop(danh_gias)
        existing_detail = (order.ket_qua.tri_so_chi_tiet or {}) if order.ket_qua else {}
        existing_ket_luan = existing_detail.get("ket_luan")
        existing_ghi_chu = existing_detail.get("ghi_chu")

        ket_luan = (payload.ket_luan or "").strip() or existing_ket_luan or None
        ghi_chu = (payload.ghi_chu or "").strip() or existing_ghi_chu or None

        if not payload.luu_nhap and not ket_luan:
            raise UnprocessableEntityException("Cần nhập kết luận trước khi trả kết quả xét nghiệm!")
        chi_so = {r.ma: _fmt(payload.chi_so[r.ma]) for r in results}
        detail = {
            "loai": XET_NGHIEM,
            "ma_mau": template.ma_mau,
            "gioi_tinh_ap_dung": gioi_tinh,
            # chi_so dạng {mã: giá trị} giữ tương thích với màn hình kết quả hiện có
            "chi_so": chi_so,
            "chi_tiet": [r.model_dump() for r in results],
            "so_bat_thuong": sum(1 for d in danh_gias if d != BINH_THUONG),
            "so_nguy_hiem": danh_gias.count(NGUY_HIEM),
            "ket_luan": ket_luan,
            "ghi_chu": ghi_chu,
        }

        now = datetime.now(timezone.utc)
        kq = order.ket_qua
        if kq is None:
            kq = KetQuaCLS(chi_dinh_id=order.id)
            db.add(kq)
        kq.nguoi_thuc_hien_id = technician_user_id
        kq.ket_qua_chi_tiet = _summary_text(results, chi_so, ket_luan)
        kq.tri_so_chi_tiet = detail
        kq.ket_qua_phan_loai = phan_loai
        kq.thoi_gian_lay_mau = order.thoi_gian_lay_mau
        kq.thoi_gian_thuc_hien = order.thoi_gian_thuc_hien or now

        if not payload.luu_nhap:
            order.trang_thai = "da_co_ket_qua"
            order.thoi_gian_tra_ket_qua = now
            order.ky_thuat_vien_id = technician_user_id
            order.ket_qua_chi_tiet = kq.ket_qua_chi_tiet
            order.ket_qua_phan_loai = phan_loai
            order.tri_so_chi_tiet = detail

        response = LabResultResponse(
            chi_dinh_id=order.id,
            trang_thai=order.trang_thai,
            ket_qua=LabResultSaved(
                da_tra_ket_qua=order.trang_thai == "da_co_ket_qua",
                ket_qua_phan_loai=phan_loai,
                chi_so=chi_so,
                chi_tiet=results,
                so_bat_thuong=detail["so_bat_thuong"],
                so_nguy_hiem=detail["so_nguy_hiem"],
                ket_luan=ket_luan,
                ghi_chu=ghi_chu,
                thoi_gian_tra_ket_qua=order.thoi_gian_tra_ket_qua if order.trang_thai == "da_co_ket_qua" else None,
            ),
        )
        await db.commit()
        return response


cls_lab_result_service = ClsLabResultService()
