import pytest
from datetime import datetime, timezone

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    UnprocessableEntityException,
)
from app.schemas.compliance import TrangThaiDonThuoc
from app.services.national_gateway_service import NationalGatewayService, national_gateway_service
from app.services.prescription_fsm_service import (
    PrescriptionFSMService,
    VALID_TRANSITIONS,
)
from tests.test_compliance_prescription_fsm import (
    MockNationalPrescriptionGateway,
)


# ==============================================================================
# CHALLENGER M2 ADVERSARIAL STRESS SUITE (INT-04 / R3)
# ==============================================================================

# ------------------------------------------------------------------------------
# INVARIANT 1: SUBMISSION WITHOUT VALID FACILITY OR PRACTITIONER CODE (422)
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_challenger_inv1_submit_prescription_rejects_missing_facility_code():
    """Invariant 1: Direct gateway submission with empty or None facility_code must raise 422 UnprocessableEntity."""
    gw = NationalGatewayService()

    # Empty string facility_code
    with pytest.raises(UnprocessableEntityException) as exc_info:
        await gw.submit_prescription(
            prescription_id=101,
            facility_code="",
            practitioner_code="BS-12345",
            idempotency_key="KEY-INV1-01",
        )
    assert exc_info.value.code == 422
    assert "Mã cơ sở KCB" in str(exc_info.value.message)

    # None facility_code
    with pytest.raises(UnprocessableEntityException) as exc_info2:
        await gw.submit_prescription(
            prescription_id=101,
            facility_code=None,  # type: ignore
            practitioner_code="BS-12345",
            idempotency_key="KEY-INV1-02",
        )
    assert exc_info2.value.code == 422


@pytest.mark.asyncio
async def test_challenger_inv1_submit_prescription_rejects_missing_practitioner_code():
    """Invariant 1: Direct gateway submission with empty or None practitioner_code must raise 422 UnprocessableEntity."""
    gw = NationalGatewayService()

    # Empty string practitioner_code
    with pytest.raises(UnprocessableEntityException) as exc_info:
        await gw.submit_prescription(
            prescription_id=102,
            facility_code="CS-79-999",
            practitioner_code="",
            idempotency_key="KEY-INV1-03",
        )
    assert exc_info.value.code == 422
    assert "mã người hành nghề" in str(exc_info.value.message)

    # None practitioner_code
    with pytest.raises(UnprocessableEntityException) as exc_info2:
        await gw.submit_prescription(
            prescription_id=102,
            facility_code="CS-79-999",
            practitioner_code=None,  # type: ignore
            idempotency_key="KEY-INV1-04",
        )
    assert exc_info2.value.code == 422


@pytest.mark.asyncio
async def test_challenger_inv1_submit_prescription_rejects_both_missing_codes():
    """Invariant 1: Missing both facility and practitioner code must be rejected with 422."""
    gw = NationalGatewayService()
    with pytest.raises(UnprocessableEntityException) as exc_info:
        await gw.submit_prescription(
            prescription_id=103,
            facility_code="",
            practitioner_code="",
            idempotency_key="KEY-INV1-05",
        )
    assert exc_info.value.code == 422


@pytest.mark.asyncio
async def test_challenger_inv1_mock_gateway_rejects_empty_codes():
    """Invariant 1: MockNationalPrescriptionGateway in test infra must also reject empty codes with 422."""
    mock_gw = MockNationalPrescriptionGateway()

    with pytest.raises(UnprocessableEntityException):
        await mock_gw.submit_prescription(1, "", "BS-01", "K1")

    with pytest.raises(UnprocessableEntityException):
        await mock_gw.submit_prescription(1, "CS-01", "", "K1")


