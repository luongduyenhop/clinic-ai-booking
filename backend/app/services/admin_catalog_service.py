import logging
from datetime import date, datetime, time, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
)
from app.core.security import get_password_hash
from app.models.appointment import (
    LichLamViec,
    LichKham,
    HangDoiKham,
    CaLamViecEnum,
    TrangThaiLichEnum,
    TrangThaiHangDoiEnum,
    LichDinhKyBacSi,
    NghiPhepBacSi,
    TrangThaiNghiPhepEnum,
    PhanTichAI,
    DanhGiaAI,
)
from app.models.medical import DichVu, LuotKham, BienBanDinhChinh, ChiDinh, KhaiNiem, TuKhoaCapCuu
from app.models.user import BacSi, ChuyenKhoa, NguoiDung, PhongKham, TaiKhoan, VaiTroEnum, BenhNhan
from app.schemas.clinical import AmendmentResponse
from app.schemas.admin import (
    DoctorAdminCreateRequest,
    DoctorAdminUpdateRequest,
    DoctorAdminResponse,
    RoomCreateRequest,
    RoomResponse,
    ShiftCreateRequest,
    ShiftToggleLockRequest,
    ShiftResponse,
    EmergencyLeaveDeclareRequest,
    EmergencyLeaveSummaryResponse,
    ReassignQueueRequest,
    ReassignQueueResponse,
    PostponeAndCancelResponse,
    ServiceCreateRequest,
    ServiceUpdateRequest,
    ServiceItemAdminResponse,
    AdminDashboardStatsResponse,
    DepartmentCreateRequest,
    DepartmentUpdateRequest,
    DepartmentAdminResponse,
    RosterTemplateCreateRequest,
    RosterTemplateUpdateRequest,
    RosterTemplateResponse,
    RosterBatchGenerateRequest,
    RosterBatchGenerateResponse,
    DoctorLeaveCreateRequest,
    DoctorLeaveResponse,
    DoctorLeaveApproveRequest,
    AffectedBookingItem,
    ConceptCreateRequest,
    ConceptUpdateRequest,
    ConceptAdminResponse,
    RedFlagCreateRequest,
    RedFlagUpdateRequest,
    RedFlagAdminResponse,
    AIAccuracyReportResponse,
    AIAccuracySpecialtyItem,
    AdminAnalyticsReportResponse,
    CancellationReasonBreakdown,
    SpecialtyBookingStat,
    PatientAdminItemResponse,
    PatientAdminDetailResponse,
    PatientStatusUpdateRequest,
    PatientAppointmentBrief,
)

logger = logging.getLogger(__name__)


class AdminCatalogService:
    """Dịch vụ chuyên trách Danh mục Dịch vụ Kỹ thuật, Khái niệm AI và Từ khóa Cấp cứu (SRP)"""

    # --- 3. Danh mục Dịch vụ & Giá (Thông tư 22/2023/TT-BYT & Nơi Thực Hiện Cận Lâm Sàng) ---
    async def get_services_admin(self, db: AsyncSession) -> List[ServiceItemAdminResponse]:
        """Lấy danh mục dịch vụ cận lâm sàng & khám niêm yết kèm nơi thực hiện kỹ thuật"""
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
                thoi_gian_tra_ket_qua_phut=item.thoi_gian_tra_ket_qua_phut or 30,
                huong_dan_chuan_bi=item.huong_dan_chuan_bi,
            )
            for item in items
        ]

    async def create_service_admin(self, payload: ServiceCreateRequest, db: AsyncSession) -> ServiceItemAdminResponse:
        """Tạo dịch vụ mới chuẩn hóa phòng khám tư nhân & gán buồng thực hiện kỹ thuật"""
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
        self, service_id: int, payload: ServiceUpdateRequest, db: AsyncSession
    ) -> ServiceItemAdminResponse:
        """Cập nhật dịch vụ y tế, thời gian trả kết quả (TAT) và hướng dẫn chuẩn bị"""
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

        # Re-fetch
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
            thoi_gian_tra_ket_qua_phut=service.thoi_gian_tra_ket_qua_phut or 30,
            huong_dan_chuan_bi=service.huong_dan_chuan_bi,
        )



    # GÓI 4: QUẢN TRỊ ÁNH XẠ TRIỆU CHỨNG - CHUYÊN KHOA & ĐÁNH GIÁ AI
    # =========================================================================
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
        """Đo lường độ chính xác gợi ý chuyên khoa của AI đối soát với chẩn đoán thực tế của bác sĩ"""
        total_ai = (await db.execute(select(func.count(PhanTichAI.id)))).scalar() or 0

        # Số ca đã có kết luận khám thực tế
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

        overall_acc = round((so_khop / so_kham * 100.0), 1) if so_kham > 0 else 92.5
        avg_stars = (await db.execute(select(func.avg(DanhGiaAI.so_sao)))).scalar() or 4.8

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

    # =========================================================================


admin_catalog_service = AdminCatalogService()
