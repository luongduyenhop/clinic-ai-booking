import logging
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.medical import (
    LuotKham,
    DonThuoc,
    BienBanDinhChinh,
    KhaiNiem,
    ChiDinh,
)
from app.models.appointment import HangDoiKham
from app.models.user import TaiKhoan, BacSi
from app.models.specialty_exam import (
    KhamNoiKhoa,
    KhamNgoaiKhoa,
    KhamMat,
    KhamTaiMuiHong,
    KhamRangHamMat,
)
from app.schemas.clinical import (
    EncounterCreateRequest,
    EncounterCompleteRequest,
    EncounterResponse,
    DiagnosisCreateRequest,
    DiagnosisResponse,
    OrderCreateRequest,
    OrderResponse,
    OrderResultUpdateRequest,
    PrescriptionCreateRequest,
    PrescriptionResponse,
    AmendmentCreateRequest,
    AmendmentResponse,
    AmendmentApproveRequest,
    Icd10SearchItem,
    VitalsCreateRequest,
    VitalsResponse,
    SealAndSignResponse,
    AllergyCheckResponse,
)
from app.schemas.subclinical import PhysicalExamRequest, PhysicalExamResponse
from app.schemas.ai import AiFeedbackRequest, AiFeedbackResponse

from app.services.clinical_modules import (
    clinical_workspace_service,
    clinical_encounter_service,
    clinical_order_service,
    clinical_prescription_service,
    clinical_exam_service,
    clinical_amendment_service,
    clinical_catalog_service,
)

logger = logging.getLogger(__name__)