@pytest.mark.asyncio
async def test_challenger_inv1_direct_submit_prescription_empty_values_oracle():
    """Invariant 1: Comprehensive matrix of missing/invalid code inputs to submit_prescription."""
    gw = NationalGatewayService()
    test_cases = [
        ("", "BS-01"),
        (None, "BS-01"),
        ("CS-01", ""),
        ("CS-01", None),
        ("", ""),
        (None, None),
    ]
    for fac, pract in test_cases:
        with pytest.raises(UnprocessableEntityException) as exc:
            await gw.submit_prescription(999, fac, pract, "KEY-ORACLE")  # type: ignore
        assert exc.value.code == 422



# ------------------------------------------------------------------------------
# INVARIANT 2: GATEWAY TIMEOUT TRANSITIONS TO UNKNOWN_RESULT / RETRY_PENDING (504, NEVER ACCEPTED)
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_challenger_inv2_gateway_timeout_never_reaches_accepted():
    """Invariant 2: On timeout, GatewaySubmissionResult status is UNKNOWN_RESULT, code 504, receipt is None, never ACCEPTED."""
    gw = NationalGatewayService()
    gw.timeout_mode = True

    result = await gw.submit_prescription(
        prescription_id=201,
        facility_code="CS-79-01",
        practitioner_code="BS-01",
        idempotency_key="KEY-TIMEOUT-STRESS-01",
    )

    assert result.code == 504
    assert result.status == TrangThaiDonThuoc.UNKNOWN_RESULT.value
    assert result.status != TrangThaiDonThuoc.ACCEPTED.value
    assert result.transaction_receipt is None
    assert "Timeout" in result.message or "504" in result.message


def test_challenger_inv2_fsm_rejects_unknown_result_to_accepted_transition():
    """Invariant 2: FSM must strictly forbid transitioning directly from UNKNOWN_RESULT or RETRY_PENDING to ACCEPTED."""
    # Direct UNKNOWN_RESULT -> ACCEPTED must raise ConflictException
    with pytest.raises(ConflictException) as exc1:
        PrescriptionFSMService.transition(
            TrangThaiDonThuoc.UNKNOWN_RESULT.value,
            TrangThaiDonThuoc.ACCEPTED.value,
        )
    assert "không hợp lệ" in str(exc1.value.message)

    # Direct RETRY_PENDING -> ACCEPTED must raise ConflictException
    with pytest.raises(ConflictException) as exc2:
        PrescriptionFSMService.transition(
            TrangThaiDonThuoc.RETRY_PENDING.value,
            TrangThaiDonThuoc.ACCEPTED.value,
        )
    assert "không hợp lệ" in str(exc2.value.message)


@pytest.mark.asyncio
async def test_challenger_inv2_api_timeout_leaves_db_status_unknown_result(api_client, booking, db_session):
    """Invariant 2: Full API lifecycle - timeout sets DB state to UNKNOWN_RESULT, HTTP 504 code reported in data, receipt is None."""
    national_gateway_service.timeout_mode = True
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    # Create encounter and prescription
    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Sốt virus"},
        headers=token_bs,
    )
    assert res_start.status_code == 201
    enc_id = res_start.json()["data"]["id"]

    res_rx = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/prescriptions",
        json={
            "danh_sach_thuoc": [
                {"ten_thuoc": "Paracetamol", "ham_luong": "500mg", "don_vi_tinh": "Viên", "so_luong": 10, "cach_dung": "Khi sốt uống 1 viên", "so_ngay_dung": 3}
            ]
        },
        headers=token_bs,
    )
    rx_id = res_rx.json()["data"]["id"]

    # Validate, Sign, Issue
    await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/validate", headers=token_bs)
    await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/sign", json={"chu_ky_so": "SIG_VALID"}, headers=token_bs)
    await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/issue", headers=token_bs)

    # Submit under timeout
    to_key = f"IDEMP-TIMEOUT-TEST-{rx_id}"
    res_sub = await api_client.post(
        f"/api/v1/clinical/prescriptions/{rx_id}/submit-gateway",
        headers={**token_bs, "Idempotency-Key": to_key},
    )
    assert res_sub.status_code == 200
    data = res_sub.json()["data"]
    assert data["status"] == "UNKNOWN_RESULT"
    assert data["code"] == 504
    assert data["transaction_receipt"] is None

    # Verify DB state directly via GET endpoint
    res_get = await api_client.get(f"/api/v1/clinical/prescriptions/{rx_id}", headers=token_bs)
    rx_db = res_get.json()["data"]
    assert rx_db["trang_thai"] == "UNKNOWN_RESULT"
    assert rx_db.get("bien_nhan_giao_dich") is None

    # Clean up timeout mode
    national_gateway_service.timeout_mode = False


