from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
import uuid
import pytest
from sqlalchemy import select

from app.core.config import settings
from app.models.appointment import (
    CaLamViecEnum,
    HangDoiKham,
    LichKham,
    LichLamViec,
    TrangThaiHangDoiEnum,
    TrangThaiLichEnum,
)
from app.models.compliance import HealthDataAccessAction, HealthDataResourceType
from app.models.medical import (
    ChiDinh,
    DichVu,
    DonThuoc,
    HoaDon,
    KhaiNiem,
    LuotKham,
    LuotKhamTheLuc,
    PhieuKetQuaCLS,
    PhieuKhamChuyenKhoa,
)
from app.models.user import ChuyenKhoa, NguoiDung, VaiTroEnum
from app.services.appointment_service import clinic_now


def _clinic_now_naive():
    clinic_tz = timezone(timedelta(hours=settings.CLINIC_UTC_OFFSET_HOURS))
    return datetime.now(clinic_tz).replace(tzinfo=None)


@pytest.mark.asyncio
async def test_flow_closed_loop_booking_to_patient_portal_e2e(api_client, booking, db_session):
    token_bn = booking.tokens["bn_a"]
    token_letan = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    await booking.tao_tai_khoan("ktv", VaiTroEnum.KY_THUAT_VIEN.value)
    token_ktv = booking.tokens["ktv"]

    suffix = uuid.uuid4().hex[:6]
    ck = ChuyenKhoa(
        ma_chuyen_khoa=f"KHOA_NOI_{suffix}",
        ten_chuyen_khoa="Nội tổng quát",
        vi_tri_phong="Phòng 101",
        is_active=True,
    )
    db_session.add(ck)
    await db_session.flush()

    booking.bs_x.chuyen_khoa_id = ck.id
    booking.bs_x.gia_kham_mac_dinh = Decimal("200000.00")

    nd_bn = await db_session.get(NguoiDung, booking.bn_a.nguoi_dung_id)
    nd_bn.gioi_tinh = "Nam"
    nd_bn.ngay_sinh = date(1992, 6, 15)
    await db_session.flush()

    res_triage = await api_client.post(
        "/api/v1/ai/analyze-symptoms",
        json={"trieu_chung": f"dau bung tieu chay, day hoi ({suffix})"},
        headers=token_bn,
    )
    assert res_triage.status_code == 200
    triage_data = res_triage.json()["data"]
    assert triage_data["has_emergency"] is False
    assert len(triage_data["suggested_specialties"]) >= 1

    now_clinic = _clinic_now_naive()
    lich = LichKham(
        ma_lich_kham=f"LK-E2E-{suffix}",
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        chuyen_khoa_id=ck.id,
        ngay_kham=now_clinic.date(),
        gio_kham=(now_clinic + timedelta(minutes=10)).time().replace(microsecond=0),
        ca_kham="sang",
        so_thu_tu=1,
        trang_thai=TrangThaiLichEnum.DA_XAC_NHAN.value,
        ly_do_kham="Sốt xuất huyết nghi ngờ, đau đầu, chảy máu chân răng",
    )
    db_session.add(lich)
    await db_session.commit()

    res_checkin = await api_client.post(
        "/api/v1/reception/check-in",
        json={"lich_kham_id": lich.id, "ghi_chu": "Bệnh nhân đến đúng khung giờ hẹn"},
        headers=token_letan,
    )
    assert res_checkin.status_code == 201
    ticket_data = res_checkin.json()["data"]
    ticket_id = ticket_data["id"]
    assert ticket_data["trang_thai"] == TrangThaiHangDoiEnum.CHO_KHAM.value

    res_call = await api_client.post("/api/v1/clinical/queue/call-next", headers=token_bs)
    assert res_call.status_code == 200
    assert res_call.json()["data"]["ticket"]["id"] == ticket_id
    assert res_call.json()["data"]["ticket"]["trang_thai"] == TrangThaiHangDoiEnum.DANG_KHAM.value

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={
            "lich_kham_id": lich.id,
            "ly_do_vao_kham": "Sốt cao ngày thứ 4, xuất huyết dưới da",
        },
        headers=token_bs,
    )
    assert res_enc.status_code == 201
    enc_id = res_enc.json()["data"]["id"]

    icd_concept = KhaiNiem(
        ma_khai_niem="A97",
        ten_khai_niem="Sốt xuất huyết Dengue",
        loai_khai_niem="benh_icd10",
        is_active=True,
    )
    db_session.add(icd_concept)
    await db_session.flush()

    workspace_step1 = {
        "encounters": {
            str(enc_id): {
                "id": enc_id,
                "mach_lan_phut": 96,
                "huyet_ap_tam_thu": 110,
                "huyet_ap_tam_truong": 70,
                "nhip_tho_lan_phut": 20,
                "nhiet_do_c": "38.9",
                "chieu_cao_cm": "170.0",
                "can_nang_kg": "75.0",
                "ly_do_vao_kham": "Sốt cao ngày thứ 4, chấm xuất huyết cẳng chân",
                "benh_su": "Sốt liên tục 4 ngày, uống hạ sốt đỡ ít",
                "kham_lam_sang_bo_phan": "Da xung huyết, dấu hiệu dây thắt dương tính",
                "kham_chuyen_khoa": {
                    "items": {
                        "Tuần hoàn": {"status": "BT", "note": "Nhịp nhanh đều"},
                        "Huyết học": {"status": "BAT", "note": "Xuất huyết dưới da rải rác"},
                    },
                    "extras": {"Cảnh báo": "Theo dõi sát số lượng tiểu cầu"},
                },
                "ket_luan_dieu_tri": "Theo dõi Sốt xuất huyết Dengue có dấu hiệu cảnh báo",
                "danh_sach_chan_doan": [
                    {
                        "ma_icd10": "A97",
                        "ten_benh_chan_doan": "Sốt xuất huyết Dengue",
                        "loai_chan_doan": "chinh",
                        "ghi_chu_chuyen_mon": "Cần xét nghiệm tổng phân tích tế bào máu khẩn",
                    }
                ],
            }
        }
    }
    res_ws1 = await api_client.put(
        "/api/v1/clinical/workspace-state",
        json=workspace_step1,
        headers=token_bs,
    )
    assert res_ws1.status_code == 200

    dv_xn = DichVu(
        ma_dich_vu=f"DV_XN_MAU_{suffix}",
        ten_dich_vu="Công thức máu 18 chỉ số",
        don_gia=Decimal("150000.00"),
        don_vi_tinh="Lần",
        ma_nhom_byt="XN",
        is_active=True,
    )
    db_session.add(dv_xn)
    await db_session.flush()

    res_order = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/orders",
        json={"dich_vu_id": dv_xn.id, "so_luong": 1},
        headers=token_bs,
    )
    assert res_order.status_code == 201
    order_id = res_order.json()["data"]["id"]
    assert res_order.json()["data"]["trang_thai"] == "da_chi_dinh"

    res_preview = await api_client.get(
        f"/api/v1/cashier/encounters/{enc_id}/invoice-preview",
        headers=token_letan,
    )
    assert res_preview.status_code == 200
    assert Decimal(str(res_preview.json()["data"]["tong_tien"])) == Decimal("350000.00")

    res_inv = await api_client.post(
        "/api/v1/cashier/invoices",
        json={"luot_kham_id": enc_id, "mien_giam": 20000.00, "ghi_chu": "Hỗ trợ người bệnh"},
        headers=token_letan,
    )
    assert res_inv.status_code == 201
    inv_id = res_inv.json()["data"]["id"]
    thuc_thu = float(res_inv.json()["data"]["thuc_thu"])
    assert Decimal(str(thuc_thu)) == Decimal("330000.00")

    res_pay = await api_client.post(
        f"/api/v1/cashier/invoices/{inv_id}/pay",
        json={
            "phuong_thuc_thanh_toan": "chuyen_khoan",
            "so_tien_khach_tra": thuc_thu,
            "ghi_chu": "Thanh toán QR liên ngân hàng",
        },
        headers=token_letan,
    )
    assert res_pay.status_code == 200
    assert res_pay.json()["data"]["trang_thai"] == "da_thu"

    db_session.expire_all()
    cd_after_pay = await db_session.get(ChiDinh, order_id)
    assert cd_after_pay.trang_thai == "da_thanh_toan"

    res_cls_queue = await api_client.get("/api/v1/subclinical/queue", headers=token_ktv)
    assert res_cls_queue.status_code == 200
    queue_order_ids = [item["id"] for item in res_cls_queue.json()["data"]["items"]]
    assert order_id in queue_order_ids

    res_cls_start = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/start",
        headers=token_ktv,
    )
    assert res_cls_start.status_code == 200
    assert res_cls_start.json()["data"]["trang_thai"] == "dang_thuc_hien"

    res_lab_submit = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/lab-results",
        json={
            "chi_so": {"WBC": 3.2, "HGB": 155, "PLT": 38},
            "ket_luan": "Giảm tiểu cầu mức nguy kịch (PLT 38 G/L), cô đặc máu nhẹ",
            "luu_nhap": False,
        },
        headers=token_ktv,
    )
    assert res_lab_submit.status_code == 200
    lab_submit_data = res_lab_submit.json()["data"]
    assert lab_submit_data["ket_qua"]["ket_qua_phan_loai"] == "NGUY_KICH"
    assert lab_submit_data["ket_qua"]["so_nguy_hiem"] >= 1

    res_approve = await api_client.post(
        f"/api/v1/subclinical/orders/{order_id}/approve",
        headers=token_ktv,
    )
    assert res_approve.status_code == 200
    approve_data = res_approve.json()["data"]
    assert approve_data["trang_thai"] == "da_co_ket_qua"
    assert approve_data["trang_thai_ket_qua"] == "DA_DUYET"

    res_returned = await api_client.get("/api/v1/subclinical/returned-results", headers=token_bs)
    assert res_returned.status_code == 200
    returned_ids = [item["chi_dinh_id"] for item in res_returned.json()["data"]["items"]]
    assert order_id in returned_ids

    workspace_step2 = {
        "encounters": {
            str(enc_id): {
                "id": enc_id,
                "so_ngay_dung": 5,
                "loi_dan_uong_thuoc": "Uống nhiều Oresol, tái khám ngay nếu chảy máu cam hoặc đau bụng nhiều",
                "trang_thai_don_thuoc": "SIGNED",
                "chu_ky_so": "SHA256-BS-SIGNATURE-VERIFIED",
                "danh_sach_thuoc": [
                    {
                        "ten_thuoc": "Paracetamol",
                        "hoat_chat": "Paracetamol",
                        "ham_luong": "500mg",
                        "don_vi_tinh": "Viên",
                        "sang": "1",
                        "trua": "1",
                        "chieu": "0",
                        "toi": "1",
                        "so_ngay_dung": 5,
                        "ghi_chu": "Chỉ uống khi sốt từ 38.5 độ C",
                    },
                    {
                        "ten_thuoc": "Oresol",
                        "hoat_chat": "Glucose + Điện giải",
                        "ham_luong": "20.5g",
                        "don_vi_tinh": "Gói",
                        "sang": "1",
                        "trua": "1",
                        "chieu": "1",
                        "toi": "0",
                        "so_ngay_dung": 5,
                        "ghi_chu": "Pha 1 gói với đúng 1 lít nước đun sôi để nguội",
                    },
                ],
            }
        }
    }
    res_ws2 = await api_client.put(
        "/api/v1/clinical/workspace-state",
        json=workspace_step2,
        headers=token_bs,
    )
    assert res_ws2.status_code == 200

    res_complete = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/complete",
        json={
            "ket_luan_dieu_tri": "Sốt xuất huyết Dengue ngày 4 có giảm tiểu cầu, điều trị ngoại trú theo dõi sát",
            "loi_dan_bac_si": "Tái khám xét nghiệm lại công thức máu sau 24 giờ",
        },
        headers=token_bs,
    )
    assert res_complete.status_code == 200
    assert res_complete.json()["data"]["is_locked"] is True

    db_session.expire_all()
    lk_final = await db_session.get(LuotKham, enc_id)
    pe_final = (
        await db_session.execute(select(LuotKhamTheLuc).where(LuotKhamTheLuc.luot_kham_id == enc_id))
    ).scalar_one()
    ck_final = (
        await db_session.execute(select(PhieuKhamChuyenKhoa).where(PhieuKhamChuyenKhoa.luot_kham_id == enc_id))
    ).scalar_one()
    rx_final = (
        await db_session.execute(select(DonThuoc).where(DonThuoc.luot_kham_id == enc_id))
    ).scalar_one()
    ticket_final = await db_session.get(HangDoiKham, ticket_id)
    hd_final = await db_session.get(HoaDon, inv_id)
    phieu_cls_final = (
        await db_session.execute(select(PhieuKetQuaCLS).where(PhieuKetQuaCLS.chi_dinh_id == order_id))
    ).scalar_one()

    assert lk_final.bmi == Decimal("26.0")
    assert pe_final.bmi == Decimal("26.0")
    assert ck_final.phan_loai_suc_khoe == "LOAI_2"
    assert rx_final.trang_thai == "SIGNED"
    assert rx_final.du_lieu_don_thuoc_hash is not None
    assert ticket_final.trang_thai == TrangThaiHangDoiEnum.DA_KHAM.value
    assert hd_final.trang_thai == "da_thu"
    assert phieu_cls_final.trang_thai == "DA_DUYET"

    res_pt_emr = await api_client.get("/api/v1/patient/medical-records", headers=token_bn)
    assert res_pt_emr.status_code == 200
    emr_list = res_pt_emr.json()["data"]
    emr_item = next(item for item in emr_list if item["luot_kham_id"] == enc_id)
    assert emr_item["ma_icd10"] == "A97"
    assert emr_item["sinh_hieu"]["bmi"] == 26.0
    assert emr_item["trang_thai_luot_kham"] == "DA_KHOA_HO_SO"
    assert emr_item["co_don_thuoc"] is True
    assert emr_item["so_loai_thuoc"] == 2
    assert len(emr_item["chi_dinh_cls"]) == 1

    res_pt_labs = await api_client.get("/api/v1/patient/lab-results", headers=token_bn)
    assert res_pt_labs.status_code == 200
    lab_items = res_pt_labs.json()["data"]
    assert len(lab_items) >= 1
    lab_item = next(item for item in lab_items if item["id"] == order_id)
    assert lab_item["phan_loai"] == "NGUY_KICH"
    assert lab_item["loai_ket_qua"] == "XET_NGHIEM"

    res_pt_rxs = await api_client.get("/api/v1/patient/prescriptions", headers=token_bn)
    assert res_pt_rxs.status_code == 200
    rx_items = res_pt_rxs.json()["data"]
    rx_item = next(item for item in rx_items if item["luot_kham_id"] == enc_id)
    assert rx_item["trang_thai"] == "SIGNED"
    assert rx_item["da_ky_so"] is True
    assert len(rx_item["danh_sach_thuoc"]) == 2


