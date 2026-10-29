"""Ảnh kết quả cận lâm sàng (siêu âm, X-quang, nội soi...) và phiếu kết quả Chẩn đoán hình ảnh.

Ảnh lưu trên đĩa tại `<CLS_UPLOAD_DIR>/<chi_dinh_id>/<uuid>.<jpg|png>`, đường dẫn API của từng ảnh lưu trong
`chi_dinh.file_dinh_kem_urls` (nguồn chuẩn) và được chép sang `phieu_ket_qua_cls` / `ket_qua_cls` khi nộp kết quả.
Ảnh y tế không public bằng StaticFiles: chỉ xem được qua endpoint có xác thực.
"""
import logging
import re
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from fastapi import UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.exceptions import (
    AppException,
    BadRequestException,
    ConflictException,
    NotFoundException,
    UnprocessableEntityException,
)
from app.models.medical import ChiDinh, KetQuaCLS, PhieuKetQuaCLS
from app.schemas.cls_imaging import (
    ClsFileListResponse,
    ClsFileResponse,
    ImagingResultRequest,
    ImagingResultResponse,
)
from app.services.cls_result_state import PHIEU_CHO_DUYET, PHIEU_NHAP, is_phieu_approved, latest_phieu
from app.services.cls_service_group import CDHA, XET_NGHIEM, nhom_dich_vu_of

logger = logging.getLogger(__name__)

MAX_FILE_BYTES = 10 * 1024 * 1024
MAX_FILES_PER_ORDER = 10
DEFAULT_UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "cls"

# Tên tệp trên đĩa do máy chủ tự sinh: chỉ chấp nhận đúng dạng này khi đọc/xóa, chặn mọi kiểu path traversal
_FILE_ID_RE = re.compile(r"^[0-9a-f]{32}\.(jpg|png)$")
_FILE_URL_RE = re.compile(r"^/api/v1/subclinical/orders/(\d+)/files/([0-9a-f]{32}\.(?:jpg|png))$")


@dataclass(frozen=True)
class _ImageKind:
    ext: str
    media_type: str
    magic: bytes
    extensions: frozenset
    content_types: frozenset


_IMAGE_KINDS = (
    _ImageKind("jpg", "image/jpeg", b"\xff\xd8\xff", frozenset({".jpg", ".jpeg"}), frozenset({"image/jpeg", "image/jpg", "image/pjpeg"})),
    _ImageKind("png", "image/png", b"\x89PNG\r\n\x1a\n", frozenset({".png"}), frozenset({"image/png"})),
)

_EDITABLE_STATES = ("dang_thuc_hien", "da_co_ket_qua")


