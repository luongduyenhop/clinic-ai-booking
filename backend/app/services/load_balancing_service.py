import logging
from datetime import date, datetime, timezone
from typing import Optional, List
from sqlalchemy import func, select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import BadRequestException, ConflictException, NotFoundException
from app.models.appointment import (
    HangDoiKham,
    LichLamViec,
    NghiPhepBacSi,
    TrangThaiHangDoiEnum,
    TrangThaiNghiPhepEnum,
)
from app.models.user import BacSi, ChuyenKhoa

logger = logging.getLogger(__name__)


class DoctorLoadBalancingService:
    """
    Thuật toán Cân bằng tải Phân bổ Bác sĩ tự động (FC-05):
    - Dùng khi check-in lịch hẹn chưa có bác sĩ (đặt theo chuyên khoa)
    - Dùng khi bệnh nhân vãng lai không chỉ định bác sĩ
    - Dùng khi rebalance hàng đợi khi bác sĩ nghỉ đột xuất
    """

    async def assign_optimal_doctor(
        self,
        chuyen_khoa_id: int,
        ca_kham: str,
        ngay_kham: date,
        db: AsyncSession,
    ) -> int:
        """
        Tìm và trả về bac_si_id tối ưu trong ca làm việc:
        1. Tìm các bác sĩ thuộc chuyên khoa có lịch làm việc (LichLamViec) active trong ngày/ca đó.
        2. Loại trừ các bác sĩ có đơn nghỉ phép đã duyệt (DA_DUYET) trong ngày/ca đó.
        3. Sử dụng SELECT ... FOR UPDATE trên LichLamViec để ngăn race-condition concurrency.
        4. Đếm số lượng bệnh nhân đang chờ (CHO_KHAM + DANG_KHAM) của từng bác sĩ.
        5. Loại trừ bác sĩ đã chạm giới hạn ca khám (gioi_han_ca_kham).
        6. Chọn bác sĩ có tải thấp nhất; nếu bằng nhau, chọn bác sĩ có thời điểm tiếp nhận gần nhất xa hơn (round-robin).
        """
        # 1. Khóa và lấy các ca làm việc của các bác sĩ thuộc chuyên khoa
        stmt_shifts = (
            select(LichLamViec, BacSi)
            .join(BacSi, LichLamViec.bac_si_id == BacSi.id)
            .where(
                BacSi.chuyen_khoa_id == chuyen_khoa_id,
                BacSi.is_active == True,
                BacSi.trang_thai_giay_phep == "ACTIVE",
                LichLamViec.ngay_lam_viec == ngay_kham,
                LichLamViec.ca_lam_viec == ca_kham,
                LichLamViec.is_active == True,
            )
            .with_for_update(of=LichLamViec)
        )
        shifts_result = (await db.execute(stmt_shifts)).all()
        if not shifts_result:
            raise ConflictException(
                f"Không có bác sĩ nào thuộc chuyên khoa ID {chuyen_khoa_id} có lịch trực hợp lệ trong ca {ca_kham} ngày {ngay_kham}!"
            )

        # 2. Lọc bỏ các bác sĩ đang nghỉ phép đã duyệt
        doctor_ids = [bs.id for _, bs in shifts_result]
        stmt_leaves = (
            select(NghiPhepBacSi.bac_si_id)
            .where(
                NghiPhepBacSi.bac_si_id.in_(doctor_ids),
                NghiPhepBacSi.trang_thai == TrangThaiNghiPhepEnum.DA_DUYET.value,
                NghiPhepBacSi.tu_ngay <= ngay_kham,
                NghiPhepBacSi.den_ngay >= ngay_kham,
                or_(
                    NghiPhepBacSi.ca_lam_viec.is_(None),
                    NghiPhepBacSi.ca_lam_viec == ca_kham,
                ),
            )
        )
        leave_doctor_ids = set((await db.execute(stmt_leaves)).scalars().all())

        available_shifts = [
            (shift, bs) for shift, bs in shifts_result if bs.id not in leave_doctor_ids
        ]
        if not available_shifts:
            raise ConflictException(
                f"Tất cả bác sĩ thuộc chuyên khoa trong ca {ca_kham} ngày {ngay_kham} đều đang nghỉ phép!"
            )

        # 3. Tính tải và công suất cho từng bác sĩ khả dụng
        active_statuses = [
            TrangThaiHangDoiEnum.CHO_KHAM.value,
            TrangThaiHangDoiEnum.DANG_KHAM.value,
        ]

        scored_candidates = []
        for shift, bs in available_shifts:
            # Đếm số lượng bệnh nhân đang chờ/khám
            stmt_load = select(func.count(HangDoiKham.id)).where(
                HangDoiKham.bac_si_id == bs.id,
                HangDoiKham.ngay_kham == ngay_kham,
                HangDoiKham.ca_kham == ca_kham,
                HangDoiKham.trang_thai.in_(active_statuses),
            )
            current_load = (await db.execute(stmt_load)).scalar() or 0

            # Tổng số vé đã tiếp nhận trong ca (để kiểm tra trần giới hạn ca khám)
            stmt_total = select(func.count(HangDoiKham.id)).where(
                HangDoiKham.bac_si_id == bs.id,
                HangDoiKham.ngay_kham == ngay_kham,
                HangDoiKham.ca_kham == ca_kham,
                HangDoiKham.trang_thai != TrangThaiHangDoiEnum.DA_DONG_VE.value,
            )
            total_tickets = (await db.execute(stmt_total)).scalar() or 0

            # Nếu đã vượt giới hạn tối đa của ca thì bỏ qua
            if shift.gioi_han_ca_kham and total_tickets >= shift.gioi_han_ca_kham:
                logger.info(
                    f"Bác sĩ ID {bs.id} đã đạt giới hạn ca ({total_tickets}/{shift.gioi_han_ca_kham})"
                )
                continue

            # Thời điểm check-in cuối cùng (để giải quyết tie-breaker)
            stmt_last_assigned = select(func.max(HangDoiKham.thoi_gian_check_in)).where(
                HangDoiKham.bac_si_id == bs.id,
                HangDoiKham.ngay_kham == ngay_kham,
                HangDoiKham.ca_kham == ca_kham,
            )
            last_assigned = (await db.execute(stmt_last_assigned)).scalar()
            last_timestamp = last_assigned.timestamp() if last_assigned else 0

            scored_candidates.append({
                "bac_si_id": bs.id,
                "current_load": current_load,
                "last_timestamp": last_timestamp,
            })

        if not scored_candidates:
            raise ConflictException(
                f"Tất cả bác sĩ thuộc chuyên khoa trong ca {ca_kham} ngày {ngay_kham} đã đạt giới hạn tiếp nhận tối đa!"
            )

        # 4. Sắp xếp: Tải ít nhất -> Tiếp nhận gần nhất xa hơn (timestamp nhỏ hơn) -> ID nhỏ hơn
        scored_candidates.sort(
            key=lambda x: (x["current_load"], x["last_timestamp"], x["bac_si_id"])
        )
        selected_doctor_id = scored_candidates[0]["bac_si_id"]
        logger.info(
            f"Load Balancing chọn Bác sĩ ID {selected_doctor_id} (Tải hiện tại: {scored_candidates[0]['current_load']})"
        )
        return selected_doctor_id


load_balancing_service = DoctorLoadBalancingService()
