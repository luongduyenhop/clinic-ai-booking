from datetime import datetime, timezone
import pytest
from app.schemas.compliance import TrangThaiDonThuoc
from app.services.national_gateway_service import national_gateway_service
from app.services.prescription_fsm_service import prescription_fsm_service, VALID_TRANSITIONS
from app.core.exceptions import ConflictException


# ==============================================================================
# EMPIRICAL CHALLENGE 1: EXHAUSTIVE TRANSITION MATRIX TEST (ORACLE)
# ==============================================================================

def test_exhaustive_fsm_transition_matrix():
    """Tất cả 122 cặp chuyển trạng thái không nằm trong ma trận FSM bắt buộc phải ném ConflictException(409)."""
    all_states = [e.value for e in TrangThaiDonThuoc]
    
    for s1 in all_states:
        allowed = VALID_TRANSITIONS.get(s1, set())
        for s2 in all_states:
            if s2 in allowed:
                res = prescription_fsm_service.transition(s1, s2)
                assert res == s2
            else:
                with pytest.raises(ConflictException) as exc:
                    prescription_fsm_service.transition(s1, s2)
                assert "không hợp lệ" in exc.value.message


# ==============================================================================
# EMPIRICAL CHALLENGE 2: API LEVEL INVALID TRANSITION REJECTIONS (HTTP 409)
# ==============================================================================

@pytest.mark.asyncio
async def test_api_blocks_illegal_transitions_with_409(api_client, booking, db_session):
    """
    Xác minh các bước nhảy cóc hoặc thoái lui qua API trả về HTTP 409 Conflict:
    1. DRAFT -> SUBMIT_GATEWAY: 409
    2. DRAFT -> SIGN: 409 (chưa validate)
    3. ISSUED -> VALIDATE: 409 (thoái lui)
    4. SUPERSEDED -> SIGN: 409
    5. SUPERSEDED -> SUBMIT_GATEWAY: 409
    """
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    # Khởi tạo ca khám
    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Test FSM Chặn nhảy cóc"},
        headers=token_bs,
    )
    assert res_start.status_code == 201
    enc_id = res_start.json()["data"]["id"]

    # Tạo đơn thuốc DRAFT
    res_rx = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/prescriptions",
        json={
            "danh_sach_thuoc": [
                {"ten_thuoc": "Paracetamol", "ham_luong": "500mg", "don_vi_tinh": "Viên", "so_luong": 10, "cach_dung": "Uống khi sốt"}
            ]
        },
        headers=token_bs,
    )
    assert res_rx.status_code == 201
    rx_id = res_rx.json()["data"]["id"]
    assert res_rx.json()["data"]["trang_thai"] == "DRAFT"

    # Chặn 1: DRAFT -> SUBMIT_GATEWAY -> 409 Conflict
    res_sub_draft = await api_client.post(
        f"/api/v1/clinical/prescriptions/{rx_id}/submit-gateway",
        headers={**token_bs, "Idempotency-Key": f"KEY-DRAFT-{rx_id}"},
    )
    assert res_sub_draft.status_code == 409, f"Expected 409 for DRAFT submit, got {res_sub_draft.status_code}"

    # Chặn 2: DRAFT -> SIGN -> 409 Conflict (chưa validate)
    res_sign_draft = await api_client.post(
        f"/api/v1/clinical/prescriptions/{rx_id}/sign",
        json={"chu_ky_so": "SIG_PREMATURE"},
        headers=token_bs,
    )
    assert res_sign_draft.status_code == 409, f"Expected 409 for DRAFT sign, got {res_sign_draft.status_code}"

    # Hợp lệ: Validate & Sign & Issue
    res_val = await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/validate", headers=token_bs)
    assert res_val.status_code == 200
    res_sign = await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/sign", json={"chu_ky_so": "SIG_VALID"}, headers=token_bs)
    assert res_sign.status_code == 200
    res_issue = await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/issue", headers=token_bs)
    assert res_issue.status_code == 200

    # Chặn 3: ISSUED -> VALIDATE -> 409 Conflict (thoái lui)
    res_val_issued = await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/validate", headers=token_bs)
    assert res_val_issued.status_code == 409, f"Expected 409 for ISSUED validate, got {res_val_issued.status_code}"

    # Chuyển đơn sang SUPERSEDED
    res_super = await api_client.post(
        f"/api/v1/clinical/prescriptions/{rx_id}/supersede",
        json={"ly_do": "Đổi thuốc do tương tác thuốc cần thiết"},
        headers=token_bs,
    )
    assert res_super.status_code == 200

    # Chặn 4: SUPERSEDED -> SIGN -> 409 Conflict
    res_sign_sup = await api_client.post(
        f"/api/v1/clinical/prescriptions/{rx_id}/sign",
        json={"chu_ky_so": "SIG_ON_SUPERSEDED"},
        headers=token_bs,
    )
    assert res_sign_sup.status_code == 409, f"Expected 409 for SUPERSEDED sign, got {res_sign_sup.status_code}"

    # Chặn 5: SUPERSEDED -> SUBMIT_GATEWAY -> 409 Conflict
    res_sub_sup = await api_client.post(
        f"/api/v1/clinical/prescriptions/{rx_id}/submit-gateway",
        headers={**token_bs, "Idempotency-Key": f"KEY-SUP-{rx_id}"},
    )
    assert res_sub_sup.status_code == 409, f"Expected 409 for SUPERSEDED submit, got {res_sub_sup.status_code}"

    # Chặn 6: SUPERSEDED -> RETRY_GATEWAY -> 409 Conflict
    res_retry_sup = await api_client.post(
        f"/api/v1/clinical/prescriptions/{rx_id}/retry-gateway",
        headers=token_bs,
    )
    assert res_retry_sup.status_code == 409, f"Expected 409 for SUPERSEDED retry, got {res_retry_sup.status_code}"

    # Chặn 7: SUPERSEDED -> SUPERSEDE -> 409 Conflict (đơn đã hủy không thể supersede lần 2)
    res_super_sup = await api_client.post(
        f"/api/v1/clinical/prescriptions/{rx_id}/supersede",
        json={"ly_do": "Thử supersede đơn đã supersede"},
        headers=token_bs,
    )
    assert res_super_sup.status_code == 409, f"Expected 409 for supersede on SUPERSEDED, got {res_super_sup.status_code}"


