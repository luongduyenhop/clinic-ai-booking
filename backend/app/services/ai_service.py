import re
import unicodedata
import logging
from functools import lru_cache
from typing import List, Optional, Tuple, Union
from starlette.concurrency import run_in_threadpool
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from app.core.config import settings
from app.models.user import ChuyenKhoa, BacSi, BenhNhan, NguoiDung, TaiKhoan, VaiTroEnum
from app.models.medical import TuKhoaCapCuu
from app.models.appointment import PhanTichAI, PhanTichAIGoiY
from app.schemas.ai import (
    SymptomTriageRequest, 
    SymptomTriageResponse, 
    SpecialtySuggestion
)
from app.schemas.appointment import DoctorBriefResponse
from app.ml.triage_model import (
    AITriageModelError,
    MODEL_VERSION,
    get_ai_triage_model,
)
from app.ml.triage_nlp import (
    detect_red_flags as detect_model_red_flags,
    route_by_keywords,
)

logger = logging.getLogger("clinic_backend")

KEYWORD_ROUTE_CONFIDENCE = {
    "organ_trauma": 0.95,
    "trauma_or_acute_abdomen": 0.90,
    "organ_keyword": 0.85,
}

ACUTE_ABDOMEN_TERMS = ("bụng", "hố chậu")

SPECIALTY_ALIASES = {
    "Răng Hàm Mặt": "Răng",
}