# ------------------------------------------------------------------------------
# INVARIANT 3: IDEMPOTENCY KEY ENFORCEMENT & DUPLICATE PREVENTION
# ------------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_challenger_inv3_submit_prescription_requires_idempotency_key():
    """Invariant 3: Direct submit_prescription without idempotency_key must raise BadRequestException (400)."""
    gw = NationalGatewayService()

    with pytest.raises(BadRequestException) as exc1:
        await gw.submit_prescription(301, "CS-01", "BS-01", "")
    assert exc1.value.code == 400

    with pytest.raises(BadRequestException) as exc2:
        await gw.submit_prescription(301, "CS-01", "BS-01", None)  # type: ignore
    assert exc2.value.code == 400


@pytest.mark.asyncio
async def test_challenger_inv3_repeated_submissions_with_same_key_return_identical_receipt():
    """Invariant 3: 10 successive submissions with identical Idempotency-Key return identical receipt."""
    gw = NationalGatewayService()
    key = "IDEMP-RETRY-STRESS-KEY-999"

    first_result = await gw.submit_prescription(302, "CS-01", "BS-01", key)
    assert first_result.status == TrangThaiDonThuoc.ACCEPTED.value
    assert first_result.transaction_receipt is not None
    original_receipt = first_result.transaction_receipt

    # 10 successive retries with the same key
    for i in range(10):
        retry_result = await gw.submit_prescription(302, "CS-01", "BS-01", key)
        assert retry_result.status == TrangThaiDonThuoc.ACCEPTED.value
        assert retry_result.transaction_receipt == original_receipt
        assert retry_result.idempotency_key == key


@pytest.mark.asyncio
async def test_challenger_inv3_retry_gateway_rejects_already_accepted_prescription(api_client, booking, db_session):
    """Invariant 3: Calling /retry-gateway on an already ACCEPTED prescription must raise 409 Conflict."""
    national_gateway_service.timeout_mode = False
    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Đau mắt đỏ"},
        headers=token_bs,
    )
    enc_id = res_start.json()["data"]["id"]

    res_rx = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/prescriptions",
        json={
            "danh_sach_thuoc": [
                {"ten_thuoc": "Tobramycin", "ham_luong": "0.3%", "don_vi_tinh": "Lọ", "so_luong": 1, "cach_dung": "Nhỏ mắt ngày 3 lần", "so_ngay_dung": 7}
            ]
        },
        headers=token_bs,
    )
    rx_id = res_rx.json()["data"]["id"]

    await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/validate", headers=token_bs)
    await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/sign", json={"chu_ky_so": "SIG_EYE"}, headers=token_bs)
    await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/issue", headers=token_bs)

    # First submit -> ACCEPTED
    key = f"IDEMP-ALREADY-ACCEPTED-{rx_id}"
    res_sub = await api_client.post(
        f"/api/v1/clinical/prescriptions/{rx_id}/submit-gateway",
        headers={**token_bs, "Idempotency-Key": key},
    )
    assert res_sub.status_code == 200
    assert res_sub.json()["data"]["status"] == "ACCEPTED"

    # Attempt to call /retry-gateway on an already ACCEPTED prescription -> 409 Conflict
    res_retry_bad = await api_client.post(
        f"/api/v1/clinical/prescriptions/{rx_id}/retry-gateway",
        headers={**token_bs, "Idempotency-Key": key},
    )
    assert res_retry_bad.status_code == 409
    assert "Chỉ có thể retry" in res_retry_bad.json()["message"]


