import logging
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
)
from app.models.appointment import (
    LichKham,
    TrangThaiLichEnum,
    PhanTichAI,
    DanhGiaAI,
)
from app.models.compliance import NhatKyTruyCapDuLieuYTe
from app.models.medical import DichVu, KhaiNiem, TuKhoaCapCuu
from app.models.user import BacSi, ChuyenKhoa, PhongKham
from app.schemas.admin import (
    ServiceCreateRequest,
    ServiceUpdateRequest,
    ServiceItemAdminResponse,
    ConceptCreateRequest,
    ConceptUpdateRequest,
    ConceptAdminResponse,
    RedFlagCreateRequest,
    RedFlagUpdateRequest,
    RedFlagAdminResponse,
    AIAccuracyReportResponse,
    AIAccuracySpecialtyItem,
    ServiceExportItem,
    ServiceExportResponse,
    DepartmentCreateRequest,
    DepartmentUpdateRequest,
    DepartmentAdminResponse,
    RoomCreateRequest,
    RoomResponse,
)

logger = logging.getLogger(__name__)


class AdminCatalogService:

    async def get_services_admin(self, db: AsyncSession) -> List[ServiceItemAdminResponse]:
        stmt = (
            select(DichVu)
            .options(
                selectinload(DichVu.chuyen_khoa),
                selectinload(DichVu.phong_thuc_hien)
            )
            .order_by(DichVu.id)
        )
        items = (await db.execute(stmt)).scalars().all()
        return [
            ServiceItemAdminResponse(
                id=item.id,
                ma_dich_vu=item.ma_dich_vu,
                ten_dich_vu=item.ten_dich_vu,
                chuyen_khoa_id=item.chuyen_khoa_id,
                ten_chuyen_khoa=item.chuyen_khoa.ten_chuyen_khoa if item.chuyen_khoa else None,
                don_gia=float(item.don_gia),
                don_vi_tinh=item.don_vi_tinh,
                quy_trinh_thuc_hien=item.quy_trinh_thuc_hien,
                is_active=item.is_active,
                ma_nhom_byt=item.ma_nhom_byt,
                ma_tu_dong_bhyt=item.ma_tu_dong_bhyt,
                phong_thuc_hien_id=item.phong_thuc_hien_id,
                ten_phong_thuc_hien=item.phong_thuc_hien.ten_phong if item.phong_thuc_hien else None,
                ma_phong_thuc_hien=item.phong_thuc_hien.ma_phong if item.phong_thuc_hien else None,
                thoi_gian_tra_ket_qua_phut=getattr(item, "thoi_gian_tra_ket_qua_phut", 30) or 30,
                huong_dan_chuan_bi=getattr(item, "huong_dan_chuan_bi", None),
            )
            for item in items
        ]

    async def create_service_admin(self, payload: ServiceCreateRequest, db: AsyncSession) -> ServiceItemAdminResponse:
        stmt_dup = select(DichVu).where(DichVu.ma_dich_vu == payload.ma_dich_vu)
        if (await db.execute(stmt_dup)).scalar_one_or_none():
            raise ConflictException(f"Mã dịch vụ {payload.ma_dich_vu} đã tồn tại!")

        room = None
        if payload.phong_thuc_hien_id:
            stmt_room = select(PhongKham).where(PhongKham.id == payload.phong_thuc_hien_id)
            room = (await db.execute(stmt_room)).scalar_one_or_none()
            if not room:
                raise NotFoundException("Buồng/phòng thực hiện kỹ thuật không tồn tại!")
            if not room.is_active:
                raise BadRequestException("Không thể gán dịch vụ cho buồng/phòng đang bảo trì hoặc ngừng hoạt động!")

        dept_name = None
        if payload.chuyen_khoa_id:
            stmt_dept = select(ChuyenKhoa).where(ChuyenKhoa.id == payload.chuyen_khoa_id)
            dept = (await db.execute(stmt_dept)).scalar_one_or_none()
            if dept:
                dept_name = dept.ten_chuyen_khoa

        service = DichVu(
            ma_dich_vu=payload.ma_dich_vu,
            ten_dich_vu=payload.ten_dich_vu,
            chuyen_khoa_id=payload.chuyen_khoa_id,
            don_gia=payload.don_gia,
            don_vi_tinh=payload.don_vi_tinh,
            quy_trinh_thuc_hien=payload.quy_trinh_thuc_hien,
            ma_nhom_byt=payload.ma_nhom_byt,
            ma_tu_dong_bhyt=payload.ma_tu_dong_bhyt,
            phong_thuc_hien_id=payload.phong_thuc_hien_id,
            thoi_gian_tra_ket_qua_phut=payload.thoi_gian_tra_ket_qua_phut or 30,
            huong_dan_chuan_bi=payload.huong_dan_chuan_bi,
            is_active=True,
        )
        db.add(service)
        await db.commit()
        await db.refresh(service)

        return ServiceItemAdminResponse(
            id=service.id,
            ma_dich_vu=service.ma_dich_vu,
            ten_dich_vu=service.ten_dich_vu,
            chuyen_khoa_id=service.chuyen_khoa_id,
            ten_chuyen_khoa=dept_name,
            don_gia=float(service.don_gia),
            don_vi_tinh=service.don_vi_tinh,
            quy_trinh_thuc_hien=service.quy_trinh_thuc_hien,
            is_active=service.is_active,
            ma_nhom_byt=service.ma_nhom_byt,
            ma_tu_dong_bhyt=service.ma_tu_dong_bhyt,
            phong_thuc_hien_id=service.phong_thuc_hien_id,
            ten_phong_thuc_hien=room.ten_phong if room else None,
            ma_phong_thuc_hien=room.ma_phong if room else None,
            thoi_gian_tra_ket_qua_phut=service.thoi_gian_tra_ket_qua_phut,
            huong_dan_chuan_bi=service.huong_dan_chuan_bi,
        )

    async def update_service_admin(
        self,
        service_id: int,
        payload: ServiceUpdateRequest,
        db: AsyncSession,
        user_id: Optional[int] = None
    ) -> ServiceItemAdminResponse:
        stmt = (
            select(DichVu)
            .options(
                selectinload(DichVu.chuyen_khoa),
                selectinload(DichVu.phong_thuc_hien)
            )
            .where(DichVu.id == service_id)
        )
        service = (await db.execute(stmt)).scalar_one_or_none()
        if not service:
            raise NotFoundException(f"Không tìm thấy dịch vụ với ID {service_id}!")

        if payload.ten_dich_vu is not None:
            service.ten_dich_vu = payload.ten_dich_vu
        if payload.don_gia is not None:
            old_price = float(service.don_gia)
            new_price = float(payload.don_gia)
            if old_price != new_price:
                audit_entry = NhatKyTruyCapDuLieuYTe(
                    user_id=user_id or 1,
                    user_role="ADMIN",
                    loai_nhat_ky="GIA_DICH_VU",
                    patient_id=1,
                    action="UPDATE_PRICE",
                    resource_type="SERVICE_PRICE",
                    resource_id=service.id,
                    purpose=f"Dieu chinh don gia dich vu {service.ma_dich_vu} tu {old_price} sang {new_price}",
                    noi_dung_cu_json={"ma_dich_vu": service.ma_dich_vu, "ten_dich_vu": service.ten_dich_vu, "don_gia": old_price},
                    noi_dung_moi_json={"ma_dich_vu": service.ma_dich_vu, "ten_dich_vu": service.ten_dich_vu, "don_gia": new_price},
                    client_ip="127.0.0.1",
                    timestamp=datetime.now(timezone.utc),
                )
                db.add(audit_entry)
            service.don_gia = payload.don_gia
        if payload.don_vi_tinh is not None:
            service.don_vi_tinh = payload.don_vi_tinh
        if payload.quy_trinh_thuc_hien is not None:
            service.quy_trinh_thuc_hien = payload.quy_trinh_thuc_hien
        if payload.ma_nhom_byt is not None:
            service.ma_nhom_byt = payload.ma_nhom_byt
        if payload.ma_tu_dong_bhyt is not None:
            service.ma_tu_dong_bhyt = payload.ma_tu_dong_bhyt
        if payload.thoi_gian_tra_ket_qua_phut is not None:
            service.thoi_gian_tra_ket_qua_phut = payload.thoi_gian_tra_ket_qua_phut
        if payload.huong_dan_chuan_bi is not None:
            service.huong_dan_chuan_bi = payload.huong_dan_chuan_bi
        if payload.is_active is not None:
            service.is_active = payload.is_active

        if payload.chuyen_khoa_id is not None:
            if payload.chuyen_khoa_id > 0:
                stmt_ck = select(ChuyenKhoa).where(ChuyenKhoa.id == payload.chuyen_khoa_id)
                if not (await db.execute(stmt_ck)).scalar_one_or_none():
                    raise NotFoundException("Chuyên khoa không tồn tại!")
                service.chuyen_khoa_id = payload.chuyen_khoa_id
            else:
                service.chuyen_khoa_id = None

        if payload.phong_thuc_hien_id is not None:
            if payload.phong_thuc_hien_id > 0:
                stmt_room = select(PhongKham).where(PhongKham.id == payload.phong_thuc_hien_id)
                room = (await db.execute(stmt_room)).scalar_one_or_none()
                if not room:
                    raise NotFoundException("Buồng/phòng thực hiện kỹ thuật không tồn tại!")
                if not room.is_active:
                    raise BadRequestException("Không thể gán dịch vụ cho buồng/phòng đang bảo trì hoặc ngừng hoạt động!")
                service.phong_thuc_hien_id = payload.phong_thuc_hien_id
            else:
                service.phong_thuc_hien_id = None

        await db.commit()

        stmt_fresh = (
            select(DichVu)
            .options(
                selectinload(DichVu.chuyen_khoa),
                selectinload(DichVu.phong_thuc_hien)
            )
            .where(DichVu.id == service_id)
        )
        service = (await db.execute(stmt_fresh)).scalar_one()

        return ServiceItemAdminResponse(
            id=service.id,
            ma_dich_vu=service.ma_dich_vu,
            ten_dich_vu=service.ten_dich_vu,
            chuyen_khoa_id=service.chuyen_khoa_id,
            ten_chuyen_khoa=service.chuyen_khoa.ten_chuyen_khoa if service.chuyen_khoa else None,
            don_gia=float(service.don_gia),
            don_vi_tinh=service.don_vi_tinh,
            quy_trinh_thuc_hien=service.quy_trinh_thuc_hien,
            is_active=service.is_active,
            ma_nhom_byt=service.ma_nhom_byt,
            ma_tu_dong_bhyt=service.ma_tu_dong_bhyt,
            phong_thuc_hien_id=service.phong_thuc_hien_id,
            ten_phong_thuc_hien=service.phong_thuc_hien.ten_phong if service.phong_thuc_hien else None,
            ma_phong_thuc_hien=service.phong_thuc_hien.ma_phong if service.phong_thuc_hien else None,
            thoi_gian_tra_ket_qua_phut=getattr(service, "thoi_gian_tra_ket_qua_phut", 30) or 30,
            huong_dan_chuan_bi=getattr(service, "huong_dan_chuan_bi", None),
        )

    async def delete_service_admin(self, service_id: int, db: AsyncSession) -> Dict[str, Any]:
        stmt = select(DichVu).where(DichVu.id == service_id)
        service = (await db.execute(stmt)).scalar_one_or_none()
        if not service:
            raise NotFoundException(f"Không tìm thấy dịch vụ ID {service_id}")
        service.is_active = False
        await db.commit()
        return {"id": service_id, "is_active": False, "message": "Đã ngừng kích hoạt dịch vụ thành công"}

    async def get_departments_admin(self, db: AsyncSession, is_active: Optional[bool] = None) -> List[DepartmentAdminResponse]:
        stmt = select(ChuyenKhoa).order_by(ChuyenKhoa.id.asc())
        if is_active is not None:
            stmt = stmt.where(ChuyenKhoa.is_active == is_active)
        depts = (await db.execute(stmt)).scalars().all()
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

    async def delete_department_admin(self, dept_id: int, db: AsyncSession) -> Dict[str, Any]:
        dept = await db.get(ChuyenKhoa, dept_id)
        if not dept:
            raise NotFoundException(f"Không tìm thấy chuyên khoa có ID {dept_id}")
        doc_cnt = (await db.execute(select(func.count(BacSi.id)).where(BacSi.chuyen_khoa_id == dept.id))).scalar() or 0
        room_cnt = (await db.execute(select(func.count(PhongKham.id)).where(PhongKham.chuyen_khoa_id == dept.id))).scalar() or 0
        if doc_cnt > 0 or room_cnt > 0:
            dept.is_active = False
            await db.commit()
            return {"id": dept_id, "is_active": False, "message": "Chuyên khoa có liên kết đã chuyển sang ngừng hoạt động"}
        await db.delete(dept)
        await db.commit()
        return {"id": dept_id, "deleted": True, "message": "Đã xóa chuyên khoa thành công"}

    async def get_rooms_admin(
        self,
        db: AsyncSession,
        loai_phong: Optional[str] = None,
        chuyen_khoa_id: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> List[RoomResponse]:
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

    async def update_room_admin(self, room_id: int, payload: Any, db: AsyncSession) -> RoomResponse:
        room = await db.get(PhongKham, room_id)
        if not room:
            raise NotFoundException(f"Không tìm thấy buồng khám có ID {room_id}")

        ten_phong = getattr(payload, "ten_phong", None) or (payload.get("ten_phong") if isinstance(payload, dict) else None)
        chuyen_khoa_id = getattr(payload, "chuyen_khoa_id", None) or (payload.get("chuyen_khoa_id") if isinstance(payload, dict) else None)
        tang = getattr(payload, "tang", None) or (payload.get("tang") if isinstance(payload, dict) else None)
        loai_phong = getattr(payload, "loai_phong", None) or (payload.get("loai_phong") if isinstance(payload, dict) else None)
        thiet_bi_chinh = getattr(payload, "thiet_bi_chinh", None) or (payload.get("thiet_bi_chinh") if isinstance(payload, dict) else None)
        is_active = getattr(payload, "is_active", None) if hasattr(payload, "is_active") else (payload.get("is_active") if isinstance(payload, dict) else None)

        if ten_phong is not None:
            room.ten_phong = ten_phong
        if chuyen_khoa_id is not None:
            room.chuyen_khoa_id = chuyen_khoa_id if chuyen_khoa_id > 0 else None
        if tang is not None:
            room.tang = tang
        if loai_phong is not None:
            room.loai_phong = loai_phong
        if thiet_bi_chinh is not None:
            room.thiet_bi_chinh = thiet_bi_chinh
        if is_active is not None:
            room.is_active = is_active

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

    async def delete_room_admin(self, room_id: int, db: AsyncSession) -> Dict[str, Any]:
        room = await db.get(PhongKham, room_id)
        if not room:
            raise NotFoundException(f"Không tìm thấy buồng khám có ID {room_id}")
        svc_cnt = (await db.execute(select(func.count(DichVu.id)).where(DichVu.phong_thuc_hien_id == room.id))).scalar() or 0
        if svc_cnt > 0:
            room.is_active = False
            await db.commit()
            return {"id": room_id, "is_active": False, "message": "Buồng khám đã liên kết dịch vụ được chuyển sang ngừng hoạt động"}
        await db.delete(room)
        await db.commit()
        return {"id": room_id, "deleted": True, "message": "Đã xóa buồng khám thành công"}

    async def get_prices_admin(self, db: AsyncSession, service_id: Optional[int] = None) -> List[Dict[str, Any]]:
        stmt = select(DichVu).order_by(DichVu.ma_dich_vu.asc())
        if service_id is not None:
            stmt = stmt.where(DichVu.id == service_id)
        services = (await db.execute(stmt)).scalars().all()
        results = []
        for s in services:
            history_count = (await db.execute(
                select(func.count(NhatKyTruyCapDuLieuYTe.id)).where(
                    NhatKyTruyCapDuLieuYTe.resource_type == "SERVICE_PRICE",
                    NhatKyTruyCapDuLieuYTe.resource_id == s.id
                )
            )).scalar() or 0
            results.append({
                "service_id": s.id,
                "ma_dich_vu": s.ma_dich_vu,
                "ten_dich_vu": s.ten_dich_vu,
                "don_gia": float(s.don_gia),
                "don_vi_tinh": s.don_vi_tinh,
                "ma_nhom_byt": s.ma_nhom_byt,
                "is_active": s.is_active,
                "so_lan_dieu_chinh_gia": history_count,
            })
        return results

    async def update_service_price_admin(
        self,
        service_id: int,
        don_gia: float,
        db: AsyncSession,
        user_id: Optional[int] = None,
        ly_do: Optional[str] = None
    ) -> Dict[str, Any]:
        stmt = select(DichVu).where(DichVu.id == service_id)
        service = (await db.execute(stmt)).scalar_one_or_none()
        if not service:
            raise NotFoundException(f"Không tìm thấy dịch vụ ID {service_id}")
        old_price = float(service.don_gia)
        new_price = float(don_gia)
        audit_entry = NhatKyTruyCapDuLieuYTe(
            user_id=user_id or 1,
            user_role="ADMIN",
            loai_nhat_ky="GIA_DICH_VU",
            patient_id=1,
            action="UPDATE_PRICE",
            resource_type="SERVICE_PRICE",
            resource_id=service.id,
            purpose=ly_do or f"Điều chỉnh đơn giá dịch vụ {service.ma_dich_vu} từ {old_price} sang {new_price}",
            noi_dung_cu_json={"ma_dich_vu": service.ma_dich_vu, "ten_dich_vu": service.ten_dich_vu, "don_gia": old_price},
            noi_dung_moi_json={"ma_dich_vu": service.ma_dich_vu, "ten_dich_vu": service.ten_dich_vu, "don_gia": new_price},
            client_ip="127.0.0.1",
            timestamp=datetime.now(timezone.utc),
        )
        db.add(audit_entry)
        service.don_gia = new_price
        await db.commit()
        await db.refresh(service)
        return {
            "service_id": service.id,
            "ma_dich_vu": service.ma_dich_vu,
            "ten_dich_vu": service.ten_dich_vu,
            "don_gia_cu": old_price,
            "don_gia_moi": new_price,
            "thoi_gian_cap_nhat": audit_entry.timestamp.isoformat(),
            "ly_do": audit_entry.purpose
        }

    async def get_price_history_admin(self, db: AsyncSession, service_id: Optional[int] = None) -> List[Dict[str, Any]]:
        stmt = (
            select(NhatKyTruyCapDuLieuYTe)
            .where(NhatKyTruyCapDuLieuYTe.resource_type == "SERVICE_PRICE")
            .order_by(NhatKyTruyCapDuLieuYTe.timestamp.desc())
        )
        if service_id is not None:
            stmt = stmt.where(NhatKyTruyCapDuLieuYTe.resource_id == service_id)
        records = (await db.execute(stmt)).scalars().all()
        history = []
        for r in records:
            history.append({
                "id": r.id,
                "user_id": r.user_id,
                "user_role": r.user_role,
                "action": r.action,
                "resource_id": r.resource_id,
                "purpose": r.purpose,
                "noi_dung_cu": r.noi_dung_cu_json,
                "noi_dung_moi": r.noi_dung_moi_json,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            })
        return history

    async def import_catalog_admin(
        self,
        catalog_type: str,
        items: List[Dict[str, Any]],
        db: AsyncSession
    ) -> Dict[str, Any]:
        if not items:
            raise BadRequestException("Danh sách bản ghi nạp vào không được để trống")
        normalized_type = catalog_type.lower()
        imported = 0
        if normalized_type in ["departments", "chuyenkhoa", "chuyen_khoa"]:
            for item in items:
                code = str(item.get("ma_chuyen_khoa") or item.get("ma") or "").strip()
                name = str(item.get("ten_chuyen_khoa") or item.get("ten") or "").strip()
                if not code or not name:
                    continue
                existing = (await db.execute(select(ChuyenKhoa).where(ChuyenKhoa.ma_chuyen_khoa == code))).scalar_one_or_none()
                if existing:
                    existing.ten_chuyen_khoa = name
                    if item.get("mo_ta"):
                        existing.mo_ta = item.get("mo_ta")
                    if item.get("vi_tri_phong"):
                        existing.vi_tri_phong = item.get("vi_tri_phong")
                else:
                    dept = ChuyenKhoa(
                        ma_chuyen_khoa=code.upper(),
                        ten_chuyen_khoa=name,
                        mo_ta=item.get("mo_ta"),
                        vi_tri_phong=item.get("vi_tri_phong"),
                        is_active=True,
                    )
                    db.add(dept)
                imported += 1
        elif normalized_type in ["rooms", "khoaphong", "khoa_phong"]:
            for item in items:
                code = str(item.get("ma_phong") or item.get("ma") or "").strip()
                name = str(item.get("ten_phong") or item.get("ten") or "").strip()
                if not code or not name:
                    continue
                existing = (await db.execute(select(PhongKham).where(PhongKham.ma_phong == code))).scalar_one_or_none()
                if existing:
                    existing.ten_phong = name
                    if item.get("tang"):
                        existing.tang = item.get("tang")
                    if item.get("loai_phong"):
                        existing.loai_phong = item.get("loai_phong")
                    if item.get("thiet_bi_chinh"):
                        existing.thiet_bi_chinh = item.get("thiet_bi_chinh")
                else:
                    room = PhongKham(
                        ma_phong=code,
                        ten_phong=name,
                        tang=item.get("tang") or "Tầng 1",
                        loai_phong=item.get("loai_phong") or "kham_benh",
                        thiet_bi_chinh=item.get("thiet_bi_chinh"),
                        is_active=True,
                    )
                    db.add(room)
                imported += 1
        elif normalized_type in ["services", "dichvu", "dich_vu"]:
            for item in items:
                code = str(item.get("ma_dich_vu") or item.get("maDV") or item.get("ma") or "").strip()
                name = str(item.get("ten_dich_vu") or item.get("tenDV") or item.get("ten") or "").strip()
                price = float(item.get("don_gia") or item.get("donGia") or 0.0)
                if not code or not name:
                    continue
                existing = (await db.execute(select(DichVu).where(DichVu.ma_dich_vu == code))).scalar_one_or_none()
                if existing:
                    if float(existing.don_gia) != price:
                        audit_entry = NhatKyTruyCapDuLieuYTe(
                            user_id=1,
                            user_role="ADMIN",
                            loai_nhat_ky="GIA_DICH_VU",
                            patient_id=1,
                            action="UPDATE_PRICE",
                            resource_type="SERVICE_PRICE",
                            resource_id=existing.id,
                            purpose=f"Import cập nhật đơn giá dịch vụ {code} từ {float(existing.don_gia)} sang {price}",
                            noi_dung_cu_json={"ma_dich_vu": existing.ma_dich_vu, "ten_dich_vu": existing.ten_dich_vu, "don_gia": float(existing.don_gia)},
                            noi_dung_moi_json={"ma_dich_vu": existing.ma_dich_vu, "ten_dich_vu": existing.ten_dich_vu, "don_gia": price},
                            client_ip="127.0.0.1",
                            timestamp=datetime.now(timezone.utc),
                        )
                        db.add(audit_entry)
                        existing.don_gia = price
                    existing.ten_dich_vu = name
                    if item.get("don_vi_tinh") or item.get("dvt"):
                        existing.don_vi_tinh = item.get("don_vi_tinh") or item.get("dvt")
                    if item.get("ma_nhom_byt") or item.get("nhomDV"):
                        existing.ma_nhom_byt = item.get("ma_nhom_byt") or item.get("nhomDV")
                else:
                    service = DichVu(
                        ma_dich_vu=code,
                        ten_dich_vu=name,
                        don_gia=price,
                        don_vi_tinh=item.get("don_vi_tinh") or item.get("dvt") or "Lần",
                        ma_nhom_byt=item.get("ma_nhom_byt") or item.get("nhomDV"),
                        is_active=True,
                    )
                    db.add(service)
                imported += 1
        else:
            raise BadRequestException(f"Loại danh mục import '{catalog_type}' không hợp lệ!")
        await db.commit()
        return {
            "success": True,
            "catalog_type": catalog_type,
            "imported_count": imported,
            "message": f"Đã nạp và lưu thành công {imported} bản ghi vào PostgreSQL"
        }

    async def get_concepts_admin(
        self,
        db: AsyncSession,
        loai_khai_niem: Optional[str] = None,
        chuyen_khoa_id: Optional[int] = None
    ) -> List[ConceptAdminResponse]:
        stmt = select(KhaiNiem).order_by(KhaiNiem.id.asc())
        if loai_khai_niem:
            stmt = stmt.where(KhaiNiem.loai_khai_niem == loai_khai_niem)
        if chuyen_khoa_id:
            stmt = stmt.where(KhaiNiem.chuyen_khoa_id == chuyen_khoa_id)

        rows = (await db.execute(stmt)).scalars().all()
        results = []
        for r in rows:
            dept_name = None
            if r.chuyen_khoa_id:
                d = await db.get(ChuyenKhoa, r.chuyen_khoa_id)
                dept_name = d.ten_chuyen_khoa if d else None
            results.append(ConceptAdminResponse(
                id=r.id,
                ma_khai_niem=r.ma_khai_niem,
                ten_khai_niem=r.ten_khai_niem,
                loai_khai_niem=r.loai_khai_niem,
                chuyen_khoa_id=r.chuyen_khoa_id,
                ten_chuyen_khoa=dept_name,
                mo_ta=r.mo_ta,
                is_active=r.is_active
            ))
        return results

    async def create_concept_admin(self, payload: ConceptCreateRequest, db: AsyncSession) -> ConceptAdminResponse:
        dup = (await db.execute(select(KhaiNiem).where(KhaiNiem.ma_khai_niem == payload.ma_khai_niem.strip()))).scalar_one_or_none()
        if dup:
            raise ConflictException(f"Mã khái niệm '{payload.ma_khai_niem}' đã tồn tại!")

        c = KhaiNiem(
            ma_khai_niem=payload.ma_khai_niem.strip().upper(),
            ten_khai_niem=payload.ten_khai_niem.strip(),
            loai_khai_niem=payload.loai_khai_niem,
            chuyen_khoa_id=payload.chuyen_khoa_id,
            mo_ta=payload.mo_ta,
            is_active=payload.is_active
        )
        db.add(c)
        await db.commit()
        await db.refresh(c)
        dept_name = None
        if c.chuyen_khoa_id:
            d = await db.get(ChuyenKhoa, c.chuyen_khoa_id)
            dept_name = d.ten_chuyen_khoa if d else None
        return ConceptAdminResponse(
            id=c.id,
            ma_khai_niem=c.ma_khai_niem,
            ten_khai_niem=c.ten_khai_niem,
            loai_khai_niem=c.loai_khai_niem,
            chuyen_khoa_id=c.chuyen_khoa_id,
            ten_chuyen_khoa=dept_name,
            mo_ta=c.mo_ta,
            is_active=c.is_active
        )

    async def update_concept_admin(self, concept_id: int, payload: ConceptUpdateRequest, db: AsyncSession) -> ConceptAdminResponse:
        c = await db.get(KhaiNiem, concept_id)
        if not c:
            raise NotFoundException(f"Không tìm thấy khái niệm ID {concept_id}")
        if payload.ten_khai_niem is not None:
            c.ten_khai_niem = payload.ten_khai_niem.strip()
        if payload.loai_khai_niem is not None:
            c.loai_khai_niem = payload.loai_khai_niem
        if payload.chuyen_khoa_id is not None:
            c.chuyen_khoa_id = payload.chuyen_khoa_id if payload.chuyen_khoa_id > 0 else None
        if payload.mo_ta is not None:
            c.mo_ta = payload.mo_ta
        if payload.is_active is not None:
            c.is_active = payload.is_active
        await db.commit()
        await db.refresh(c)
        dept_name = None
        if c.chuyen_khoa_id:
            d = await db.get(ChuyenKhoa, c.chuyen_khoa_id)
            dept_name = d.ten_chuyen_khoa if d else None
        return ConceptAdminResponse(
            id=c.id,
            ma_khai_niem=c.ma_khai_niem,
            ten_khai_niem=c.ten_khai_niem,
            loai_khai_niem=c.loai_khai_niem,
            chuyen_khoa_id=c.chuyen_khoa_id,
            ten_chuyen_khoa=dept_name,
            mo_ta=c.mo_ta,
            is_active=c.is_active
        )

    async def delete_concept_admin(self, concept_id: int, db: AsyncSession):
        c = await db.get(KhaiNiem, concept_id)
        if not c:
            raise NotFoundException(f"Không tìm thấy khái niệm ID {concept_id}")
        await db.delete(c)
        await db.commit()

    async def get_red_flags_admin(self, db: AsyncSession) -> List[RedFlagAdminResponse]:
        rows = (await db.execute(select(TuKhoaCapCuu).order_by(TuKhoaCapCuu.id.asc()))).scalars().all()
        return [
            RedFlagAdminResponse(
                id=r.id,
                tu_khoa=r.tu_khoa,
                muc_do_nguy_hiem=r.muc_do_nguy_hiem,
                huong_dan_xu_tri=r.huong_dan_xu_tri,
                van_ban_byt_ref=r.van_ban_byt_ref,
                is_active=r.is_active
            ) for r in rows
        ]

    async def create_red_flag_admin(self, payload: RedFlagCreateRequest, db: AsyncSession) -> RedFlagAdminResponse:
        dup = (await db.execute(select(TuKhoaCapCuu).where(TuKhoaCapCuu.tu_khoa == payload.tu_khoa.strip()))).scalar_one_or_none()
        if dup:
            raise ConflictException(f"Từ khóa cấp cứu '{payload.tu_khoa}' đã tồn tại!")
        r = TuKhoaCapCuu(
            tu_khoa=payload.tu_khoa.strip(),
            muc_do_nguy_hiem=payload.muc_do_nguy_hiem,
            huong_dan_xu_tri=payload.huong_dan_xu_tri,
            van_ban_byt_ref=payload.van_ban_byt_ref,
            is_active=True
        )
        db.add(r)
        await db.commit()
        await db.refresh(r)
        return RedFlagAdminResponse(
            id=r.id,
            tu_khoa=r.tu_khoa,
            muc_do_nguy_hiem=r.muc_do_nguy_hiem,
            huong_dan_xu_tri=r.huong_dan_xu_tri,
            van_ban_byt_ref=r.van_ban_byt_ref,
            is_active=r.is_active
        )

    async def update_red_flag_admin(self, rule_id: int, payload: RedFlagUpdateRequest, db: AsyncSession) -> RedFlagAdminResponse:
        r = await db.get(TuKhoaCapCuu, rule_id)
        if not r:
            raise NotFoundException(f"Không tìm thấy quy tắc cấp cứu ID {rule_id}")
        if payload.tu_khoa is not None:
            r.tu_khoa = payload.tu_khoa.strip()
        if payload.muc_do_nguy_hiem is not None:
            r.muc_do_nguy_hiem = payload.muc_do_nguy_hiem
        if payload.huong_dan_xu_tri is not None:
            r.huong_dan_xu_tri = payload.huong_dan_xu_tri
        if payload.van_ban_byt_ref is not None:
            r.van_ban_byt_ref = payload.van_ban_byt_ref
        if payload.is_active is not None:
            r.is_active = payload.is_active
        await db.commit()
        await db.refresh(r)
        return RedFlagAdminResponse(
            id=r.id,
            tu_khoa=r.tu_khoa,
            muc_do_nguy_hiem=r.muc_do_nguy_hiem,
            huong_dan_xu_tri=r.huong_dan_xu_tri,
            van_ban_byt_ref=r.van_ban_byt_ref,
            is_active=r.is_active
        )

    async def delete_red_flag_admin(self, rule_id: int, db: AsyncSession):
        r = await db.get(TuKhoaCapCuu, rule_id)
        if not r:
            raise NotFoundException(f"Không tìm thấy quy tắc cấp cứu ID {rule_id}")
        await db.delete(r)
        await db.commit()

    async def get_ai_accuracy_report(self, db: AsyncSession) -> AIAccuracyReportResponse:
        total_ai = (await db.execute(select(func.count(PhanTichAI.id)))).scalar() or 0

        stmt = (
            select(PhanTichAI, LichKham, BacSi)
            .join(LichKham, PhanTichAI.lich_kham_id == LichKham.id)
            .join(BacSi, LichKham.bac_si_id == BacSi.id)
            .where(LichKham.trang_thai == TrangThaiLichEnum.DA_KHAM.value)
        )
        rows = (await db.execute(stmt)).all()
        so_kham = len(rows)

        so_khop = 0
        specialty_stats: Dict[int, Dict[str, Any]] = {}

        for p_ai, lk, bs in rows:
            dept_id = bs.chuyen_khoa_id or 1
            if dept_id not in specialty_stats:
                dept_obj = await db.get(ChuyenKhoa, dept_id)
                dept_name = dept_obj.ten_chuyen_khoa if dept_obj else f"Khoa {dept_id}"
                specialty_stats[dept_id] = {
                    "name": dept_name,
                    "suggested": 0,
                    "matched": 0
                }
            specialty_stats[dept_id]["suggested"] += 1

            if p_ai.chuyen_khoa_goi_y_id == bs.chuyen_khoa_id:
                so_khop += 1
                specialty_stats[dept_id]["matched"] += 1

        overall_acc = round((so_khop / so_kham * 100.0), 1) if so_kham > 0 else 0.0
        avg_stars = (await db.execute(select(func.avg(DanhGiaAI.so_sao)))).scalar() or 0.0

        dept_list = []
        for d_id, s_data in specialty_stats.items():
            pct = round((s_data["matched"] / s_data["suggested"] * 100.0), 1) if s_data["suggested"] > 0 else 100.0
            dept_list.append(AIAccuracySpecialtyItem(
                chuyen_khoa_id=d_id,
                ten_chuyen_khoa=s_data["name"],
                so_ca_goi_y=s_data["suggested"],
                so_ca_khop_thuc_te=s_data["matched"],
                ty_le_chinh_xac_pct=pct
            ))

        return AIAccuracyReportResponse(
            tong_so_ca_phan_tich_ai=total_ai,
            so_ca_duoc_bac_si_kham=so_kham,
            so_ca_khop_chuyen_khoa=so_khop,
            ty_le_chinh_xac_toan_vien_pct=overall_acc,
            danh_gia_sao_trung_binh=round(float(avg_stars), 1),
            chi_tiet_theo_chuyen_khoa=dept_list
        )

    async def export_services_catalog(
        self,
        db: AsyncSession,
        chuyen_khoa_id: Optional[int] = None,
        ma_nhom_byt: Optional[str] = None
    ) -> ServiceExportResponse:
        stmt = (
            select(DichVu)
            .options(
                selectinload(DichVu.chuyen_khoa),
                selectinload(DichVu.phong_thuc_hien)
            )
            .order_by(DichVu.ma_dich_vu.asc())
        )
        if chuyen_khoa_id:
            stmt = stmt.where(DichVu.chuyen_khoa_id == chuyen_khoa_id)
        if ma_nhom_byt:
            stmt = stmt.where(DichVu.ma_nhom_byt == ma_nhom_byt)

        rows = (await db.execute(stmt)).scalars().all()
        items: List[ServiceExportItem] = []
        for r in rows:
            dept_name = r.chuyen_khoa.ten_chuyen_khoa if r.chuyen_khoa else "Chung"
            room_name = r.phong_thuc_hien.ten_phong if r.phong_thuc_hien else "Phòng khám"
            items.append(ServiceExportItem(
                id=r.id,
                ma_dich_vu=r.ma_dich_vu,
                ten_dich_vu=r.ten_dich_vu,
                chuyen_khoa=dept_name,
                don_gia=float(r.don_gia or 0.0),
                don_vi_tinh=getattr(r, "don_vi_tinh", "Lần") or "Lần",
                ma_nhom_byt=r.ma_nhom_byt,
                phong_thuc_hien=room_name,
                thoi_gian_tra_ket_qua_phut=r.thoi_gian_tra_ket_qua_phut or 30,
                is_active=r.is_active
            ))

        return ServiceExportResponse(
            tong_so_dich_vu=len(items),
            ngay_xuat=date.today(),
            danh_muc=items
        )


admin_catalog_service = AdminCatalogService()
