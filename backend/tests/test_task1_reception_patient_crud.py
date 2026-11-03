import random
import pytest
from datetime import date

from app.core.exceptions import ConflictException, NotFoundException
from app.schemas.reception import (
    ReceptionPatientCreateRequest,
    ReceptionPatientUpdateRequest,
)
from app.services.reception_service import reception_service


@pytest.mark.asyncio
async def test_create_and_get_patient_detail(db_session):
    phone_digits = random.randint(1000000, 9999999)
    valid_phone = f"091{phone_digits}"
    request_data = ReceptionPatientCreateRequest(
        ho_ten="Nguyễn Văn Tiếp Đón",
        so_dien_thoai=valid_phone,
        ngay_sinh=date(1990, 5, 20),
        gioi_tinh="Nam",
        dia_chi="123 Cầu Giấy, Hà Nội",
        di_ung_thuoc="Paracetamol",
        tien_su_benh="Viêm dạ dày",
        cccd_so="001090123456",
        nhom_mau="O+"
    )

    created_patient = await reception_service.create_patient(request_data, db_session)
    assert created_patient.id is not None
    assert created_patient.ho_ten == "Nguyễn Văn Tiếp Đón"
    assert created_patient.so_dien_thoai == valid_phone
    assert created_patient.ma_dinh_danh_y_te.startswith("BN-")
    assert created_patient.di_ung_thuoc == "Paracetamol"
    assert created_patient.tien_su_benh == "Viêm dạ dày"

    detail = await reception_service.get_patient_detail(created_patient.id, db_session)
    assert detail.id == created_patient.id
    assert detail.ho_ten == "Nguyễn Văn Tiếp Đón"
    assert detail.so_dien_thoai == valid_phone
    assert detail.nhom_mau == "O+"


@pytest.mark.asyncio
async def test_create_patient_duplicate_phone_conflict(db_session):
    phone_digits = random.randint(1000000, 9999999)
    duplicate_phone = f"098{phone_digits}"
    first_request = ReceptionPatientCreateRequest(
        ho_ten="Bệnh Nhân Đầu Tiên",
        so_dien_thoai=duplicate_phone,
        nam_sinh=1995,
        gioi_tinh="Nữ"
    )
    await reception_service.create_patient(first_request, db_session)

    second_request = ReceptionPatientCreateRequest(
        ho_ten="Bệnh Nhân Thứ Hai",
        so_dien_thoai=duplicate_phone,
        nam_sinh=1996,
        gioi_tinh="Nữ"
    )

    with pytest.raises(ConflictException) as exc_info:
        await reception_service.create_patient(second_request, db_session)
    assert "đã tồn tại trong hệ thống" in str(exc_info.value)


@pytest.mark.asyncio
async def test_search_patients_by_phone_and_name(db_session):
    phone_digits = random.randint(1000000, 9999999)
    search_phone = f"097{phone_digits}"
    patient_name = f"Lê Tìm Kiếm {phone_digits % 10000}"

    create_data = ReceptionPatientCreateRequest(
        ho_ten=patient_name,
        so_dien_thoai=search_phone,
        nam_sinh=1988,
        gioi_tinh="Nam"
    )
    created = await reception_service.create_patient(create_data, db_session)

    results_by_phone = await reception_service.search_patients(db_session, search=search_phone)
    assert len(results_by_phone) >= 1
    matched = next((item for item in results_by_phone if item.id == created.id), None)
    assert matched is not None
    assert matched.ho_ten == patient_name
    assert matched.so_dien_thoai == search_phone

    results_by_name = await reception_service.search_patients(db_session, search=patient_name)
    assert any(item.id == created.id for item in results_by_name)


@pytest.mark.asyncio
async def test_update_patient_success_and_conflict_handling(db_session):
    phone_digits_1 = random.randint(1000000, 9999999)
    phone_digits_2 = random.randint(1000000, 9999999)
    phone_patient_1 = f"092{phone_digits_1}"
    phone_patient_2 = f"094{phone_digits_2}"

    patient_1 = await reception_service.create_patient(
        ReceptionPatientCreateRequest(ho_ten="Bệnh Nhân 1", so_dien_thoai=phone_patient_1),
        db_session
    )
    await reception_service.create_patient(
        ReceptionPatientCreateRequest(ho_ten="Bệnh Nhân 2", so_dien_thoai=phone_patient_2),
        db_session
    )

    update_payload = ReceptionPatientUpdateRequest(
        ho_ten="Bệnh Nhân 1 Đã Sửa Tên",
        dia_chi="456 Đường Láng, Hà Nội",
        di_ung_thuoc="Aspirin",
        nhom_mau="AB+"
    )
    updated_detail = await reception_service.update_patient(patient_1.id, update_payload, db_session)
    assert updated_detail.ho_ten == "Bệnh Nhân 1 Đã Sửa Tên"
    assert updated_detail.dia_chi == "456 Đường Láng, Hà Nội"
    assert updated_detail.di_ung_thuoc == "Aspirin"
    assert updated_detail.nhom_mau == "AB+"

    conflict_payload = ReceptionPatientUpdateRequest(so_dien_thoai=phone_patient_2)
    with pytest.raises(ConflictException) as conflict_exc:
        await reception_service.update_patient(patient_1.id, conflict_payload, db_session)
    assert "đã được sử dụng bởi người dùng khác" in str(conflict_exc.value)

    with pytest.raises(NotFoundException):
        await reception_service.update_patient(99999999, update_payload, db_session)