# ==============================================================================
# EMPIRICAL CHALLENGE 3: IMMUTABILITY ON SIGNED, ISSUED, ACCEPTED, SUPERSEDED
# ==============================================================================

@pytest.mark.asyncio
async def test_api_immutability_blocked_on_signed_issued_accepted_superseded(api_client, booking, db_session):
    """
    Xác minh mọi hành vi PUT chỉnh sửa chi tiết thuốc hoặc lời dặn trên:
    - SIGNED: Bị từ chối 409 Conflict
    - ISSUED: Bị từ chối 409 Conflict
    - ACCEPTED: Bị từ chối 409 Conflict
    - SUPERSEDED: Bị từ chối 409 Conflict
    """
    national_gateway_service.timeout_mode = False
    national_gateway_service.invalid_receipt_mode = False

    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Test Bất biến"},
        headers=token_bs,
    )
    enc_id = res_start.json()["data"]["id"]

    res_rx = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/prescriptions",
        json={
            "danh_sach_thuoc": [
                {"ten_thuoc": "Amoxicillin", "ham_luong": "500mg", "don_vi_tinh": "Viên", "so_luong": 10, "cach_dung": "Uống"}
            ]
        },
        headers=token_bs,
    )
    rx_id = res_rx.json()["data"]["id"]

    # 1. Tại DRAFT: Cho phép PUT
    res_put_draft = await api_client.put(
        f"/api/v1/clinical/prescriptions/{rx_id}",
        json={"loi_dan_uong_thuoc": "Uống sau ăn no"},
        headers=token_bs,
    )
    assert res_put_draft.status_code == 200

    # Chuyển sang VALIDATED
    await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/validate", headers=token_bs)

    # 2. Chuyển sang SIGNED
    await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/sign", json={"chu_ky_so": "SIG_IMMUTABLE_1"}, headers=token_bs)

    # Thử PUT khi SIGNED -> 409
    res_put_signed = await api_client.put(
        f"/api/v1/clinical/prescriptions/{rx_id}",
        json={
            "danh_sach_thuoc": [
                {"ten_thuoc": "Tampered", "ham_luong": "1000mg", "don_vi_tinh": "Viên", "so_luong": 99, "cach_dung": "Sáng 2 viên", "so_ngay_dung": 5}
            ]
        },
        headers=token_bs,
    )
    assert res_put_signed.status_code == 409
    assert "BẤT BIẾN" in res_put_signed.json()["message"]

    # 3. Chuyển sang ISSUED
    await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/issue", headers=token_bs)

    # Thử PUT khi ISSUED -> 409
    res_put_issued = await api_client.put(
        f"/api/v1/clinical/prescriptions/{rx_id}",
        json={"loi_dan_uong_thuoc": "Sửa lén khi đã phát hành"},
        headers=token_bs,
    )
    assert res_put_issued.status_code == 409
    assert "BẤT BIẾN" in res_put_issued.json()["message"]

    # 4. Gửi cổng thành công -> ACCEPTED
    res_sub = await api_client.post(
        f"/api/v1/clinical/prescriptions/{rx_id}/submit-gateway",
        headers={**token_bs, "Idempotency-Key": f"KEY-ACC-{rx_id}"},
    )
    assert res_sub.status_code == 200
    assert res_sub.json()["data"]["status"] == "ACCEPTED"

    # Thử PUT khi ACCEPTED -> 409
    res_put_accepted = await api_client.put(
        f"/api/v1/clinical/prescriptions/{rx_id}",
        json={"loi_dan_uong_thuoc": "Sửa lén khi cổng đã duyệt"},
        headers=token_bs,
    )
    assert res_put_accepted.status_code == 409
    assert "BẤT BIẾN" in res_put_accepted.json()["message"]

    # 5. Thay thế đơn -> SUPERSEDED
    res_sup = await api_client.post(
        f"/api/v1/clinical/prescriptions/{rx_id}/supersede",
        json={"ly_do": "Thay thế đơn cũ đã liên thông cổng"},
        headers=token_bs,
    )
    assert res_sup.status_code == 200

    # Thử PUT khi SUPERSEDED -> 409
    res_put_sup = await api_client.put(
        f"/api/v1/clinical/prescriptions/{rx_id}",
        json={"loi_dan_uong_thuoc": "Sửa lén đơn đã hủy"},
        headers=token_bs,
    )
    assert res_put_sup.status_code == 409
    assert "BẤT BIẾN" in res_put_sup.json()["message"]


