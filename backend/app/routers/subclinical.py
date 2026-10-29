from datetime import date, datetime
from typing import Optional
from fastapi import APIRouter, Depends, File, Path, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_roles
from app.core.response import ResponseEnvelope
from app.models.user import TaiKhoan, VaiTroEnum
from app.schemas.cls_approval import ClsApprovalResponse, ClsReportResponse, ReturnedClsResultsResponse
from app.schemas.cls_imaging import (
    ClsFileListResponse,
    ClsFileResponse,
    ImagingResultRequest,
    ImagingResultResponse,
)
from app.schemas.subclinical import (
    SubclinicalDetailResponse,
    SubclinicalQueueResponse,
    SubclinicalResultSubmitRequest,
    WorkspaceOrdersRequest,
    WorkspaceOrdersResponse,
)
from app.schemas.cls_lab_result import LabResultResponse, LabResultSubmitRequest, LabTemplateResponse
from app.services.cls_approval_service import cls_approval_service
from app.services.cls_file_service import cls_file_service
from app.services.cls_lab_result_service import cls_lab_result_service
from app.services.cls_service_group import CLS_GROUPS
from app.services.cls_workspace_bridge_service import cls_workspace_bridge_service
from app.services.subclinical_service import subclinical_service

router = APIRouter(prefix="/subclinical", tags=["8. Cận Lâm Sàng & Xét Nghiệm / CĐHA (LIS & PACS)"])

# Bàn làm việc CLS: kỹ thuật viên thực hiện, bác sĩ theo dõi/hủy chỉ định của mình, admin giám sát
CLS_WORKBENCH_ROLES = [VaiTroEnum.KY_THUAT_VIEN, VaiTroEnum.BAC_SI, VaiTroEnum.ADMIN]
# Ký duyệt & trả kết quả do kỹ thuật viên phòng CLS thực hiện (admin giám sát), không phải bác sĩ chỉ định
CLS_APPROVER_ROLES = [VaiTroEnum.KY_THUAT_VIEN, VaiTroEnum.ADMIN]


@router.get(
    "/queue",
    response_model=ResponseEnvelope[SubclinicalQueueResponse],
    summary="Lấy danh sách hàng đợi bệnh nhân tại phòng kỹ thuật cận lâm sàng"
)
async def get_subclinical_queue(
    phong_thuc_hien_id: Optional[int] = Query(None, description="Lọc theo ID phòng kỹ thuật thực hiện"),
    trang_thai: Optional[str] = Query(
        None, description="Lọc theo trạng thái: da_chi_dinh, dang_thuc_hien, da_co_ket_qua, da_huy, tat_ca"
    ),
    nhom_dich_vu: Optional[str] = Query(
        None, pattern=f"^({'|'.join(CLS_GROUPS)})$", description="Nhóm dịch vụ: XET_NGHIEM, CDHA, TDCN, NOI_SOI"
    ),
    ngay: Optional[date] = Query(None, description="Ngày chỉ định (YYYY-MM-DD), mặc định hôm nay theo giờ phòng khám"),
    tu_khoa: Optional[str] = Query(None, max_length=100, description="Tìm theo tên, số điện thoại hoặc mã bệnh nhân"),
    current_user: TaiKhoan = Depends(require_roles(CLS_WORKBENCH_ROLES)),
    db: AsyncSession = Depends(get_db)
):
    result = await subclinical_service.get_subclinical_queue(
        phong_thuc_hien_id=phong_thuc_hien_id,
        trang_thai=trang_thai,
        db=db,
        nhom_dich_vu=nhom_dich_vu,
        ngay=ngay,
        tu_khoa=tu_khoa,
    )
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Lấy hàng đợi {result.total} ca cận lâm sàng thành công"
    )


@router.post(
    "/orders/{order_id}/start",
    response_model=ResponseEnvelope[SubclinicalDetailResponse],
    summary="Kỹ thuật viên tiếp nhận mẫu và bắt đầu thực hiện ca cận lâm sàng"
)
async def start_subclinical_order(
    order_id: int,
    current_user: TaiKhoan = Depends(require_roles(CLS_WORKBENCH_ROLES)),
    db: AsyncSession = Depends(get_db)
):
    order = await subclinical_service.start_subclinical_order(
        order_id=order_id,
        technician_user_id=current_user.nguoi_dung_id,
        db=db
    )
    resp = SubclinicalDetailResponse.model_validate(order)
    return ResponseEnvelope.success_response(
        data=resp,
        message="Bắt đầu thực hiện ca cận lâm sàng thành công"
    )


