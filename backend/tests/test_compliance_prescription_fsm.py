from datetime import datetime, timezone
import hashlib
import json
import uuid
import pytest
from pydantic import BaseModel
from app.core.exceptions import ConflictException, ForbiddenException, BadRequestException, UnprocessableEntityException
from app.models.user import BacSi

class PrescriptionState:
    DRAFT = 'DRAFT'
    VALIDATED = 'VALIDATED'
    SIGNED = 'SIGNED'
    ISSUED = 'ISSUED'
    SUBMISSION_PENDING = 'SUBMISSION_PENDING'
    SUBMITTED = 'SUBMITTED'
    ACCEPTED = 'ACCEPTED'
    REJECTED = 'REJECTED'
    RETRY_PENDING = 'RETRY_PENDING'
    MANUAL_REVIEW = 'MANUAL_REVIEW'
    UNKNOWN_RESULT = 'UNKNOWN_RESULT'
    SUPERSEDED = 'SUPERSEDED'
VALID_TRANSITIONS = {PrescriptionState.DRAFT: {PrescriptionState.VALIDATED}, PrescriptionState.VALIDATED: {PrescriptionState.SIGNED, PrescriptionState.DRAFT}, PrescriptionState.SIGNED: {PrescriptionState.ISSUED, PrescriptionState.SUPERSEDED}, PrescriptionState.ISSUED: {PrescriptionState.SUBMISSION_PENDING, PrescriptionState.SUPERSEDED}, PrescriptionState.SUBMISSION_PENDING: {PrescriptionState.SUBMITTED}, PrescriptionState.SUBMITTED: {PrescriptionState.ACCEPTED, PrescriptionState.REJECTED, PrescriptionState.UNKNOWN_RESULT, PrescriptionState.RETRY_PENDING}, PrescriptionState.UNKNOWN_RESULT: {PrescriptionState.RETRY_PENDING, PrescriptionState.SUBMITTED, PrescriptionState.MANUAL_REVIEW}, PrescriptionState.RETRY_PENDING: {PrescriptionState.SUBMITTED, PrescriptionState.MANUAL_REVIEW}, PrescriptionState.REJECTED: {PrescriptionState.MANUAL_REVIEW, PrescriptionState.SUPERSEDED}, PrescriptionState.MANUAL_REVIEW: {PrescriptionState.SUBMISSION_PENDING, PrescriptionState.SUPERSEDED}, PrescriptionState.ACCEPTED: {PrescriptionState.SUPERSEDED}, PrescriptionState.SUPERSEDED: set()}

class GatewaySubmissionResult(BaseModel):
    status: str
    transaction_receipt: str | None = None
    code: int
    idempotency_key: str
    message: str

