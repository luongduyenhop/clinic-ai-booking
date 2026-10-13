import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
    UnprocessableEntityException,
)
from app.models.medical import ChiDinh, DichVu, LuotKham
from app.models.user import BacSi, BenhNhan, NguoiDung, PhongKham
from app.schemas.subclinical import (
    PatientBrief,
    SubclinicalDetailResponse,
    SubclinicalQueueItem,
    SubclinicalQueueResponse,
    SubclinicalResultSubmitRequest,
    SubclinicalServiceBrief,
)

logger = logging.getLogger(__name__)


class SubclinicalService:
    """Nghiệp vụ Phân hệ Kỹ thuật viên Cận lâm sàng & Kết quả Xét nghiệm / CĐHA (Subclinical LIS/PACS)"""

    async def get_subclinical_queue(
        self,
        phong_thuc_hien_id: Optional[int] = None,
        trang_thai: Optional[str] = None,
        db: AsyncSession = None,
    ) -> SubclinicalQueueResponse:
        """Lấy danh sách hàng đợi chỉ định cận lâm sàng tại các phòng kỹ thuật"""
        stmt = (
            select(ChiDinh)
            .options(
                selectinload(ChiDinh.dich_vu),
                selectinload(ChiDinh.luot_kham).selectinload(LuotKham.benh_nhan).selectinload(BenhNhan.nguoi_dung),
                selectinload(ChiDinh.luot_kham).selectinload(LuotKham.bac_si).selectinload(BacSi.nguoi_dung),
            )
            .order_by(ChiDinh.id.desc())
        )

        if phong_thuc_hien_id is not None:
            stmt = stmt.where(
                (ChiDinh.phong_thuc_hien_id == phong_thuc_hien_id)
                | (ChiDinh.dich_vu.has(DichVu.phong_thuc_hien_id == phong_thuc_hien_id))
            )

        if trang_thai:
            stmt = stmt.where(ChiDinh.trang_thai == trang_thai)
        else:
            # Mặc định chỉ lấy các ca đang chờ thực hiện hoặc đang tiến hành
            stmt = stmt.where(ChiDinh.trang_thai.in_(["da_chi_dinh", "dang_thuc_hien"]))

        orders = (await db.execute(stmt)).scalars().all()

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

            items.append(
                SubclinicalQueueItem(
                    id=o.id,
                    luot_kham_id=o.luot_kham_id,
                    dich_vu=dv_brief,
                    benh_nhan=benh_nhan_dto,
                    bac_si_chi_dinh=bac_si_name,
                    trang_thai=o.trang_thai,
                    phong_thuc_hien_id=o.phong_thuc_hien_id or (o.dich_vu.phong_thuc_hien_id if o.dich_vu else None),
                    thoi_gian_chi_dinh=o.created_at,
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
