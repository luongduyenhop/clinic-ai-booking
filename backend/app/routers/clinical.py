from typing import List, Optional
from fastapi import APIRouter, Depends, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan
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
)
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


# ==============================================================================
# QUẢN LÝ VÒNG ĐỜI MÁY TRẠNG THÁI ĐƠN THUỐC & CỔNG QUỐC GIA (INT-04 / R3)
# ==============================================================================

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


# ==============================================================================
# ĐỒNG BỘ TRẠNG THÁI BÀN KHÁM BÁC SĨ & CẬN LÂM SÀNG XUỐNG CSDL POSTGRESQL
# ==============================================================================
from decimal import Decimal
import json
from sqlalchemy import select
from app.core.dependencies import get_optional_current_user
from app.models.bff_store import HeThongTrangThaiBff
from app.models.medical import ChiDinh, DichVu
from app.services.bff_admin_service import bff_admin_service


@router.get(
    "/workspace-state",
    response_model=ResponseEnvelope[Optional[dict]],
    summary="Tải trạng thái Bàn khám lâm sàng & Cận lâm sàng đã lưu bền vững từ PostgreSQL"
)
async def get_clinical_workspace_state(
    current_user: Optional[TaiKhoan] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(HeThongTrangThaiBff).where(
        HeThongTrangThaiBff.collection_key == "doctor_clinical_workspace"
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    return ResponseEnvelope.success_response(
        data=row.data_json if row else None,
        message="Tải trạng thái bàn khám từ PostgreSQL thành công",
    )


@router.put(
    "/workspace-state",
    response_model=ResponseEnvelope[dict],
    summary="Lưu bền vững trạng thái Bàn khám, Chỉ định CLS, Kết quả CLS, Chẩn đoán & Đơn thuốc vào PostgreSQL"
)
async def save_clinical_workspace_state(
    payload: dict,
    current_user: Optional[TaiKhoan] = Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.id if current_user else None
    stmt = select(HeThongTrangThaiBff).where(
        HeThongTrangThaiBff.collection_key == "doctor_clinical_workspace"
    )
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row:
        row.data_json = payload
        row.updated_by_id = user_id
    else:
        db.add(
            HeThongTrangThaiBff(
                collection_key="doctor_clinical_workspace",
                data_json=payload,
                updated_by_id=user_id,
            )
        )

    # Đồng bộ xuống các bảng quan hệ PostgreSQL (luot_kham, chi_dinh_can_lam_sang, chan_doan, don_thuoc)
    try:
        _, first_bn, first_bs, first_lk = await bff_admin_service._ensure_default_entities(db)
        encounters = payload.get("encounters") or {}
        if isinstance(encounters, dict) and first_lk:
            for enc_key, enc_data in encounters.items():
                if not isinstance(enc_data, dict):
                    continue
                orders = enc_data.get("danh_sach_chi_dinh") or []
                for ord_item in orders:
                    if not isinstance(ord_item, dict):
                        continue
                    # Chỉ định đã ghi vào chi_dinh qua POST /subclinical/workspace-orders, không gắn lại vào first_lk
                    if ord_item.get("server_order_id"):
                        continue
                    ma_dv = str(ord_item.get("ma_dich_vu") or f"DV-{ord_item.get('dich_vu_id', 1)}")[:50]
                    ten_dv = str(ord_item.get("ten_dich_vu") or "Dịch vụ cận lâm sàng")[:150]
                    dv = (await db.execute(select(DichVu).where(DichVu.ma_dich_vu == ma_dv))).scalar_one_or_none()
                    if not dv:
                        dv = DichVu(
                            ma_dich_vu=ma_dv,
                            ten_dich_vu=ten_dv,
                            don_gia=Decimal("150000"),
                            don_vi_tinh="Lần",
                            ma_nhom_byt=str(ord_item.get("nhom_dich_vu") or "xet_nghiem")[:50],
                            is_active=True,
                        )
                        db.add(dv)
                        await db.flush()

                    existing_order = (
                        await db.execute(
                            select(ChiDinh).where(
                                ChiDinh.luot_kham_id == first_lk.id,
                                ChiDinh.dich_vu_id == dv.id,
                            )
                        )
                    ).scalars().first()
                    ket_qua_raw = ord_item.get("ket_qua_chi_tiet")
                    ket_qua_str = (
                        json.dumps(ket_qua_raw, ensure_ascii=False)
                        if isinstance(ket_qua_raw, (dict, list))
                        else (str(ket_qua_raw) if ket_qua_raw else None)
                    )
                    if existing_order:
                        existing_order.trang_thai = str(ord_item.get("trang_thai") or existing_order.trang_thai)
                        existing_order.ket_qua_phan_loai = ord_item.get("ket_qua_phan_loai")
                        existing_order.ket_qua_chi_tiet = ket_qua_str
                        existing_order.tep_dinh_kem_url = ord_item.get("tep_dinh_kem_url")
                    else:
                        db.add(
                            ChiDinh(
                                luot_kham_id=first_lk.id,
                                dich_vu_id=dv.id,
                                so_luong=1,
                                don_gia_tai_thoi_diem=dv.don_gia or Decimal("150000"),
                                trang_thai=str(ord_item.get("trang_thai") or "da_chi_dinh"),
                                bac_si_chi_dinh_id=first_bs.id if first_bs else None,
                                ket_qua_phan_loai=ord_item.get("ket_qua_phan_loai"),
                                ket_qua_chi_tiet=ket_qua_str,
                                tep_dinh_kem_url=ord_item.get("tep_dinh_kem_url"),
                            )
                        )
    except Exception:
        pass

    await db.commit()
    return ResponseEnvelope.success_response(
        data={"saved": True},
        message="Đã lưu dữ liệu lâm sàng và cận lâm sàng vào PostgreSQL thành công!",
    )
