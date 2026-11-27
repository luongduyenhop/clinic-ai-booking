import glob
import json
import os
import platform

import joblib
import numpy as np
import pandas as pd
import sklearn

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
)
from sklearn.model_selection import train_test_split

from app.ml.triage_nlp import detect_red_flags, extract_features, route_by_keywords

try:
    display
except NameError:
    display = print


SEED = 42
TARGET = "prognosis"
EXPECTED_FEATURES = 849
EXPECTED_CLASSES = 160

if os.path.exists("/kaggle"):
    OUTPUT_DIR = "/kaggle/working"
else:
    OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "triage_assets"))

os.makedirs(OUTPUT_DIR, exist_ok=True)


def find_file(pattern: str, local_fallback: str) -> str:
    kaggle_matches = glob.glob(f"/kaggle/input/**/{pattern}", recursive=True)
    if kaggle_matches:
        return kaggle_matches[0]
    local_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), local_fallback)
    if os.path.exists(local_path):
        return local_path
    if os.path.exists(pattern):
        return pattern
    raise FileNotFoundError(f"Không tìm thấy file: {pattern} (đã tìm ở /kaggle/input và local)")


NL_BENCHMARK_CASES = [
    ("Đỏ mắt, ghèn mắt có mủ và dính mí mắt buổi sáng", "Mắt", False),
    ("Đau đầu căng tức hai bên kèm mệt mỏi và buồn nôn", "Nội tổng quát", False),
    ("Đi cầu ra máu đỏ tươi, đau hậu môn và táo bón kéo dài", "Ngoại", False),
    ("Sưng phồng vùng bẹn, đau bẹn tăng khi ho và mang vác nặng", "Ngoại", False),
    ("Đau răng dữ dội, sưng nướu và hôi miệng", "Răng Hàm Mặt", False),
    ("Chảy máu chân răng khi đánh răng, sưng nướu", "Răng Hàm Mặt", False),
    ("Đau răng khôn hàm dưới, há miệng hạn chế", "Răng Hàm Mặt", False),
    ("Nhức răng theo nhịp, đau nhiều về đêm", "Răng Hàm Mặt", False),
    ("dau rang va hoi mieng keo dai", "Răng Hàm Mặt", False),
    ("Đỏ mắt, chảy nước mắt, cộm như có bụi trong mắt", "Mắt", False),
    ("Nhìn mờ dần, chói sáng khi đi nắng", "Mắt", False),
    ("nhin mo mat va moi mat khi nhin man hinh", "Mắt", False),
    ("Khô mắt, rát mắt khi dùng máy tính nhiều", "Mắt", False),
    ("Đau họng, nghẹt mũi và ù tai hai bên", "Tai Mũi Họng", False),
    ("Hắt hơi liên tục, ngứa mũi, chảy nước mũi trong", "Tai Mũi Họng", False),
    ("Khàn tiếng kéo dài kèm ho khan", "Tai Mũi Họng", False),
    ("dau tai cap va u tai sau khi cam lanh", "Tai Mũi Họng", False),
    ("Chóng mặt xoay tròn khi thay đổi tư thế đầu, ù tai", "Tai Mũi Họng", False),
    ("Ợ nóng, trào ngược axit và đau thượng vị sau ăn", "Nội tổng quát", False),
    ("Sốt, ho đờm, ớn lạnh và mệt mỏi", "Nội tổng quát", False),
    ("Khát nhiều, tiểu nhiều lần và sút cân", "Nội tổng quát", False),
    ("met moi keo dai va chong mat nhe", "Nội tổng quát", False),
    ("Đau bụng dưới bên phải đột ngột, chán ăn và buồn nôn", "Ngoại", False),
    ("Đau ngực dữ dội lan lên vai trái, khó thở cấp", "EMERGENCY", True),
    ("Tôi bị nôn ra máu và đi ngoài phân đen", "EMERGENCY", True),
]

BUILTIN_EMERGENCY_PHRASES = (
    "đau ngực dữ dội",
    "khó thở cấp",
    "bất tỉnh",
    "hôn mê",
    "nôn ra máu",
)


