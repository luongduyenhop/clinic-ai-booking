import logging
from datetime import date, datetime, timezone
from typing import List, Optional
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import (
    LichLamViec,
    LichKham,
    HangDoiKham,
    TrangThaiLichEnum,
    TrangThaiHangDoiEnum,
)
from app.models.medical import LuotKham, BienBanDinhChinh, ChiDinh
from app.models.user import BacSi, ChuyenKhoa, PhongKham
from app.schemas.clinical import AmendmentResponse
from app.schemas.admin import (
    AdminDashboardStatsResponse,
    AdminAnalyticsReportResponse,
    CancellationReasonBreakdown,
    SpecialtyBookingStat,
)

logger = logging.getLogger(__name__)


class AdminAnalyticsService:
    """Dịch vụ chuyên trách Báo cáo Dashboard, Thống kê Phân tích và Duyệt đính chính (SRP)"""

    # --- 4. Dashboard KPIs Dữ liệu thật (Multi-Tier Command Center) ---
    async def get_dashboard_stats(self, query_date: Optional[date], db: AsyncSession) -> AdminDashboardStatsResponse:
        """Thống kê vận hành phòng khám đa tầng (Vận hành - An toàn - Đối soát tài chính) từ PostgreSQL"""
        d = query_date or date.today()

        # 1. Thống kê lịch hẹn theo trạng thái
        stmt_apts = select(LichKham).where(LichKham.ngay_kham == d)
        apts = (await db.execute(stmt_apts)).scalars().all()

        tong_apts = len(apts)
        so_check_in = sum(1 for a in apts if a.trang_thai in ("da_tiep_nhan", "dang_kham", "da_kham"))
        so_dang_kham = sum(1 for a in apts if a.trang_thai == "dang_kham")
        so_hoan_tat = sum(1 for a in apts if a.trang_thai == "da_kham")
        so_huy = sum(1 for a in apts if a.trang_thai in ("da_huy", "tu_dong_huy"))
        so_noshow = sum(1 for a in apts if a.trang_thai == "no_show")

        # 2. Chi tiết hàng đợi & Thời gian chờ trung bình (Chuẩn OpenEMR Flow Board)
        stmt_queue = select(HangDoiKham).where(HangDoiKham.ngay_kham == d)
        tickets = (await db.execute(stmt_queue)).scalars().all()

        so_cho_kham = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value)
        so_dang_kham_queue = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.DANG_KHAM.value)
        so_da_kham_queue = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.DA_KHAM.value)
        so_tam_hoan = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.TAM_HOAN.value)
        so_bo_kham = sum(1 for t in tickets if t.trang_thai == TrangThaiHangDoiEnum.BO_KHAM.value)

        wait_times = []
        for t in tickets:
            if t.thoi_gian_bat_dau and t.thoi_gian_check_in:
                diff = (t.thoi_gian_bat_dau - t.thoi_gian_check_in).total_seconds() / 60.0
                if diff >= 0:
                    wait_times.append(diff)
            elif t.thoi_gian_check_in and t.trang_thai == TrangThaiHangDoiEnum.CHO_KHAM.value:
                now = datetime.now(timezone.utc)
                cin = t.thoi_gian_check_in.replace(tzinfo=timezone.utc) if t.thoi_gian_check_in.tzinfo is None else t.thoi_gian_check_in
                diff = (now - cin).total_seconds() / 60.0
                if diff >= 0:
                    wait_times.append(diff)

        avg_wait = round(sum(wait_times) / len(wait_times), 1) if wait_times else 0.0

        # 3. Công suất sử dụng buồng khám vật lý & Đội ngũ y tế
        stmt_bs = select(func.count(BacSi.id)).where(BacSi.is_active.is_(True))
        active_doctors = (await db.execute(stmt_bs)).scalar() or 0

        stmt_ck = select(func.count(ChuyenKhoa.id)).where(ChuyenKhoa.is_active.is_(True))
        active_depts = (await db.execute(stmt_ck)).scalar() or 0

        stmt_total_rooms = select(func.count(PhongKham.id)).where(PhongKham.is_active.is_(True))
        total_rooms = (await db.execute(stmt_total_rooms)).scalar() or 0

        stmt_used_rooms = select(func.count(func.distinct(LichLamViec.phong_kham_id))).where(
            LichLamViec.ngay_lam_viec == d,
            LichLamViec.is_active.is_(True),
            LichLamViec.phong_kham_id.is_not(None)
        )
        used_rooms = (await db.execute(stmt_used_rooms)).scalar() or 0
        cong_suat_buong = round((used_rooms / total_rooms * 100.0), 1) if total_rooms > 0 else 0.0

        # 4. Tầng An toàn lâm sàng (Bệnh án khóa, Kiểm thảo đính chính, Cảnh báo cấp cứu)
        stmt_locked = select(func.count(LuotKham.id)).where(LuotKham.is_locked.is_(True))
        locked_emr = (await db.execute(stmt_locked)).scalar() or 0

        stmt_amendments = select(func.count(BienBanDinhChinh.id))
        total_amendments = (await db.execute(stmt_amendments)).scalar() or 0

        stmt_high_amend = select(func.count(BienBanDinhChinh.id)).where(BienBanDinhChinh.muc_do_nghiem_trong == 'CAO')
        high_amendments = (await db.execute(stmt_high_amend)).scalar() or 0

        stmt_redflags = select(func.count(LichKham.id)).where(
            LichKham.ngay_kham == d,
            or_(
                LichKham.ly_do_kham.ilike("%cấp cứu%"),
                LichKham.trieu_chung_ban_dau.ilike("%cấp cứu%")
            )
        )
        so_redflags = (await db.execute(stmt_redflags)).scalar() or 0

        # 5. Tầng Đối soát tài chính (Doanh thu khám, Tạm thu cận lâm sàng, Thất thoát)
        stmt_revenue = (
            select(func.sum(BacSi.gia_kham_mac_dinh))
            .select_from(LichKham)
            .join(BacSi, LichKham.bac_si_id == BacSi.id)
            .where(
                LichKham.ngay_kham == d,
                LichKham.trang_thai.notin_([TrangThaiLichEnum.DA_HUY.value, TrangThaiLichEnum.TU_DONG_HUY.value])
            )
        )
        est_rev = float((await db.execute(stmt_revenue)).scalar() or 0.0)

        stmt_paraclinical = (
            select(func.sum(ChiDinh.don_gia_tai_thoi_diem * ChiDinh.so_luong))
            .select_from(ChiDinh)
            .join(LuotKham, ChiDinh.luot_kham_id == LuotKham.id)
            .join(LichKham, LuotKham.lich_kham_id == LichKham.id)
            .where(
                LichKham.ngay_kham == d,
                ChiDinh.trang_thai != "da_huy"
            )
        )
        paraclinical_rev = float((await db.execute(stmt_paraclinical)).scalar() or 0.0)

        tong_doanh_thu = est_rev + paraclinical_rev
        ty_le_noshow = round((so_noshow / tong_apts * 100.0), 1) if tong_apts > 0 else 0.0

        return AdminDashboardStatsResponse(
            ngay_bao_cao=d,
            tong_lich_hen_hom_nay=tong_apts,
            so_ca_da_check_in=so_check_in,
            so_ca_cho_kham=so_cho_kham,
            so_ca_dang_kham=so_dang_kham if so_dang_kham > 0 else so_dang_kham_queue,
            so_ca_hoan_tat_kham=so_hoan_tat if so_hoan_tat > 0 else so_da_kham_queue,
            so_ca_tam_hoan=so_tam_hoan,
            so_ca_bo_kham=so_bo_kham,
            so_ca_da_huy=so_huy,
            so_ca_no_show=so_noshow,
            thoi_gian_cho_trung_binh_phut=avg_wait,
            cong_suat_buong_kham_pct=cong_suat_buong,
            tong_bac_si_hoat_dong=active_doctors,
            tong_chuyen_khoa=active_depts,
            so_ca_canh_bao_cap_cuu=so_redflags,
            so_bien_ban_dinh_chinh=total_amendments,
            so_dinh_chinh_muc_cao=high_amendments,
            so_benh_an_da_khoa=locked_emr,
            doanh_thu_kham_lam_sang=est_rev,
            doanh_thu_can_lam_sang=paraclinical_rev,
            tong_doanh_thu_trong_ngay=tong_doanh_thu,
            ty_le_that_thoat_noshow_pct=ty_le_noshow,
            doanh_thu_du_kien_hom_nay=tong_doanh_thu,
        )



    # --- 5. Duyệt Đính Chính Hồ Sơ Bệnh Án Toàn Viện (Four-Eyes Principle) ---
    async def get_amendments_admin(
        self,
        db: AsyncSession,
        trang_thai: Optional[str] = None
    ) -> List[AmendmentResponse]:
        """Lấy toàn bộ danh sách biên bản đính chính bệnh án toàn viện để Giám đốc CM / Trưởng khoa kiểm thảo"""
        stmt = select(BienBanDinhChinh).order_by(BienBanDinhChinh.created_at.desc())
        if trang_thai:
            stmt = stmt.where(BienBanDinhChinh.trang_thai == trang_thai)
        rows = (await db.execute(stmt)).scalars().all()
        from app.services.clinical_service import clinical_service
        return [clinical_service._to_amendment_response(r) for r in rows]

    # =========================================================================


    # GÓI 5: XEM BÁO CÁO THỐNG KÊ CHUYÊN SÂU (Analytics & Intelligence)
    # =========================================================================
    async def get_analytics_report_admin(
        self,
        db: AsyncSession,
        tu_ngay: Optional[date] = None,
        den_ngay: Optional[date] = None
    ) -> AdminAnalyticsReportResponse:
        from datetime import timedelta
        d_end = den_ngay or date.today()
        d_start = tu_ngay or (d_end - timedelta(days=30))

        stmt = select(LichKham).where(
            LichKham.ngay_kham >= d_start,
            LichKham.ngay_kham <= d_end
        )
        apts = (await db.execute(stmt)).scalars().all()
        tong_dat = len(apts)

        completed = sum(1 for a in apts if a.trang_thai == TrangThaiLichEnum.DA_KHAM.value)
        noshow = sum(1 for a in apts if a.trang_thai == TrangThaiLichEnum.NO_SHOW.value)

        pt_cancel = sum(1 for a in apts if a.trang_thai == TrangThaiLichEnum.DA_HUY.value and a.nguoi_huy_vai_tro == "benh_nhan")
        auto_cancel = sum(1 for a in apts if a.trang_thai == TrangThaiLichEnum.TU_DONG_HUY.value)
        clinic_cancel = sum(1 for a in apts if a.trang_thai == TrangThaiLichEnum.DA_HUY.value and a.nguoi_huy_vai_tro != "benh_nhan")
        total_cancel = pt_cancel + auto_cancel + clinic_cancel

        ty_le_noshow = round((noshow / tong_dat * 100.0), 1) if tong_dat > 0 else 0.0
        ty_le_huy = round((total_cancel / tong_dat * 100.0), 1) if tong_dat > 0 else 0.0

        depts = (await db.execute(select(ChuyenKhoa))).scalars().all()
        dept_stats = []
        for d in depts:
            doc_ids = (await db.execute(select(BacSi.id).where(BacSi.chuyen_khoa_id == d.id))).scalars().all()
            if doc_ids:
                d_apts = [a for a in apts if a.bac_si_id in doc_ids]
                d_total = len(d_apts)
                d_done = sum(1 for a in d_apts if a.trang_thai == TrangThaiLichEnum.DA_KHAM.value)
                d_canc = sum(1 for a in d_apts if a.trang_thai in [TrangThaiLichEnum.DA_HUY.value, TrangThaiLichEnum.TU_DONG_HUY.value])
                dept_stats.append(SpecialtyBookingStat(
                    chuyen_khoa_id=d.id,
                    ten_chuyen_khoa=d.ten_chuyen_khoa,
                    so_luot_dat=d_total,
                    so_hoan_tat=d_done,
                    so_da_huy=d_canc
                ))

        ai_rep = await self.get_ai_accuracy_report(db)

        return AdminAnalyticsReportResponse(
            tu_ngay=d_start,
            den_ngay=d_end,
            tong_luot_dat_kham=tong_dat,
            so_luot_kham_hoan_tat=completed,
            so_luot_no_show=noshow,
            ty_le_no_show_pct=ty_le_noshow,
            phan_tich_huy=CancellationReasonBreakdown(
                benh_nhan_tu_huy=pt_cancel,
                tu_dong_huy_qua_han_24h=auto_cancel,
                phong_kham_huy_do_bac_si_nghi=clinic_cancel,
                tong_so_huy=total_cancel
            ),
            ty_le_huy_tong_hop_pct=ty_le_huy,
            do_chinh_xac_ai_pct=ai_rep.ty_le_chinh_xac_toan_vien_pct,
            thong_ke_chuyen_khoa=dept_stats
        )

    # =========================================================================


admin_analytics_service = AdminAnalyticsService()
