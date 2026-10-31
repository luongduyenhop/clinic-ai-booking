import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
)
from app.models.medical import ChiDinh, DichVu, LuotKham
from app.models.user import BacSi, BenhNhan, NguoiDung
from app.schemas.subclinical import (
    PatientBrief,
    SubclinicalQueueItem,
    SubclinicalQueueResponse,
    SubclinicalResultSubmitRequest,
    SubclinicalServiceBrief,
)
from app.services.cls_service_group import clinic_day_range, nhom_dich_vu_condition, nhom_dich_vu_of

logger = logging.getLogger(__name__)


class SubclinicalService:
    """Nghiệp vụ Phân hệ Kỹ thuật viên Cận lâm sàng & Kết quả Xét nghiệm / CĐHA (Subclinical LIS/PACS)"""

    async def get_subclinical_queue(
        self,
        phong_thuc_hien_id: Optional[int] = None,
        trang_thai: Optional[str] = None,
        db: AsyncSession = None,
        nhom_dich_vu: Optional[str] = None,
        ngay: Optional[date] = None,
        tu_khoa: Optional[str] = None,
    ) -> SubclinicalQueueResponse:
        """Lấy hàng đợi chỉ định cận lâm sàng trong ngày (giờ phòng khám), ca chỉ định sớm nhất lên trước"""
        day_start, day_end = clinic_day_range(ngay)
        stmt = (
            select(ChiDinh)
            .options(
                selectinload(ChiDinh.dich_vu),
                selectinload(ChiDinh.luot_kham).selectinload(LuotKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(ChiDinh.luot_kham).selectinload(LuotKham.bac_si).selectinload(BacSi.nguoi_dung),
            )
            .where(ChiDinh.created_at >= day_start, ChiDinh.created_at < day_end)
            .order_by(ChiDinh.created_at.asc(), ChiDinh.id.asc())
        )

        if phong_thuc_hien_id is not None:
            stmt = stmt.where(
                (ChiDinh.phong_thuc_hien_id == phong_thuc_hien_id)
                | (ChiDinh.dich_vu.has(DichVu.phong_thuc_hien_id == phong_thuc_hien_id))
            )

        if nhom_dich_vu:
            stmt = stmt.where(ChiDinh.dich_vu.has(nhom_dich_vu_condition(nhom_dich_vu)))

        if tu_khoa and tu_khoa.strip():
            pattern = f"%{tu_khoa.strip()}%"
            stmt = stmt.where(
                ChiDinh.luot_kham.has(
                    LuotKham.benh_nhan.has(
                        BenhNhan.ma_dinh_danh_y_te.ilike(pattern)
                        | BenhNhan.nguoi_dung.has(
                            NguoiDung.ho_ten.ilike(pattern) | NguoiDung.so_dien_thoai.ilike(pattern)
                        )
                    )
                )
            )

        if trang_thai == "tat_ca":
            pass
        elif trang_thai:
            stmt = stmt.where(ChiDinh.trang_thai == trang_thai)
        else:
            # Mặc định chỉ lấy các ca đang chờ thực hiện hoặc đang tiến hành
            stmt = stmt.where(ChiDinh.trang_thai.in_(["da_chi_dinh", "dang_thuc_hien"]))

        orders = (await db.execute(stmt)).scalars().all()

        now = datetime.now(timezone.utc)
        items: List[SubclinicalQueueItem] = []
        for o in orders:
            benh_nhan_dto = PatientBrief(ho_ten="Chưa xác định")
            if o.luot_kham and o.luot_kham.benh_nhan:
                bn = o.luot_kham.benh_nhan
                mabn = bn.ma_dinh_danh_y_te
                ho_ten = bn.nguoi_dung.ho_ten if bn.nguoi_dung else "Chưa xác định"
                sdt = bn.nguoi_dung.so_dien_thoai if bn.nguoi_dung else None
                gioi_tinh = bn.nguoi_dung.gioi_tinh if bn.nguoi_dung else None
                nam_sinh = bn.nguoi_dung.ngay_sinh.year if (bn.nguoi_dung and bn.nguoi_dung.ngay_sinh) else None
                benh_nhan_dto = PatientBrief(
                    mabn=mabn,
                    ho_ten=ho_ten,
                    so_dien_thoai=sdt,
                    gioi_tinh=gioi_tinh,
                    nam_sinh=nam_sinh,
                    di_ung_thuoc=bn.di_ung_thuoc,
                )

            bac_si_name = None
            if o.luot_kham and o.luot_kham.bac_si and o.luot_kham.bac_si.nguoi_dung:
                bac_si_name = o.luot_kham.bac_si.nguoi_dung.ho_ten

            dv_brief = SubclinicalServiceBrief(
                id=o.dich_vu_id,
                ma_dich_vu=o.dich_vu.ma_dich_vu if o.dich_vu else f"DV-{o.dich_vu_id}",
                ten_dich_vu=o.dich_vu.ten_dich_vu if o.dich_vu else "Dịch vụ cận lâm sàng",
                don_gia=o.don_gia_tai_thoi_diem or Decimal("0.00"),
            )

            waited_until = o.thoi_gian_thuc_hien or now
            items.append(
                SubclinicalQueueItem(
                    id=o.id,
                    luot_kham_id=o.luot_kham_id,
                    dich_vu=dv_brief,
                    nhom_dich_vu=nhom_dich_vu_of(o.dich_vu.ma_nhom_byt, o.dich_vu.ma_dich_vu) if o.dich_vu else None,
                    ten_dich_vu=dv_brief.ten_dich_vu,
                    benh_nhan=benh_nhan_dto,
                    bac_si_chi_dinh=bac_si_name,
                    ly_do_vao_kham=o.luot_kham.ly_do_vao_kham if o.luot_kham else None,
                    chan_doan_so_bo=o.luot_kham.chan_doan_so_bo if o.luot_kham else None,
                    trang_thai=o.trang_thai,
                    phong_thuc_hien_id=o.phong_thuc_hien_id or (o.dich_vu.phong_thuc_hien_id if o.dich_vu else None),
                    thoi_gian_chi_dinh=o.created_at,
                    thoi_gian_cho_phut=max(0, int((waited_until - o.created_at).total_seconds() // 60)),
                    ket_qua_chi_tiet=o.ket_qua_chi_tiet,
                    ket_qua_phan_loai=o.ket_qua_phan_loai,
                    tri_so_chi_tiet=o.tri_so_chi_tiet,
                    file_dinh_kem_urls=o.file_dinh_kem_urls,
                )
            )

        return SubclinicalQueueResponse(items=items, total=len(items))

    async def start_subclinical_order(
        self,
        order_id: int,
        technician_user_id: int,
        db: AsyncSession,
    ) -> ChiDinh:
        """Kỹ thuật viên tiếp nhận mẫu hoặc bắt đầu thực hiện ca cận lâm sàng"""
        stmt = (
            select(ChiDinh)
            .where(ChiDinh.id == order_id)
            .with_for_update()
        )
        order = (await db.execute(stmt)).scalar_one_or_none()
        if not order:
            raise NotFoundException(f"Không tìm thấy chỉ định cận lâm sàng ID {order_id}!")

        if order.trang_thai == "da_co_ket_qua":
            raise ConflictException("Chỉ định này đã có kết quả xét nghiệm hoàn tất!")

        if order.trang_thai == "da_huy":
            raise ConflictException("Chỉ định này đã bị hủy bỏ!")

        now = datetime.now(timezone.utc)
        order.trang_thai = "dang_thuc_hien"
        order.ky_thuat_vien_id = technician_user_id
        order.thoi_gian_thuc_hien = now
        if not order.thoi_gian_lay_mau:
            order.thoi_gian_lay_mau = now

        await db.commit()
        await db.refresh(order)
        return order

    async def submit_subclinical_result(
        self,
        order_id: int,
        payload: SubclinicalResultSubmitRequest,
        technician_user_id: int,
        db: AsyncSession,
    ) -> ChiDinh:
        """Nhập kết quả, trị số chi tiết và trả kết quả xét nghiệm / CĐHA"""
        stmt = (
            select(ChiDinh)
            .options(selectinload(ChiDinh.dich_vu))
            .where(ChiDinh.id == order_id)
            .with_for_update()
        )
        order = (await db.execute(stmt)).scalar_one_or_none()
        if not order:
            raise NotFoundException(f"Không tìm thấy chỉ định cận lâm sàng ID {order_id}!")

        if order.trang_thai == "da_huy":
            raise ConflictException("Không thể nhập kết quả cho chỉ định đã bị hủy!")

        now = datetime.now(timezone.utc)
        order.ket_qua_chi_tiet = payload.ket_qua_chi_tiet
        order.ket_qua_phan_loai = payload.ket_qua_phan_loai or "BINH_THUONG"
        order.tri_so_chi_tiet = payload.tri_so_chi_tiet or {}
        order.file_dinh_kem_urls = payload.file_dinh_kem_urls or []
        order.trang_thai = "da_co_ket_qua"
        order.thoi_gian_tra_ket_qua = now
        order.ky_thuat_vien_id = technician_user_id

        await db.commit()
        await db.refresh(order)
        return order

    async def cancel_subclinical_order(
        self,
        order_id: int,
        reason: str,
        user_id: int,
        db: AsyncSession,
    ) -> ChiDinh:
        """Hủy chỉ định cận lâm sàng (ví dụ khi bệnh nhân không đồng ý thực hiện)"""
        stmt = select(ChiDinh).where(ChiDinh.id == order_id).with_for_update()
        order = (await db.execute(stmt)).scalar_one_or_none()
        if not order:
            raise NotFoundException(f"Không tìm thấy chỉ định cận lâm sàng ID {order_id}!")

        if order.trang_thai == "da_co_ket_qua":
            raise ConflictException("Không thể hủy chỉ định đã có kết quả!")

        order.trang_thai = "da_huy"
        order.ket_qua_chi_tiet = f"HỦY BỎ: {reason}"
        await db.commit()
        await db.refresh(order)
        return order


subclinical_service = SubclinicalService()