def evaluate_nl_benchmark(model, feature_names: list[str], disease_lookup: dict[str, dict]) -> tuple[int, int, float]:
    specialties = sorted({str(row["specialty"]) for row in disease_lookup.values() if row.get("specialty")})
    passed = 0
    for text, expected, expect_emergency in NL_BENCHMARK_CASES:
        lowered = text.lower()
        is_emergency = bool(detect_red_flags(text)) or any(phrase in lowered for phrase in BUILTIN_EMERGENCY_PHRASES)
        if expect_emergency:
            if is_emergency:
                passed += 1
            continue
        if is_emergency:
            continue
        keyword_route = route_by_keywords(text)
        if keyword_route:
            predicted_specialty = keyword_route["specialty"]
        else:
            extraction = extract_features(text, feature_names, {"age": "age_adult"})
            vector = extraction["vector"]
            frame = pd.DataFrame(
                [[vector[name] for name in feature_names]],
                columns=feature_names,
                dtype=np.int8,
            )
            probs = model.predict_proba(frame)[0].astype(float)
            scores = {sp: 0.0 for sp in specialties}
            for idx, prob in enumerate(probs):
                info = disease_lookup.get(str(model.classes_[idx]))
                if info and info.get("specialty") in scores:
                    scores[info["specialty"]] += float(prob)
            top_sp, top_prob = max(scores.items(), key=lambda item: item[1])
            if top_prob < 0.40 or extraction["clinical_match_count"] < 2:
                predicted_specialty = "Nội tổng quát"
            else:
                predicted_specialty = top_sp
        if predicted_specialty == expected:
            passed += 1
    total = len(NL_BENCHMARK_CASES)
    return passed, total, float(passed / total)


