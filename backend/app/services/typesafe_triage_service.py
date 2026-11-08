import os
import re
import json
import unicodedata
from typing import Any, Callable, Dict, List, Optional
import httpx
from pydantic import BaseModel, Field

class TriageChoiceResult(BaseModel):
    choice: str
    confidence: float
    probabilities: Dict[str, float]
    muc_do_uu_tien: int
    loai_hang_doi: str
    co_dau_hieu_cap_cuu: bool
    source: str
    reason: str

class ClsNoulResult(BaseModel):
    is_appropriate: bool
    noul_probability: float
    risk_level: str
    warnings: List[str]
    source: str
    reason: str

class ClsReturnScoreResult(BaseModel):
    urgency_score: int
    raw_score_level: int
    confidence: float
    muc_do_uu_tien: int
    queue_note: str
    source: str
    reason: str

EMERGENCY_KEYWORDS = [
    "dau nguc du doi",
    "kho tho cap",
    "kho tho du doi",
    "hon me",
    "ngat xiu",
    "bat tinh",
    "co giat",
    "liet nua nguoi",
    "non ra mau",
    "xuat huyet o at",
    "tut huyet ap",
    "soc phan ve",
    "ngung tim",
    "ngung tho"
]

PRIORITY_KEYWORDS = [
    "sot cao",
    "co giat do sot",
    "dau bung du doi",
    "dau du doi",
    "kho tho nhe",
    "phu phoi",
    "tram cam nang"
]

CRITICAL_CLS_KEYWORDS = [
    "nguy hiem",
    "nguy kich",
    "xuat huyet nao",
    "nhoi mau co tim",
    "troponin",
    "tran khi mang phoi",
    "vo tang",
    "giam tieu cau nang",
    "toan chuyen hoa nang"
]

def normalize_vietnamese_text(text: str) -> str:
    if not text:
        return ""
    normalized = unicodedata.normalize("NFD", text.lower())
    without_marks = "".join(char for char in normalized if unicodedata.category(char) != "Mn")
    cleaned = without_marks.replace("đ", "d").replace("Đ", "D")
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", " ", cleaned)).strip()

