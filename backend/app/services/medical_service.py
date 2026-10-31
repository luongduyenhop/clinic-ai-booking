from typing import List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Select, select, func, or_
from app.core.response import PaginationMeta
from app.models.user import BacSi, NguoiDung, ChuyenKhoa
from app.schemas.medical import SpecialtyResponse, DoctorResponse, AcademicDegreeResponse

# Tên chuyên khoa hiển thị cho bác sĩ chưa được gán khoa
DEFAULT_SPECIALTY_NAME = "Đa khoa"


class MedicalService:
    """Tầng Control xử lý danh mục Chuyên khoa & Bác sĩ phục vụ tra cứu đặt lịch (UC-B01)"""

    def _visible_doctors(self, *columns) -> Select:
        """Khung truy vấn bác sĩ được hiển thị cho người bệnh: đang hành nghề, hồ sơ chưa bị xóa
        và chuyên khoa (nếu có) còn hoạt động. Mọi truy vấn danh mục dùng chung để số liệu luôn khớp nhau."""
        return (
            select(*columns)
            .select_from(BacSi)
            .join(NguoiDung, BacSi.nguoi_dung_id == NguoiDung.id)
            .outerjoin(ChuyenKhoa, BacSi.chuyen_khoa_id == ChuyenKhoa.id)
            .where(
                BacSi.is_active.is_(True),
                NguoiDung.is_deleted.is_(False),
                or_(BacSi.chuyen_khoa_id.is_(None), ChuyenKhoa.is_active.is_(True))
            )
        )

    async def get_specialties(self, db: AsyncSession) -> List[SpecialtyResponse]:
        """Lấy danh mục chuyên khoa đang hoạt động kèm số bác sĩ khả dụng của từng khoa"""
        # 1. Đếm số bác sĩ khả dụng theo từng chuyên khoa
        doctor_count = (
            self._visible_doctors(BacSi.chuyen_khoa_id, func.count(BacSi.id).label("so_luong_bac_si"))
            .group_by(BacSi.chuyen_khoa_id)
            .subquery()
        )

        # 2. Ghép số lượng vào danh mục chuyên khoa đang hoạt động (khoa chưa có bác sĩ -> 0)
        stmt = (
            select(ChuyenKhoa, func.coalesce(doctor_count.c.so_luong_bac_si, 0))
            .outerjoin(doctor_count, doctor_count.c.chuyen_khoa_id == ChuyenKhoa.id)
            .where(ChuyenKhoa.is_active.is_(True))
            .order_by(ChuyenKhoa.ten_chuyen_khoa)
        )
        rows = (await db.execute(stmt)).all()

        return [
            SpecialtyResponse(
                id=ck.id,
                ma_chuyen_khoa=ck.ma_chuyen_khoa,
                ten_chuyen_khoa=ck.ten_chuyen_khoa,
                mo_ta=ck.mo_ta,
                vi_tri_phong=ck.vi_tri_phong,
                so_luong_bac_si=so_luong_bac_si
            )
            for ck, so_luong_bac_si in rows
        ]

    async def get_doctors(
        self,
        specialty_id: Optional[int],
        hoc_vi: Optional[List[str]],
        page: int,
        page_size: int,
        db: AsyncSession
    ) -> Tuple[List[DoctorResponse], PaginationMeta]:
        """Tra cứu bác sĩ theo chuyên khoa và học vị, trả về kết quả phân trang"""
        # 1. Dựng điều kiện lọc, bỏ qua giá trị học vị rỗng (client gửi ?hoc_vi= khi chọn "Tất cả")
        filters = []
        if specialty_id is not None:
            filters.append(BacSi.chuyen_khoa_id == specialty_id)
        hoc_vi_values = [value.strip() for value in hoc_vi or [] if value.strip()]
        if hoc_vi_values:
            filters.append(BacSi.hoc_vi.in_(hoc_vi_values))

        # 2. Đếm tổng số bác sĩ thỏa điều kiện để tính metadata phân trang
        count_stmt = self._visible_doctors(func.count(BacSi.id)).where(*filters)
        total_items = (await db.execute(count_stmt)).scalar_one()

        # 3. Lấy dữ liệu trang hiện tại, sắp xếp ổn định theo họ tên rồi theo ID
        stmt = (
            self._visible_doctors(BacSi, NguoiDung, ChuyenKhoa)
            .where(*filters)
            .order_by(NguoiDung.ho_ten, BacSi.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        rows = (await db.execute(stmt)).all()

        doctors = [
            DoctorResponse(
                id=bs.id,
                ho_ten=nd.ho_ten,
                hoc_vi=bs.hoc_vi,
                chuyen_khoa_id=bs.chuyen_khoa_id,
                chuyen_khoa=ck.ten_chuyen_khoa if ck else DEFAULT_SPECIALTY_NAME,
                vi_tri_phong=ck.vi_tri_phong if ck else None,
                nam_kinh_nghiem=bs.nam_kinh_nghiem or 0,
                mo_ta_chuyen_sau=bs.mo_ta_chuyen_sau,
                gia_kham_mac_dinh=float(bs.gia_kham_mac_dinh)
            )
            for bs, nd, ck in rows
        ]
        return doctors, PaginationMeta.create(page=page, page_size=page_size, total_items=total_items)

    async def get_academic_degrees(
        self,
        specialty_id: Optional[int],
        db: AsyncSession
    ) -> List[AcademicDegreeResponse]:
        """Lấy các học vị hiện có của bác sĩ khả dụng để dựng bộ lọc (có thể giới hạn theo chuyên khoa)"""
        stmt = (
            self._visible_doctors(BacSi.hoc_vi, func.count(BacSi.id))
            .group_by(BacSi.hoc_vi)
            .order_by(BacSi.hoc_vi)
        )
        if specialty_id is not None:
            stmt = stmt.where(BacSi.chuyen_khoa_id == specialty_id)
        rows = (await db.execute(stmt)).all()

        return [
            AcademicDegreeResponse(hoc_vi=hoc_vi, so_luong_bac_si=so_luong_bac_si)
            for hoc_vi, so_luong_bac_si in rows
        ]


medical_service = MedicalService()