class ReferencePrescriptionFSM:

    @staticmethod
    def compute_prescription_hash(prescription_id: int, items: list[dict]) -> str:
        payload = f'{prescription_id}:' + json.dumps(sorted(items, key=lambda x: x.get('ten_thuoc', '')), sort_keys=True)
        return hashlib.sha256(payload.encode('utf-8')).hexdigest()

    @staticmethod
    def transition(current_status: str, next_status: str) -> str:
        allowed = VALID_TRANSITIONS.get(current_status, set())
        if next_status not in allowed:
            raise ConflictException(f"Chuyển trạng thái đơn thuốc không hợp lệ: '{current_status}' -> '{next_status}'. Các trạng thái được phép: {allowed or 'Không có (trạng thái kết thúc)'}")
        return next_status

    @staticmethod
    def assert_immutable(status: str):
        if status in (PrescriptionState.SIGNED, PrescriptionState.ISSUED, PrescriptionState.ACCEPTED, PrescriptionState.SUPERSEDED):
            raise ConflictException(f"Đơn thuốc đang ở trạng thái '{status}'. Nội dung thuốc và liều lượng đã ký là BẤT BIẾN, không được phép chỉnh sửa trực tiếp! Vui lòng sử dụng quy trình tạo đơn thay thế (SUPERSEDED).")

    @classmethod
    def sign_prescription(cls, prescription: dict, doctor_id: int, signature_data: str) -> dict:
        if prescription.get('trang_thai') != PrescriptionState.VALIDATED:
            raise ConflictException(f"Đơn thuốc phải ở trạng thái '{PrescriptionState.VALIDATED}' trước khi ký số! Trạng thái hiện tại: '{prescription.get('trang_thai')}'")
        prescription['trang_thai'] = cls.transition(prescription['trang_thai'], PrescriptionState.SIGNED)
        prescription['chu_ky_so'] = signature_data
        prescription['nguoi_ky_id'] = doctor_id
        prescription['thoi_gian_ky'] = datetime.now(timezone.utc)
        prescription['du_lieu_don_thuoc_hash'] = cls.compute_prescription_hash(prescription.get('id', 1), prescription.get('items', []))
        return prescription

    @classmethod
    def supersede(cls, old_prescription: dict, new_prescription_id: int, reason: str) -> tuple[dict, dict]:
        if not reason or len(reason.strip()) < 5:
            raise BadRequestException('Lý do thay thế đơn thuốc phải được nêu rõ ràng (tối thiểu 5 ký tự)!')
        if old_prescription.get('trang_thai') not in (PrescriptionState.SIGNED, PrescriptionState.ISSUED, PrescriptionState.ACCEPTED):
            raise ConflictException(f"Chỉ có thể thay thế đơn thuốc đã ký hoặc ban hành! Trạng thái hiện tại: {old_prescription.get('trang_thai')}")
        old_prescription['trang_thai'] = PrescriptionState.SUPERSEDED
        old_prescription['superseded_by_id'] = new_prescription_id
        old_prescription['ly_do_thay_the'] = reason
        new_prescription = {'id': new_prescription_id, 'thay_the_cho_don_id': old_prescription.get('id'), 'trang_thai': PrescriptionState.DRAFT, 'luot_kham_id': old_prescription.get('luot_kham_id'), 'items': []}
        return (old_prescription, new_prescription)

class MockNationalPrescriptionGateway:

    def __init__(self):
        self._cache = {}
        self.timeout_mode = False
        self.invalid_receipt_mode = False

    async def submit_prescription(self, prescription_id: int, facility_code: str, practitioner_code: str, idempotency_key: str) -> GatewaySubmissionResult:
        if not facility_code or not practitioner_code:
            raise UnprocessableEntityException('Mã cơ sở KCB và mã người hành nghề là bắt buộc khi liên thông Cổng quốc gia!')
        if not idempotency_key:
            raise BadRequestException('Idempotency-Key header là bắt buộc để chống gửi trùng lặp giao dịch!')
        if idempotency_key in self._cache:
            return self._cache[idempotency_key]
        if self.timeout_mode:
            res = GatewaySubmissionResult(status=PrescriptionState.UNKNOWN_RESULT, transaction_receipt=None, code=504, idempotency_key=idempotency_key, message='Cổng đơn thuốc quốc gia quá thời gian phản hồi (Gateway Timeout 504)')
            return res
        if self.invalid_receipt_mode:
            res = GatewaySubmissionResult(status=PrescriptionState.UNKNOWN_RESULT, transaction_receipt='INVALID_SIGNATURE_RECEIPT', code=200, idempotency_key=idempotency_key, message='HTTP 200 nhưng chữ ký biên nhận không hợp lệ')
            return res
        receipt_token = f'RECEIPT-BYT-{prescription_id}-{uuid.uuid4().hex[:12].upper()}'
        result = GatewaySubmissionResult(status=PrescriptionState.ACCEPTED, transaction_receipt=receipt_token, code=200, idempotency_key=idempotency_key, message='Cổng đơn thuốc quốc gia đã tiếp nhận và xác thực đơn thuốc thành công')
        self._cache[idempotency_key] = result
        return result