@pytest.mark.xfail(
    reason="COMPLIANCE DEFECT: assert_immutable uses incomplete blacklist (SIGNED, ISSUED, ACCEPTED, SUPERSEDED). Post-signing states UNKNOWN_RESULT, RETRY_PENDING, REJECTED, MANUAL_REVIEW allow direct PUT drug modifications (returns 200 instead of 409).",
    strict=True
)
@pytest.mark.asyncio
async def test_challenge_probe_immutability_on_post_signing_states(api_client, booking, db_session):
    """
    Adversarial Challenge Probe:
    Kiểm tra xem khi đơn thuốc ở trạng thái REJECTED hoặc MANUAL_REVIEW hoặc UNKNOWN_RESULT,
    PUT /clinical/prescriptions/{id} có bị chặn 409 hay không.
    Theo quy tắc: Đơn đã ký thì BẤT BIẾN tuyệt đối, chỉ có thể tạo đơn mới thay thế (SUPERSEDED).
    """
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Test Post-Signing States Immutability"},
        headers=token_bs,
    )
    enc_id = res_start.json()["data"]["id"]

    res_rx = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/prescriptions",
        json={
            "danh_sach_thuoc": [
                {"ten_thuoc": "Amoxicillin", "ham_luong": "500mg", "don_vi_tinh": "Viên", "so_luong": 10, "cach_dung": "Uống", "so_ngay_dung": 5}
            ]
        },
        headers=token_bs,
    )
    rx_id = res_rx.json()["data"]["id"]

    # Validate -> Sign -> Issue
    await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/validate", headers=token_bs)
    await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/sign", json={"chu_ky_so": "SIG_VALID"}, headers=token_bs)
    await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/issue", headers=token_bs)

    # Đưa đơn vào trạng thái UNKNOWN_RESULT thông qua timeout gateway
    national_gateway_service.timeout_mode = True
    res_to = await api_client.post(
        f"/api/v1/clinical/prescriptions/{rx_id}/submit-gateway",
        headers={**token_bs, "Idempotency-Key": f"KEY-TO-PROBE-{rx_id}"},
    )
    assert res_to.status_code == 200
    assert res_to.json()["data"]["status"] == "UNKNOWN_RESULT"

    # Thử PUT khi UNKNOWN_RESULT
    res_put_unknown = await api_client.put(
        f"/api/v1/clinical/prescriptions/{rx_id}",
        json={
            "danh_sach_thuoc": [
                {"ten_thuoc": "TamperedUnknown", "ham_luong": "1000mg", "don_vi_tinh": "Viên", "so_luong": 99, "cach_dung": "Uống", "so_ngay_dung": 1}
            ]
        },
        headers=token_bs,
    )

    print("\n[PROBE RESULT] PUT status for UNKNOWN_RESULT:", res_put_unknown.status_code)
    # Theo chuẩn bất biến sau ký, đây phải là 409
    assert res_put_unknown.status_code == 409, f"Vulnerability detected! Expected 409, got {res_put_unknown.status_code}"



