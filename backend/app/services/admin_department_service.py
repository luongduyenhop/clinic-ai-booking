import logging
from typing import List, Optional
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    ConflictException,
    NotFoundException,
)
from app.models.user import BacSi, ChuyenKhoa, PhongKham
from app.schemas.admin import (
    RoomCreateRequest,
    RoomResponse,
    DepartmentCreateRequest,
    DepartmentUpdateRequest,
    DepartmentAdminResponse,
)

logger = logging.getLogger(__name__)


class AdminDepartmentService:
    """Dịch vụ chuyên trách Quản lý Khoa phòng và Buồng khám (SRP)"""

    # --- 1b. Quản lý Buồng khám Vật lý (Physical Clinic Rooms) ---
    async def get_rooms_admin(
        self,
        db: AsyncSession,
        loai_phong: Optional[str] = None,
        chuyen_khoa_id: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> List[RoomResponse]:
        """Lấy danh sách tất cả các buồng khám vật lý và trạng thái phòng"""
        stmt = (
            select(PhongKham)
            .options(selectinload(PhongKham.chuyen_khoa))
        )
        if loai_phong:
            stmt = stmt.where(PhongKham.loai_phong == loai_phong)
        if chuyen_khoa_id:
            stmt = stmt.where((PhongKham.chuyen_khoa_id == chuyen_khoa_id) | (PhongKham.chuyen_khoa_id.is_(None)))
        if is_active is not None:
            stmt = stmt.where(PhongKham.is_active == is_active)
        stmt = stmt.order_by(PhongKham.tang, PhongKham.ma_phong)
        rooms = (await db.execute(stmt)).scalars().all()
        return [
            RoomResponse(
                id=r.id,
                ma_phong=r.ma_phong,
                ten_phong=r.ten_phong,
                chuyen_khoa_id=r.chuyen_khoa_id,
                ten_chuyen_khoa=r.chuyen_khoa.ten_chuyen_khoa if r.chuyen_khoa else "Đa khoa / Dùng chung",
                tang=r.tang,
                loai_phong=r.loai_phong,
                thiet_bi_chinh=r.thiet_bi_chinh,
                is_active=r.is_active,
            )
            for r in rooms
        ]

    async def create_room_admin(self, payload: RoomCreateRequest, db: AsyncSession) -> RoomResponse:
        """Tạo mới buồng khám vật lý"""
        stmt_check = select(PhongKham).where(PhongKham.ma_phong == payload.ma_phong)
        existing = (await db.execute(stmt_check)).scalar_one_or_none()
        if existing:
            raise ConflictException(f"Buồng khám mã '{payload.ma_phong}' đã tồn tại!")

        room = PhongKham(
            ma_phong=payload.ma_phong,
            ten_phong=payload.ten_phong,
            chuyen_khoa_id=payload.chuyen_khoa_id,
            tang=payload.tang,
            loai_phong=payload.loai_phong,
            thiet_bi_chinh=payload.thiet_bi_chinh,
            is_active=True,
        )
        db.add(room)
        await db.commit()
        await db.refresh(room)

        ten_ck = "Đa khoa / Dùng chung"
        if room.chuyen_khoa_id:
            stmt_ck = select(ChuyenKhoa).where(ChuyenKhoa.id == room.chuyen_khoa_id)
            ck = (await db.execute(stmt_ck)).scalar_one_or_none()
            if ck:
                ten_ck = ck.ten_chuyen_khoa

        return RoomResponse(
            id=room.id,
            ma_phong=room.ma_phong,
            ten_phong=room.ten_phong,
            chuyen_khoa_id=room.chuyen_khoa_id,
            ten_chuyen_khoa=ten_ck,
            tang=room.tang,
            loai_phong=room.loai_phong,
            thiet_bi_chinh=room.thiet_bi_chinh,
            is_active=room.is_active,
        )



    # GÓI 1: QUẢN LÝ DANH MỤC CHUYÊN KHOA KHÁM BỆNH (OpenMRS Department Catalog)
    # =========================================================================
    async def get_departments_admin(self, db: AsyncSession) -> List[DepartmentAdminResponse]:
        """Lấy toàn bộ danh mục chuyên khoa kèm số bác sĩ và buồng khám trực thuộc"""
        depts = (await db.execute(select(ChuyenKhoa).order_by(ChuyenKhoa.id.asc()))).scalars().all()
        results = []
        for d in depts:
            doc_cnt = (await db.execute(
                select(func.count(BacSi.id)).where(BacSi.chuyen_khoa_id == d.id)
            )).scalar() or 0
            room_cnt = (await db.execute(
                select(func.count(PhongKham.id)).where(PhongKham.chuyen_khoa_id == d.id)
            )).scalar() or 0
            results.append(DepartmentAdminResponse(
                id=d.id,
                ma_chuyen_khoa=d.ma_chuyen_khoa,
                ten_chuyen_khoa=d.ten_chuyen_khoa,
                mo_ta=d.mo_ta,
                vi_tri_phong=d.vi_tri_phong,
                is_active=d.is_active,
                so_luong_bac_si=doc_cnt,
                so_luong_phong_kham=room_cnt
            ))
        return results

    async def create_department_admin(self, payload: DepartmentCreateRequest, db: AsyncSession) -> DepartmentAdminResponse:
        """Thêm mới chuyên khoa khám bệnh"""
        existing = (await db.execute(
            select(ChuyenKhoa).where(
                or_(
                    ChuyenKhoa.ma_chuyen_khoa == payload.ma_chuyen_khoa.strip(),
                    ChuyenKhoa.ten_chuyen_khoa == payload.ten_chuyen_khoa.strip()
                )
            )
        )).scalar_one_or_none()
        if existing:
            raise ConflictException(f"Chuyên khoa với mã '{payload.ma_chuyen_khoa}' hoặc tên '{payload.ten_chuyen_khoa}' đã tồn tại!")

        dept = ChuyenKhoa(
            ma_chuyen_khoa=payload.ma_chuyen_khoa.strip().upper(),
            ten_chuyen_khoa=payload.ten_chuyen_khoa.strip(),
            mo_ta=payload.mo_ta,
            vi_tri_phong=payload.vi_tri_phong,
            is_active=payload.is_active
        )
        db.add(dept)
        await db.commit()
        await db.refresh(dept)
        return DepartmentAdminResponse(
            id=dept.id,
            ma_chuyen_khoa=dept.ma_chuyen_khoa,
            ten_chuyen_khoa=dept.ten_chuyen_khoa,
            mo_ta=dept.mo_ta,
            vi_tri_phong=dept.vi_tri_phong,
            is_active=dept.is_active,
            so_luong_bac_si=0,
            so_luong_phong_kham=0
        )

    async def update_department_admin(self, dept_id: int, payload: DepartmentUpdateRequest, db: AsyncSession) -> DepartmentAdminResponse:
        """Cập nhật thông tin chuyên khoa khám bệnh"""
        dept = await db.get(ChuyenKhoa, dept_id)
        if not dept:
            raise NotFoundException(f"Không tìm thấy chuyên khoa có ID {dept_id}")

        if payload.ten_chuyen_khoa is not None:
            dup = (await db.execute(
                select(ChuyenKhoa).where(
                    ChuyenKhoa.ten_chuyen_khoa == payload.ten_chuyen_khoa.strip(),
                    ChuyenKhoa.id != dept_id
                )
            )).scalar_one_or_none()
            if dup:
                raise ConflictException(f"Tên chuyên khoa '{payload.ten_chuyen_khoa}' đã được sử dụng!")
            dept.ten_chuyen_khoa = payload.ten_chuyen_khoa.strip()

        if payload.mo_ta is not None:
            dept.mo_ta = payload.mo_ta
        if payload.vi_tri_phong is not None:
            dept.vi_tri_phong = payload.vi_tri_phong
        if payload.is_active is not None:
            dept.is_active = payload.is_active

        await db.commit()
        await db.refresh(dept)
        doc_cnt = (await db.execute(select(func.count(BacSi.id)).where(BacSi.chuyen_khoa_id == dept.id))).scalar() or 0
        room_cnt = (await db.execute(select(func.count(PhongKham.id)).where(PhongKham.chuyen_khoa_id == dept.id))).scalar() or 0
        return DepartmentAdminResponse(
            id=dept.id,
            ma_chuyen_khoa=dept.ma_chuyen_khoa,
            ten_chuyen_khoa=dept.ten_chuyen_khoa,
            mo_ta=dept.mo_ta,
            vi_tri_phong=dept.vi_tri_phong,
            is_active=dept.is_active,
            so_luong_bac_si=doc_cnt,
            so_luong_phong_kham=room_cnt
        )

    # =========================================================================


admin_department_service = AdminDepartmentService()
