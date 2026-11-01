from __future__ import annotations

import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from app.ml.triage_nlp import detect_red_flags, extract_features

logger = logging.getLogger("clinic_backend")

MODEL_VERSION = "ai-disease-model-v2"
MODEL_DIR = Path(__file__).resolve().parent / "triage_assets"
MODEL_PATH = MODEL_DIR / "ai_disease_model_v2.joblib"


class AITriageModelError(RuntimeError):
    """Raised when the packaged AI model cannot be loaded or evaluated."""


class AITriageModel:
    """Adapter around the standalone TestAI model for backend-safe inference."""

    def __init__(self) -> None:
        if not MODEL_PATH.is_file():
            raise AITriageModelError(f"Không tìm thấy AI model tại {MODEL_PATH}")

        try:
            bundle = joblib.load(MODEL_PATH)
        except Exception as exc:  # pragma: no cover - depends on deployment image
            raise AITriageModelError("Không thể nạp AI model") from exc

        required = {"model", "feature_names", "disease_map"}
        missing = required - set(bundle)
        if missing:
            raise AITriageModelError(f"AI model thiếu thành phần: {sorted(missing)}")

        self.model = bundle["model"]
        self.feature_names = list(bundle["feature_names"])
        if len(self.feature_names) != 450:
            raise AITriageModelError(
                f"AI model phải có 450 đặc trưng, nhận được {len(self.feature_names)}"
            )

        disease_rows = bundle["disease_map"]
        self.disease_lookup = {
            str(row["disease_key"]): row for row in disease_rows
        }
        self.specialties = sorted(
            {str(row["specialty"]) for row in disease_rows if row.get("specialty")}
        )

    def analyze(
        self,
        text: str,
        *,
        age: int | None = None,
        gender: str | None = None,
        structured: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        context = self._structured_context(age, gender)
        context.update({key: value for key, value in (structured or {}).items() if value})
        extraction = extract_features(text, self.feature_names, context)
        vector = extraction["vector"]
        frame = pd.DataFrame(
            [[vector[name] for name in self.feature_names]],
            columns=self.feature_names,
            dtype=np.int8,
        )

        probabilities = self.model.predict_proba(frame)[0].astype(float, copy=True)
        pediatric_features = {
            "age_newborn",
            "age_infant",
            "age_child",
            "age_adolescent",
            "child_patient",
            "newborn_patient",
        }
        has_pediatric_evidence = any(vector.get(name, 0) for name in pediatric_features)

        # Không suy đoán bệnh nhi từ các triệu chứng chung nếu không có bằng chứng tuổi.
        if not has_pediatric_evidence:
            for index, disease_class in enumerate(self.model.classes_):
                info = self.disease_lookup.get(str(disease_class))
                if info and info.get("specialty") == "Nhi":
                    probabilities[index] = 0.0
            total = probabilities.sum()
            if total > 0:
                probabilities /= total

        specialty_scores = {specialty: 0.0 for specialty in self.specialties}
        for index, probability in enumerate(probabilities):
            info = self.disease_lookup.get(str(self.model.classes_[index]))
            if info and info.get("specialty") in specialty_scores:
                specialty_scores[info["specialty"]] += float(probability)

        specialty_predictions = sorted(
            (
                {"specialty": specialty, "probability": probability}
                for specialty, probability in specialty_scores.items()
            ),
            key=lambda item: item["probability"],
            reverse=True,
        )
        disease_predictions = []
        for index in np.argsort(probabilities)[::-1][:5]:
            key = str(self.model.classes_[index])
            info = self.disease_lookup.get(
                key,
                {"disease_name_vi": key, "specialty": "Nội tổng quát"},
            )
            disease_predictions.append(
                {
                    "ma_benh": key,
                    "ten_benh": info["disease_name_vi"],
                    "chuyen_khoa": info["specialty"],
                    "xac_suat": float(probabilities[index]),
                }
            )

        return {
            "specialties": specialty_predictions,
            "diseases": disease_predictions,
            "recognized_symptoms": [
                label
                for _feature, label, method, _score in extraction["detections"]
                if method != "negative"
            ],
            "active_features": extraction["active_features"],
            "clinical_match_count": extraction["clinical_match_count"],
            "model_red_flags": detect_red_flags(text),
            "pediatric_evidence": has_pediatric_evidence,
        }

    @staticmethod
    def _structured_context(age: int | None, gender: str | None) -> dict[str, str]:
        context: dict[str, str] = {}
        if age is not None:
            if age < 1:
                context["age"] = "age_infant"
            elif age < 13:
                context["age"] = "age_child"
            elif age < 18:
                context["age"] = "age_adolescent"
            elif age < 60:
                context["age"] = "age_adult"
            else:
                context["age"] = "age_older_adult"

        normalized_gender = (gender or "").strip().lower()
        if normalized_gender in {"nữ", "nu", "female", "f"}:
            context["sex"] = "sex_female"
        elif normalized_gender in {"nam", "male", "m"}:
            context["sex"] = "sex_male"
        return context


@lru_cache(maxsize=1)
def get_ai_triage_model() -> AITriageModel:
    """Load the 30 MB model once per backend worker."""
    logger.info("Loading packaged AI Triage model: %s", MODEL_VERSION)
    return AITriageModel()