class TypeSafeTriageService:
    def __init__(
        self,
        endpoint_url: Optional[str] = None,
        api_key: Optional[str] = None,
        timeout_seconds: float = 2.0,
        jev_caller: Optional[Callable[..., Any]] = None
    ):
        self.endpoint_url = endpoint_url or os.getenv("TYPESAFE_ENDPOINT_URL", "https://api.typesafe.ai/v1/judge")
        self.api_key = api_key or os.getenv("TYPESAFE_API_KEY", "")
        self.timeout_seconds = timeout_seconds
        self.jev_caller = jev_caller

    async def _call_upstream_jev(
        self,
        primitive_type: str,
        instructions: str,
        state: str,
        criteria: Optional[Any] = None,
        options: Optional[List[str]] = None
    ) -> Optional[Dict[str, Any]]:
        if self.jev_caller is not None:
            try:
                result = self.jev_caller(
                    primitive_type=primitive_type,
                    instructions=instructions,
                    state=state,
                    criteria=criteria,
                    options=options
                )
                if hasattr(result, "__await__"):
                    result = await result
                return result
            except Exception:
                return None

        if not self.endpoint_url:
            return None

        payload: Dict[str, Any] = {
            "type": primitive_type,
            "instructions": instructions,
            "state": state,
            "model": "jev-1.13-free"
        }
        if criteria is not None:
            payload["criteria"] = criteria
        if options is not None:
            payload["options"] = options

        headers = {
            "Content-Type": "application/json"
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        try:
            async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                response = await client.post(self.endpoint_url, json=payload, headers=headers)
                if response.status_code == 200:
                    body = response.json()
                    answers = body.get("answers", {})
                    if "judgment" in answers:
                        return answers["judgment"]
                    return body
        except Exception:
            return None
        return None

    def _deterministic_reception_triage(
        self,
        symptoms: str,
        vital_signs: Optional[Dict[str, Any]] = None,
        demographics: Optional[Dict[str, Any]] = None,
        has_appointment: bool = False
    ) -> TriageChoiceResult:
        normalized_symptoms = normalize_vietnamese_text(symptoms)
        vitals = vital_signs or {}
        demo = demographics or {}

        systolic = vitals.get("systolic_bp") or vitals.get("huyet_ap_tam_thu")
        spo2 = vitals.get("spo2")
        heart_rate = vitals.get("heart_rate") or vitals.get("nhip_tim")
        temperature = vitals.get("temperature") or vitals.get("nhiet_do")

        is_emergency = False
        emergency_reason = ""

        if systolic is not None:
            if systolic < 90 or systolic >= 180:
                is_emergency = True
                emergency_reason = f"Huyết áp nguy kịch ({systolic} mmHg)"
        if spo2 is not None and spo2 < 92:
            is_emergency = True
            emergency_reason = f"Độ bão hòa oxy SpO2 nguy kịch ({spo2}%)"
        if heart_rate is not None and (heart_rate > 130 or heart_rate < 45):
            is_emergency = True
            emergency_reason = f"Tần số tim bất thường nguy cấp ({heart_rate} bpm)"

        if not is_emergency:
            for kw in EMERGENCY_KEYWORDS:
                if kw in normalized_symptoms:
                    is_emergency = True
                    emergency_reason = f"Phát hiện triệu chứng cấp cứu ({kw})"
                    break

        if is_emergency:
            return TriageChoiceResult(
                choice="Emergency",
                confidence=0.98,
                probabilities={"Emergency": 0.98, "Priority": 0.02, "Standard": 0.0, "Walk-in": 0.0},
                muc_do_uu_tien=1,
                loai_hang_doi="cap_cuu",
                co_dau_hieu_cap_cuu=True,
                source="deterministic_fallback",
                reason=emergency_reason or "Phát hiện dấu hiệu cấp cứu tức thời"
            )

        is_priority = False
        priority_reason = ""

        age = demo.get("age") or demo.get("tuoi")
        if age is not None:
            if age >= 80:
                is_priority = True
                priority_reason = f"Người cao tuổi ưu tiên ({age} tuổi)"
            elif age <= 1:
                is_priority = True
                priority_reason = f"Trẻ sơ sinh ưu tiên ({age} tuổi)"

        if demo.get("is_pregnant") or demo.get("mang_thai"):
            is_priority = True
            priority_reason = "Phụ nữ mang thai thuộc nhóm ưu tiên"

        if temperature is not None and temperature >= 39.0:
            is_priority = True
            priority_reason = f"Sốt cao ({temperature}°C)"

        pain_level = vitals.get("pain_score") or vitals.get("muc_do_dau")
        if pain_level is not None and pain_level >= 7:
            is_priority = True
            priority_reason = f"Thang điểm đau mức độ nặng ({pain_level}/10)"

        if not is_priority:
            for pkw in PRIORITY_KEYWORDS:
                if pkw in normalized_symptoms:
                    is_priority = True
                    priority_reason = f"Phát hiện triệu chứng ưu tiên khám sớm ({pkw})"
                    break

        if is_priority:
            return TriageChoiceResult(
                choice="Priority",
                confidence=0.92,
                probabilities={"Emergency": 0.02, "Priority": 0.92, "Standard": 0.05, "Walk-in": 0.01},
                muc_do_uu_tien=2,
                loai_hang_doi="uu_tien",
                co_dau_hieu_cap_cuu=False,
                source="deterministic_fallback",
                reason=priority_reason or "Thuộc nhóm bệnh nhân ưu tiên"
            )

        if has_appointment:
            return TriageChoiceResult(
                choice="Standard",
                confidence=0.95,
                probabilities={"Emergency": 0.0, "Priority": 0.05, "Standard": 0.95, "Walk-in": 0.0},
                muc_do_uu_tien=5,
                loai_hang_doi="dung_hen",
                co_dau_hieu_cap_cuu=False,
                source="deterministic_fallback",
                reason="Lượt khám đúng hẹn chuẩn"
            )

        return TriageChoiceResult(
            choice="Walk-in",
            confidence=0.90,
            probabilities={"Emergency": 0.0, "Priority": 0.05, "Standard": 0.05, "Walk-in": 0.90},
            muc_do_uu_tien=7,
            loai_hang_doi="vang_lai",
            co_dau_hieu_cap_cuu=False,
            source="deterministic_fallback",
            reason="Bệnh nhân vãng lai không đặt hẹn"
        )

    async def classify_reception_triage(
        self,
        symptoms: str,
        vital_signs: Optional[Dict[str, Any]] = None,
        demographics: Optional[Dict[str, Any]] = None,
        has_appointment: bool = False
    ) -> TriageChoiceResult:
        state_payload = {
            "symptoms": symptoms,
            "vital_signs": vital_signs or {},
            "demographics": demographics or {},
            "has_appointment": has_appointment
        }
        instructions = "Phân loại tiếp đón bệnh nhân theo các mức độ ưu tiên: Emergency, Priority, Standard, Walk-in."
        options = ["Emergency", "Priority", "Standard", "Walk-in"]
        criteria = {
            "Emergency": "Dấu hiệu nguy kịch, đe dọa tính mạng hoặc cần cấp cứu tức thời: khó thở cấp, đau thắt ngực dữ dội, hôn mê, co giật, tụt huyết áp, sốc, xuất huyết ồ ạt",
            "Priority": "Bệnh nhân có triệu chứng cần ưu tiên khám sớm hoặc thuộc diện ưu tiên (người già >=80, trẻ sơ sinh, thai phụ, sốt cao, đau nhiều nhưng sinh hiệu ổn định)",
            "Standard": "Bệnh nhân đã đặt hẹn trước, triệu chứng thông thường, sinh hiệu ổn định",
            "Walk-in": "Bệnh nhân vãng lai chưa đặt hẹn trước, triệu chứng nhẹ hoặc tái khám định kỳ, sinh hiệu ổn định"
        }

        judgment = await self._call_upstream_jev(
            primitive_type="choice",
            instructions=instructions,
            state=json.dumps(state_payload, ensure_ascii=False),
            criteria=criteria,
            options=options
        )

        if not judgment or not isinstance(judgment, dict):
            return self._deterministic_reception_triage(
                symptoms=symptoms,
                vital_signs=vital_signs,
                demographics=demographics,
                has_appointment=has_appointment
            )

        choice = str(judgment.get("choice", "")).strip()
        confidence = float(judgment.get("confidence", 0.85))
        probabilities = judgment.get("probabilities", {})

        if choice == "Emergency":
            return TriageChoiceResult(
                choice="Emergency",
                confidence=confidence,
                probabilities=probabilities,
                muc_do_uu_tien=1,
                loai_hang_doi="cap_cuu",
                co_dau_hieu_cap_cuu=True,
                source="typesafe_jev",
                reason="TypeSafe Choice phán quyết ca cấp cứu khẩn cấp"
            )
        elif choice == "Priority":
            return TriageChoiceResult(
                choice="Priority",
                confidence=confidence,
                probabilities=probabilities,
                muc_do_uu_tien=2,
                loai_hang_doi="uu_tien",
                co_dau_hieu_cap_cuu=False,
                source="typesafe_jev",
                reason="TypeSafe Choice phán quyết ca ưu tiên khám sớm"
            )
        elif choice == "Standard":
            return TriageChoiceResult(
                choice="Standard",
                confidence=confidence,
                probabilities=probabilities,
                muc_do_uu_tien=5,
                loai_hang_doi="dung_hen",
                co_dau_hieu_cap_cuu=False,
                source="typesafe_jev",
                reason="TypeSafe Choice phán quyết luồng khám đúng hẹn"
            )
        elif choice == "Walk-in":
            return TriageChoiceResult(
                choice="Walk-in",
                confidence=confidence,
                probabilities=probabilities,
                muc_do_uu_tien=7,
                loai_hang_doi="vang_lai",
                co_dau_hieu_cap_cuu=False,
                source="typesafe_jev",
                reason="TypeSafe Choice phán quyết luồng khám vãng lai"
            )

        return self._deterministic_reception_triage(
            symptoms=symptoms,
            vital_signs=vital_signs,
            demographics=demographics,
            has_appointment=has_appointment
        )

    def _deterministic_cls_guardrails(
        self,
        service_name: str,
        service_group: str,
        clinical_diagnosis: str,
        symptoms: str,
        allergies: Optional[List[str]] = None,
        contraindications: Optional[List[str]] = None,
        patient_conditions: Optional[Dict[str, Any]] = None
    ) -> ClsNoulResult:
        normalized_service = normalize_vietnamese_text(service_name)
        normalized_group = normalize_vietnamese_text(service_group)
        conditions = patient_conditions or {}
        allergy_text = " ".join([normalize_vietnamese_text(a) for a in (allergies or [])])
        contra_text = " ".join([normalize_vietnamese_text(c) for c in (contraindications or [])])

        warnings: List[str] = []
        is_appropriate = True
        noul_prob = 0.95
        risk_level = "LOW"

        is_contrast_procedure = any(token in normalized_service for token in ["can quang", "thuoc can quang", "contrast"])
        has_contrast_allergy = any(token in allergy_text for token in ["can quang", "i ot", "iodine", "contrast"]) or any(token in contra_text for token in ["can quang", "i ot", "iodine"])
        egfr = conditions.get("egfr")
        has_severe_renal_failure = (egfr is not None and egfr < 30) or any(token in contra_text for token in ["suy than nang", "suy than do 4", "suy than do 5"])

        if is_contrast_procedure and (has_contrast_allergy or has_severe_renal_failure):
            is_appropriate = False
            noul_prob = 0.04
            risk_level = "CRITICAL"
            reason_part = "tiền sử dị ứng thuốc cản quang" if has_contrast_allergy else f"suy thận nặng (eGFR {egfr})"
            warnings.append(f"Chống chỉ định tuyệt đối: Bệnh nhân có {reason_part}")

        is_radiation_procedure = any(token in normalized_service for token in ["ct", "x quang", "cat lop vi tinh"]) or normalized_group in ["chuan doan hinh anh", "cdha"]
        is_pelvis_abdomen = any(token in normalized_service for token in ["bung", "chau", "that lung", "tieu khung"])
        is_pregnant = conditions.get("is_pregnant") or conditions.get("mang_thai") or any(token in contra_text for token in ["mang thai", "co thai"])

        if is_radiation_procedure and is_pelvis_abdomen and is_pregnant:
            is_appropriate = False
            noul_prob = 0.08
            risk_level = "CRITICAL"
            warnings.append("Chống chỉ định xạ chiếu ion hóa liều cao vùng bụng chậu trên phụ nữ có thai")

        is_mri = any(token in normalized_service for token in ["mri", "cong huong tu"])
        has_pacemaker = conditions.get("has_pacemaker") or any(token in contra_text for token in ["may tao nhip", "pacemaker", "di vat kim loai"])

        if is_mri and has_pacemaker:
            is_appropriate = False
            noul_prob = 0.02
            risk_level = "CRITICAL"
            warnings.append("Chống chỉ định tuyệt đối chụp MRI trên bệnh nhân có máy tạo nhịp tim hoặc dị vật từ tính")

        if is_appropriate and not warnings:
            return ClsNoulResult(
                is_appropriate=True,
                noul_probability=noul_prob,
                risk_level=risk_level,
                warnings=[],
                source="deterministic_fallback",
                reason="Chỉ định cận lâm sàng phù hợp, không phát hiện chống chỉ định y khoa"
            )

        return ClsNoulResult(
            is_appropriate=is_appropriate,
            noul_probability=noul_prob,
            risk_level=risk_level,
            warnings=warnings,
            source="deterministic_fallback",
            reason="; ".join(warnings)
        )

    async def verify_cls_appropriateness(
        self,
        service_name: str,
        service_group: str,
        clinical_diagnosis: str,
        symptoms: str,
        allergies: Optional[List[str]] = None,
        contraindications: Optional[List[str]] = None,
        patient_conditions: Optional[Dict[str, Any]] = None
    ) -> ClsNoulResult:
        state_payload = {
            "service_name": service_name,
            "service_group": service_group,
            "clinical_diagnosis": clinical_diagnosis,
            "symptoms": symptoms,
            "allergies": allergies or [],
            "contraindications": contraindications or [],
            "patient_conditions": patient_conditions or {}
        }
        instructions = "Chỉ định cận lâm sàng này có an toàn và phù hợp với chẩn đoán, tiền sử dị ứng và chống chỉ định của bệnh nhân không?"

        judgment = await self._call_upstream_jev(
            primitive_type="noul",
            instructions=instructions,
            state=json.dumps(state_payload, ensure_ascii=False)
        )

        if not judgment or not isinstance(judgment, dict) or "noul" not in judgment:
            return self._deterministic_cls_guardrails(
                service_name=service_name,
                service_group=service_group,
                clinical_diagnosis=clinical_diagnosis,
                symptoms=symptoms,
                allergies=allergies,
                contraindications=contraindications,
                patient_conditions=patient_conditions
            )

        noul_prob = float(judgment.get("noul", 0.5))
        if noul_prob >= 0.70:
            return ClsNoulResult(
                is_appropriate=True,
                noul_probability=noul_prob,
                risk_level="LOW",
                warnings=[],
                source="typesafe_jev",
                reason="TypeSafe Noul xác nhận chỉ định cận lâm sàng an toàn và phù hợp"
            )
        elif noul_prob >= 0.40:
            return ClsNoulResult(
                is_appropriate=True,
                noul_probability=noul_prob,
                risk_level="MODERATE",
                warnings=["Cần lưu ý thận trọng các yếu tố nguy cơ cận lâm sàng trước khi thực hiện"],
                source="typesafe_jev",
                reason="TypeSafe Noul cảnh báo mức độ thận trọng trung bình"
            )
        else:
            return ClsNoulResult(
                is_appropriate=False,
                noul_probability=noul_prob,
                risk_level="CRITICAL",
                warnings=["Phát hiện nguy cơ chống chỉ định hoặc không phù hợp lâm sàng nghiêm trọng"],
                source="typesafe_jev",
                reason="TypeSafe Noul vi phạm rào chắn an toàn chỉ định cận lâm sàng"
            )

    def _deterministic_cls_return_score(
        self,
        service_name: str,
        service_group: str,
        result_summary: str,
        result_classification: Optional[str] = None,
        result_details: Optional[Dict[str, Any]] = None,
        wait_time_minutes: int = 0
    ) -> ClsReturnScoreResult:
        normalized_text = normalize_vietnamese_text(f"{service_name} {result_summary}")
        classification = (result_classification or "").upper()

        is_critical = False
        critical_term = ""

        if classification in ["NGUY_HIEM", "CRITICAL"]:
            is_critical = True
            critical_term = "phân loại kết quả nguy hiểm"
        else:
            for ckw in CRITICAL_CLS_KEYWORDS:
                if ckw in normalized_text:
                    is_critical = True
                    critical_term = ckw
                    break

        if is_critical:
            return ClsReturnScoreResult(
                urgency_score=95,
                raw_score_level=3,
                confidence=0.99,
                muc_do_uu_tien=1,
                queue_note=f"[KHẨN CẤP] Trả KQ CLS nguy kịch ({critical_term})",
                source="deterministic_fallback",
                reason="Phát hiện kết quả cận lâm sàng đe dọa tính mạng cần bác sĩ xử trí khẩn cấp"
            )

        is_abnormal = classification in ["BAT_THUONG", "ABNORMAL"] or "bat thuong" in normalized_text
        if is_abnormal:
            return ClsReturnScoreResult(
                urgency_score=70,
                raw_score_level=2,
                confidence=0.90,
                muc_do_uu_tien=2,
                queue_note="[ƯU TIÊN] Trả KQ CLS bất thường cần đánh giá sớm",
                source="deterministic_fallback",
                reason="Kết quả cận lâm sàng có trị số bất thường đáng kể"
            )

        base_score = 20
        wait_bonus = min(25, max(0, wait_time_minutes) // 5)
        calculated_score = base_score + wait_bonus

        return ClsReturnScoreResult(
            urgency_score=calculated_score,
            raw_score_level=0,
            confidence=0.85,
            muc_do_uu_tien=3,
            queue_note="Đã có KQ Cận lâm sàng",
            source="deterministic_fallback",
            reason="Kết quả cận lâm sàng hoàn toàn bình thường, duy trì thứ tự tái khám"
        )

    async def score_cls_return_priority(
        self,
        service_name: str,
        service_group: str,
        result_summary: str,
        result_classification: Optional[str] = None,
        result_details: Optional[Dict[str, Any]] = None,
        wait_time_minutes: int = 0
    ) -> ClsReturnScoreResult:
        state_payload = {
            "service_name": service_name,
            "service_group": service_group,
            "result_summary": result_summary,
            "result_classification": result_classification,
            "result_details": result_details or {},
            "wait_time_minutes": wait_time_minutes
        }
        instructions = "Đánh giá mức độ khẩn cấp lâm sàng của kết quả cận lâm sàng theo thang điểm từ 0 đến 3 để điều phối hàng đợi tái khám."
        criteria = [
            "Chỉ số bình thường, không có nguy cơ y khoa tức thời",
            "Bất thường nhẹ, bệnh nhân ổn định",
            "Bất thường đáng kể cần bác sĩ đánh giá sớm",
            "Giá trị nguy kịch đe dọa tính mạng cần can thiệp cấp cứu ngay"
        ]

        judgment = await self._call_upstream_jev(
            primitive_type="score",
            instructions=instructions,
            state=json.dumps(state_payload, ensure_ascii=False),
            criteria=criteria
        )

        if not judgment or not isinstance(judgment, dict) or "score" not in judgment:
            return self._deterministic_cls_return_score(
                service_name=service_name,
                service_group=service_group,
                result_summary=result_summary,
                result_classification=result_classification,
                result_details=result_details,
                wait_time_minutes=wait_time_minutes
            )

        score_level = int(judgment.get("score", 0))
        confidence = float(judgment.get("confidence", 0.90))

        if score_level >= 3:
            return ClsReturnScoreResult(
                urgency_score=95,
                raw_score_level=score_level,
                confidence=confidence,
                muc_do_uu_tien=1,
                queue_note="[KHẨN CẤP] TypeSafe Score phán quyết KQ CLS nguy kịch",
                source="typesafe_jev",
                reason="Phát hiện kết quả cận lâm sàng mức nguy kịch cấp 3"
            )
        elif score_level == 2:
            return ClsReturnScoreResult(
                urgency_score=75,
                raw_score_level=score_level,
                confidence=confidence,
                muc_do_uu_tien=2,
                queue_note="[ƯU TIÊN] TypeSafe Score phán quyết KQ CLS bất thường đáng kể",
                source="typesafe_jev",
                reason="Phát hiện kết quả cận lâm sàng bất thường cần đánh giá sớm cấp 2"
            )
        elif score_level == 1:
            return ClsReturnScoreResult(
                urgency_score=45,
                raw_score_level=score_level,
                confidence=confidence,
                muc_do_uu_tien=3,
                queue_note="[THEO DÕI] TypeSafe Score phán quyết KQ CLS bất thường nhẹ",
                source="typesafe_jev",
                reason="Kết quả cận lâm sàng bất thường nhẹ cấp 1"
            )
        else:
            base_score = 20
            wait_bonus = min(20, max(0, wait_time_minutes) // 5)
            return ClsReturnScoreResult(
                urgency_score=base_score + wait_bonus,
                raw_score_level=0,
                confidence=confidence,
                muc_do_uu_tien=3,
                queue_note="Đã có KQ Cận lâm sàng",
                source="typesafe_jev",
                reason="Kết quả cận lâm sàng hoàn toàn bình thường cấp 0"
            )

typesafe_triage_service = TypeSafeTriageService()
