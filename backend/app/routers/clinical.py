from typing import List
from fastapi import APIRouter, Depends, status
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
    PrescriptionResponse,
    AmendmentCreateRequest,
    AmendmentResponse,
    AmendmentApproveRequest,
)
from app.schemas.queue import CallNextResponse, QueueTicketResponse
from app.services.clinical_service import clinical_service
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