BUILT_IN_EMERGENCY = [
    "đau ngực dữ dội", "khó thở cấp", "ngất xỉu", "hôn mê",
    "co giật", "liệt nửa người", "sốt co giật", "nôn ra máu",
    "bất tỉnh", "không đánh thức được"
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


def _keyword_route_reason(route: dict, confidence: float) -> str:
    keywords = ", ".join(route["keywords"][:4])
    if route["rule"] == "trauma_or_acute_abdomen":
        has_abdominal_sign = any(
            term in " ".join(route["keywords"]).lower() for term in ACUTE_ABDOMEN_TERMS
        )
        if has_abdominal_sign:
            focus = f"dấu hiệu bụng cấp ({keywords})"
        else:
            focus = f"dấu hiệu chấn thương ({keywords})"
        return (
            f"[Định tuyến theo từ khóa: {confidence:.0%}] Phát hiện {focus}. "
            "Chuyển khoa Ngoại để bác sĩ đánh giá trực tiếp; không phải chẩn đoán."
        )
    return (
        f"[Định tuyến theo từ khóa: {confidence:.0%}] Phát hiện triệu chứng "
        f"định hướng rõ tới {route['specialty']} ({keywords}). "
        "Cần bác sĩ khám lâm sàng xác nhận; không phải chẩn đoán."
    )


class AIService:

    def normalize_vietnamese(self, text: str) -> str:
        return _normalize_vietnamese(text)

    def remove_diacritics(self, text: str) -> str:
        return _remove_diacritics(text)

    def tokenize(self, text_normalized: str) -> List[Tuple[str, str]]:
        return [(word, _remove_diacritics(word)) for word in text_normalized.split()]

    def contains_phrase(self, tokens: Union[str, List[Tuple[str, str]]], keyword: str, check_negation: bool = False) -> bool:
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
                    is_neg = False
                    for offset in range(1, min(start + 1, 4)):
                        w, p = tokens[start - offset]
                        if w in ADVERSATIVE_CONJUNCTIONS or p in ADVERSATIVE_CONJUNCTIONS:
                            break
                        if w in NEGATION_TRIGGERS or p in NEGATION_TRIGGERS:
                            is_neg = True
                            break

                    if not is_neg:
                        return True
                else:
                    return True
        return False

    def contains_red_flag(self, text_normalized: str, keyword: str) -> bool:
        return self.contains_phrase(self.tokenize(text_normalized), keyword, check_negation=True)

    async def scan_red_flags(
        self, tokens: List[Tuple[str, str]], db: AsyncSession
    ) -> Tuple[bool, str, Optional[str]]:
        stmt = select(TuKhoaCapCuu).where(TuKhoaCapCuu.is_active.is_(True))
        red_flag_rules = (await db.execute(stmt)).scalars().all()

        for rule in red_flag_rules:
            if self.contains_phrase(tokens, rule.tu_khoa, check_negation=True):
                ref_suffix = f" [Căn cứ y khoa: {rule.van_ban_byt_ref}]" if rule.van_ban_byt_ref else ""
                alert_text = f"{rule.huong_dan_xu_tri}{ref_suffix}"
                logger.critical(f"🚨 [RED FLAG DETECTED] Bắt trúng từ khóa nguy hiểm: '{rule.tu_khoa}' | Căn cứ: {rule.van_ban_byt_ref}")
                return True, alert_text, rule.tu_khoa

        for emg in BUILT_IN_EMERGENCY:
            if self.contains_phrase(tokens, emg, check_negation=True):
                logger.critical(f"🚨 [RED FLAG DETECTED] Bắt trúng từ khóa nguy hiểm (built-in): '{emg}'")
                return True, "CẢNH BÁO NGUY CƠ NGUY HIỂM TÍNH MẠNG! Đề nghị liên hệ 115 hoặc đến phòng cấp cứu gần nhất. [Tham chiếu Hướng dẫn cấp cứu BYT]", emg

        return False, "", None

    async def _get_patient_id(self, user: Optional[TaiKhoan], db: AsyncSession) -> Optional[int]:
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
        raw_text = payload.trieu_chung
        tokens = self.tokenize(self.normalize_vietnamese(raw_text))
        benh_nhan_id = await self._get_patient_id(user, db)

        is_emergency, alert_msg, tu_khoa = await self.scan_red_flags(tokens, db)
        model_red_flags = detect_model_red_flags(raw_text)
        if not is_emergency and model_red_flags:
            is_emergency = True
            tu_khoa = model_red_flags[0]
            alert_msg = (
                "CẢNH BÁO DẤU HIỆU NGUY CẤP: "
                f"{', '.join(model_red_flags)}. Gọi ngay 115 hoặc đến cơ sở cấp cứu "
                "gần nhất; không chờ kết quả phân loại chuyên khoa."
            )
        if is_emergency:
            log_ai = PhanTichAI(
                benh_nhan_id=benh_nhan_id,
                trieu_chung_nhap=raw_text,
                co_dau_hieu_cap_cuu=True,
                tu_khoa_cap_cuu_phat_hien=tu_khoa[:100],
                do_tin_cay=1.0
            )
            db.add(log_ai)
            await db.flush()
            await db.commit()

            return SymptomTriageResponse(
                has_emergency=True,
                emergency_alert=alert_msg,
                suggested_specialties=[],
                recognized_symptoms=[],
                disease_predictions=[],
                model_version=MODEL_VERSION,
                phan_tich_ai_id=log_ai.id,
            )

        model_failed = False
        try:
            def infer():
                return get_ai_triage_model().analyze(
                    raw_text, age=payload.tuoi, gender=payload.gioi_tinh,
                    structured=payload.structured.model_dump(exclude_none=True) if payload.structured else None,
                )

            model_result = await run_in_threadpool(infer)
        except (AITriageModelError, ValueError, OSError) as exc:
            logger.exception("AI Triage model unavailable: %s", exc)
            model_failed = True
            model_result = {
                "specialties": [],
                "diseases": [],
                "recognized_symptoms": [],
                "clinical_match_count": 0,
            }

        scored_specialties = model_result["specialties"]
        disease_predictions = model_result["diseases"]
        disease_by_specialty = model_result.get("disease_by_specialty") or {}
        recognized_symptoms = list(dict.fromkeys(model_result["recognized_symptoms"]))
        keyword_route = route_by_keywords(raw_text)
        suggestions: List[SpecialtySuggestion] = []
        default_assigned = False
        needs_more_information = False

        top_confidence = scored_specialties[0]["probability"] if scored_specialties else 0.0
        insufficient_evidence = model_result["clinical_match_count"] < 2
        below_threshold = (
            model_failed
            or top_confidence < settings.AI_CONFIDENCE_THRESHOLD
            or insufficient_evidence
        )

        if keyword_route:
            specialty_name = SPECIALTY_ALIASES.get(
                keyword_route["specialty"], keyword_route["specialty"]
            )
            confidence = KEYWORD_ROUTE_CONFIDENCE.get(keyword_route["rule"], 0.80)
            muc_do = "cao" if confidence >= 0.75 else "trung_binh"
            suggestions.append(
                await self._build_specialty_suggestion(
                    specialty_name,
                    confidence,
                    _keyword_route_reason(keyword_route, confidence),
                    db,
                    muc_do=muc_do,
                )
            )
            keywords_text = " ".join(keyword_route["keywords"]).lower()
            pure_trauma = keyword_route["rule"] == "trauma_or_acute_abdomen" and not any(
                term in keywords_text for term in ACUTE_ABDOMEN_TERMS
            )
            scoped_diseases = disease_by_specialty.get(
                keyword_route["specialty"], []
            )
            if pure_trauma:
                disease_predictions = []
            elif scoped_diseases:
                disease_predictions = scoped_diseases
        elif below_threshold:
            default_assigned = True
            needs_more_information = True
            confidence = top_confidence
            if model_failed:
                reason = (
                    "Model AI hiện không sẵn sàng. Hệ thống chuyển Nội tổng quát "
                    "để tiếp nhận an toàn; nhân viên y tế cần đánh giá trực tiếp."
                )
            else:
                reason = (
                    f"Độ tin cậy chuyên khoa cao nhất là {top_confidence:.0%} hoặc mô tả "
                    "chưa có đủ 2 dấu hiệu đặc hiệu. Vui lòng bổ sung vị trí, thời gian, "
                    "mức độ và dấu hiệu đi kèm; tạm thời tiếp nhận tại Nội tổng quát."
                )
            suggestions.append(
                await self._build_specialty_suggestion(
                    "Nội tổng quát", confidence, reason, db, muc_do="thap"
                )
            )
        else:
            top_diseases = disease_predictions[:3]
            disease_context = ", ".join(
                f"{item['ten_benh']} ({item['xac_suat']:.0%})" for item in top_diseases
            )
            for index, item in enumerate(scored_specialties[:2]):
                spec_name = SPECIALTY_ALIASES.get(item["specialty"], item["specialty"])
                conf = item["probability"]
                if index > 0 and conf < 0.20:
                    continue
                if conf >= 0.75:
                    muc_do = "cao"
                    tier = "Độ tin cậy cao"
                else:
                    muc_do = "trung_binh"
                    tier = "Gợi ý tham khảo"
                full_reason = (
                    f"[{tier}: {conf:.0%}] Model nhận diện: "
                    f"{', '.join(recognized_symptoms[:6])}. Các khả năng nổi bật: "
                    f"{disease_context}. Cần bác sĩ khám lâm sàng xác nhận."
                )
                suggestions.append(
                    await self._build_specialty_suggestion(spec_name, conf, full_reason, db, muc_do=muc_do)
                )

        top_suggestion = suggestions[0]
        log_ai = PhanTichAI(
            benh_nhan_id=benh_nhan_id,
            trieu_chung_nhap=raw_text,
            chuyen_khoa_goi_y_id=top_suggestion.chuyen_khoa_id,
            do_tin_cay=top_suggestion.do_tin_cay,
            co_dau_hieu_cap_cuu=False
        )
        db.add(log_ai)
        await db.flush()
        for index, suggestion in enumerate(suggestions, start=1):
            if suggestion.chuyen_khoa_id is None:
                continue
            db.add(
                PhanTichAIGoiY(
                    phan_tich_ai_id=log_ai.id,
                    chuyen_khoa_id=suggestion.chuyen_khoa_id,
                    thu_tu_uu_tien=index,
                    do_tin_cay=suggestion.do_tin_cay,
                    ly_do_goi_y=suggestion.ly_do_de_xuat,
                )
            )
        await db.commit()

        return SymptomTriageResponse(
            has_emergency=False,
            emergency_alert=None,
            suggested_specialties=suggestions,
            default_assigned=default_assigned,
            needs_more_information=needs_more_information,
            recognized_symptoms=recognized_symptoms,
            disease_predictions=disease_predictions,
            model_version=MODEL_VERSION,
            phan_tich_ai_id=log_ai.id,
        )

    async def _build_specialty_suggestion(
        self, 
        specialty_name: str, 
        confidence: float, 
        reason: str, 
        db: AsyncSession,
        muc_do: Optional[str] = None
    ) -> SpecialtySuggestion:
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
        ck_id = None
        display_name = specialty_name

        if ck:
            ck_id = ck.id
            display_name = ck.ten_chuyen_khoa
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
