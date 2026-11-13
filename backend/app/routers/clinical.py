from typing import List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan, VaiTroEnum
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
    PrescriptionUpdateRequest,
    PrescriptionResponse,
    AmendmentCreateRequest,
    AmendmentResponse,
    AmendmentApproveRequest,
    Icd10SearchItem,
    VitalsCreateRequest,
    VitalsResponse,
    SealAndSignResponse,
    AllergyCheckRequest,
    AllergyCheckResponse,
)
from app.schemas.ai import AiFeedbackRequest, AiFeedbackResponse
from app.schemas.compliance import (
    PrescriptionSignRequest,
    PrescriptionIssueRequest,
    PrescriptionGatewaySubmitRequest,
    GatewaySubmissionResult,
    PrescriptionGatewayRetryRequest,
    PrescriptionSupersedeRequest,
    PrescriptionSupersedeResponse,
)
from app.schemas.subclinical import PhysicalExamRequest, PhysicalExamResponse
from app.schemas.queue import CallNextResponse, QueueTicketResponse
from app.services.clinical_service import clinical_service
from app.services.national_gateway_service import national_gateway_service
from app.services.prescription_fsm_service import prescription_fsm_service
from app.services.queue_service import queue_service

router = APIRouter(prefix="/clinical", tags=["5. Khám Lâm Sàng & Bệnh Án Điện Tử (Package D)"])
clinical_staff = require_roles([VaiTroEnum.BAC_SI, VaiTroEnum.ADMIN])


def require_live_clinical_integration() -> None:
    if settings.is_demo:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Ký số và liên thông đơn thuốc chưa khả dụng trong bản demo.")


class WorkspaceTicketUpdate(BaseModel):
    ticket_id: int = Field(gt=0)
    trang_thai: str = Field(max_length=30)
    ghi_chu: str | None = Field(None, max_length=2000)
    so_lan_goi: int | None = Field(None, ge=0, le=1000)


class WorkspaceStateUpdate(BaseModel):
    queue: list[WorkspaceTicketUpdate] = Field(default_factory=list, max_length=1000)
    encounters: dict[str, dict] = Field(default_factory=dict, max_length=1000)