@router.post(
    "/orders/{order_id}/results",
    response_model=ResponseEnvelope[SubclinicalDetailResponse],
    summary="Kỹ thuật viên nhập kết quả, phân loại và hoàn tất ca cận lâm sàng"
)
async def submit_subclinical_result(
    order_id: int,
    payload: SubclinicalResultSubmitRequest,
    current_user: TaiKhoan = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    order = await subclinical_service.submit_subclinical_result(
        order_id=order_id,
        payload=payload,
        technician_user_id=current_user.nguoi_dung_id,
        db=db
    )
    resp = SubclinicalDetailResponse.model_validate(order)
    return ResponseEnvelope.success_response(
        data=resp,
        message="Nhập kết quả cận lâm sàng thành công"
    )


@router.post(
    "/orders/{order_id}/cancel",
    response_model=ResponseEnvelope[SubclinicalDetailResponse],
    summary="Hủy chỉ định cận lâm sàng"
)
async def cancel_subclinical_order(
    order_id: int,
    ly_do: str = Query("Bệnh nhân từ chối thực hiện", description="Lý do hủy chỉ định"),
    current_user: TaiKhoan = Depends(require_roles(CLS_WORKBENCH_ROLES)),
    db: AsyncSession = Depends(get_db)
):
    order = await subclinical_service.cancel_subclinical_order(
        order_id=order_id,
        reason=ly_do,
        user_id=current_user.nguoi_dung_id,
        db=db
    )
    resp = SubclinicalDetailResponse.model_validate(order)
    return ResponseEnvelope.success_response(
        data=resp,
        message="Hủy chỉ định cận lâm sàng thành công"
    )


@router.post(
    "/workspace-orders",
    response_model=ResponseEnvelope[WorkspaceOrdersResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Ghi chỉ định CLS từ bàn khám bác sĩ (workspace) vào bảng chi_dinh để kỹ thuật viên tiếp nhận"
)
async def create_orders_from_workspace(
    payload: WorkspaceOrdersRequest,
    current_user: TaiKhoan = Depends(require_roles([VaiTroEnum.BAC_SI, VaiTroEnum.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    result = await cls_workspace_bridge_service.create_orders_from_workspace(payload, current_user, db)
    return ResponseEnvelope.success_response(
        data=result,
        message=f"Đã gửi {len(result.orders)} chỉ định cận lâm sàng sang phòng kỹ thuật",
        code=status.HTTP_201_CREATED
    )


@router.get(
    "/orders/{order_id}/lab-template",
    response_model=ResponseEnvelope[LabTemplateResponse],
    summary="Bộ chỉ số mẫu (đơn vị, khoảng tham chiếu theo giới tính) của chỉ định xét nghiệm, kèm kết quả đã lưu"
)
async def get_lab_template(
    order_id: int,
    current_user: TaiKhoan = Depends(require_roles(CLS_WORKBENCH_ROLES)),
    db: AsyncSession = Depends(get_db)
):
    result = await cls_lab_result_service.get_lab_template(order_id, db)
    return ResponseEnvelope.success_response(data=result, message="Lấy bộ chỉ số xét nghiệm thành công")


@router.post(
    "/orders/{order_id}/lab-results",
    response_model=ResponseEnvelope[LabResultResponse],
    summary="Nhập chỉ số xét nghiệm máu, tự đánh giá vượt ngưỡng và lưu vào ket_qua_cls"
)
async def submit_lab_result(
    order_id: int,
    payload: LabResultSubmitRequest,
    current_user: TaiKhoan = Depends(require_roles(CLS_WORKBENCH_ROLES)),
    db: AsyncSession = Depends(get_db)
):
    result = await cls_lab_result_service.submit_lab_result(
        order_id=order_id,
        payload=payload,
        technician_user_id=current_user.nguoi_dung_id,
        db=db
    )
    message = "Đã lưu nháp kết quả xét nghiệm" if payload.luu_nhap else "Đã trả kết quả xét nghiệm"
    if result.ket_qua.so_nguy_hiem:
        message += f" — {result.ket_qua.so_nguy_hiem} chỉ số ở ngưỡng nguy hiểm"
    return ResponseEnvelope.success_response(data=result, message=message)


# ── Ảnh kết quả & phiếu kết quả Chẩn đoán hình ảnh ─────────────────────────
@router.post(
    "/orders/{order_id}/files",
    response_model=ResponseEnvelope[ClsFileResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Tải lên 1 ảnh kết quả (JPG/PNG, tối đa 10 MB, tối đa 10 ảnh/ca) cho chỉ định CLS"
)
async def upload_subclinical_file(
    order_id: int,
    file: UploadFile = File(..., description="Ảnh JPG/PNG (ảnh DICOM cần xuất sang JPG/PNG từ máy)"),
    current_user: TaiKhoan = Depends(require_roles(CLS_WORKBENCH_ROLES)),
    db: AsyncSession = Depends(get_db)
):
    result = await cls_file_service.upload_file(order_id, file, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Tải ảnh kết quả lên thành công",
        code=status.HTTP_201_CREATED
    )


@router.get(
    "/orders/{order_id}/files",
    response_model=ResponseEnvelope[ClsFileListResponse],
    summary="Danh sách ảnh kết quả đã tải lên của chỉ định CLS"
)
async def list_subclinical_files(
    order_id: int,
    current_user: TaiKhoan = Depends(require_roles(CLS_WORKBENCH_ROLES)),
    db: AsyncSession = Depends(get_db)
):
    result = await cls_file_service.list_files(order_id, db)
    return ResponseEnvelope.success_response(data=result, message=f"Có {len(result.items)} ảnh kết quả")


@router.get(
    "/orders/{order_id}/files/{file_id}",
    response_class=FileResponse,
    summary="Xem ảnh kết quả CLS (bắt buộc xác thực, không public)"
)
async def get_subclinical_file(
    order_id: int,
    file_id: str = Path(..., max_length=40),
    current_user: TaiKhoan = Depends(require_roles(CLS_WORKBENCH_ROLES)),
    db: AsyncSession = Depends(get_db)
):
    path, media_type = await cls_file_service.get_file(order_id, file_id, db)
    return FileResponse(
        path,
        media_type=media_type,
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.delete(
    "/orders/{order_id}/files/{file_id}",
    response_model=ResponseEnvelope[None],
    summary="Xóa ảnh kết quả khi kết quả chưa được duyệt"
)
async def delete_subclinical_file(
    order_id: int,
    file_id: str = Path(..., max_length=40),
    current_user: TaiKhoan = Depends(require_roles(CLS_WORKBENCH_ROLES)),
    db: AsyncSession = Depends(get_db)
):
    await cls_file_service.delete_file(order_id, file_id, db)
    return ResponseEnvelope.success_response(data=None, message="Đã xóa ảnh kết quả")


@router.get(
    "/orders/{order_id}/imaging-result",
    response_model=ResponseEnvelope[ImagingResultResponse],
    summary="Lấy phiếu kết quả Chẩn đoán hình ảnh (bản nháp hoặc đã trả) kèm danh sách ảnh"
)
async def get_imaging_result(
    order_id: int,
    current_user: TaiKhoan = Depends(require_roles(CLS_WORKBENCH_ROLES)),
    db: AsyncSession = Depends(get_db)
):
    result = await cls_file_service.get_imaging_result(order_id, db)
    return ResponseEnvelope.success_response(data=result, message="Lấy kết quả chẩn đoán hình ảnh thành công")


@router.post(
    "/orders/{order_id}/imaging-result",
    response_model=ResponseEnvelope[ImagingResultResponse],
    summary="Lưu nháp hoặc trả kết quả Chẩn đoán hình ảnh (mô tả, kết luận, đề nghị, ảnh đã tải lên)"
)
async def save_imaging_result(
    order_id: int,
    payload: ImagingResultRequest,
    current_user: TaiKhoan = Depends(require_roles(CLS_WORKBENCH_ROLES)),
    db: AsyncSession = Depends(get_db)
):
    result = await cls_file_service.save_imaging_result(order_id, payload, current_user.nguoi_dung_id, db)
    return ResponseEnvelope.success_response(
        data=result,
        message="Đã trả kết quả chẩn đoán hình ảnh" if result.trang_thai == "da_co_ket_qua" else "Đã lưu nháp kết quả"
    )


# ── Ký duyệt & trả kết quả, phiếu in, kết quả mới cho bàn khám ─────────────
@router.post(
    "/orders/{order_id}/approve",
    response_model=ResponseEnvelope[ClsApprovalResponse],
    summary="KTV duyệt & trả kết quả đã hoàn tất: chỉ định sang da_co_ket_qua, khóa sửa kết quả và ảnh"
)
async def approve_subclinical_result(
    order_id: int,
    current_user: TaiKhoan = Depends(require_roles(CLS_APPROVER_ROLES)),
    db: AsyncSession = Depends(get_db)
):
    result = await cls_approval_service.approve(order_id, current_user, db)
    return ResponseEnvelope.success_response(data=result, message="Đã duyệt & trả kết quả cho bác sĩ chỉ định")


@router.get(
    "/orders/{order_id}/report",
    response_model=ResponseEnvelope[ClsReportResponse],
    summary="Dữ liệu phiếu kết quả CLS để in A4/A5 (chỉ kết quả đã duyệt)"
)
async def get_subclinical_report(
    order_id: int,
    current_user: TaiKhoan = Depends(require_roles(CLS_WORKBENCH_ROLES)),
    db: AsyncSession = Depends(get_db)
):
    result = await cls_approval_service.get_report(order_id, current_user, db)
    return ResponseEnvelope.success_response(data=result, message="Lấy dữ liệu phiếu kết quả thành công")


@router.get(
    "/returned-results",
    response_model=ResponseEnvelope[ReturnedClsResultsResponse],
    summary="Kết quả CLS vừa được duyệt (bàn khám bác sĩ hỏi định kỳ để hiện kết quả không cần tải lại trang)"
)
async def get_returned_results(
    since: Optional[datetime] = Query(None, description="Lấy kết quả duyệt từ thời điểm này (mặc định đầu ngày)"),
    current_user: TaiKhoan = Depends(require_roles([VaiTroEnum.BAC_SI, VaiTroEnum.ADMIN])),
    db: AsyncSession = Depends(get_db)
):
    result = await cls_approval_service.returned_results(current_user, since, db)
    return ResponseEnvelope.success_response(data=result, message=f"Có {len(result.items)} kết quả mới")
