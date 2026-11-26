from app.models.specialty_exam import (
    KhamMat,
    KhamNgoaiKhoa,
    KhamNoiKhoa,
    KhamRangHamMat,
    KhamTaiMuiHong,
)
from app.services.clinical import (
    clinical_amendment_service,
    clinical_catalog_service,
    clinical_encounter_service,
    clinical_exam_service,
    clinical_order_service,
    clinical_prescription_service,
    clinical_workspace_service,
)


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

    _build_hang_doi_query = staticmethod(clinical_workspace_service._build_hang_doi_query)
    _is_order_done = staticmethod(clinical_workspace_service._is_order_done)
    _resolve_specialty_slug = staticmethod(clinical_workspace_service._resolve_specialty_slug)
    _reconstruct_specialty_exam = clinical_workspace_service._reconstruct_specialty_exam
    _resolve_and_heal_ticket_encounter = clinical_workspace_service._resolve_and_heal_ticket_encounter
    _get_ticket_encounter = clinical_workspace_service._get_ticket_encounter
    get_or_sync_workspace_state = clinical_workspace_service.get_or_sync_workspace_state
    sync_workspace_to_postgres = clinical_workspace_service.sync_workspace_to_postgres

    _get_doctor_from_user = clinical_encounter_service._get_doctor_from_user
    enrich_workspace_ai = clinical_encounter_service.enrich_workspace_ai
    _assert_completion_diagnosis_invariant = staticmethod(
        clinical_encounter_service._assert_completion_diagnosis_invariant
    )
    _find_icd10_concept = clinical_encounter_service._find_icd10_concept
    _get_encounter_with_relations = clinical_encounter_service._get_encounter_with_relations
    _get_encounter_matching = clinical_encounter_service._get_encounter_matching
    assert_encounter_access = clinical_encounter_service.assert_encounter_access
    get_authorized_encounter = clinical_encounter_service.get_authorized_encounter
    _to_encounter_response = clinical_encounter_service._to_encounter_response
    rate_ai_suggestion = clinical_encounter_service.rate_ai_suggestion
    start_encounter = clinical_encounter_service.start_encounter
    get_encounter_detail = clinical_encounter_service.get_encounter_detail
    get_patient_encounters_history = clinical_encounter_service.get_patient_encounters_history
    get_my_encounters_history = clinical_encounter_service.get_my_encounters_history
    complete_encounter = clinical_encounter_service.complete_encounter
    seal_and_sign_encounter = clinical_encounter_service.seal_and_sign_encounter

    save_physical_exam = clinical_exam_service.save_physical_exam
    get_physical_exam = clinical_exam_service.get_physical_exam
    save_specialty_exam = clinical_exam_service.save_specialty_exam
    get_specialty_exam = clinical_exam_service.get_specialty_exam
    get_all_specialty_exams = clinical_exam_service.get_all_specialty_exams
    record_encounter_vitals = clinical_exam_service.record_encounter_vitals

    _extract_order_attachments = staticmethod(clinical_order_service._extract_order_attachments)
    add_diagnosis = clinical_order_service.add_diagnosis
    add_order = clinical_order_service.add_order
    update_order_result = clinical_order_service.update_order_result
    get_encounter_orders = clinical_order_service.get_encounter_orders

    assert_prescription_edit_access = clinical_prescription_service.assert_prescription_edit_access
    _to_prescription_response = clinical_prescription_service._to_prescription_response
    create_prescription = clinical_prescription_service.create_prescription
    get_prescription = clinical_prescription_service.get_prescription
    copy_prescription_from_previous = clinical_prescription_service.copy_prescription_from_previous
    check_drug_allergy_conflict = clinical_prescription_service.check_drug_allergy_conflict

    _to_amendment_response = clinical_amendment_service._to_amendment_response
    request_amendment = clinical_amendment_service.request_amendment
    approve_amendment = clinical_amendment_service.approve_amendment
    reject_amendment = clinical_amendment_service.reject_amendment
    get_amendments = clinical_amendment_service.get_amendments

    strip_vietnamese_accents = clinical_catalog_service.strip_vietnamese_accents
    search_icd10 = clinical_catalog_service.search_icd10


clinical_service = ClinicalService()
