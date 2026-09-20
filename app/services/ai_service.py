import re
import unicodedata
import logging
from typing import List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.models.user import ChuyenKhoa, BacSi, NguoiDung, TaiKhoan
from app.models.medical import TuKhoaCapCuu
from app.models.appointment import PhanTichAI
from app.schemas.ai import (
    SymptomTriageRequest, 
    SymptomTriageResponse, 
    SpecialtySuggestion
)
from app.schemas.appointment import DoctorBriefResponse

logger = logging.getLogger("clinic_backend")


class AIService:
    """Tầng Control xử lý Trí tuệ nhân tạo phân tích triệu chứng và Bộ lọc Red Flags y tế (Package C)"""

    def normalize_vietnamese(self, text: str) -> str:
        """Chuẩn hóa chuỗi văn bản tiếng Việt sang dạng Unicode dựng sẵn NFC và chữ thường"""
        if not text:
            return ""
        text = unicodedata.normalize("NFC", text)
        text = text.lower()
        text = re.sub(r"[^\w\s\u00C0-\u024F]", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        return text

    async def scan_red_flags(self, text_normalized: str, db: AsyncSession) -> Tuple[bool, str]:
        """Chốt chặn an toàn số 1: Quét từ điển dấu hiệu cấp cứu nguy hiểm tính mạng"""
        stmt = select(TuKhoaCapCuu).where(TuKhoaCapCuu.is_active.is_(True))
        red_flag_rules = (await db.execute(stmt)).scalars().all()

        for rule in red_flag_rules:
            pattern = self.normalize_vietnamese(rule.tu_khoa)
            if pattern in text_normalized:
                logger.critical(f"🚨 [RED FLAG DETECTED] Bắt trúng từ khóa nguy hiểm: '{rule.tu_khoa}'")
                return True, rule.huong_dan_xu_tri

        # Kiểm tra thêm một số cụm từ cấp cứu kinh điển đề phòng DB chưa seed đủ
        built_in_emergency = [
            "đau ngực dữ dội", "khó thở cấp", "ngất xỉu", "hôn mê", 
            "co giật", "liệt nửa người", "sốt co giật", "nôn ra máu"
        ]
        for emg in built_in_emergency:
            if emg in text_normalized:
                return True, "CẢNH BÁO NGUY CƠ NGUY HIỂM TÍNH MẠNG! Đề nghị liên hệ 115 hoặc đến phòng cấp cứu gần nhất."

        return False, ""

    async def analyze_symptoms(
        self, 
        payload: SymptomTriageRequest, 
        user: TaiKhoan = None, 
        db: AsyncSession = None
    ) -> SymptomTriageResponse:
        """Quy trình 3 chốt chặn suy luận phân loại chuyên khoa và gợi ý bác sĩ"""
        raw_text = payload.trieu_chung
        text_normalized = self.normalize_vietnamese(raw_text)

        # 1. CHỐT CHẶN 1: Quét dấu hiệu cấp cứu Red Flags
        is_emergency, alert_msg = await self.scan_red_flags(text_normalized, db)
        if is_emergency:
            # Ghi vết nhật ký cấp cứu
            log_ai = PhanTichAI(
                trieu_chung_nhap=raw_text,
                co_dau_hieu_cap_cuu=True,
                do_tin_cay=1.0
            )
            db.add(log_ai)
            await db.commit()

            return SymptomTriageResponse(
                has_emergency=True,
                emergency_alert=alert_msg,
                suggested_specialties=[]
            )

        # 2. CHỐT CHẶN 2: Mô hình phân loại triệu chứng dựa trên bảng tri thức y tế
        # (Trong thực tế production gọi model PhoBERT trên server GPU, ở đây implement Engine đối chiếu luật + trọng số NLP)
        knowledge_base = [
            {
                "specialty_name": "Tim mạch",
                "keywords": ["ngực", "tim", "hồi hộp", "đánh trống ngực", "mạch nhanh", "vã mồ hôi"],
                "reason": "Mô tả triệu chứng liên quan đến vùng ngực, tim và huyết động học."
            },
            {
                "specialty_name": "Tiêu hóa",
                "keywords": ["bụng", "dạ dày", "tiêu chảy", "ợ chua", "đầy hơi", "buồn nôn", "thượng vị"],
                "reason": "Các dấu hiệu điển hình của rối loạn đường tiêu hóa và dạ dày - đại tràng."
            },
            {
                "specialty_name": "Tai - Mũi - Họng",
                "keywords": ["chóng mặt", "quay cuồng", "tiền đình", "ù tai", "tai", "mũi", "họng", "nghẹt mũi", "khàn tiếng"],
                "reason": "Triệu chứng tiền đình và hô hấp trên thuộc phạm vi Tai - Mũi - Họng."
            },
            {
                "specialty_name": "Thần kinh",
                "keywords": ["đầu", "đau nửa đầu", "mất ngủ", "tê bì", "giật", "chân tay"],
                "reason": "Dấu hiệu ảnh hưởng tới hệ thần kinh trung ương và ngoại vi."
            },
            {
                "specialty_name": "Hô hấp",
                "keywords": ["ho", "đờm", "phổi", "khò khè", "viêm phế quản"],
                "reason": "Triệu chứng bệnh lý đường hô hấp dưới và phổi."
            },
            {
                "specialty_name": "Da liễu",
                "keywords": ["ngứa", "mẩn đỏ", "dị ứng", "mề đay", "mụn", "bong tróc da"],
                "reason": "Tổn thương bề mặt da và phản ứng quá mẫn dị ứng."
            },
            {
                "specialty_name": "Cơ xương khớp",
                "keywords": ["khớp", "gối", "lưng", "vai gáy", "cột sống", "cứng khớp"],
                "reason": "Bệnh lý hệ vận động và thoái hóa xương khớp."
            }
        ]

        scored_specialties = []
        for kb in knowledge_base:
            match_count = sum(1 for kw in kb["keywords"] if kw in text_normalized)
            if match_count > 0:
                confidence = min(0.60 + (match_count * 0.12), 0.95)
                scored_specialties.append((kb["specialty_name"], confidence, kb["reason"]))

        scored_specialties.sort(key=lambda x: x[1], reverse=True)

        suggestions: List[SpecialtySuggestion] = []
        default_assigned = False

        # 3. CHỐT CHẶN 3: Đánh giá ngưỡng 60% (Confidence Threshold)
        if not scored_specialties or scored_specialties[0][1] < settings.AI_CONFIDENCE_THRESHOLD:
            # Độ tin cậy dưới 60% -> Tự động chuyển về Nội tổng quát để đảm bảo an toàn
            default_assigned = True
            target_specialty_name = "Nội tổng quát"
            confidence = 0.50
            reason = "Mô tả triệu chứng chưa đủ đặc hiệu. Hệ thống khuyến nghị khám Nội tổng quát để sàng lọc bước đầu."
            suggestions.append(
                await self._build_specialty_suggestion(target_specialty_name, confidence, reason, db)
            )
        else:
            # Lấy tối đa 2 chuyên khoa có điểm cao nhất
            for spec_name, conf, reason in scored_specialties[:2]:
                suggestions.append(
                    await self._build_specialty_suggestion(spec_name, conf, reason, db)
                )

        # 4. Ghi nhận vết suy luận vào CSDL
        top_suggestion = suggestions[0]
        log_ai = PhanTichAI(
            trieu_chung_nhap=raw_text,
            chuyen_khoa_goi_y_id=top_suggestion.chuyen_khoa_id,
            do_tin_cay=top_suggestion.do_tin_cay,
            co_dau_hieu_cap_cuu=False
        )
        db.add(log_ai)
        await db.commit()

        return SymptomTriageResponse(
            has_emergency=False,
            emergency_alert=None,
            suggested_specialties=suggestions,
            default_assigned=default_assigned
        )

    async def _build_specialty_suggestion(
        self, 
        specialty_name: str, 
        confidence: float, 
        reason: str, 
        db: AsyncSession
    ) -> SpecialtySuggestion:
        """Helper tìm kiếm chuyên khoa và danh sách bác sĩ tương ứng trong CSDL"""
        stmt_ck = select(ChuyenKhoa).where(ChuyenKhoa.ten_chuyen_khoa.ilike(f"%{specialty_name}%"))
        ck = (await db.execute(stmt_ck)).scalar_one_or_none()

        doctor_briefs = []
        ck_id = 0
        display_name = specialty_name

        if ck:
            ck_id = ck.id
            display_name = ck.ten_chuyen_khoa
            # Lấy các bác sĩ của chuyên khoa
            stmt_bs = (
                select(BacSi, NguoiDung)
                .join(NguoiDung, BacSi.nguoi_dung_id == NguoiDung.id)
                .where(BacSi.chuyen_khoa_id == ck.id)
                .limit(3)
            )
            bs_list = (await db.execute(stmt_bs)).all()
            for bac_si, nguoi_dung in bs_list:
                doctor_briefs.append(
                    DoctorBriefResponse(
                        id=bac_si.id,
                        ho_ten=nguoi_dung.ho_ten,
                        chuyen_khoa=display_name,
                        hoc_vi=bac_si.hoc_vi
                    )
                )

        return SpecialtySuggestion(
            chuyen_khoa_id=ck_id,
            ten_chuyen_khoa=display_name,
            do_tin_cay=confidence,
            ly_do_de_xuat=reason,
            danh_sach_bac_si=doctor_briefs
        )


ai_service = AIService()
