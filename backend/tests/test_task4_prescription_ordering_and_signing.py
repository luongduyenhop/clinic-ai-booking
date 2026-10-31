import pytest
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.medical import DonThuoc, ChiTietDonThuoc, LuotKham
from app.schemas.compliance import TrangThaiDonThuoc


@pytest.mark.asyncio
async def test_task4_prescribe_drugs_with_dosage_slots_and_sync(api_client, booking, db_session):
    """
    Task 4 AC1 & AC2: Kê đơn thuốc từ danh mục với đầy đủ liều dùng buổi (Sáng/Trưa/Chiều/Tối),
    số ngày dùng và đồng bộ bền vững vào PostgreSQL qua workspace-state.
    """
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    # 1. Khởi tạo ca khám
    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Kê đơn viêm họng cấp"},
        headers=token_bs,
    )
    assert res_enc.status_code == 201
    enc_id = res_enc.json()["data"]["id"]

    # 2. Kê đơn thuốc gồm 2 loại thuốc với liều dùng từng buổi
    workspace_payload = {
        "encounters": {
            str(enc_id): {
                "id": enc_id,
                "so_ngay_dung": 7,
                "loi_dan_uong_thuoc": "Uống sau ăn no, kiêng đồ uống có cồn",
                "trang_thai_don_thuoc": "DRAFT",
                "danh_sach_thuoc": [
                    {
                        "ten_thuoc": "Amoxicillin + Clavulanic Acid 1000mg",
                        "hoat_chat": "Amoxicillin + Clavulanic Acid",
                        "ham_luong": "1000mg",
                        "don_vi_tinh": "Viên",
                        "sang": "1",
                        "trua": "0",
                        "chieu": "1",
                        "toi": "0",
                        "so_ngay_dung": 7,
                        "cach_dung": "Uống sáng 1 viên, chiều 1 viên sau ăn no",
                    },
                    {
                        "ten_thuoc": "Paracetamol 500mg",
                        "hoat_chat": "Paracetamol",
                        "ham_luong": "500mg",
                        "don_vi_tinh": "Viên",
                        "sang": "1",
                        "trua": "1",
                        "chieu": "1",
                        "toi": "1",
                        "so_ngay_dung": 5,
                        "cach_dung": "Uống 1 viên khi sốt trên 38.5 độ C",
                    },
                ],
            }
        }
    }

    # 3. Gửi đồng bộ qua API workspace-state
    res_sync = await api_client.put(
        "/api/v1/clinical/workspace-state",
        json=workspace_payload,
        headers=token_bs,
    )
    assert res_sync.status_code == 200

    # 4. Kiểm tra dữ liệu được nạp chính xác vào PostgreSQL
    stmt = (
        select(DonThuoc)
        .options(selectinload(DonThuoc.danh_sach_chi_tiet))
        .where(DonThuoc.luot_kham_id == enc_id)
        .order_by(DonThuoc.id.desc())
    )
    rx = (await db_session.execute(stmt)).scalars().first()
    assert rx is not None
    assert rx.trang_thai == TrangThaiDonThuoc.DRAFT.value
    assert rx.so_ngay_dung == 7
    assert "Uống sau ăn no" in rx.loi_dan_uong_thuoc

    # Kiểm tra chi tiết liều dùng từng buổi
    items = rx.danh_sach_chi_tiet
    assert len(items) == 2

    amox = next((it for it in items if "Amoxicillin" in it.ten_thuoc), None)
    assert amox is not None
    assert amox.lieu_sang == "1"
    assert amox.lieu_trua == "0"
    assert amox.lieu_chieu == "1"
    assert amox.lieu_toi == "0"
    assert amox.so_luong == 14  # (1 + 1) * 7 = 14 viên
    assert amox.don_vi_tinh == "Viên"

    para = next((it for it in items if "Paracetamol" in it.ten_thuoc), None)
    assert para is not None
    assert para.lieu_sang == "1"
    assert para.lieu_trua == "1"
    assert para.lieu_chieu == "1"
    assert para.lieu_toi == "1"
    assert para.so_luong == 20  # (1 + 1 + 1 + 1) * 5 = 20 viên


