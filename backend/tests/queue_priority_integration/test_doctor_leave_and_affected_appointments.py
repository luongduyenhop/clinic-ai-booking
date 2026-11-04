import uuid
from datetime import time, timedelta
import pytest
from sqlalchemy import select

from app.models.appointment import (
    LichLamViec,
    LichKham,
    NghiPhepBacSi,
    CaLamViecEnum,
    TrangThaiLichEnum,
    TrangThaiNghiPhepEnum,
)
from app.models.user import ChuyenKhoa, PhongKham, NguoiDung, BenhNhan
from app.schemas.admin import DoctorLeaveCreateRequest, DoctorLeaveApproveRequest
from app.services.appointment_service import clinic_now


async def _tao_benh_nhan_moi(db_session, suffix: str, idx: int) -> BenhNhan:
    nd = NguoiDung(
        ho_ten=f"Bệnh Nhân Test Leave {idx}",
        email=f"bn.leave.{suffix}.{idx}@clinic.com",
        so_dien_thoai=f"098{uuid.uuid4().int % 10000000:07d}",
    )
    db_session.add(nd)
    await db_session.flush()

    bn = BenhNhan(
        nguoi_dung_id=nd.id,
        ma_dinh_danh_y_te=f"BN-LEAVE-{suffix}-{idx}",
    )
    db_session.add(bn)
    await db_session.commit()
    return bn


@pytest.mark.asyncio
async def test_approve_doctor_leave_locks_shifts_and_warns_affected_appointments(api_client, booking, db_session):
    token_admin = booking.tokens["admin"]
    bs = booking.bs_x
    suffix = uuid.uuid4().hex[:6]

    bn_a = await _tao_benh_nhan_moi(db_session, suffix, 1)
    bn_b = await _tao_benh_nhan_moi(db_session, suffix, 2)

    ck = ChuyenKhoa(
        ma_chuyen_khoa=f"CK-LEAVE-{suffix}",
        ten_chuyen_khoa=f"Khoa Khám {suffix}",
        vi_tri_phong="Phòng 104",
        is_active=True,
    )
    db_session.add(ck)
    await db_session.flush()

    pk = PhongKham(
        ma_phong=f"P104-{suffix}",
        ten_phong="Phòng 104",
        chuyen_khoa_id=ck.id,
        is_active=True,
    )
    db_session.add(pk)
    await db_session.flush()

    bs.chuyen_khoa_id = ck.id
    bs.phong_kham_id = pk.id

    today = clinic_now().date()
    day_1 = today + timedelta(days=1)
    day_2 = today + timedelta(days=2)

    shift_1 = LichLamViec(
        bac_si_id=bs.id,
        phong_kham_id=pk.id,
        ngay_lam_viec=day_1,
        ca_lam_viec=CaLamViecEnum.SANG.value,
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        is_active=True,
    )
    shift_2 = LichLamViec(
        bac_si_id=bs.id,
        phong_kham_id=pk.id,
        ngay_lam_viec=day_2,
        ca_lam_viec=CaLamViecEnum.SANG.value,
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        is_active=True,
    )
    db_session.add_all([shift_1, shift_2])
    await db_session.flush()

    lich_1 = LichKham(
        ma_lich_kham=f"LK-AFF-1-{suffix}",
        benh_nhan_id=bn_a.id,
        bac_si_id=bs.id,
        chuyen_khoa_id=ck.id,
        ngay_kham=day_1,
        gio_kham=time(8, 30),
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
        ly_do_kham="Tái khám định kỳ ngày 1",
    )
    lich_2 = LichKham(
        ma_lich_kham=f"LK-AFF-2-{suffix}",
        benh_nhan_id=bn_b.id,
        bac_si_id=bs.id,
        chuyen_khoa_id=ck.id,
        ngay_kham=day_2,
        gio_kham=time(9, 0),
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
        ly_do_kham="Tái khám định kỳ ngày 2",
    )
    db_session.add_all([lich_1, lich_2])
    await db_session.commit()

    create_payload = DoctorLeaveCreateRequest(
        bac_si_id=bs.id,
        tu_ngay=day_1,
        den_ngay=day_2,
        loai_nghi="NGHI_PHEP",
        ly_do="Đi công tác tập huấn chuyên môn",
    )
    res_create = await api_client.post(
        "/api/v1/schedules/leaves",
        json=create_payload.model_dump(mode="json"),
        headers=token_admin,
    )
    assert res_create.status_code == 201
    leave_data = res_create.json()["data"]
    leave_id = leave_data["id"]
    assert leave_data["trang_thai"] == TrangThaiNghiPhepEnum.CHO_DUYET.value

    approve_payload = DoctorLeaveApproveRequest(
        hanh_dong=TrangThaiNghiPhepEnum.DA_DUYET.value,
        ghi_chu="Đã duyệt lịch nghỉ tập huấn",
    )
    res_approve = await api_client.post(
        f"/api/v1/schedules/leaves/{leave_id}/approve",
        json=approve_payload.model_dump(mode="json"),
        headers=token_admin,
    )
    assert res_approve.status_code == 200
    approved_data = res_approve.json()["data"]
    assert approved_data["trang_thai"] == TrangThaiNghiPhepEnum.DA_DUYET.value

    stmt_lv = select(NghiPhepBacSi).where(NghiPhepBacSi.id == leave_id)
    leave_db = (await db_session.execute(stmt_lv)).scalar_one()
    assert leave_db.trang_thai == TrangThaiNghiPhepEnum.DA_DUYET.value
    assert leave_db.ghi_chu_duyet == "Đã duyệt lịch nghỉ tập huấn"

    stmt_s1 = select(LichLamViec).where(LichLamViec.id == shift_1.id)
    s1_db = (await db_session.execute(stmt_s1)).scalar_one()
    assert s1_db.is_active is False
    assert "Nghỉ phép theo kế hoạch" in (s1_db.ghi_chu_nghi or "")

    stmt_s2 = select(LichLamViec).where(LichLamViec.id == shift_2.id)
    s2_db = (await db_session.execute(stmt_s2)).scalar_one()
    assert s2_db.is_active is False
    assert "Nghỉ phép theo kế hoạch" in (s2_db.ghi_chu_nghi or "")

    res_affected = await api_client.get(
        f"/api/v1/schedules/leaves/{leave_id}/affected-bookings",
        headers=token_admin,
    )
    assert res_affected.status_code == 200
    affected_list = res_affected.json()["data"]

    assert len(affected_list) == 2
    affected_ids = [item["lich_kham_id"] for item in affected_list]
    assert lich_1.id in affected_ids
    assert lich_2.id in affected_ids

    for item in affected_list:
        assert item["ma_lich_kham"] is not None
        assert item["ten_benh_nhan"] is not None
        assert item["so_dien_thoai"] is not None
        assert item["ngay_kham"] in (day_1.isoformat(), day_2.isoformat())
        assert item["gio_kham"] is not None


