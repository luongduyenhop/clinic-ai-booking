import re
import unicodedata
import logging
from functools import lru_cache
from typing import List, Optional, Tuple, Union
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from app.core.config import settings
from app.models.user import ChuyenKhoa, BacSi, BenhNhan, NguoiDung, TaiKhoan, VaiTroEnum
from app.models.medical import TuKhoaCapCuu
from app.models.appointment import PhanTichAI
from app.schemas.ai import (
    SymptomTriageRequest, 
    SymptomTriageResponse, 
    SpecialtySuggestion
)
from app.schemas.appointment import DoctorBriefResponse

logger = logging.getLogger("clinic_backend")

# Cụm từ cấp cứu kinh điển đề phòng DB chưa seed đủ
BUILT_IN_EMERGENCY = [
    "đau ngực dữ dội", "khó thở cấp", "ngất xỉu", "hôn mê",
    "co giật", "liệt nửa người", "sốt co giật", "nôn ra máu"
]


def _normalize_vietnamese(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFC", text)
    text = text.lower()
    text = re.sub(r"[^\w\s\u00C0-\u024F]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _remove_diacritics(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text)
    without_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return without_marks.replace("đ", "d").replace("Đ", "D")


@lru_cache(maxsize=1024)
def _keyword_tokens(keyword: str) -> Tuple[Tuple[str, str], ...]:
    """Tách từ khóa thành từng tiếng kèm dạng bỏ dấu; cache vì từ khóa lặp lại ở mọi request"""
    return tuple((word, _remove_diacritics(word)) for word in _normalize_vietnamese(keyword).split())


NEGATION_WORDS_SINGLE = {"không", "khong", "chưa", "chua", "chẳng", "chang", "hết", "het", "đỡ", "do"}
NEGATION_PAIRS = {
    ("không", "bị"), ("khong", "bi"),
    ("không", "có"), ("khong", "co"),
    ("không", "còn"), ("khong", "con"),
    ("chưa", "từng"), ("chua", "tung")
}
ADVERSATIVE_CONJUNCTIONS = {"nhưng", "nhung", "mà", "ma", "chứ", "chu", "song"}
NEGATION_TRIGGERS = {"không", "khong", "chưa", "chua", "chẳng", "chang", "hết", "het", "đỡ", "do"}


class AIService:
    """Tầng Control xử lý Trí tuệ nhân tạo phân tích triệu chứng và Bộ lọc Red Flags y tế (Package C)"""

    def normalize_vietnamese(self, text: str) -> str:
        """Chuẩn hóa chuỗi văn bản tiếng Việt sang dạng Unicode dựng sẵn NFC và chữ thường"""
        return _normalize_vietnamese(text)

    def remove_diacritics(self, text: str) -> str:
        """Bỏ dấu tiếng Việt ('đau ngực' -> 'dau nguc') để nhận diện cả khi người bệnh gõ không dấu"""
        return _remove_diacritics(text)

    def tokenize(self, text_normalized: str) -> List[Tuple[str, str]]:
        """Tách văn bản đã chuẩn hóa thành từng tiếng kèm dạng bỏ dấu; làm 1 lần mỗi request rồi dùng cho cả 2 chốt chặn"""
        return [(word, _remove_diacritics(word)) for word in text_normalized.split()]

    def contains_phrase(self, tokens: Union[str, List[Tuple[str, str]]], keyword: str, check_negation: bool = False) -> bool:
        """So khớp cụm từ theo nguyên tiếng (hỗ trợ cả str lẫn danh sách tokens).
        Nếu check_negation=True: Bỏ qua các lần xuất hiện bị phủ định ('không khó thở', 'chưa từng co giật').
        Chỉ trả về True nếu có ít nhất 1 lần xuất hiện mang tính khẳng định."""
        if isinstance(tokens, str):
            tokens = self.tokenize(tokens)

        phrase = _keyword_tokens(keyword)
        if not phrase or len(phrase) > len(tokens):
            return False

        for start in range(len(tokens) - len(phrase) + 1):
            if all(
                word == kw or (word == plain and plain == kw_plain)
                for (word, plain), (kw, kw_plain) in zip(tokens[start:start + len(phrase)], phrase)
            ):
                if check_negation:
                    # Thuật toán cửa sổ quét ngược NegEx (Lookback window tối đa 3 từ)
                    is_neg = False
                    for offset in range(1, min(start + 1, 4)):
                        w, p = tokens[start - offset]
                        if w in ADVERSATIVE_CONJUNCTIONS or p in ADVERSATIVE_CONJUNCTIONS:
                            # Gặp liên từ đối lập ("nhưng đau ngực") -> ngắt phạm vi phủ định của vế trước
                            break
                        if w in NEGATION_TRIGGERS or p in NEGATION_TRIGGERS:
                            is_neg = True
                            break

                    if not is_neg:
                        return True  # Tìm thấy ít nhất 1 lần xuất hiện khẳng định
                else:
                    return True
        return False

    def contains_red_flag(self, text_normalized: str, keyword: str) -> bool:
        """Kiểm tra 1 cụm từ cấp cứu trong văn bản đã chuẩn hóa (có kiểm tra phủ định)"""
        return self.contains_phrase(self.tokenize(text_normalized), keyword, check_negation=True)

    async def scan_red_flags(
        self, tokens: List[Tuple[str, str]], db: AsyncSession
    ) -> Tuple[bool, str, Optional[str]]:
        """Chốt chặn an toàn số 1: Quét từ điển dấu hiệu cấp cứu nguy hiểm tính mạng (có Negation Handling).
        Trả về (có cấp cứu, hướng dẫn xử trí kèm căn cứ BYT, từ khóa đã bắt trúng) để ghi vết phục vụ hậu kiểm"""
        stmt = select(TuKhoaCapCuu).where(TuKhoaCapCuu.is_active.is_(True))
        red_flag_rules = (await db.execute(stmt)).scalars().all()

        for rule in red_flag_rules:
            if self.contains_phrase(tokens, rule.tu_khoa, check_negation=True):
                ref_suffix = f" [Căn cứ y khoa: {rule.van_ban_byt_ref}]" if rule.van_ban_byt_ref else ""
                alert_text = f"{rule.huong_dan_xu_tri}{ref_suffix}"
                logger.critical(f"🚨 [RED FLAG DETECTED] Bắt trúng từ khóa nguy hiểm: '{rule.tu_khoa}' | Căn cứ: {rule.van_ban_byt_ref}")
                return True, alert_text, rule.tu_khoa

        # Kiểm tra thêm một số cụm từ cấp cứu kinh điển đề phòng DB chưa seed đủ
        for emg in BUILT_IN_EMERGENCY:
            if self.contains_phrase(tokens, emg, check_negation=True):
                logger.critical(f"🚨 [RED FLAG DETECTED] Bắt trúng từ khóa nguy hiểm (built-in): '{emg}'")
                return True, "CẢNH BÁO NGUY CƠ NGUY HIỂM TÍNH MẠNG! Đề nghị liên hệ 115 hoặc đến phòng cấp cứu gần nhất. [Tham chiếu Hướng dẫn cấp cứu BYT]", emg

        return False, "", None

    async def _get_patient_id(self, user: Optional[TaiKhoan], db: AsyncSession) -> Optional[int]:
        """Mã hồ sơ bệnh nhân của người gọi để gắn vào nhật ký suy luận; khách vãng lai/bác sĩ/admin -> None"""
        if not user or user.vai_tro != VaiTroEnum.BENH_NHAN.value:
            return None
        stmt = select(BenhNhan.id).where(BenhNhan.nguoi_dung_id == user.nguoi_dung_id)
        return (await db.execute(stmt)).scalar_one_or_none()

    async def analyze_symptoms(
        self, 
        payload: SymptomTriageRequest, 
        user: Optional[TaiKhoan] = None,
        db: AsyncSession = None
    ) -> SymptomTriageResponse:
        """Quy trình 3 chốt chặn suy luận phân loại chuyên khoa và gợi ý bác sĩ"""
        raw_text = payload.trieu_chung
        # Chuẩn hóa + tách tiếng 1 lần, dùng chung cho chốt chặn 1 và 2 (cùng nhận diện được văn bản gõ không dấu)
        tokens = self.tokenize(self.normalize_vietnamese(raw_text))
        benh_nhan_id = await self._get_patient_id(user, db)

        # 1. CHỐT CHẶN 1: Quét dấu hiệu cấp cứu Red Flags
        is_emergency, alert_msg, tu_khoa = await self.scan_red_flags(tokens, db)
        if is_emergency:
            # Ghi vết nhật ký cấp cứu kèm từ khóa đã bắt trúng để hậu kiểm báo động
            log_ai = PhanTichAI(
                benh_nhan_id=benh_nhan_id,
                trieu_chung_nhap=raw_text,
                co_dau_hieu_cap_cuu=True,
                tu_khoa_cap_cuu_phat_hien=tu_khoa[:100],
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
            match_count = sum(1 for kw in kb["keywords"] if self.contains_phrase(tokens, kw))
            if match_count > 0:
                confidence = min(0.60 + (match_count * 0.12), 0.95)
                scored_specialties.append((kb["specialty_name"], confidence, kb["reason"]))

        scored_specialties.sort(key=lambda x: x[1], reverse=True)

        suggestions: List[SpecialtySuggestion] = []
        default_assigned = False

        # 3. CHỐT CHẶN 3: Đánh giá 3 tầng ngưỡng tin cậy (Tham chiếu Infermedica Confidence Tiers)
        if not scored_specialties or scored_specialties[0][1] < settings.AI_CONFIDENCE_THRESHOLD:
            # Tầng 3 (< 60%): Không đủ độ tin cậy đặc hiệu -> Fallback về Nội tổng quát để đảm bảo an toàn
            default_assigned = True
            target_specialty_name = "Nội tổng quát"
            confidence = 0.50
            reason = "Mô tả triệu chứng chưa đủ đặc hiệu hoặc độ tin cậy < 60%. Hệ thống khuyến nghị khám Nội tổng quát để sàng lọc bước đầu."
            suggestions.append(
                await self._build_specialty_suggestion(target_specialty_name, confidence, reason, db, muc_do="thap")
            )
        else:
            # Lấy tối đa 2 chuyên khoa có điểm cao nhất
            for spec_name, conf, reason in scored_specialties[:2]:
                if conf >= 0.75:
                    muc_do = "cao"
                    full_reason = f"[Độ tin cậy cao >= 75%] {reason}"
                else:
                    muc_do = "trung_binh"
                    full_reason = f"[Gợi ý tham khảo 60-74%] {reason} (Khuyến nghị bác sĩ khám lâm sàng xác nhận)"
                suggestions.append(
                    await self._build_specialty_suggestion(spec_name, conf, full_reason, db, muc_do=muc_do)
                )

        # 4. Ghi nhận vết suy luận vào CSDL
        top_suggestion = suggestions[0]
        log_ai = PhanTichAI(
            benh_nhan_id=benh_nhan_id,
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
        db: AsyncSession,
        muc_do: Optional[str] = None
    ) -> SpecialtySuggestion:
        """Helper tìm kiếm chuyên khoa và danh sách bác sĩ tương ứng trong CSDL"""
        # Nhiều khoa có thể cùng chứa tên gợi ý ('Tim mạch', 'Tim mạch nhi'): ưu tiên khớp đúng tên, sau đó tên ngắn nhất
        stmt_ck = (
            select(ChuyenKhoa)
            .where(ChuyenKhoa.ten_chuyen_khoa.ilike(f"%{specialty_name}%"), ChuyenKhoa.is_active.is_(True))
            .order_by(
                (func.lower(ChuyenKhoa.ten_chuyen_khoa) == specialty_name.lower()).desc(),
                func.length(ChuyenKhoa.ten_chuyen_khoa),
                ChuyenKhoa.id
            )
            .limit(1)
        )
        ck = (await db.execute(stmt_ck)).scalars().first()

        doctor_briefs = []
        # None (không phải 0) khi khoa gợi ý chưa có trong CSDL (chưa seed/đổi tên): 0 là ID không tồn tại,
        # vừa gây lỗi khóa ngoại khi ghi nhật ký vừa khiến frontend lọc/đặt lịch theo khoa ma
        ck_id = None
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
            muc_do_tin_cay=muc_do,
            ly_do_de_xuat=reason,
            danh_sach_bac_si=doctor_briefs
        )


ai_service = AIService()