@pytest.mark.asyncio
async def test_task4_signing_prescription_locks_immutability_and_generates_hash(api_client, booking, db_session):
    """
    Task 4 AC1: Ký số đơn thuốc điện tử chuyển FSM sang SIGNED, sinh mã hash SHA-256
    và bảo vệ tính bất biến (Immutability Guard - cấm sửa/xóa thuốc trực tiếp).
    """
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Ký số đơn thuốc"},
        headers=token_bs,
    )
    enc_id = res_enc.json()["data"]["id"]

    # 1. Ký số đơn thuốc điện tử
    sig_data = f"SHA256:TEST_SIG:{enc_id}:{int(now.timestamp())}"
    sign_payload = {
        "encounters": {
            str(enc_id): {
                "id": enc_id,
                "so_ngay_dung": 5,
                "trang_thai_don_thuoc": TrangThaiDonThuoc.SIGNED.value,
                "chu_ky_so": sig_data,
                "loi_dan_uong_thuoc": "Uống đúng liều đã ký",
                "danh_sach_thuoc": [
                    {
                        "ten_thuoc": "Augmentin 1g",
                        "hoat_chat": "Amoxicillin + Clavulanate",
                        "ham_luong": "1000mg",
                        "don_vi_tinh": "Viên",
                        "sang": "1",
                        "trua": "0",
                        "chieu": "1",
                        "toi": "0",
                        "so_ngay_dung": 5,
                        "cach_dung": "Uống sau ăn",
                    }
                ],
            }
        }
    }

    res_sign = await api_client.put(
        "/api/v1/clinical/workspace-state",
        json=sign_payload,
        headers=token_bs,
    )
    assert res_sign.status_code == 200

    # 2. Xác thực trạng thái SIGNED và mã băm SHA-256
    stmt = (
        select(DonThuoc)
        .options(selectinload(DonThuoc.danh_sach_chi_tiet))
        .where(DonThuoc.luot_kham_id == enc_id)
        .order_by(DonThuoc.id.desc())
    )
    rx = (await db_session.execute(stmt)).scalars().first()
    assert rx is not None
    assert rx.trang_thai == TrangThaiDonThuoc.SIGNED.value
    assert rx.chu_ky_so == sig_data
    assert rx.ngay_ky is not None
    assert rx.du_lieu_don_thuoc_hash is not None
    assert len(rx.du_lieu_don_thuoc_hash) == 64  # SHA-256 hex string
    signed_hash = rx.du_lieu_don_thuoc_hash

    # 3. Kịch bản gian lận / sửa đổi: Cố tình ghi đè thuốc trên đơn đã SIGNED
    tamper_payload = {
        "encounters": {
            str(enc_id): {
                "id": enc_id,
                "trang_thai_don_thuoc": "DRAFT",
                "danh_sach_thuoc": [
                    {
                        "ten_thuoc": "Thuốc bị sửa trái phép 500mg",
                        "so_luong": 99,
                        "sang": "10",
                    }
                ],
            }
        }
    }
    res_tamper = await api_client.put(
        "/api/v1/clinical/workspace-state",
        json=tamper_payload,
        headers=token_bs,
    )
    assert res_tamper.status_code == 200

    # 4. Kiểm tra tính bất biến: CSDL không bị thay đổi, danh sách thuốc và hash được bảo vệ
    stmt_after = (
        select(DonThuoc)
        .options(selectinload(DonThuoc.danh_sach_chi_tiet))
        .where(DonThuoc.id == rx.id)
    )
    rx_after = (await db_session.execute(stmt_after)).scalars().first()
    assert rx_after.trang_thai == TrangThaiDonThuoc.SIGNED.value
    assert rx_after.du_lieu_don_thuoc_hash == signed_hash
    assert len(rx_after.danh_sach_chi_tiet) == 1
    assert rx_after.danh_sach_chi_tiet[0].ten_thuoc == "Augmentin 1g"
    assert rx_after.danh_sach_chi_tiet[0].so_luong == 10


@pytest.mark.asyncio
async def test_task4_api_prescription_details_for_printing_a4_a5(api_client, booking):
    """
    Task 4 AC2: API truy xuất thông tin đơn thuốc điện tử trả về đầy đủ chi tiết liều dùng
    từng buổi, chữ ký số và mã phục vụ in phiếu A4/A5 và QR Code.
    """
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_enc = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Kê đơn in ấn"},
        headers=token_bs,
    )
    enc_id = res_enc.json()["data"]["id"]

    # Kê đơn và ký số
    sig_code = f"SHA256:QR_SIG:{enc_id}"
    workspace_payload = {
        "encounters": {
            str(enc_id): {
                "id": enc_id,
                "so_ngay_dung": 5,
                "trang_thai_don_thuoc": TrangThaiDonThuoc.SIGNED.value,
                "chu_ky_so": sig_code,
                "loi_dan_uong_thuoc": "Uống sau ăn 30 phút",
                "danh_sach_thuoc": [
                    {
                        "ten_thuoc": "Cefuroxime 500mg",
                        "hoat_chat": "Cefuroxime Axetil",
                        "ham_luong": "500mg",
                        "don_vi_tinh": "Viên",
                        "sang": "1",
                        "trua": "0",
                        "chieu": "1",
                        "toi": "0",
                        "so_ngay_dung": 5,
                        "cach_dung": "Uống sáng 1 viên, chiều 1 viên",
                    }
                ],
            }
        }
    }
    await api_client.put(
        "/api/v1/clinical/workspace-state",
        json=workspace_payload,
        headers=token_bs,
    )

    # Gọi API lấy chi tiết đơn thuốc cho lượt khám
    res_get = await api_client.get(
        f"/api/v1/clinical/encounters/{enc_id}/prescriptions",
        headers=token_bs,
    )
    assert res_get.status_code == 200
    rx_data = res_get.json()["data"]

    # Verify các trường cần thiết cho bản in A4/A5 và QR
    assert rx_data["trang_thai"] == TrangThaiDonThuoc.SIGNED.value
    assert rx_data["chu_ky_so"] == sig_code
    assert rx_data["du_lieu_don_thuoc_hash"] is not None
    assert rx_data["so_ngay_dung"] == 5
    assert rx_data["loi_dan_uong_thuoc"] == "Uống sau ăn 30 phút"

    # Chi tiết từng loại thuốc
    assert len(rx_data["danh_sach_chi_tiet"]) == 1
    drug_item = rx_data["danh_sach_chi_tiet"][0]
    assert drug_item["ten_thuoc"] == "Cefuroxime 500mg"
    assert drug_item["lieu_sang"] == "1"
    assert drug_item["lieu_trua"] == "0"
    assert drug_item["lieu_chieu"] == "1"
    assert drug_item["lieu_toi"] == "0"
    assert drug_item["so_luong"] == 10
    assert drug_item["don_vi_tinh"] == "Viên"
