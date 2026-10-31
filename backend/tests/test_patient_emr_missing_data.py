from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.models.medical import LuotKham
from app.services.patient_service import PatientService


@pytest.mark.asyncio
async def test_legacy_encounter_without_doctor_or_start_uses_creation_not_followup():
    encounter = LuotKham(id=987, benh_nhan_id=1)
    encounter.bac_si = None
    encounter.created_at = datetime(2026, 1, 2, tzinfo=timezone.utc)
    encounter.ngay_hen_tai_kham = datetime(2026, 2, 5).date()
    encounter.danh_sach_chan_doan = []
    encounter.danh_sach_chi_dinh = []
    encounter.danh_sach_don_thuoc = []
    result = MagicMock()
    result.scalars.return_value.all.return_value = [encounter]
    db = SimpleNamespace(execute=AsyncMock(return_value=result))
    service = PatientService()
    service._get_current_benh_nhan = AsyncMock(return_value=SimpleNamespace(id=1))
    records = await service.get_patient_medical_records(None, db)
    assert records[0].bac_si_id is None
    assert records[0].thoi_gian_bat_dau is None
    assert str(records[0].ngay_kham) == "2026-01-02"
    assert records[0].chi_dinh_cls == []
    assert records[0].don_thuoc_chi_tiet == []