class ClsFileService:
    """Tải lên / xem / xóa ảnh kết quả CLS và nộp kết quả Chẩn đoán hình ảnh"""

    @property
    def upload_root(self) -> Path:
        return Path(settings.CLS_UPLOAD_DIR).resolve() if settings.CLS_UPLOAD_DIR else DEFAULT_UPLOAD_DIR

    @staticmethod
    def file_url(order_id: int, file_id: str) -> str:
        return f"{settings.API_V1_STR}/subclinical/orders/{order_id}/files/{file_id}"

    # ── Ảnh kết quả ──────────────────────────────────────────────────────

    async def upload_file(self, order_id: int, file: UploadFile, db: AsyncSession) -> ClsFileResponse:
        """Nhận 1 ảnh JPG/PNG: kiểm tra đuôi tệp, content-type, magic bytes và dung lượng trước khi ghi đĩa"""
        data = await file.read(MAX_FILE_BYTES + 1)
        if not data:
            raise BadRequestException("Tệp tải lên rỗng")
        if len(data) > MAX_FILE_BYTES:
            raise AppException(
                f"Ảnh vượt quá dung lượng cho phép {MAX_FILE_BYTES // (1024 * 1024)} MB",
                code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            )
        kind = self._detect_kind(file.filename, file.content_type, data)

        order = await self._lock_order(order_id, db)
        self._ensure_imaging_order(order)
        self._ensure_editable(order)
        await self._ensure_not_approved(order, db)

        file_ids = self._file_ids(order)
        if len(file_ids) >= MAX_FILES_PER_ORDER:
            raise ConflictException(f"Mỗi ca chỉ được đính kèm tối đa {MAX_FILES_PER_ORDER} ảnh")

        file_id = f"{uuid.uuid4().hex}.{kind.ext}"
        path = self._safe_path(order.id, file_id)
        await run_in_threadpool(self._write_file, path, data)

        order.file_dinh_kem_urls = [*(order.file_dinh_kem_urls or []), self.file_url(order.id, file_id)]
        await self._sync_result_attachments(order, db)
        try:
            await db.commit()
        except Exception:
            path.unlink(missing_ok=True)
            raise

        return ClsFileResponse(
            file_id=file_id,
            url=self.file_url(order.id, file_id),
            content_type=kind.media_type,
            kich_thuoc=len(data),
            ten_goc=self._original_name(file.filename),
        )

    async def list_files(self, order_id: int, db: AsyncSession) -> ClsFileListResponse:
        order = await db.get(ChiDinh, order_id)
        if not order:
            raise NotFoundException(f"Không tìm thấy chỉ định cận lâm sàng ID {order_id}!")
        items = []
        for file_id in self._file_ids(order):
            path = self._safe_path(order.id, file_id)
            items.append(
                ClsFileResponse(
                    file_id=file_id,
                    url=self.file_url(order.id, file_id),
                    content_type=self._media_type(file_id),
                    kich_thuoc=path.stat().st_size if path.is_file() else None,
                )
            )
        return ClsFileListResponse(chi_dinh_id=order.id, items=items, toi_da=MAX_FILES_PER_ORDER)

    async def get_file(self, order_id: int, file_id: str, db: AsyncSession) -> tuple[Path, str]:
        """Trả về (đường dẫn trên đĩa, media type) của một ảnh thuộc đúng chỉ định này"""
        not_found = NotFoundException("Không tìm thấy ảnh kết quả")
        if not _FILE_ID_RE.fullmatch(file_id):
            raise not_found
        order = await db.get(ChiDinh, order_id)
        if not order or file_id not in self._file_ids(order):
            raise not_found
        path = self._safe_path(order.id, file_id)
        if not path.is_file():
            raise not_found
        return path, self._media_type(file_id)

    async def delete_file(self, order_id: int, file_id: str, db: AsyncSession) -> None:
        if not _FILE_ID_RE.fullmatch(file_id):
            raise NotFoundException("Không tìm thấy ảnh kết quả")
        order = await self._lock_order(order_id, db)
        if file_id not in self._file_ids(order):
            raise NotFoundException("Không tìm thấy ảnh kết quả")
        if order.trang_thai == "da_huy":
            raise ConflictException("Chỉ định này đã bị hủy bỏ!")
        await self._ensure_not_approved(order, db)

        url = self.file_url(order.id, file_id)
        order.file_dinh_kem_urls = [u for u in (order.file_dinh_kem_urls or []) if u != url]
        if order.tep_dinh_kem_url == url:
            order.tep_dinh_kem_url = order.file_dinh_kem_urls[0] if order.file_dinh_kem_urls else None
        await self._sync_result_attachments(order, db)
        await db.commit()
        self._safe_path(order.id, file_id).unlink(missing_ok=True)

    # ── Kết quả Chẩn đoán hình ảnh ───────────────────────────────────────

    async def get_imaging_result(self, order_id: int, db: AsyncSession) -> ImagingResultResponse:
        stmt = (
            select(ChiDinh)
            .options(selectinload(ChiDinh.dich_vu), selectinload(ChiDinh.ket_qua))
            .where(ChiDinh.id == order_id)
        )
        order = (await db.execute(stmt)).scalar_one_or_none()
        if not order:
            raise NotFoundException(f"Không tìm thấy chỉ định cận lâm sàng ID {order_id}!")
        return self._to_response(order, await latest_phieu(order.id, db), order.ket_qua)

    async def save_imaging_result(
        self,
        order_id: int,
        payload: ImagingResultRequest,
        technician_user_id: int,
        db: AsyncSession,
    ) -> ImagingResultResponse:
        """Lưu nháp hoặc hoàn tất kết quả CĐHA vào phieu_ket_qua_cls (+ ket_qua_cls khi hoàn tất).

        Chỉ định vẫn ở `dang_thuc_hien` cho tới khi KTV bấm "Duyệt & Trả kết quả" (cls_approval_service).
        """
        order = await self._lock_order(order_id, db)
        group = self._ensure_imaging_order(order)
        self._ensure_editable(order)
        phieu = await latest_phieu(order.id, db)
        if is_phieu_approved(phieu) or order.trang_thai == "da_co_ket_qua":
            raise ConflictException("Kết quả đã được duyệt, không thể chỉnh sửa!")

        mo_ta = (payload.mo_ta_hinh_anh or "").strip() or None
        ket_luan = (payload.ket_luan or "").strip() or None
        de_nghi = (payload.de_nghi or "").strip() or None
        # Đã hoàn tất (chờ duyệt) thì mọi lần lưu sau đều là cập nhật kết quả hoàn tất, không quay về nháp
        final = payload.hoan_tat or bool(phieu and phieu.trang_thai == PHIEU_CHO_DUYET)
        if final and not (mo_ta and ket_luan):
            raise UnprocessableEntityException("Cần nhập mô tả hình ảnh và kết luận trước khi hoàn tất kết quả")

        if phieu is None:
            phieu = PhieuKetQuaCLS(chi_dinh_id=order.id, lan_thuc_hien=1)
            db.add(phieu)
        attachments = list(order.file_dinh_kem_urls or [])
        phieu.loai_ket_qua = group or CDHA
        phieu.mo_ta_hinh_anh = mo_ta
        phieu.ket_luan = ket_luan
        phieu.de_nghi = de_nghi
        phieu.thiet_bi_thuc_hien = (payload.thiet_bi_thuc_hien or "").strip() or None
        phieu.tep_dinh_kem_urls = attachments
        phieu.ky_thuat_vien_id = technician_user_id
        phieu.thoi_gian_lay_mau = order.thoi_gian_lay_mau
        phieu.thoi_gian_thuc_hien = order.thoi_gian_thuc_hien
        phieu.trang_thai = PHIEU_CHO_DUYET if final else PHIEU_NHAP

        ket_qua = (await db.execute(select(KetQuaCLS).where(KetQuaCLS.chi_dinh_id == order.id))).scalar_one_or_none()
        if final:
            order.ky_thuat_vien_id = technician_user_id
            if ket_qua is None:
                ket_qua = KetQuaCLS(chi_dinh_id=order.id)
                db.add(ket_qua)
            ket_qua.nguoi_thuc_hien_id = technician_user_id
            ket_qua.ket_qua_chi_tiet = self._summary_text(mo_ta, ket_luan, de_nghi)
            ket_qua.ket_qua_phan_loai = payload.ket_qua_phan_loai
            ket_qua.file_dinh_kem_urls = attachments
            ket_qua.thoi_gian_lay_mau = order.thoi_gian_lay_mau
            ket_qua.thoi_gian_thuc_hien = order.thoi_gian_thuc_hien

        await db.commit()
        return self._to_response(order, phieu, ket_qua)

    # ── Nội bộ ───────────────────────────────────────────────────────────

    @staticmethod
    def _detect_kind(filename: Optional[str], content_type: Optional[str], data: bytes) -> _ImageKind:
        ext = Path((filename or "").replace("\\", "/")).suffix.lower()
        ctype = (content_type or "").split(";")[0].strip().lower()
        for kind in _IMAGE_KINDS:
            if data.startswith(kind.magic):
                if ext in kind.extensions and ctype in kind.content_types:
                    return kind
                break
        raise AppException(
            "Chỉ nhận ảnh JPG hoặc PNG (ảnh DICOM cần xuất sang JPG/PNG trước khi tải lên)",
            code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
        )

    @staticmethod
    def _original_name(filename: Optional[str]) -> Optional[str]:
        name = (filename or "").replace("\\", "/").rsplit("/", 1)[-1].strip()
        return name[:255] or None

    @staticmethod
    def _media_type(file_id: str) -> str:
        return "image/png" if file_id.endswith(".png") else "image/jpeg"

    def _safe_path(self, order_id: int, file_id: str) -> Path:
        root = self.upload_root
        path = (root / str(int(order_id)) / file_id).resolve()
        if not path.is_relative_to(root):
            raise NotFoundException("Không tìm thấy ảnh kết quả")
        return path

    @staticmethod
    def _write_file(path: Path, data: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "xb") as fh:
            fh.write(data)

    @staticmethod
    def _file_ids(order: ChiDinh) -> List[str]:
        """Ảnh do hệ thống quản lý của chính chỉ định này (bỏ qua URL ngoài từ luồng nhập kết quả cũ)"""
        ids = []
        for url in order.file_dinh_kem_urls or []:
            match = _FILE_URL_RE.fullmatch(str(url))
            if match and int(match.group(1)) == order.id:
                ids.append(match.group(2))
        return ids

    @staticmethod
    async def _lock_order(order_id: int, db: AsyncSession) -> ChiDinh:
        stmt = select(ChiDinh).options(selectinload(ChiDinh.dich_vu)).where(ChiDinh.id == order_id).with_for_update()
        order = (await db.execute(stmt)).scalar_one_or_none()
        if not order:
            raise NotFoundException(f"Không tìm thấy chỉ định cận lâm sàng ID {order_id}!")
        return order

    @staticmethod
    def _ensure_imaging_order(order: ChiDinh) -> Optional[str]:
        group = nhom_dich_vu_of(order.dich_vu.ma_nhom_byt, order.dich_vu.ma_dich_vu) if order.dich_vu else None
        if group == XET_NGHIEM:
            raise ConflictException("Chỉ định xét nghiệm không nhập kết quả hình ảnh")
        return group

    @staticmethod
    def _ensure_editable(order: ChiDinh) -> None:
        if order.trang_thai == "da_huy":
            raise ConflictException("Chỉ định này đã bị hủy bỏ!")
        if order.trang_thai not in _EDITABLE_STATES:
            raise ConflictException("Cần tiếp nhận ca (bắt đầu thực hiện) trước khi nhập kết quả hình ảnh")

    async def _ensure_not_approved(self, order: ChiDinh, db: AsyncSession) -> None:
        if is_phieu_approved(await latest_phieu(order.id, db)):
            raise ConflictException("Kết quả đã được duyệt, không thể thay đổi ảnh!")

    async def _sync_result_attachments(self, order: ChiDinh, db: AsyncSession) -> None:
        """Giữ danh sách ảnh trên phiếu kết quả khớp với chi_dinh khi thêm/xóa ảnh sau lúc đã lưu kết quả"""
        attachments = list(order.file_dinh_kem_urls or [])
        phieu = await latest_phieu(order.id, db)
        if phieu is not None:
            phieu.tep_dinh_kem_urls = attachments
        ket_qua = (await db.execute(select(KetQuaCLS).where(KetQuaCLS.chi_dinh_id == order.id))).scalar_one_or_none()
        if ket_qua is not None:
            ket_qua.file_dinh_kem_urls = attachments
        if order.trang_thai == "da_co_ket_qua":
            order.tep_dinh_kem_url = attachments[0] if attachments else None

    @staticmethod
    def _summary_text(mo_ta: Optional[str], ket_luan: Optional[str], de_nghi: Optional[str]) -> str:
        parts = [f"Mô tả: {mo_ta}", f"Kết luận: {ket_luan}"]
        if de_nghi:
            parts.append(f"Đề nghị: {de_nghi}")
        return "\n".join(parts)

    def _to_response(
        self, order: ChiDinh, phieu: Optional[PhieuKetQuaCLS], ket_qua: Optional[KetQuaCLS]
    ) -> ImagingResultResponse:
        return ImagingResultResponse(
            chi_dinh_id=order.id,
            trang_thai=order.trang_thai,
            nhom_dich_vu=nhom_dich_vu_of(order.dich_vu.ma_nhom_byt, order.dich_vu.ma_dich_vu) if order.dich_vu else None,
            phieu_id=phieu.id if phieu else None,
            trang_thai_phieu=phieu.trang_thai if phieu else None,
            loai_ket_qua=phieu.loai_ket_qua if phieu else None,
            mo_ta_hinh_anh=phieu.mo_ta_hinh_anh if phieu else None,
            ket_luan=phieu.ket_luan if phieu else None,
            de_nghi=phieu.de_nghi if phieu else None,
            ket_qua_phan_loai=ket_qua.ket_qua_phan_loai if ket_qua else None,
            thiet_bi_thuc_hien=phieu.thiet_bi_thuc_hien if phieu else None,
            tep_dinh_kem_urls=[self.file_url(order.id, fid) for fid in self._file_ids(order)],
            da_duyet=is_phieu_approved(phieu),
            thoi_gian_duyet=phieu.thoi_gian_duyet if phieu else None,
            thoi_gian_tra_ket_qua=order.thoi_gian_tra_ket_qua,
        )


cls_file_service = ClsFileService()
