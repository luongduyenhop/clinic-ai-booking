import logging
from datetime import date, datetime, timezone
from typing import List

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import ConflictException, ForbiddenException, NotFoundException
from app.models.medical import ChiDinh, DichVu, LuotKham
from app.models.user import BacSi, BenhNhan, NguoiDung, TaiKhoan, VaiTroEnum
from app.schemas.subclinical import (
    WorkspaceOrderItem,
    WorkspaceOrdersRequest,
    WorkspaceOrdersResponse,
    WorkspacePatientIn,
)
from app.services.cls_service_group import nhom_dich_vu_of
from app.services.clinical_service import clinical_service
from app.services.credential_service import credential_service

logger = logging.getLogger(__name__)


def _normalize_name(name: str) -> str:
    return " ".join((name or "").split()).casefold()


class ClsWorkspaceBridgeService:
    """Cầu nối bàn khám bác sĩ (lượt khám lưu trong workspace-state) với bảng chi_dinh.

    Bàn khám hiện chưa tạo luot_kham thật nên mỗi lượt khám của workspace được ánh xạ sang 1 LuotKham
    có ma_kcb = "WS-<workspace_encounter_id>-<benh_nhan_id>". Gọi lại nhiều lần không tạo trùng.
    """

    async def _find_or_create_patient(
        self, workspace_encounter_id: str, payload: WorkspacePatientIn, db: AsyncSession
    ) -> BenhNhan:
        ma = (payload.ma or "").strip() or f"WS-BN-{workspace_encounter_id}"
        stmt = select(BenhNhan).options(selectinload(BenhNhan.nguoi_dung)).where(BenhNhan.ma_dinh_danh_y_te == ma)
        benh_nhan = (await db.execute(stmt)).scalar_one_or_none()
        if benh_nhan:
            existing_name = benh_nhan.nguoi_dung.ho_ten if benh_nhan.nguoi_dung else ""
            if _normalize_name(existing_name) != _normalize_name(payload.ho_ten):
                raise ConflictException(f"Mã bệnh nhân {ma} đã thuộc về bệnh nhân khác, không thể gửi chỉ định!")
            return benh_nhan

        so_dien_thoai = payload.so_dien_thoai
        if so_dien_thoai:
            taken = (await db.execute(select(NguoiDung.id).where(NguoiDung.so_dien_thoai == so_dien_thoai))).first()
            if taken:
                so_dien_thoai = None

        nguoi_dung = NguoiDung(
            ho_ten=payload.ho_ten.strip(),
            gioi_tinh=payload.gioi_tinh,
            so_dien_thoai=so_dien_thoai,
            # Bàn khám chỉ có tuổi: quy ước ngày 01/01 của năm sinh
            ngay_sinh=date(date.today().year - payload.tuoi, 1, 1) if payload.tuoi is not None else None,
        )
        db.add(nguoi_dung)
        await db.flush()
        benh_nhan = BenhNhan(nguoi_dung_id=nguoi_dung.id, ma_dinh_danh_y_te=ma, di_ung_thuoc=payload.di_ung_thuoc)
        db.add(benh_nhan)
        await db.flush()
        return benh_nhan

    async def create_orders_from_workspace(
        self, payload: WorkspaceOrdersRequest, user: TaiKhoan, db: AsyncSession
    ) -> WorkspaceOrdersResponse:
        bac_si = None
        if user.vai_tro == VaiTroEnum.BAC_SI.value:
            bac_si = await clinical_service._get_doctor_from_user(user, db)
        elif user.vai_tro == VaiTroEnum.ADMIN.value:
            stmt_admin_doc = select(BacSi).where(BacSi.nguoi_dung_id == user.nguoi_dung_id)
            bac_si = (await db.execute(stmt_admin_doc)).scalar_one_or_none()
            if not bac_si:
                stmt_fallback = select(BacSi).where(BacSi.is_active.is_(True)).order_by(BacSi.id.asc())
                bac_si = (await db.execute(stmt_fallback)).scalars().first()
                if not bac_si:
                    raise NotFoundException("Hệ thống chưa có hồ sơ Bác sĩ nào đang hoạt động!")
        else:
            raise ForbiddenException("Chức năng chỉ định cận lâm sàng chỉ dành cho Bác sĩ hoặc Quản trị viên!")

        dich_vu_ids = list(dict.fromkeys(payload.dich_vu_ids))
        services = (await db.execute(select(DichVu).where(DichVu.id.in_(dich_vu_ids)))).scalars().all()
        services_by_id = {dv.id: dv for dv in services}
        for dv_id in dich_vu_ids:
            dv = services_by_id.get(dv_id)
            if not dv or not dv.is_active:
                raise NotFoundException(f"Dịch vụ cận lâm sàng ID {dv_id} không tồn tại hoặc đã tạm dừng cung cấp!")
            if user.vai_tro == VaiTroEnum.BAC_SI.value:
                await credential_service.check_doctor_scope_of_practice(db, bac_si.id, dv.id)

        benh_nhan = await self._find_or_create_patient(payload.workspace_encounter_id, payload.benh_nhan, db)

        ma_kcb = f"WS-{payload.workspace_encounter_id}-{benh_nhan.id}"
        stmt_lk = select(LuotKham).where(LuotKham.ma_kcb == ma_kcb).with_for_update()
        luot_kham = (await db.execute(stmt_lk)).scalar_one_or_none()
        if luot_kham is None:
            if user.vai_tro == VaiTroEnum.BAC_SI.value:
                await credential_service.check_doctor_license_valid(db, bac_si.id)
            luot_kham = LuotKham(
                ma_kcb=ma_kcb,
                bac_si_id=bac_si.id,
                benh_nhan_id=benh_nhan.id,
                thoi_gian_bat_dau=datetime.now(timezone.utc),
                ly_do_vao_kham=payload.ly_do_vao_kham,
                chan_doan_so_bo=payload.chan_doan_so_bo,
                is_locked=False,
            )
            db.add(luot_kham)
            await db.flush()
        elif luot_kham.is_locked:
            raise ConflictException("Hồ sơ bệnh án đã bị khóa, không thể kê thêm chỉ định dịch vụ!")
        elif payload.chan_doan_so_bo:
            luot_kham.chan_doan_so_bo = payload.chan_doan_so_bo

        stmt_orders = select(ChiDinh).where(
            ChiDinh.luot_kham_id == luot_kham.id,
            ChiDinh.dich_vu_id.in_(dich_vu_ids),
            ChiDinh.trang_thai != "da_huy",
        )
        active_by_service = {o.dich_vu_id: o for o in (await db.execute(stmt_orders)).scalars().all()}

        orders: List[ChiDinh] = []
        for dv_id in dich_vu_ids:
            order = active_by_service.get(dv_id)
            if order is None:
                dv = services_by_id[dv_id]
                order = ChiDinh(
                    luot_kham_id=luot_kham.id,
                    dich_vu_id=dv.id,
                    so_luong=1,
                    don_gia_tai_thoi_diem=dv.don_gia,
                    trang_thai="da_chi_dinh",
                    bac_si_chi_dinh_id=bac_si.id,
                    phong_thuc_hien_id=dv.phong_thuc_hien_id,
                )
                db.add(order)
            orders.append(order)

        await db.commit()
        for order in orders:
            await db.refresh(order)

        logger.info(
            f"🧪 [WORKSPACE ORDERS] workspace={payload.workspace_encounter_id} luot_kham={luot_kham.id} "
            f"chi_dinh={[o.id for o in orders]}"
        )
        return WorkspaceOrdersResponse(
            luot_kham_id=luot_kham.id,
            orders=[
                WorkspaceOrderItem(
                    id=o.id,
                    dich_vu_id=o.dich_vu_id,
                    ma_dich_vu=services_by_id[o.dich_vu_id].ma_dich_vu,
                    nhom_dich_vu=nhom_dich_vu_of(
                        services_by_id[o.dich_vu_id].ma_nhom_byt, services_by_id[o.dich_vu_id].ma_dich_vu
                    ),
                    trang_thai=o.trang_thai,
                )
                for o in orders
            ],
        )


cls_workspace_bridge_service = ClsWorkspaceBridgeService()