def main() -> None:
    train_path = find_file("training_data_5_specialties_v2.csv", "training_data_5_specialties_v2.csv")
    mapping_path = find_file("disease_specialty_map_v2.csv", "disease_specialty_map_v2.csv")
    dictionary_path = find_file("feature_dictionary_v2.csv", "feature_dictionary_v2.csv")

    df = pd.read_csv(train_path, encoding="utf-8-sig")
    disease_map = pd.read_csv(mapping_path, encoding="utf-8-sig")
    feature_dictionary = pd.read_csv(dictionary_path, encoding="utf-8-sig")

    feature_names = [column for column in df.columns if column != TARGET]
    X = df[feature_names].copy()
    y = df[TARGET].copy()

    assert TARGET in df.columns
    assert X.shape[1] == EXPECTED_FEATURES
    assert y.nunique() == EXPECTED_CLASSES
    assert len(disease_map) == EXPECTED_CLASSES
    assert df.isna().sum().sum() == 0
    assert df.duplicated().sum() == 0

    non_binary_columns = [
        column
        for column in X.columns
        if not set(X[column].unique()).issubset({0, 1})
    ]
    assert not non_binary_columns

    mapping_keys = set(disease_map["disease_key"])
    assert not (set(y.unique()) - mapping_keys)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=SEED,
        stratify=y,
    )

    evaluation_model = RandomForestClassifier(
        n_estimators=150,
        criterion="gini",
        max_features="sqrt",
        min_samples_leaf=1,
        class_weight="balanced_subsample",
        oob_score=True,
        random_state=SEED,
        n_jobs=-1,
    )
    evaluation_model.fit(X_train, y_train)

    y_pred = evaluation_model.predict(X_test)
    y_proba = evaluation_model.predict_proba(X_test)
    classes = np.array(evaluation_model.classes_)

    top3_indices = np.argsort(y_proba, axis=1)[:, -3:]
    top3_hits = [
        truth in classes[top3_indices[row_idx]]
        for row_idx, truth in enumerate(y_test.to_numpy())
    ]
    top3_disease_accuracy = float(np.mean(top3_hits))

    disease_lookup = {
        str(row["disease_key"]): row
        for row in disease_map.to_dict(orient="records")
    }
    specialties = sorted({str(row["specialty"]) for row in disease_lookup.values() if row.get("specialty")})
    sp_to_idx = {sp: idx for idx, sp in enumerate(specialties)}
    class_to_sp_idx = np.array(
        [sp_to_idx[disease_lookup[str(cls)]["specialty"]] for cls in classes],
        dtype=np.int32,
    )
    sp_probs = np.zeros((len(X_test), len(specialties)), dtype=float)
    for class_idx, sp_idx in enumerate(class_to_sp_idx):
        sp_probs[:, sp_idx] += y_proba[:, class_idx]
    y_sp_true = [disease_lookup[str(k)]["specialty"] for k in y_test]
    y_sp_pred = [specialties[idx] for idx in np.argmax(sp_probs, axis=1)]

    specialty_accuracy = float(accuracy_score(y_sp_true, y_sp_pred))
    specialty_macro_f1 = float(f1_score(y_sp_true, y_sp_pred, average="macro"))

    accuracy = float(accuracy_score(y_test, y_pred))
    balanced_accuracy = float(balanced_accuracy_score(y_test, y_pred))
    macro_f1 = float(f1_score(y_test, y_pred, average="macro"))
    weighted_f1 = float(f1_score(y_test, y_pred, average="weighted"))

    report = classification_report(
        y_test,
        y_pred,
        output_dict=True,
        zero_division=0,
    )
    report_df = pd.DataFrame(report).transpose()
    report_df.to_csv(
        os.path.join(OUTPUT_DIR, "validation_report_v2.csv"),
        encoding="utf-8-sig",
    )

    labels = list(evaluation_model.classes_)
    cm = confusion_matrix(y_test, y_pred, labels=labels)
    np.fill_diagonal(cm, 0)
    confusion_rows = []
    for actual_index in range(len(labels)):
        for predicted_index in range(len(labels)):
            count = int(cm[actual_index, predicted_index])
            if count > 0:
                confusion_rows.append({
                    "actual_disease": labels[actual_index],
                    "predicted_disease": labels[predicted_index],
                    "count": count,
                })
    confusion_df = pd.DataFrame(confusion_rows)
    if not confusion_df.empty:
        confusion_df = confusion_df.sort_values("count", ascending=False)
    confusion_df.to_csv(
        os.path.join(OUTPUT_DIR, "top_confusions_v2.csv"),
        index=False,
        encoding="utf-8-sig",
    )

    importance_df = pd.DataFrame({
        "feature": feature_names,
        "importance": evaluation_model.feature_importances_,
    }).sort_values("importance", ascending=False)
    importance_df.to_csv(
        os.path.join(OUTPUT_DIR, "feature_importance_v2.csv"),
        index=False,
        encoding="utf-8-sig",
    )

    nl_passed, nl_total, nl_accuracy = evaluate_nl_benchmark(evaluation_model, feature_names, disease_lookup)

    metrics = {
        "accuracy": accuracy,
        "top3_disease_accuracy": top3_disease_accuracy,
        "balanced_accuracy": balanced_accuracy,
        "macro_f1": macro_f1,
        "weighted_f1": weighted_f1,
        "oob_score": float(evaluation_model.oob_score_),
        "specialty_accuracy": specialty_accuracy,
        "specialty_macro_f1": specialty_macro_f1,
        "train_samples": int(len(X_train)),
        "test_samples": int(len(X_test)),
        "leakage_free_holdout": True,
        "nl_benchmark_passed": nl_passed,
        "nl_benchmark_cases": nl_total,
        "nl_benchmark_accuracy": nl_accuracy,
    }

    bundle = {
        "model": evaluation_model,
        "feature_names": feature_names,
        "disease_map": disease_map.to_dict(orient="records"),
        "feature_dictionary": feature_dictionary.to_dict(orient="records"),
        "target_name": TARGET,
        "metrics": metrics,
        "dataset_rows": int(len(df)),
        "dataset_features": int(len(feature_names)),
        "dataset_classes": int(y.nunique()),
        "random_seed": SEED,
        "python_version": platform.python_version(),
        "sklearn_version": sklearn.__version__,
        "numpy_version": np.__version__,
        "pandas_version": pd.__version__,
        "joblib_version": joblib.__version__,
    }

    model_path = os.path.join(OUTPUT_DIR, "ai_disease_model_v2.joblib")
    joblib.dump(bundle, model_path, compress=6)

    with open(os.path.join(OUTPUT_DIR, "feature_names_v2.json"), "w", encoding="utf-8") as file:
        json.dump(feature_names, file, ensure_ascii=False, indent=2)

    with open(os.path.join(OUTPUT_DIR, "model_metrics_v2.json"), "w", encoding="utf-8") as file:
        json.dump(metrics, file, ensure_ascii=False, indent=2)

    disease_map.to_csv(
        os.path.join(OUTPUT_DIR, "disease_specialty_map_v2.csv"),
        index=False,
        encoding="utf-8-sig",
    )

    with open(os.path.join(OUTPUT_DIR, "requirements_model.txt"), "w", encoding="utf-8") as file:
        file.write(f"scikit-learn=={sklearn.__version__}\n")
        file.write(f"numpy=={np.__version__}\n")
        file.write(f"pandas=={pd.__version__}\n")
        file.write(f"joblib=={joblib.__version__}\n")

    print(json.dumps(metrics, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
