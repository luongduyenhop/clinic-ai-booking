from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from app.ml.triage_nlp import detect_red_flags, extract_features, route_by_keywords

logger = logging.getLogger("clinic_backend")

MODEL_VERSION = "ai-disease-model-v2.1-849f"
MODEL_DIR = Path(__file__).resolve().parent / "triage_assets"
MODEL_PATH = MODEL_DIR / "ai_disease_model_v2.joblib"


class AITriageModelError(RuntimeError):
    pass


class AITriageModel:

    def __init__(self) -> None:
        if not MODEL_PATH.is_file():
            raise AITriageModelError(f"Không tìm thấy AI model tại {MODEL_PATH}")

        try:
            bundle = joblib.load(MODEL_PATH)
        except Exception as exc:
            raise AITriageModelError("Không thể nạp AI model") from exc

        required = {"model", "feature_names", "disease_map"}
        missing = required - set(bundle)
        if missing:
            raise AITriageModelError(f"AI model thiếu thành phần: {sorted(missing)}")

        self.model = bundle["model"]
        self.feature_names = list(bundle["feature_names"])
        expected_features = getattr(self.model, "n_features_in_", len(self.feature_names))
        if not self.feature_names or len(self.feature_names) != int(expected_features):
            raise AITriageModelError(
                "AI model không nhất quán: "
                f"{len(self.feature_names)} tên đặc trưng nhưng model cần {expected_features}"
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

        specialty_scores = {specialty: 0.0 for specialty in self.specialties}
        disease_by_specialty: dict[str, list[dict[str, Any]]] = {}
        for index, probability in enumerate(probabilities):
            key = str(self.model.classes_[index])
            info = self.disease_lookup.get(key)
            if info and info.get("specialty") in specialty_scores:
                specialty = info["specialty"]
                specialty_scores[specialty] += float(probability)
                disease_by_specialty.setdefault(specialty, []).append(
                    {
                        "ma_benh": key,
                        "ten_benh": info["disease_name_vi"],
                        "chuyen_khoa": specialty,
                        "xac_suat": float(probability),
                    }
                )

        disease_by_specialty = {
            specialty: sorted(
                items, key=lambda item: item["xac_suat"], reverse=True
            )[:3]
            for specialty, items in disease_by_specialty.items()
        }

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
            "disease_by_specialty": disease_by_specialty,
            "keyword_route": route_by_keywords(text),
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


_model_instance: AITriageModel | None = None
_model_lock = threading.Lock()


def get_ai_triage_model() -> AITriageModel:
    global _model_instance
    if _model_instance is not None:
        return _model_instance
    with _model_lock:
        if _model_instance is None:
            logger.info("Loading packaged AI Triage model: %s", MODEL_VERSION)
            _model_instance = AITriageModel()
    return _model_instance