# ==============================================================================
# EMPIRICAL CHALLENGE 4: SUPERSEDING INTEGRITY & GATEWAY SUBMISSION REJECTION
# ==============================================================================

@pytest.mark.asyncio
async def test_api_superseding_bidirectional_link_and_gateway_lockout(api_client, booking, db_session):
    """
    Xác minh toàn vẹn quy trình Supersede:
    1. Đơn cũ được cập nhật trạng thái SUPERSEDED, có superseded_by_id trỏ sang đơn mới.
    2. Đơn mới được tạo ở trạng thái DRAFT, có thay_the_cho_don_id trỏ sang đơn cũ.
    3. Đơn cũ tuyệt đối không thể gửi lên Cổng quốc gia (chặn 409 Conflict).
    4. Đơn mới có thể được ký và gửi lên Cổng bình thường.
    """
    national_gateway_service.timeout_mode = False
    national_gateway_service.invalid_receipt_mode = False

    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Test Supersede Link & Lockout"},
        headers=token_bs,
    )
    enc_id = res_start.json()["data"]["id"]

    res_rx = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/prescriptions",
        json={
            "danh_sach_thuoc": [
                {"ten_thuoc": "Ciprofloxacin", "ham_luong": "500mg", "don_vi_tinh": "Viên", "so_luong": 10, "cach_dung": "Uống sáng 1 tối 1"}
            ]
        },
        headers=token_bs,
    )
    old_rx_id = res_rx.json()["data"]["id"]

    await api_client.post(f"/api/v1/clinical/prescriptions/{old_rx_id}/validate", headers=token_bs)
    await api_client.post(f"/api/v1/clinical/prescriptions/{old_rx_id}/sign", json={"chu_ky_so": "SIG_OLD"}, headers=token_bs)

    # Thực hiện supersede
    res_sup = await api_client.post(
        f"/api/v1/clinical/prescriptions/{old_rx_id}/supersede",
        json={
            "ly_do": "Phát hiện chống chỉ định Ciprofloxacin, đổi sang Ceftriaxone",
            "danh_sach_thuoc": [
                {"ten_thuoc": "Ceftriaxone", "ham_luong": "1g", "don_vi_tinh": "Lọ", "so_luong": 5, "cach_dung": "Tiêm bắp"}
            ]
        },
        headers=token_bs,
    )
    assert res_sup.status_code == 200
    sup_data = res_sup.json()["data"]
    new_rx_id = sup_data["new_prescription"]["id"]

    # Kiểm tra liên kết 2 chiều
    assert sup_data["old_prescription"]["id"] == old_rx_id
    assert sup_data["old_prescription"]["trang_thai"] == "SUPERSEDED"
    assert sup_data["old_prescription"]["superseded_by_id"] == new_rx_id

    assert sup_data["new_prescription"]["id"] == new_rx_id
    assert sup_data["new_prescription"]["trang_thai"] == "DRAFT"
    assert sup_data["new_prescription"]["thay_the_cho_don_id"] == old_rx_id

    # Đơn cũ: Thử submit gateway -> 409
    res_old_submit = await api_client.post(
        f"/api/v1/clinical/prescriptions/{old_rx_id}/submit-gateway",
        headers={**token_bs, "Idempotency-Key": f"KEY-OLD-SUPER-{old_rx_id}"},
    )
    assert res_old_submit.status_code == 409
    assert "SUPERSEDED" in res_old_submit.json()["message"]

    # Đơn mới: Validate -> Sign -> Issue -> Submit Gateway -> 200 ACCEPTED
    res_val_new = await api_client.post(f"/api/v1/clinical/prescriptions/{new_rx_id}/validate", headers=token_bs)
    assert res_val_new.status_code == 200

    res_sign_new = await api_client.post(
        f"/api/v1/clinical/prescriptions/{new_rx_id}/sign",
        json={"chu_ky_so": "SIG_NEW_OK"},
        headers=token_bs,
    )
    assert res_sign_new.status_code == 200

    res_issue_new = await api_client.post(f"/api/v1/clinical/prescriptions/{new_rx_id}/issue", headers=token_bs)
    assert res_issue_new.status_code == 200

    res_submit_new = await api_client.post(
        f"/api/v1/clinical/prescriptions/{new_rx_id}/submit-gateway",
        headers={**token_bs, "Idempotency-Key": f"KEY-NEW-OK-{new_rx_id}"},
    )
    assert res_submit_new.status_code == 200
    assert res_submit_new.json()["data"]["status"] == "ACCEPTED"