@router.post(
    "/ai-feedback",
    response_model=ResponseEnvelope[AiFeedbackResponse],
    status_code=status.HTTP_200_OK,
    summary="Bác sĩ lưu đánh giá cho gợi ý AI của lịch hẹn mình phụ trách",
)
async def rate_ai_suggestion(
    payload: AiFeedbackRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await clinical_service.rate_ai_suggestion(payload, current_user, db)
    return ResponseEnvelope.success_response(data=result, message="Đã lưu đánh giá gợi ý AI thành công")


@router.post(
    "/encounters",
    response_model=ResponseEnvelope[EncounterResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Bác sĩ tiếp nhận và bắt đầu ca khám lâm sàng thực tế (OpenMRS Encounter)"
)
async def start_encounter(
    payload: EncounterCreateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.start_encounter(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Bắt đầu ca khám thành công",
        code=status.HTTP_201_CREATED
    )


@router.get(
    "/encounters/{encounter_id}",
    response_model=ResponseEnvelope[EncounterResponse],
    summary="Xem thông tin chi tiết ca khám và hồ sơ bệnh án điện tử (EMR)"
)
async def get_encounter_detail(
    encounter_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.get_encounter_detail(encounter_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy thông tin lượt khám thành công"
    )


@router.post(
    "/encounters/{encounter_id}/diagnoses",
    response_model=ResponseEnvelope[DiagnosisResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Thêm chẩn đoán bệnh theo danh mục mã chuẩn quốc tế WHO ICD-10"
)
async def add_diagnosis(
    encounter_id: int,
    payload: DiagnosisCreateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.add_diagnosis(encounter_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Thêm chẩn đoán ICD-10 thành công",
        code=status.HTTP_201_CREATED
    )


@router.post(
    "/encounters/{encounter_id}/orders",
    response_model=ResponseEnvelope[OrderResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Kê phiếu chỉ định dịch vụ cận lâm sàng (xét nghiệm, chẩn đoán hình ảnh)"
)
async def add_order(
    encounter_id: int,
    payload: OrderCreateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.add_order(encounter_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Kê chỉ định cận lâm sàng thành công",
        code=status.HTTP_201_CREATED
    )


@router.put(
    "/orders/{order_id}/result",
    response_model=ResponseEnvelope[OrderResponse],
    summary="Kỹ thuật viên / Bác sĩ cập nhật kết quả cận lâm sàng (Lab/Imaging Result)"
)
async def update_order_result(
    order_id: int,
    payload: OrderResultUpdateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.update_order_result(order_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Cập nhật kết quả cận lâm sàng thành công"
    )


@router.get(
    "/encounters/{encounter_id}/orders",
    response_model=ResponseEnvelope[List[OrderResponse]],
    summary="Lấy danh sách y lệnh chỉ định cận lâm sàng kèm kết quả của ca khám"
)
async def get_encounter_orders(
    encounter_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.get_encounter_orders(encounter_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy danh sách chỉ định cận lâm sàng thành công"
    )


@router.get(
    "/patients/{patient_id}/history",
    response_model=ResponseEnvelope[List[EncounterResponse]],
    summary="Bác sĩ tra cứu lịch sử bệnh án dài hạn (Longitudinal EMR Record) của bệnh nhân"
)
async def get_patient_encounters_history(
    patient_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.get_patient_encounters_history(patient_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy lịch sử khám bệnh nhân thành công"
    )


@router.get(
    "/my-history",
    response_model=ResponseEnvelope[List[EncounterResponse]],
    summary="Bệnh nhân tra cứu lịch sử hồ sơ bệnh án các lần khám trước của chính mình"
)
async def get_my_encounters_history(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.get_my_encounters_history(current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy lịch sử hồ sơ bệnh án thành công"
    )


@router.post(
    "/encounters/{encounter_id}/complete",
    response_model=ResponseEnvelope[EncounterResponse],
    summary="Hoàn tất ca khám và khóa vĩnh viễn hồ sơ bệnh án thành Read-only (Thông tư 32/2023/TT-BYT)"
)
async def complete_encounter(
    encounter_id: int,
    payload: EncounterCompleteRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.complete_encounter(encounter_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Ca khám đã được hoàn tất và khóa hồ sơ bệnh án thành công"
    )


@router.post(
    "/encounters/{encounter_id}/prescriptions",
    response_model=ResponseEnvelope[PrescriptionResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Bác sĩ kê đơn thuốc điều trị ngoại trú cho lượt khám (OpenMRS Drug Order)"
)
async def create_prescription(
    encounter_id: int,
    payload: PrescriptionCreateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.create_prescription(encounter_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Kê đơn thuốc ngoại trú thành công",
        code=status.HTTP_201_CREATED
    )


@router.get(
    "/encounters/{encounter_id}/prescriptions",
    response_model=ResponseEnvelope[PrescriptionResponse],
    summary="Xem thông tin chi tiết đơn thuốc điều trị ngoại trú của lượt khám"
)
async def get_prescription(
    encounter_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.get_prescription(encounter_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy thông tin đơn thuốc thành công"
    )



@router.get(
    "/prescriptions/{prescription_id}",
    response_model=ResponseEnvelope[PrescriptionResponse],
    summary="Xem chi tiết đơn thuốc điện tử theo ID (OpenMRS Drug Order)"
)
async def get_prescription_by_id(
    prescription_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    rx = await prescription_fsm_service.get_prescription_or_404(db, prescription_id)
    await clinical_service.get_authorized_encounter(rx.luot_kham_id, current_user, db)
    result = clinical_service._to_prescription_response(rx)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy thông tin đơn thuốc thành công"
    )


@router.put(
    "/prescriptions/{prescription_id}",
    response_model=ResponseEnvelope[PrescriptionResponse],
    summary="Chỉnh sửa đơn thuốc (Khóa bất biến nếu đơn đã SIGNED, ISSUED, ACCEPTED, SUPERSEDED)"
)
async def update_prescription(
    prescription_id: int,
    payload: PrescriptionUpdateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    rx = await prescription_fsm_service.update_prescription_db(
        db=db,
        prescription_id=prescription_id,
        user=current_user,
        payload=payload,
    )
    return ResponseEnvelope.success_response(
        data=clinical_service._to_prescription_response(rx),
        message="Cập nhật đơn thuốc thành công"
    )


@router.post(
    "/prescriptions/{prescription_id}/validate",
    response_model=ResponseEnvelope[PrescriptionResponse],
    summary="Thẩm định chuyên môn đơn thuốc trước khi ký số (DRAFT -> VALIDATED)"
)
async def validate_prescription(
    prescription_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    rx = await prescription_fsm_service.validate_prescription(db, prescription_id, current_user)
    return ResponseEnvelope.success_response(
        data=clinical_service._to_prescription_response(rx),
        message="Thẩm định đơn thuốc thành công"
    )


@router.post(
    "/prescriptions/{prescription_id}/sign",
    response_model=ResponseEnvelope[PrescriptionResponse],
    summary="Bác sĩ ký số đơn thuốc điện tử bằng chữ ký số cá nhân (VALIDATED -> SIGNED)"
)
async def sign_prescription(
    prescription_id: int,
    payload: PrescriptionSignRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_live_clinical_integration()
    await clinical_service.assert_prescription_edit_access(prescription_id, current_user, db)
    rx = await prescription_fsm_service.sign_prescription_db(
        db=db,
        prescription_id=prescription_id,
        user=current_user,
        signature_data=payload.chu_ky_so,
    )
    return ResponseEnvelope.success_response(
        data=clinical_service._to_prescription_response(rx),
        message="Ký số đơn thuốc thành công, nội dung thuốc đã bị khóa bất biến"
    )


@router.post(
    "/prescriptions/{prescription_id}/issue",
    response_model=ResponseEnvelope[PrescriptionResponse],
    summary="Ban hành đơn thuốc điện tử ra hệ thống ngoại trú (SIGNED -> ISSUED)"
)
async def issue_prescription(
    prescription_id: int,
    payload: Optional[PrescriptionIssueRequest] = None,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_live_clinical_integration()
    await clinical_service.assert_prescription_edit_access(prescription_id, current_user, db)
    rx = await prescription_fsm_service.issue_prescription_db(db, prescription_id, current_user)
    return ResponseEnvelope.success_response(
        data=clinical_service._to_prescription_response(rx),
        message="Ban hành đơn thuốc thành công"
    )


@router.post(
    "/prescriptions/{prescription_id}/submit-gateway",
    response_model=ResponseEnvelope[GatewaySubmissionResult],
    summary="Liên thông đơn thuốc lên Cổng đơn thuốc quốc gia (ISSUED -> SUBMISSION_PENDING -> SUBMITTED -> ACCEPTED)"
)
async def submit_gateway(
    prescription_id: int,
    payload: Optional[PrescriptionGatewaySubmitRequest] = None,
    idempotency_key_header: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_live_clinical_integration()
    await clinical_service.assert_prescription_edit_access(prescription_id, current_user, db)
    key = idempotency_key_header or (payload.idempotency_key if payload else None)
    facility_code = payload.facility_code if payload else None
    practitioner_code = payload.practitioner_code if payload else None
    result = await national_gateway_service.submit_to_gateway(
        db=db,
        prescription_id=prescription_id,
        user=current_user,
        idempotency_key=key,
        facility_code=facility_code,
        practitioner_code=practitioner_code,
    )
    return ResponseEnvelope.success_response(
        data=result,
        message=result.message
    )


@router.post(
    "/prescriptions/{prescription_id}/retry-gateway",
    response_model=ResponseEnvelope[GatewaySubmissionResult],
    summary="Gửi lại đơn thuốc gặp sự cố kết nối/timeout với nguyên vẹn Idempotency-Key"
)
async def retry_gateway(
    prescription_id: int,
    payload: Optional[PrescriptionGatewayRetryRequest] = None,
    idempotency_key_header: Optional[str] = Header(None, alias="Idempotency-Key"),
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_live_clinical_integration()
    await clinical_service.assert_prescription_edit_access(prescription_id, current_user, db)
    key = idempotency_key_header or (payload.idempotency_key if payload else None)
    result = await national_gateway_service.retry_gateway(
        db=db,
        prescription_id=prescription_id,
        user=current_user,
        idempotency_key=key,
    )
    return ResponseEnvelope.success_response(
        data=result,
        message=result.message
    )


@router.post(
    "/prescriptions/{prescription_id}/supersede",
    response_model=ResponseEnvelope[PrescriptionSupersedeResponse],
    summary="Quy trình thay thế đơn thuốc: Khóa đơn cũ SUPERSEDED và tạo đơn mới DRAFT"
)
async def supersede_prescription(
    prescription_id: int,
    payload: PrescriptionSupersedeRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    old_rx, new_rx = await prescription_fsm_service.supersede_prescription_db(
        db=db,
        prescription_id=prescription_id,
        user=current_user,
        payload=payload,
    )
    return ResponseEnvelope.success_response(
        data=PrescriptionSupersedeResponse(
            old_prescription=clinical_service._to_prescription_response(old_rx).model_dump(),
            new_prescription=clinical_service._to_prescription_response(new_rx).model_dump(),
            message=f"Đơn thuốc #{old_rx.id} đã được thay thế thành công bởi đơn mới #{new_rx.id}"
        ),
        message="Thay thế đơn thuốc thành công"
    )


@router.post(
    "/queue/call-next",
    response_model=ResponseEnvelope[CallNextResponse],
    summary="Bác sĩ gọi bệnh nhân tiếp theo vào phòng khám theo thuật toán 5 bậc ưu tiên Bahmni"
)
async def call_next_patient(
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.call_next_patient(current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=result.message
    )


@router.post(
    "/queue/{ticket_id}/postpone",
    response_model=ResponseEnvelope[QueueTicketResponse],
    summary="Bác sĩ chuyển ca khám sang trạng thái Tạm hoãn khi gọi loa quá 3 lần không vào"
)
async def postpone_ticket(
    ticket_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await queue_service.postpone_ticket(ticket_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Đã chuyển phiếu khám sang trạng thái tạm hoãn thành công"
    )


@router.post(
    "/encounters/{encounter_id}/amendments",
    response_model=ResponseEnvelope[AmendmentResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Bác sĩ tạo biên bản đính chính bệnh án đã khóa (OpenMRS / FHIR Amendment Pattern)"
)
async def request_amendment(
    encounter_id: int,
    payload: AmendmentCreateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.request_amendment(encounter_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Tạo yêu cầu đính chính bệnh án thành công (chờ phê duyệt)",
        code=status.HTTP_201_CREATED
    )


@router.get(
    "/encounters/{encounter_id}/amendments",
    response_model=ResponseEnvelope[list[AmendmentResponse]],
    summary="Xem danh sách các biên bản đính chính của một ca khám"
)
async def get_amendments(
    encounter_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.get_amendments(encounter_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy danh sách biên bản đính chính thành công"
    )


@router.post(
    "/amendments/{amendment_id}/approve",
    response_model=ResponseEnvelope[AmendmentResponse],
    summary="Trưởng khoa / Admin phê duyệt biên bản đính chính (Four-Eyes Principle)"
)
async def approve_amendment(
    amendment_id: int,
    payload: AmendmentApproveRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.approve_amendment(amendment_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Phê duyệt biên bản đính chính thành công"
    )


@router.post(
    "/amendments/{amendment_id}/reject",
    response_model=ResponseEnvelope[AmendmentResponse],
    summary="Trưởng khoa / Admin từ chối biên bản đính chính"
)
async def reject_amendment(
    amendment_id: int,
    payload: AmendmentApproveRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.reject_amendment(amendment_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Đã từ chối biên bản đính chính"
    )


@router.post(
    "/encounters/{encounter_id}/physical-exam",
    response_model=ResponseEnvelope[PhysicalExamResponse],
    summary="Ghi nhận hoặc cập nhật kết quả khám thể lực chuyên khoa theo Thông tư 32/2023/TT-BYT"
)
async def save_physical_exam(
    encounter_id: int,
    payload: PhysicalExamRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.save_physical_exam(encounter_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Cập nhật khám thể lực thành công"
    )


@router.get(
    "/encounters/{encounter_id}/physical-exam",
    response_model=ResponseEnvelope[Optional[PhysicalExamResponse]],
    summary="Xem chi tiết kết quả khám thể lực của lượt khám"
)
async def get_physical_exam(
    encounter_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.get_physical_exam(encounter_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy thông tin khám thể lực thành công"
    )



@router.get(
    "/encounters/{encounter_id}/specialties",
    response_model=ResponseEnvelope[dict],
    summary="Lấy toàn bộ kết quả khám 5 chuyên khoa (Nội, Ngoại, Mắt, TMH, RHM) của một lượt khám"
)
async def get_all_specialty_exams(
    encounter_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.get_all_specialty_exams(encounter_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Lấy toàn bộ hồ sơ chuyên khoa thành công"
    )


@router.get(
    "/encounters/{encounter_id}/specialty/{dept_code}",
    response_model=ResponseEnvelope[Optional[dict]],
    summary="Xem kết quả khám chuyên khoa cụ thể (noi-khoa, ngoai-khoa, mat, tai-mui-hong, rang-ham-mat)"
)
async def get_specialty_exam(
    encounter_id: int,
    dept_code: str,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.get_specialty_exam(encounter_id, dept_code, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Lấy thông tin khám chuyên khoa {dept_code} thành công"
    )


@router.put(
    "/encounters/{encounter_id}/specialty/{dept_code}",
    response_model=ResponseEnvelope[dict],
    summary="Lưu hoặc cập nhật hồ sơ khám chuyên khoa (Kiến trúc 2 tầng - Khóa bất biến theo TT 32/2023)"
)
async def save_specialty_exam(
    encounter_id: int,
    dept_code: str,
    payload: dict,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    data_dict = payload.get("data", payload) if isinstance(payload, dict) else {}
    result = await clinical_service.save_specialty_exam(encounter_id, dept_code, data_dict, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Cập nhật khám chuyên khoa {dept_code} thành công"
    )


@router.post(
    "/encounters/{encounter_id}/copy-prescription/{source_prescription_id}",
    response_model=ResponseEnvelope[PrescriptionResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Sao chép nhanh đơn thuốc cũ từ lịch sử khám sang ca khám hiện tại (Kế thừa từ TheDuckHospital)"
)
async def copy_old_prescription(
    encounter_id: int,
    source_prescription_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await clinical_service.copy_prescription_from_previous(
        encounter_id, source_prescription_id, current_user, db
    )
    return ResponseEnvelope.success_response(
        data=result,
        message="Sao chép đơn thuốc cũ thành công",
        code=status.HTTP_201_CREATED
    )


@router.get(
    "/workspace-state",
    response_model=ResponseEnvelope[Optional[dict]],
    summary="Tải trạng thái Bàn khám lâm sàng & Cận lâm sàng từ PostgreSQL (100% dữ liệu thật từ DB)"
)
async def get_clinical_workspace_state(
    doctor_id: Optional[int] = Query(None, description="Lọc theo bác sĩ (tùy chọn)"),
    current_user: TaiKhoan = Depends(clinical_staff),
    db: AsyncSession = Depends(get_db),
):
    data = await clinical_service.get_or_sync_workspace_state(
        db=db,
        current_user=current_user,
        doctor_id=doctor_id,
    )
    return ResponseEnvelope.success_response(
        data=data,
        message="Tải trạng thái bàn khám từ PostgreSQL thành công",
    )


@router.put(
    "/workspace-state",
    response_model=ResponseEnvelope[dict],
    summary="Lưu bền vững trạng thái Bàn khám, Sinh hiệu, Khám chuyên khoa vào PostgreSQL"
)
async def save_clinical_workspace_state(
    payload: WorkspaceStateUpdate,
    current_user: TaiKhoan = Depends(clinical_staff),
    db: AsyncSession = Depends(get_db),
):
    result = await clinical_service.sync_workspace_to_postgres(
        db=db,
        payload=payload.model_dump(),
        current_user=current_user,
    )
    return ResponseEnvelope.success_response(data=result, message="Đã lưu dữ liệu bàn khám.")


@router.get(
    "/icd10/search",
    response_model=ResponseEnvelope[List[Icd10SearchItem]],
    status_code=status.HTTP_200_OK,
)
async def search_icd10_endpoint(
    q: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: TaiKhoan = Depends(get_current_user),
):
    results = await clinical_service.search_icd10(q, db)
    return ResponseEnvelope.success_response(
        data=results,
        message=f"Tìm thấy {len(results)} kết quả phù hợp"
    )


@router.post(
    "/encounters/{encounter_id}/vitals",
    response_model=ResponseEnvelope[VitalsResponse],
    status_code=status.HTTP_201_CREATED,
)
async def record_encounter_vitals_endpoint(
    encounter_id: int,
    payload: VitalsCreateRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await clinical_service.record_encounter_vitals(encounter_id, payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Ghi nhận chỉ số sinh hiệu thành công",
        code=status.HTTP_201_CREATED
    )


@router.post(
    "/allergy-check",
    response_model=ResponseEnvelope[AllergyCheckResponse],
    status_code=status.HTTP_200_OK,
)
async def check_allergy_endpoint(
    payload: AllergyCheckRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await clinical_service.check_drug_allergy_conflict(payload.patient_id, payload.active_ingredient, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Kiểm tra tiền sử dị ứng thành công"
    )


@router.post(
    "/encounters/{encounter_id}/seal-and-sign",
    response_model=ResponseEnvelope[SealAndSignResponse],
    status_code=status.HTTP_200_OK,
)
async def seal_and_sign_encounter_endpoint(
    encounter_id: int,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_live_clinical_integration()
    result = await clinical_service.seal_and_sign_encounter(encounter_id, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Ký số và đóng niêm phong hồ sơ bệnh án thành công (Invariant EMR-1)"
    )