@pytest.mark.asyncio
async def test_fsm_full_happy_path_lifecycle():
    fsm = ReferencePrescriptionFSM
    gateway = MockNationalPrescriptionGateway()
    current = PrescriptionState.DRAFT
    current = fsm.transition(current, PrescriptionState.VALIDATED)
    assert current == PrescriptionState.VALIDATED
    rx = {'id': 101, 'trang_thai': current, 'items': [{'ten_thuoc': 'Aspirin', 'so_luong': 10}]}
    rx = fsm.sign_prescription(rx, doctor_id=1, signature_data='SIG_RSA_DOC_1_VALID')
    assert rx['trang_thai'] == PrescriptionState.SIGNED
    assert rx['chu_ky_so'] == 'SIG_RSA_DOC_1_VALID'
    assert rx['du_lieu_don_thuoc_hash'] is not None
    current = fsm.transition(rx['trang_thai'], PrescriptionState.ISSUED)
    assert current == PrescriptionState.ISSUED
    current = fsm.transition(current, PrescriptionState.SUBMISSION_PENDING)
    assert current == PrescriptionState.SUBMISSION_PENDING
    current = fsm.transition(current, PrescriptionState.SUBMITTED)
    assert current == PrescriptionState.SUBMITTED
    sub_res = await gateway.submit_prescription(prescription_id=101, facility_code='CS-79-0123', practitioner_code='BS-CCHN-0987', idempotency_key='IDEMP-KEY-TEST-001')
    assert sub_res.status == PrescriptionState.ACCEPTED
    assert sub_res.transaction_receipt.startswith('RECEIPT-BYT-101-')
    current = fsm.transition(current, sub_res.status)
    assert current == PrescriptionState.ACCEPTED

@pytest.mark.asyncio
async def test_fsm_signing_locks_prescription_items():
    fsm = ReferencePrescriptionFSM
    fsm.assert_immutable(PrescriptionState.DRAFT)
    fsm.assert_immutable(PrescriptionState.VALIDATED)
    with pytest.raises(ConflictException) as exc:
        fsm.assert_immutable(PrescriptionState.SIGNED)
    assert 'BẤT BIẾN' in str(exc.value.message)
    with pytest.raises(ConflictException) as exc_iss:
        fsm.assert_immutable(PrescriptionState.ISSUED)
    assert 'BẤT BIẾN' in str(exc_iss.value.message)

@pytest.mark.asyncio
async def test_fsm_superseding_protocol_creates_replacement_link():
    fsm = ReferencePrescriptionFSM
    old_rx = {'id': 201, 'trang_thai': PrescriptionState.SIGNED, 'luot_kham_id': 50, 'items': [{'ten_thuoc': 'Amoxicillin', 'so_luong': 20}]}
    old_res, new_res = fsm.supersede(old_rx, new_prescription_id=202, reason='Bệnh nhân có tiền sử dị ứng Penicillin, thay bằng Macrolide')
    assert old_res['trang_thai'] == PrescriptionState.SUPERSEDED
    assert old_res['superseded_by_id'] == 202
    assert 'dị ứng Penicillin' in old_res['ly_do_thay_the']
    assert new_res['id'] == 202
    assert new_res['thay_the_cho_don_id'] == 201
    assert new_res['trang_thai'] == PrescriptionState.DRAFT
    assert new_res['luot_kham_id'] == 50

@pytest.mark.asyncio
async def test_gateway_retry_with_idempotency_key_returns_identical_receipt():
    gateway = MockNationalPrescriptionGateway()
    key = 'IDEMP-RETRY-UNIQUE-KEY-001'
    res1 = await gateway.submit_prescription(301, 'CS-01', 'BS-01', key)
    assert res1.status == PrescriptionState.ACCEPTED
    receipt1 = res1.transaction_receipt
    res2 = await gateway.submit_prescription(301, 'CS-01', 'BS-01', key)
    assert res2.status == PrescriptionState.ACCEPTED
    assert res2.transaction_receipt == receipt1

@pytest.mark.asyncio
async def test_gateway_timeout_transitions_to_unknown_result():
    gateway = MockNationalPrescriptionGateway()
    gateway.timeout_mode = True
    res = await gateway.submit_prescription(401, 'CS-01', 'BS-01', 'IDEMP-TIMEOUT-001')
    assert res.code == 504
    assert res.status == PrescriptionState.UNKNOWN_RESULT
    assert res.transaction_receipt is None

