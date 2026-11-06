from types import SimpleNamespace

import pytest

from app.models.user import VaiTroEnum
from app.services.clinical_service import ClinicalService


class _FakeResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


class _FakeDB:
    def __init__(self, doctor):
        self.doctor = doctor
        self.audit_entries = []
        self.commit_count = 0

    async def execute(self, _statement):
        return _FakeResult(self.doctor)

    def add(self, entry):
        self.audit_entries.append(entry)

    async def flush(self):
        return None

    async def commit(self):
        self.commit_count += 1


@pytest.mark.asyncio
async def test_doctor_emr_view_writes_and_commits_audit_log(monkeypatch):
    doctor_id = 73
    patient_id = 91
    encounter_id = 147
    account = SimpleNamespace(id=25, nguoi_dung_id=38, vai_tro=VaiTroEnum.BAC_SI.value)
    doctor = SimpleNamespace(id=doctor_id)
    encounter = SimpleNamespace(
        id=encounter_id,
        benh_nhan_id=patient_id,
        bac_si_id=doctor_id,
        tiep_quan_boi_id=None,
    )
    db = _FakeDB(doctor)
    service = ClinicalService()

    async def load_encounter(_encounter_id, _db):
        return encounter

    monkeypatch.setattr(service, "_get_encounter_with_relations", load_encounter)
    monkeypatch.setattr(service, "_to_encounter_response", lambda _encounter: "encounter-response")

    response = await service.get_encounter_detail(encounter_id, account, db)

    assert response == "encounter-response"
    assert len(db.audit_entries) == 1
    audit_entry = db.audit_entries[0]
    assert audit_entry.user_id == account.id
    assert audit_entry.user_role == VaiTroEnum.BAC_SI.value
    assert audit_entry.patient_id == patient_id
    assert audit_entry.action == "VIEW"
    assert audit_entry.resource_type == "ENCOUNTER"
    assert audit_entry.resource_id == encounter_id
    assert audit_entry.purpose == "Xem hồ sơ bệnh án điện tử (EMR)"
    assert db.commit_count == 1