# ------------------------------------------------------------------------------
# INVARIANT 4: INVALID TRANSACTION RECEIPTS MUST NEVER TRANSITION TO ACCEPTED
# ------------------------------------------------------------------------------

def test_challenger_inv4_validate_receipt_adversarial_oracle():
    """Invariant 4: Comprehensive test oracle for receipt validation rejecting all malformed tokens."""
    gw = NationalGatewayService()
    rx_id = 404

    # Valid receipt
    valid_receipt = f"RECEIPT-BYT-{rx_id}-A1B2C3D4E5F6"
    assert gw.validate_receipt(valid_receipt, rx_id) is True

    # Malformed receipts that MUST return False:
    assert gw.validate_receipt(None, rx_id) is False
    assert gw.validate_receipt("", rx_id) is False
    assert gw.validate_receipt("   ", rx_id) is False
    assert gw.validate_receipt("INVALID_SIGNATURE_RECEIPT", rx_id) is False
    assert gw.validate_receipt(f"RECEIPT-BYT-{rx_id+1}-A1B2C3D4E5F6", rx_id) is False  # Wrong Rx ID
    assert gw.validate_receipt(f"RECEIPT-BYT-{rx_id}-SHORT", rx_id) is False  # Less than prefix + 8
    assert gw.validate_receipt("FAKE-BYT-404-A1B2C3D4E5F6", rx_id) is False  # Wrong prefix
    assert gw.validate_receipt(f"RECEIPT-BYT-{rx_id}", rx_id) is False  # Prefix without suffix
    assert gw.validate_receipt("HTTP 200 OK", rx_id) is False  # Plain HTTP status


@pytest.mark.asyncio
async def test_challenger_inv4_invalid_receipt_mode_prevents_accepted_transition():
    """Invariant 4: When invalid_receipt_mode is enabled, submit_prescription returns UNKNOWN_RESULT, not ACCEPTED."""
    gw = NationalGatewayService()
    gw.invalid_receipt_mode = True

    result = await gw.submit_prescription(
        prescription_id=405,
        facility_code="CS-79-01",
        practitioner_code="BS-01",
        idempotency_key="KEY-INVALID-RECEIPT-STRESS",
    )

    assert result.status == TrangThaiDonThuoc.UNKNOWN_RESULT.value
    assert result.status != TrangThaiDonThuoc.ACCEPTED.value
    assert result.transaction_receipt == "INVALID_SIGNATURE_RECEIPT"


