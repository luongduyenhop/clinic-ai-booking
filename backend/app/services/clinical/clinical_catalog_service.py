import hashlib
import json
import logging
import unicodedata
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_, select, func, and_
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.exceptions import (
    NotFoundException,
    ConflictException,
    ForbiddenException,
    UnprocessableEntityException,
    BadRequestException,
)
from app.models.production_models import (
    EncounterProduction,
    DiagnosisICD10Production,
    EncounterDiagnosisProduction,
    ClinicalVitalProduction,
    PatientAllergyProduction,
    EmrSignedRecordProduction,
    PatientProduction,
    UserProduction,
)
from app.models.appointment import (
    LichKham,
    TrangThaiLichEnum,
    CANCELLED_STATUSES,
    HangDoiKham,
    TrangThaiHangDoiEnum,
    PhanTichAI,
    PhanTichAIGoiY,
    DanhGiaAI,
)
from app.models.medical import (
    LuotKham,
    ChanDoan,
    ChiDinh,
    DichVu,
    KhaiNiem,
    DonThuoc,
    ChiTietDonThuoc,
    BienBanDinhChinh,
    AmendmentStatus,
    LuotKhamTheLuc,
    PhieuKhamChuyenKhoa,
)
from app.models.user import TaiKhoan, BacSi, BenhNhan, VaiTroEnum, ChuyenKhoa
from app.models.specialty_exam import (
    KhamNoiKhoa,
    KhamNgoaiKhoa,
    KhamMat,
    KhamTaiMuiHong,
    KhamRangHamMat,
)
from app.schemas.subclinical import PhysicalExamRequest, PhysicalExamResponse
from app.schemas.compliance import TrangThaiDonThuoc
from app.services.compliance.audit_trail_service import audit_trail_service
from app.services.compliance.prescription_fsm_service import PrescriptionFSMService
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
    PrescriptionItemResponse,
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

logger = logging.getLogger(__name__)

def strip_vietnamese_accents(self, text: str) -> str:
    if not text:
        return ""
    normalized = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in normalized if not unicodedata.combining(c))
    return stripped.replace("đ", "d").replace("Đ", "D").lower().strip()

async def search_icd10(self, query: str, db: AsyncSession) -> List[Icd10SearchItem]:
    q_clean = query.strip()
    q_norm = self.strip_vietnamese_accents(q_clean)

    stmt = select(DiagnosisICD10Production).where(DiagnosisICD10Production.is_active.is_(True))
    records = (await db.execute(stmt)).scalars().all()

    if not records:
        default_seeds = [
            DiagnosisICD10Production(code="J02.9", chapter_code="X", name_vi="Viêm họng cấp, không đặc hiệu", name_en="Acute pharyngitis, unspecified", is_common=True),
            DiagnosisICD10Production(code="I10", chapter_code="IX", name_vi="Bệnh tăng huyết áp vô căn (nguyên phát)", name_en="Essential (primary) hypertension", is_common=True),
            DiagnosisICD10Production(code="E11.9", chapter_code="IV", name_vi="Đái tháo đường típ 2, không biến chứng", name_en="Type 2 diabetes mellitus without complications", is_common=True),
            DiagnosisICD10Production(code="K29.7", chapter_code="XI", name_vi="Viêm dạ dày, không đặc hiệu", name_en="Gastritis, unspecified", is_common=True),
            DiagnosisICD10Production(code="J00", chapter_code="X", name_vi="Viêm mũi họng cấp (cảm thường)", name_en="Acute nasopharyngitis (common cold)", is_common=True),
            DiagnosisICD10Production(code="J20.9", chapter_code="X", name_vi="Viêm phế quản cấp, không đặc hiệu", name_en="Acute bronchitis, unspecified", is_common=True),
            DiagnosisICD10Production(code="A09", chapter_code="I", name_vi="Viêm dạ dày ruột và viêm đại tràng không rõ nguyên nhân", name_en="Infectious gastroenteritis and colitis, unspecified", is_common=True),
            DiagnosisICD10Production(code="M54.5", chapter_code="XIII", name_vi="Đau vùng thắt lưng", name_en="Low back pain", is_common=True),
        ]
        for s in default_seeds:
            db.add(s)
        await db.commit()
        records = default_seeds

    matches = []
    for r in records:
        code_match = q_norm in r.code.lower()
        name_vi_norm = self.strip_vietnamese_accents(r.name_vi)
        name_vi_match = q_norm in name_vi_norm
        name_en_match = q_norm in (r.name_en or "").lower()
        if code_match or name_vi_match or name_en_match:
            matches.append(Icd10SearchItem(
                code=r.code,
                name_vi=r.name_vi,
                name_en=r.name_en,
                chapter=r.chapter_code,
            ))

    if not matches:
        stmt_kn = select(KhaiNiem).where(KhaiNiem.loai_khai_niem == "benh")
        concepts = (await db.execute(stmt_kn)).scalars().all()
        for c in concepts:
            c_norm = self.strip_vietnamese_accents(c.ten_tieng_viet)
            if q_norm in c_norm or (c.ma_khai_niem and q_norm in c.ma_khai_niem.lower()):
                matches.append(Icd10SearchItem(
                    code=c.ma_khai_niem or "R69",
                    name_vi=c.ten_tieng_viet,
                    name_en=c.ten_tieng_anh,
                    chapter="XVIII",
                ))

    return matches[:20]