@pytest.mark.parametrize('invalid_from, invalid_to', [(PrescriptionState.DRAFT, PrescriptionState.ACCEPTED), (PrescriptionState.DRAFT, PrescriptionState.SIGNED), (PrescriptionState.ACCEPTED, PrescriptionState.DRAFT), (PrescriptionState.ACCEPTED, PrescriptionState.VALIDATED), (PrescriptionState.SUPERSEDED, PrescriptionState.ACCEPTED), (PrescriptionState.SUPERSEDED, PrescriptionState.DRAFT)])
def test_fsm_rejects_illegal_state_transitions(invalid_from, invalid_to):
    with pytest.raises(ConflictException) as exc:
        ReferencePrescriptionFSM.transition(invalid_from, invalid_to)
    assert 'không hợp lệ' in str(exc.value.message)

@pytest.mark.asyncio
async def test_fsm_signing_fails_if_not_validated():
    rx = {'id': 501, 'trang_thai': PrescriptionState.DRAFT, 'items': []}
    with pytest.raises(ConflictException) as exc:
        ReferencePrescriptionFSM.sign_prescription(rx, doctor_id=2, signature_data='SIG_INVALID')
    assert 'VALIDATED' in str(exc.value.message)

@pytest.mark.asyncio
async def test_fsm_supersede_requires_valid_reason():
    old_rx = {'id': 601, 'trang_thai': PrescriptionState.SIGNED, 'luot_kham_id': 1}
    with pytest.raises(BadRequestException):
        ReferencePrescriptionFSM.supersede(old_rx, 602, reason='')
    with pytest.raises(BadRequestException):
        ReferencePrescriptionFSM.supersede(old_rx, 602, reason='   ')
    with pytest.raises(BadRequestException):
        ReferencePrescriptionFSM.supersede(old_rx, 602, reason='ngắn')

@pytest.mark.asyncio
async def test_gateway_requires_idempotency_key_and_codes():
    gateway = MockNationalPrescriptionGateway()
    with pytest.raises(UnprocessableEntityException):
        await gateway.submit_prescription(701, '', 'BS-01', 'KEY-1')
    with pytest.raises(UnprocessableEntityException):
        await gateway.submit_prescription(701, 'CS-01', '', 'KEY-1')
    with pytest.raises(BadRequestException):
        await gateway.submit_prescription(701, 'CS-01', 'BS-01', '')

@pytest.mark.asyncio
async def test_gateway_rejects_accepted_status_without_valid_receipt():
    gateway = MockNationalPrescriptionGateway()
    gateway.invalid_receipt_mode = True
    res = await gateway.submit_prescription(801, 'CS-01', 'BS-01', 'KEY-INVALID-RECEIPT')
    assert res.code == 200
    assert res.status == PrescriptionState.UNKNOWN_RESULT

@pytest.mark.asyncio
async def test_cross_feature_expired_doctor_cannot_sign_prescription():
    from app.models.compliance import TrangThaiGiayPhep
    from app.services.credential_service import credential_service
    expired_doctor = BacSi(id=99, trang_thai_giay_phep=TrangThaiGiayPhep.EXPIRED.value, is_active=False)

    class MockDB:

        async def execute(self, stmt):

            class ScalarMock:

                def scalar_one_or_none(self):
                    return expired_doctor
            return ScalarMock()
    with pytest.raises(ForbiddenException) as exc:
        await credential_service.check_doctor_license_valid(MockDB(), 99)
    assert 'HẾT HẠN' in str(exc.value.message)