@pytest.mark.asyncio
async def test_flow_emergency_leave_and_shift_rerouting_e2e(api_client, booking, db_session):
    token_admin = booking.tokens["admin"]
    today = clinic_now().date()
    suffix = uuid.uuid4().hex[:6]

    ck = ChuyenKhoa(
        ma_chuyen_khoa=f"CK_TIM_{suffix}",
        ten_chuyen_khoa=f"Khoa Tim Mạch {suffix}",
        vi_tri_phong="Phòng 202",
        is_active=True,
    )
    db_session.add(ck)
    await db_session.flush()

    booking.bs_x.chuyen_khoa_id = ck.id
    booking.bs_y.chuyen_khoa_id = ck.id

    shift_x = LichLamViec(
        bac_si_id=booking.bs_x.id,
        ngay_lam_viec=today,
        ca_lam_viec=CaLamViecEnum.SANG.value,
        gio_bat_dau=time(7, 30),
        gio_ket_thuc=time(11, 30),
        gioi_han_ca_kham=10,
        is_active=True,
    )
    shift_y = LichLamViec(
        bac_si_id=booking.bs_y.id,
        ngay_lam_viec=today,
        ca_lam_viec=CaLamViecEnum.SANG.value,
        gio_bat_dau=time(7, 30),
        gio_ket_thuc=time(11, 30),
        gioi_han_ca_kham=10,
        is_active=True,
    )
    db_session.add_all([shift_x, shift_y])
    await db_session.flush()

    hd1 = HangDoiKham(
        benh_nhan_id=booking.bn_a.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=1,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc),
    )
    hd2 = HangDoiKham(
        benh_nhan_id=booking.bn_b.id,
        bac_si_id=booking.bs_x.id,
        ngay_kham=today,
        ca_kham=CaLamViecEnum.SANG.value,
        so_thu_tu_kham=2,
        trang_thai=TrangThaiHangDoiEnum.CHO_KHAM.value,
        thoi_gian_check_in=datetime.now(timezone.utc),
    )
    db_session.add_all([hd1, hd2])
    await db_session.flush()

    res_leave = await api_client.post(
        f"/api/v1/admin/shifts/{shift_x.id}/emergency-leave",
        json={"ly_do_nghi": "Bác sĩ tham gia hội chẩn cấp cứu liên viện"},
        headers=token_admin,
    )
    assert res_leave.status_code == 200
    assert res_leave.json()["data"]["so_ve_cho_kham"] == 2

    res_reassign = await api_client.post(
        f"/api/v1/admin/shifts/{shift_x.id}/reassign",
        json={"bac_si_thay_the_id": booking.bs_y.id},
        headers=token_admin,
    )
    assert res_reassign.status_code == 200
    reassign_data = res_reassign.json()["data"]
    assert reassign_data["so_ve_cho_kham_da_chuyen"] == 2
    assert reassign_data["bac_si_thay_the_id"] == booking.bs_y.id

    res_call_y = await api_client.post(
        "/api/v1/clinical/queue/call-next",
        headers=booking.tokens["bs_y"],
    )
    assert res_call_y.status_code == 200
    assert res_call_y.json()["data"]["ticket"]["bac_si_id"] == booking.bs_y.id


