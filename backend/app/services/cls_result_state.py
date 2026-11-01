"""Trạng thái phiếu kết quả CLS dùng chung cho nhập kết quả xét nghiệm, CĐHA và ký duyệt.

`phieu_ket_qua_cls.trang_thai`: NHAP (lưu nháp) -> DA_CO_KET_QUA (KTV hoàn tất, chờ duyệt) -> DA_DUYET.
`chi_dinh.trang_thai` chỉ chuyển sang `da_co_ket_qua` khi kết quả được duyệt, nên mọi màn hình đọc chỉ định
(bàn khám bác sĩ, cổng bệnh nhân) chỉ thấy kết quả đã duyệt.
"""
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.medical import PhieuKetQuaCLS

PHIEU_NHAP = "NHAP"
PHIEU_CHO_DUYET = "DA_CO_KET_QUA"
PHIEU_DA_DUYET = "DA_DUYET"


async def latest_phieu(order_id: int, db: AsyncSession) -> Optional[PhieuKetQuaCLS]:
    stmt = (
        select(PhieuKetQuaCLS)
        .where(PhieuKetQuaCLS.chi_dinh_id == order_id)
        .order_by(PhieuKetQuaCLS.lan_thuc_hien.desc())
        .limit(1)
    )
    return (await db.execute(stmt)).scalar_one_or_none()


def is_phieu_approved(phieu: Optional[PhieuKetQuaCLS]) -> bool:
    return bool(phieu and (phieu.trang_thai == PHIEU_DA_DUYET or phieu.bac_si_duyet_id or phieu.thoi_gian_duyet))