@pytest.mark.asyncio
async def test_cross_feature_locked_encounter_rejects_new_draft_prescription(api_client, booking, db_session):
    token_bs = booking.tokens['bs_x']
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)
    res_start = await api_client.post('/api/v1/clinical/encounters', json={'lich_kham_id': lich.id, 'ly_do_vao_kham': 'Tăng huyết áp'}, headers=token_bs)
    assert res_start.status_code == 201
    enc_id = res_start.json()['data']['id']
    from tests.test_clinical_skeleton import _dam_bao_ma_icd10
    await _dam_bao_ma_icd10(db_session, 'I10', 'Bệnh tăng huyết áp vô căn')
    res_diag = await api_client.post(f'/api/v1/clinical/encounters/{enc_id}/diagnoses', json={'ma_icd10': 'I10', 'ten_benh_chan_doan': 'Bệnh tăng huyết áp vô căn', 'loai_chan_doan': 'chinh'}, headers=token_bs)
    assert res_diag.status_code == 201
    res_comp = await api_client.post(f'/api/v1/clinical/encounters/{enc_id}/complete', json={'ket_luan_dieu_tri': 'Khám xong', 'loi_dan_bac_si': 'Nghỉ ngơi'}, headers=token_bs)
    assert res_comp.status_code == 200
    res_rx = await api_client.post(f'/api/v1/clinical/encounters/{enc_id}/prescriptions', json={'danh_sach_thuoc': [{'ten_thuoc': 'Amlodipine', 'ham_luong': '5mg', 'don_vi_tinh': 'Viên', 'so_luong': 10, 'cach_dung': 'Sáng 1 viên', 'so_ngay_dung': 10}]}, headers=token_bs)
    assert res_rx.status_code == 409
    assert 'bị khóa' in res_rx.json()['message']

@pytest.mark.asyncio
async def test_cross_feature_superseded_prescription_cannot_be_submitted_to_gateway():
    with pytest.raises(ConflictException) as exc:
        ReferencePrescriptionFSM.transition(PrescriptionState.SUPERSEDED, PrescriptionState.SUBMISSION_PENDING)
    assert 'không hợp lệ' in str(exc.value.message)

@pytest.mark.asyncio
async def test_real_world_scenario_gateway_timeout_and_idempotent_recovery():
    fsm = ReferencePrescriptionFSM
    gateway = MockNationalPrescriptionGateway()
    rx = {'id': 901, 'trang_thai': PrescriptionState.DRAFT, 'items': [{'ten_thuoc': 'Metformin', 'ham_luong': '500mg', 'so_luong': 60, 'cach_dung': 'Sáng 1, Tối 1 sau ăn'}]}
    rx['trang_thai'] = fsm.transition(rx['trang_thai'], PrescriptionState.VALIDATED)
    rx = fsm.sign_prescription(rx, doctor_id=1, signature_data='SIGNATURE_TOKEN_DOC_1')
    rx['trang_thai'] = fsm.transition(rx['trang_thai'], PrescriptionState.ISSUED)
    assert rx['trang_thai'] == PrescriptionState.ISSUED
    rx['trang_thai'] = fsm.transition(rx['trang_thai'], PrescriptionState.SUBMISSION_PENDING)
    rx['trang_thai'] = fsm.transition(rx['trang_thai'], PrescriptionState.SUBMITTED)
    idempotency_key = f"IDEMP-SESSION-{rx['id']}-{uuid.uuid4().hex[:8]}"
    gateway.timeout_mode = True
    sub_res_timeout = await gateway.submit_prescription(rx['id'], 'CS-79-001', 'BS-001', idempotency_key)
    assert sub_res_timeout.code == 504
    rx['trang_thai'] = fsm.transition(rx['trang_thai'], sub_res_timeout.status)
    assert rx['trang_thai'] == PrescriptionState.UNKNOWN_RESULT
    gateway.timeout_mode = False
    rx['trang_thai'] = fsm.transition(rx['trang_thai'], PrescriptionState.SUBMITTED)
    sub_res_success = await gateway.submit_prescription(rx['id'], 'CS-79-001', 'BS-001', idempotency_key)
    assert sub_res_success.code == 200
    assert sub_res_success.status == PrescriptionState.ACCEPTED
    assert sub_res_success.transaction_receipt is not None
    rx['trang_thai'] = fsm.transition(rx['trang_thai'], sub_res_success.status)
    rx['transaction_receipt'] = sub_res_success.transaction_receipt
    assert rx['trang_thai'] == PrescriptionState.ACCEPTED
    assert rx['transaction_receipt'].startswith(f"RECEIPT-BYT-{rx['id']}-")