class ClinicalService:
    _SPECIALTY_MODEL_MAP = {
        "noi": KhamNoiKhoa,
        "noi-khoa": KhamNoiKhoa,
        "ngoai": KhamNgoaiKhoa,
        "ngoai-khoa": KhamNgoaiKhoa,
        "mat": KhamMat,
        "tmh": KhamTaiMuiHong,
        "tai-mui-hong": KhamTaiMuiHong,
        "rhm": KhamRangHamMat,
        "rang-ham-mat": KhamRangHamMat,
    }

    async def _get_doctor_from_user(self, user: TaiKhoan, db: AsyncSession) -> BacSi:
        return await clinical_encounter_service._get_doctor_from_user(self, user, db)

    async def enrich_workspace_ai(self, payload: dict, db: AsyncSession) -> dict:
        return await clinical_encounter_service.enrich_workspace_ai(self, payload, db)

    def _build_hang_doi_query(self, today, doc_id):
        return clinical_workspace_service._build_hang_doi_query(today, doc_id)

    async def get_or_sync_workspace_state(
        self,
        db: AsyncSession,
        current_user: Optional[TaiKhoan] = None,
        doctor_id: Optional[int] = None,
    ) -> dict:
        return await clinical_workspace_service.get_or_sync_workspace_state(
            self, db, current_user, doctor_id
        )

    def _is_order_done(self, order):
        return clinical_workspace_service._is_order_done(order)

    def _resolve_specialty_slug(self, ma_chuyen_khoa: Optional[str], ten_chuyen_khoa: Optional[str]) -> Optional[str]:
        return clinical_workspace_service._resolve_specialty_slug(ma_chuyen_khoa, ten_chuyen_khoa)

    def _reconstruct_specialty_exam(self, encounter: LuotKham, dept_slug: str, active_orders: list) -> dict:
        return clinical_workspace_service._reconstruct_specialty_exam(self, encounter, dept_slug, active_orders)

    async def _resolve_and_heal_ticket_encounter(self, ticket: HangDoiKham, db: AsyncSession) -> Optional[LuotKham]:
        return await clinical_workspace_service._resolve_and_heal_ticket_encounter(self, ticket, db)

    async def _get_ticket_encounter(self, ticket: HangDoiKham, db: AsyncSession) -> Optional[LuotKham]:
        return await clinical_workspace_service._get_ticket_encounter(self, ticket, db)

    def _assert_completion_diagnosis_invariant(self, luot_kham: LuotKham) -> None:
        return clinical_encounter_service._assert_completion_diagnosis_invariant(luot_kham)

    async def _find_icd10_concept(self, ma_icd10: str, db: AsyncSession) -> Optional[KhaiNiem]:
        return await clinical_encounter_service._find_icd10_concept(self, ma_icd10, db)

    async def _get_encounter_with_relations(
        self, encounter_id: int, db: AsyncSession, for_update: bool = False
    ) -> Optional[LuotKham]:
        return await clinical_encounter_service._get_encounter_with_relations(
            self, encounter_id, db, for_update
        )

    async def _get_encounter_matching(self, condition, db: AsyncSession, for_update: bool = False) -> Optional[LuotKham]:
        return await clinical_encounter_service._get_encounter_matching(
            self, condition, db, for_update
        )

    async def assert_encounter_access(self, encounter: LuotKham, user: TaiKhoan, db: AsyncSession) -> None:
        return await clinical_encounter_service.assert_encounter_access(self, encounter, user, db)

    async def get_authorized_encounter(self, encounter_id: int, user: TaiKhoan, db: AsyncSession) -> LuotKham:
        return await clinical_encounter_service.get_authorized_encounter(self, encounter_id, user, db)

    async def assert_prescription_edit_access(self, prescription_id: int, user: TaiKhoan, db: AsyncSession) -> DonThuoc:
        return await clinical_prescription_service.assert_prescription_edit_access(self, prescription_id, user, db)

    def _to_prescription_response(self, dt: DonThuoc) -> PrescriptionResponse:
        return clinical_prescription_service._to_prescription_response(self, dt)

    def _extract_order_attachments(self, order: ChiDinh) -> List[str]:
        return clinical_order_service._extract_order_attachments(order)

    def _to_encounter_response(self, lk: LuotKham) -> EncounterResponse:
        return clinical_encounter_service._to_encounter_response(self, lk)

    async def rate_ai_suggestion(self, payload: AiFeedbackRequest, user: TaiKhoan, db: AsyncSession) -> AiFeedbackResponse:
        return await clinical_encounter_service.rate_ai_suggestion(self, payload, user, db)

    async def start_encounter(self, payload: EncounterCreateRequest, user: TaiKhoan, db: AsyncSession) -> EncounterResponse:
        return await clinical_encounter_service.start_encounter(self, payload, user, db)

    async def get_encounter_detail(self, encounter_id: int, user: TaiKhoan, db: AsyncSession) -> EncounterResponse:
        return await clinical_encounter_service.get_encounter_detail(self, encounter_id, user, db)

    async def add_diagnosis(self, encounter_id: int, payload: DiagnosisCreateRequest, user: TaiKhoan, db: AsyncSession) -> DiagnosisResponse:
        return await clinical_order_service.add_diagnosis(self, encounter_id, payload, user, db)

    async def add_order(self, encounter_id: int, payload: OrderCreateRequest, user: TaiKhoan, db: AsyncSession) -> OrderResponse:
        return await clinical_order_service.add_order(self, encounter_id, payload, user, db)

    async def update_order_result(self, order_id: int, payload: OrderResultUpdateRequest, user: TaiKhoan, db: AsyncSession) -> OrderResponse:
        return await clinical_order_service.update_order_result(self, order_id, payload, user, db)

    async def get_encounter_orders(self, encounter_id: int, user: TaiKhoan, db: AsyncSession) -> List[OrderResponse]:
        return await clinical_order_service.get_encounter_orders(self, encounter_id, user, db)

    async def get_patient_encounters_history(self, patient_id: int, user: TaiKhoan, db: AsyncSession) -> List[EncounterResponse]:
        return await clinical_encounter_service.get_patient_encounters_history(self, patient_id, user, db)

    async def get_my_encounters_history(self, user: TaiKhoan, db: AsyncSession) -> List[EncounterResponse]:
        return await clinical_encounter_service.get_my_encounters_history(self, user, db)

    async def complete_encounter(self, encounter_id: int, payload: EncounterCompleteRequest, user: TaiKhoan, db: AsyncSession) -> EncounterResponse:
        return await clinical_encounter_service.complete_encounter(self, encounter_id, payload, user, db)

    async def create_prescription(self, encounter_id: int, payload: PrescriptionCreateRequest, user: TaiKhoan, db: AsyncSession) -> PrescriptionResponse:
        return await clinical_prescription_service.create_prescription(self, encounter_id, payload, user, db)

    async def get_prescription(self, encounter_id: int, user: TaiKhoan, db: AsyncSession) -> PrescriptionResponse:
        return await clinical_prescription_service.get_prescription(self, encounter_id, user, db)

    def _to_amendment_response(self, bb: BienBanDinhChinh) -> AmendmentResponse:
        return clinical_amendment_service._to_amendment_response(self, bb)

    async def request_amendment(self, encounter_id: int, payload: AmendmentCreateRequest, user: TaiKhoan, db: AsyncSession) -> AmendmentResponse:
        return await clinical_amendment_service.request_amendment(self, encounter_id, payload, user, db)

    async def approve_amendment(self, amendment_id: int, payload: AmendmentApproveRequest, user: TaiKhoan, db: AsyncSession) -> AmendmentResponse:
        return await clinical_amendment_service.approve_amendment(self, amendment_id, payload, user, db)

    async def reject_amendment(self, amendment_id: int, payload: AmendmentApproveRequest, user: TaiKhoan, db: AsyncSession) -> AmendmentResponse:
        return await clinical_amendment_service.reject_amendment(self, amendment_id, payload, user, db)

    async def get_amendments(self, encounter_id: int, user: TaiKhoan, db: AsyncSession) -> List[AmendmentResponse]:
        return await clinical_amendment_service.get_amendments(self, encounter_id, user, db)

    async def save_physical_exam(self, encounter_id: int, payload: PhysicalExamRequest, user: TaiKhoan, db: AsyncSession) -> PhysicalExamResponse:
        return await clinical_exam_service.save_physical_exam(self, encounter_id, payload, user, db)

    async def get_physical_exam(self, encounter_id: int, user: TaiKhoan, db: AsyncSession) -> PhysicalExamResponse:
        return await clinical_exam_service.get_physical_exam(self, encounter_id, user, db)

    async def save_specialty_exam(self, encounter_id: int, dept_code: str, payload_data: dict, user: TaiKhoan, db: AsyncSession) -> dict:
        return await clinical_exam_service.save_specialty_exam(self, encounter_id, dept_code, payload_data, user, db)

    async def get_specialty_exam(self, encounter_id: int, dept_code: str, user: TaiKhoan, db: AsyncSession) -> dict:
        return await clinical_exam_service.get_specialty_exam(self, encounter_id, dept_code, user, db)

    async def get_all_specialty_exams(self, encounter_id: int, user: TaiKhoan, db: AsyncSession) -> List[dict]:
        return await clinical_exam_service.get_all_specialty_exams(self, encounter_id, user, db)

    async def copy_prescription_from_previous(self, encounter_id: int, source_prescription_id: int, user: TaiKhoan, db: AsyncSession) -> PrescriptionResponse:
        return await clinical_prescription_service.copy_prescription_from_previous(self, encounter_id, source_prescription_id, user, db)

    async def sync_workspace_to_postgres(self, db: AsyncSession, payload: dict, current_user: Optional[TaiKhoan] = None) -> dict:
        return await clinical_workspace_service.sync_workspace_to_postgres(self, db, payload, current_user)

    def strip_vietnamese_accents(self, text: str) -> str:
        return clinical_catalog_service.strip_vietnamese_accents(self, text)

    async def search_icd10(self, query: str, db: AsyncSession) -> List[Icd10SearchItem]:
        return await clinical_catalog_service.search_icd10(self, query, db)

    async def record_encounter_vitals(self, encounter_id: int, payload: VitalsCreateRequest, user: TaiKhoan, db: AsyncSession) -> VitalsResponse:
        return await clinical_exam_service.record_encounter_vitals(self, encounter_id, payload, user, db)

    async def check_drug_allergy_conflict(self, patient_id: int, active_ingredient: str, db: AsyncSession) -> AllergyCheckResponse:
        return await clinical_prescription_service.check_drug_allergy_conflict(self, patient_id, active_ingredient, db)

    async def seal_and_sign_encounter(self, encounter_id: int, user: TaiKhoan, db: AsyncSession) -> SealAndSignResponse:
        return await clinical_encounter_service.seal_and_sign_encounter(self, encounter_id, user, db)


clinical_service = ClinicalService()