@pytest.mark.asyncio
async def test_challenger_inv4_api_invalid_receipt_downgrades_to_unknown_result(api_client, booking, db_session):
    """Invariant 4: Full API test - Gateway returning HTTP 200 with invalid receipt must downgrade DB state to UNKNOWN_RESULT."""
    national_gateway_service.timeout_mode = False
    national_gateway_service.invalid_receipt_mode = True

    token_bs = booking.tokens["bs_x"]
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)

    res_start = await api_client.post(
        "/api/v1/clinical/encounters",
        json={"lich_kham_id": lich.id, "ly_do_vao_kham": "Viêm xoang cấp"},
        headers=token_bs,
    )
    enc_id = res_start.json()["data"]["id"]

    res_rx = await api_client.post(
        f"/api/v1/clinical/encounters/{enc_id}/prescriptions",
        json={
            "danh_sach_thuoc": [
                {"ten_thuoc": "Cefuroxime", "ham_luong": "500mg", "don_vi_tinh": "Viên", "so_luong": 14, "cach_dung": "Sáng 1, Tối 1 sau ăn", "so_ngay_dung": 7}
            ]
        },
        headers=token_bs,
    )
    rx_id = res_rx.json()["data"]["id"]

    await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/validate", headers=token_bs)
    await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/sign", json={"chu_ky_so": "SIG_SINUS"}, headers=token_bs)
    await api_client.post(f"/api/v1/clinical/prescriptions/{rx_id}/issue", headers=token_bs)

    # Submit with invalid_receipt_mode = True
    key = f"IDEMP-INVALID-RCPT-{rx_id}"
    res_sub = await api_client.post(
        f"/api/v1/clinical/prescriptions/{rx_id}/submit-gateway",
        headers={**token_bs, "Idempotency-Key": key},
    )
    assert res_sub.status_code == 200
    data = res_sub.json()["data"]
    # Must NOT be ACCEPTED!
    assert data["status"] == "UNKNOWN_RESULT"

    # Verify DB state directly via GET endpoint
    res_get = await api_client.get(f"/api/v1/clinical/prescriptions/{rx_id}", headers=token_bs)
    rx_db = res_get.json()["data"]
    assert rx_db["trang_thai"] == "UNKNOWN_RESULT"
    assert rx_db.get("bien_nhan_giao_dich") is None

    # Clean up
    national_gateway_service.invalid_receipt_mode = False


# ------------------------------------------------------------------------------
# FSM STATE MACHINE INVARIANTS & ADVERSARIAL BOUNDARY CHECKS
# ------------------------------------------------------------------------------

@pytest.mark.parametrize("invalid_state", [
    TrangThaiDonThuoc.DRAFT.value,
    TrangThaiDonThuoc.VALIDATED.value,
    TrangThaiDonThuoc.SIGNED.value,
    TrangThaiDonThuoc.SUPERSEDED.value,
])
def test_challenger_fsm_illegal_pre_gateway_states(invalid_state):
    """Stress test: Unissued states cannot transition directly to SUBMITTED or ACCEPTED."""
    with pytest.raises(ConflictException):
        PrescriptionFSMService.transition(invalid_state, TrangThaiDonThuoc.SUBMITTED.value)

    with pytest.raises(ConflictException):
        PrescriptionFSMService.transition(invalid_state, TrangThaiDonThuoc.ACCEPTED.value)


def test_challenger_accepted_state_is_immutable_and_only_exit_is_superseded():
    """Stress test: ACCEPTED state can only transition to SUPERSEDED, nowhere else."""
    allowed = VALID_TRANSITIONS.get(TrangThaiDonThuoc.ACCEPTED.value, set())
    assert allowed == {TrangThaiDonThuoc.SUPERSEDED.value}

    # Cannot transition to DRAFT
    with pytest.raises(ConflictException):
        PrescriptionFSMService.transition(TrangThaiDonThuoc.ACCEPTED.value, TrangThaiDonThuoc.DRAFT.value)

    # Cannot transition to SUBMITTED
    with pytest.raises(ConflictException):
        PrescriptionFSMService.transition(TrangThaiDonThuoc.ACCEPTED.value, TrangThaiDonThuoc.SUBMITTED.value)

    # Can transition to SUPERSEDED
    assert (
        PrescriptionFSMService.transition(
            TrangThaiDonThuoc.ACCEPTED.value, TrangThaiDonThuoc.SUPERSEDED.value
        )
        == TrangThaiDonThuoc.SUPERSEDED.value
    )


def test_challenger_superseded_is_strictly_terminal():
    """Stress test: SUPERSEDED is a terminal state with zero outgoing transitions."""
    allowed = VALID_TRANSITIONS.get(TrangThaiDonThuoc.SUPERSEDED.value, set())
    assert len(allowed) == 0

    for target_state in TrangThaiDonThuoc:
        with pytest.raises(ConflictException):
            PrescriptionFSMService.transition(TrangThaiDonThuoc.SUPERSEDED.value, target_state.value)