@pytest.mark.asyncio
async def test_real_world_scenario_post_sign_modification_triggers_superseding():
    fsm = ReferencePrescriptionFSM
    original_rx = {'id': 999, 'trang_thai': PrescriptionState.VALIDATED, 'luot_kham_id': 88, 'items': [{'ten_thuoc': 'Augmentin', 'ham_luong': '625mg', 'so_luong': 14}]}
    original_rx = fsm.sign_prescription(original_rx, doctor_id=1, signature_data='SIG_001')
    assert original_rx['trang_thai'] == PrescriptionState.SIGNED
    with pytest.raises(ConflictException) as exc:
        fsm.assert_immutable(original_rx['trang_thai'])
    assert 'BẤT BIẾN' in str(exc.value.message)
    old_rx, replacement_rx = fsm.supersede(original_rx, new_prescription_id=1000, reason='Điều chỉnh liều giảm từ 625mg xuống 500mg do chức năng thận suy giảm')
    assert old_rx['trang_thai'] == PrescriptionState.SUPERSEDED
    assert old_rx['superseded_by_id'] == 1000
    assert replacement_rx['id'] == 1000
    assert replacement_rx['thay_the_cho_don_id'] == 999
    assert replacement_rx['trang_thai'] == PrescriptionState.DRAFT
    replacement_rx['items'] = [{'ten_thuoc': 'Augmentin', 'ham_luong': '500mg', 'so_luong': 14}]
    replacement_rx['trang_thai'] = fsm.transition(replacement_rx['trang_thai'], PrescriptionState.VALIDATED)
    replacement_rx = fsm.sign_prescription(replacement_rx, doctor_id=1, signature_data='SIG_002')
    assert replacement_rx['trang_thai'] == PrescriptionState.SIGNED
    assert replacement_rx['du_lieu_don_thuoc_hash'] is not None