@pytest.mark.asyncio
async def test_reject_doctor_leave_does_not_lock_shifts(api_client, booking, db_session):
    token_admin = booking.tokens["admin"]
    bs = booking.bs_x
    today = clinic_now().date()
    target_day = today + timedelta(days=3)

    shift = LichLamViec(
        bac_si_id=bs.id,
        ngay_lam_viec=target_day,
        ca_lam_viec=CaLamViecEnum.SANG.value,
        gio_bat_dau=time(8, 0),
        gio_ket_thuc=time(12, 0),
        is_active=True,
    )
    db_session.add(shift)
    await db_session.commit()

    req_create = DoctorLeaveCreateRequest(
        bac_si_id=bs.id,
        tu_ngay=target_day,
        den_ngay=target_day,
        loai_nghi="NGHI_PHEP",
        ly_do="Xin nghỉ việc riêng",
    )
    res_c = await api_client.post(
        "/api/v1/schedules/leaves",
        json=req_create.model_dump(mode="json"),
        headers=token_admin,
    )
    leave_id = res_c.json()["data"]["id"]

    req_reject = DoctorLeaveApproveRequest(
        hanh_dong=TrangThaiNghiPhepEnum.TU_CHOI.value,
        ghi_chu="Không đủ nhân sự trực thay thế",
    )
    res_r = await api_client.post(
        f"/api/v1/schedules/leaves/{leave_id}/approve",
        json=req_reject.model_dump(mode="json"),
        headers=token_admin,
    )
    assert res_r.status_code == 200
    assert res_r.json()["data"]["trang_thai"] == TrangThaiNghiPhepEnum.TU_CHOI.value

    shift_db = (await db_session.execute(select(LichLamViec).where(LichLamViec.id == shift.id))).scalar_one()
    assert shift_db.is_active is True
