from types import SimpleNamespace

import pytest

from app.models.medical import ChiDinh, DichVu
from app.services.patient_service import PatientService


@pytest.mark.parametrize('group,report_type,files,expected', [
    ('XN', None, ['blood.pdf'], 'XET_NGHIEM'),
    ('XN', None, ['blood.png'], 'XET_NGHIEM'),
    ('CDHA', None, [], 'CHAN_DOAN_HINH_ANH'),
    ('XN', 'CHAN_DOAN_HINH_ANH', [], 'CHAN_DOAN_HINH_ANH'),
    ('CDHA', 'XET_NGHIEM', ['blood.pdf'], 'XET_NGHIEM'),
    (None, None, ['unknown.png'], 'CHUA_PHAN_LOAI'),
    ('TDCN', None, [], 'THAM_DO_CHUC_NANG'),
])
def test_lab_type_follows_metadata_instead_of_attachments(group, report_type, files, expected):
    order = SimpleNamespace(
        dich_vu=SimpleNamespace(ma_nhom_byt=group),
        phieu_ket_qua=SimpleNamespace(loai_ket_qua=report_type) if report_type else None,
        file_dinh_kem_urls=files,
    )
    assert PatientService._lab_result_type(order) == expected


@pytest.mark.asyncio
async def test_patient_api_keeps_blood_pdf_and_imaging_without_file_in_correct_categories(
    api_client, booking, db_session,
):
    from datetime import datetime, timezone
    appointment = await booking.tao_lich(booking.bn_a, booking.bs_x, datetime.now(timezone.utc))
    encounter = await api_client.post(
        '/api/v1/clinical/encounters', json={'lich_kham_id': appointment.id},
        headers=booking.tokens['bs_x'],
    )
    assert encounter.status_code == 201
    encounter_id = encounter.json()['data']['id']
    for group, files in [('XN', ['https://cdn.clinic.test/blood.pdf']), ('CDHA', [])]:
        service = DichVu(ma_dich_vu=f'{group}-{booking.suffix}', ten_dich_vu=group, ma_nhom_byt=group, don_gia=1)
        db_session.add(service)
        await db_session.flush()
        db_session.add(ChiDinh(
            luot_kham_id=encounter_id, dich_vu_id=service.id, don_gia_tai_thoi_diem=1,
            trang_thai='da_co_ket_qua', file_dinh_kem_urls=files,
        ))
    await db_session.flush()
    response = await api_client.get('/api/v1/patient/lab-results', headers=booking.tokens['bn_a'])
    assert response.status_code == 200
    types = {item['ten_dich_vu']: item['loai_ket_qua'] for item in response.json()['data']}
    assert types == {'XN': 'XET_NGHIEM', 'CDHA': 'CHAN_DOAN_HINH_ANH'}
    foreign = await api_client.get('/api/v1/patient/lab-results', headers=booking.tokens['bn_b'])
    assert foreign.status_code == 200
    assert foreign.json()['data'] == []