@pytest.mark.asyncio
async def test_api_fsm_full_lifecycle_and_immutability(api_client, booking, db_session):
    from app.services.national_gateway_service import national_gateway_service
    national_gateway_service.timeout_mode = False
    national_gateway_service.invalid_receipt_mode = False
    token_bs = booking.tokens['bs_x']
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)
    res_start = await api_client.post('/api/v1/clinical/encounters', json={'lich_kham_id': lich.id, 'ly_do_vao_kham': 'Đau đầu dữ dội'}, headers=token_bs)
    assert res_start.status_code == 201
    enc_id = res_start.json()['data']['id']
    res_rx = await api_client.post(f'/api/v1/clinical/encounters/{enc_id}/prescriptions', json={'danh_sach_thuoc': [{'ten_thuoc': 'Paracetamol', 'ham_luong': '500mg', 'don_vi_tinh': 'Viên', 'so_luong': 10, 'cach_dung': 'Khi sốt uống 1 viên', 'so_ngay_dung': 3}], 'loi_dan_uong_thuoc': 'Uống sau ăn'}, headers=token_bs)
    assert res_rx.status_code == 201
    rx_id = res_rx.json()['data']['id']
    assert res_rx.json()['data']['trang_thai'] == 'DRAFT'
    res_val = await api_client.post(f'/api/v1/clinical/prescriptions/{rx_id}/validate', headers=token_bs)
    assert res_val.status_code == 200
    assert res_val.json()['data']['trang_thai'] == 'VALIDATED'
    res_sign = await api_client.post(f'/api/v1/clinical/prescriptions/{rx_id}/sign', json={'chu_ky_so': 'TOKEN_PKI_CA_DOC_1_XYZ'}, headers=token_bs)
    assert res_sign.status_code == 200
    assert res_sign.json()['data']['trang_thai'] == 'SIGNED'
    assert res_sign.json()['data']['chu_ky_so'] == 'TOKEN_PKI_CA_DOC_1_XYZ'
    assert res_sign.json()['data']['du_lieu_don_thuoc_hash'] is not None
    res_put_blocked = await api_client.put(f'/api/v1/clinical/prescriptions/{rx_id}', json={'danh_sach_thuoc': [{'ten_thuoc': 'Paracetamol', 'ham_luong': '1000mg', 'don_vi_tinh': 'Viên', 'so_luong': 20, 'cach_dung': 'Sáng 2 viên', 'so_ngay_dung': 5}]}, headers=token_bs)
    assert res_put_blocked.status_code == 409
    assert 'BẤT BIẾN' in res_put_blocked.json()['message']
    res_issue = await api_client.post(f'/api/v1/clinical/prescriptions/{rx_id}/issue', headers=token_bs)
    assert res_issue.status_code == 200
    assert res_issue.json()['data']['trang_thai'] == 'ISSUED'
    idemp_key = f'IDEMP-LIVE-TEST-{rx_id}-{uuid.uuid4().hex[:6]}'
    res_submit = await api_client.post(f'/api/v1/clinical/prescriptions/{rx_id}/submit-gateway', headers={**token_bs, 'Idempotency-Key': idemp_key})
    assert res_submit.status_code == 200
    sub_data = res_submit.json()['data']
    assert sub_data['status'] == 'ACCEPTED'
    assert sub_data['code'] == 200
    assert sub_data['transaction_receipt'].startswith(f'RECEIPT-BYT-{rx_id}-')
    res_resubmit = await api_client.post(f'/api/v1/clinical/prescriptions/{rx_id}/submit-gateway', headers={**token_bs, 'Idempotency-Key': idemp_key})
    assert res_resubmit.status_code == 200
    assert res_resubmit.json()['data']['transaction_receipt'] == sub_data['transaction_receipt']
    res_detail = await api_client.get(f'/api/v1/clinical/prescriptions/{rx_id}', headers=token_bs)
    assert res_detail.status_code == 200
    assert res_detail.json()['data']['trang_thai'] == 'ACCEPTED'
    assert res_detail.json()['data']['bien_nhan_giao_dich'] == sub_data['transaction_receipt']

@pytest.mark.asyncio
async def test_api_fsm_supersede_and_replacement_workflow(api_client, booking, db_session):
    token_bs = booking.tokens['bs_x']
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)
    res_start = await api_client.post('/api/v1/clinical/encounters', json={'lich_kham_id': lich.id, 'ly_do_vao_kham': 'Viêm phế quản'}, headers=token_bs)
    enc_id = res_start.json()['data']['id']
    res_rx = await api_client.post(f'/api/v1/clinical/encounters/{enc_id}/prescriptions', json={'danh_sach_thuoc': [{'ten_thuoc': 'Amoxicillin', 'ham_luong': '500mg', 'don_vi_tinh': 'Viên', 'so_luong': 14, 'cach_dung': 'Sáng 1, Tối 1', 'so_ngay_dung': 7}]}, headers=token_bs)
    orig_rx_id = res_rx.json()['data']['id']
    await api_client.post(f'/api/v1/clinical/prescriptions/{orig_rx_id}/validate', headers=token_bs)
    await api_client.post(f'/api/v1/clinical/prescriptions/{orig_rx_id}/sign', json={'chu_ky_so': 'SIG_VALID_1'}, headers=token_bs)
    res_super = await api_client.post(f'/api/v1/clinical/prescriptions/{orig_rx_id}/supersede', json={'ly_do': 'Bệnh nhân có phản ứng mẩn ngứa, đổi sang nhóm Macrolide', 'danh_sach_thuoc': [{'ten_thuoc': 'Azithromycin', 'ham_luong': '500mg', 'don_vi_tinh': 'Viên', 'so_luong': 3, 'cach_dung': 'Ngày 1 viên', 'so_ngay_dung': 3}], 'loi_dan_uong_thuoc': 'Uống 1 giờ trước bữa ăn'}, headers=token_bs)
    assert res_super.status_code == 200
    super_data = res_super.json()['data']
    assert super_data['old_prescription']['id'] == orig_rx_id
    assert super_data['old_prescription']['trang_thai'] == 'SUPERSEDED'
    new_rx_id = super_data['new_prescription']['id']
    assert super_data['old_prescription']['superseded_by_id'] == new_rx_id
    assert super_data['new_prescription']['thay_the_cho_don_id'] == orig_rx_id
    assert super_data['new_prescription']['trang_thai'] == 'DRAFT'
    assert len(super_data['new_prescription']['danh_sach_chi_tiet']) == 1
    assert super_data['new_prescription']['danh_sach_chi_tiet'][0]['ten_thuoc'] == 'Azithromycin'
    res_val_new = await api_client.post(f'/api/v1/clinical/prescriptions/{new_rx_id}/validate', headers=token_bs)
    assert res_val_new.status_code == 200
    res_sign_new = await api_client.post(f'/api/v1/clinical/prescriptions/{new_rx_id}/sign', json={'chu_ky_so': 'SIG_NEW_REPLACEMENT_2'}, headers=token_bs)
    assert res_sign_new.status_code == 200
    assert res_sign_new.json()['data']['trang_thai'] == 'SIGNED'