@pytest.mark.asyncio
async def test_flow_admin_compliance_and_audit_integrity_e2e(api_client, booking):
    token_admin = booking.tokens["admin"]
    token_bs = booking.tokens["bs_x"]
    token_bn = booking.tokens["bn_a"]

    res_boot = await api_client.get("/api/v1/admin/bootstrap", headers=token_admin)
    assert res_boot.status_code == 200
    boot_data = res_boot.json()["data"]
    assert boot_data["schemaVersion"] == "2.0.0-promax"
    assert boot_data["inventoryBatches"] == []

    res_log = await api_client.post(
        "/api/v1/compliance/audit/log",
        json={
            "patient_id": booking.bn_a.id,
            "action": HealthDataAccessAction.VIEW.value,
            "resource_type": HealthDataResourceType.ENCOUNTER.value,
            "resource_id": 999,
            "purpose": "KHAM_BENH",
        },
        headers=token_bs,
    )
    assert res_log.status_code == 201
    assert res_log.json()["data"]["is_immutable"] is True

    res_dash = await api_client.get("/api/v1/compliance/dashboard", headers=token_admin)
    assert res_dash.status_code == 200
    assert res_dash.json()["data"]["statutory_compliance_status"] in (
        "COMPLIANT",
        "ATTENTION_REQUIRED",
        "NON_COMPLIANT",
    )

    res_forbidden = await api_client.get("/api/v1/compliance/dashboard", headers=token_bn)
    assert res_forbidden.status_code == 403