@pytest.mark.asyncio
async def test_api_gateway_timeout_and_retry_recovery(api_client, booking, db_session):
    from app.services.national_gateway_service import national_gateway_service
    token_bs = booking.tokens['bs_x']
    now = datetime.now(timezone.utc)
    lich = await booking.tao_lich(booking.bn_a, booking.bs_x, now)
    res_start = await api_client.post('/api/v1/clinical/encounters', json={'lich_kham_id': lich.id, 'ly_do_vao_kham': 'Đau dạ dày'}, headers=token_bs)
    enc_id = res_start.json()['data']['id']
    res_rx = await api_client.post(f'/api/v1/clinical/encounters/{enc_id}/prescriptions', json={'danh_sach_thuoc': [{'ten_thuoc': 'Esomeprazole', 'ham_luong': '40mg', 'don_vi_tinh': 'Viên', 'so_luong': 14, 'cach_dung': 'Sáng 1 viên trước ăn', 'so_ngay_dung': 14}]}, headers=token_bs)
    rx_id = res_rx.json()['data']['id']
    await api_client.post(f'/api/v1/clinical/prescriptions/{rx_id}/validate', headers=token_bs)
    await api_client.post(f'/api/v1/clinical/prescriptions/{rx_id}/sign', json={'chu_ky_so': 'SIG_DOC'}, headers=token_bs)
    await api_client.post(f'/api/v1/clinical/prescriptions/{rx_id}/issue', headers=token_bs)
    national_gateway_service.timeout_mode = True
    res_to = await api_client.post(f'/api/v1/clinical/prescriptions/{rx_id}/submit-gateway', headers={**token_bs, 'Idempotency-Key': f'KEY-TO-{rx_id}'})
    assert res_to.status_code == 200
    assert res_to.json()['data']['status'] == 'UNKNOWN_RESULT'
    assert res_to.json()['data']['code'] == 504
    res_chk = await api_client.get(f'/api/v1/clinical/prescriptions/{rx_id}', headers=token_bs)
    assert res_chk.json()['data']['trang_thai'] == 'UNKNOWN_RESULT'
    national_gateway_service.timeout_mode = False
    res_retry = await api_client.post(f'/api/v1/clinical/prescriptions/{rx_id}/retry-gateway', headers=token_bs)
    assert res_retry.status_code == 200
    assert res_retry.json()['data']['status'] == 'ACCEPTED'
    assert res_retry.json()['data']['code'] == 200
    assert res_retry.json()['data']['transaction_receipt'] is not None
    res_fin = await api_client.get(f'/api/v1/clinical/prescriptions/{rx_id}', headers=token_bs)
    assert res_fin.json()['data']['trang_thai'] == 'ACCEPTED'
    assert res_fin.json()['data']['bien_nhan_giao_dich'] is not None
