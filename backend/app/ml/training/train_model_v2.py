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
print(f"Output directory: {OUTPUT_DIR}")



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


TRAIN_PATH = find_file("training_data_5_specialties_v2.csv", "training_data_5_specialties_v2.csv")
MAPPING_PATH = find_file("disease_specialty_map_v2.csv", "disease_specialty_map_v2.csv")
DICTIONARY_PATH = find_file("feature_dictionary_v2.csv", "feature_dictionary_v2.csv")

print("Training data:", TRAIN_PATH)
print("Disease mapping:", MAPPING_PATH)
print("Feature dictionary:", DICTIONARY_PATH)



df = pd.read_csv(TRAIN_PATH, encoding="utf-8-sig")
disease_map = pd.read_csv(MAPPING_PATH, encoding="utf-8-sig")
feature_dictionary = pd.read_csv(DICTIONARY_PATH, encoding="utf-8-sig")

feature_names = [column for column in df.columns if column != TARGET]

X = df[feature_names].copy()
y = df[TARGET].copy()

print("\nKích thước dữ liệu:", df.shape)
print("Số đặc trưng:", X.shape[1])
print("Số bệnh:", y.nunique())
print("Số mẫu mỗi bệnh:")
print(y.value_counts().describe())



assert TARGET in df.columns, f"Thiếu cột nhãn '{TARGET}' trong dữ liệu"
assert X.shape[1] == EXPECTED_FEATURES, (
    f"Kỳ vọng {EXPECTED_FEATURES} đặc trưng, nhận được {X.shape[1]}"
)
assert y.nunique() == EXPECTED_CLASSES, (
    f"Kỳ vọng {EXPECTED_CLASSES} bệnh, nhận được {y.nunique()}"
)
assert len(disease_map) == EXPECTED_CLASSES, (
    f"Kỳ vọng {EXPECTED_CLASSES} dòng trong disease_map, nhận được {len(disease_map)}"
)
assert df.isna().sum().sum() == 0, "Dữ liệu chứa giá trị rỗng/NaN"
assert df.duplicated().sum() == 0, "Dữ liệu có dòng bị trùng lặp"

non_binary_columns = [
    column
    for column in X.columns
    if not set(X[column].unique()).issubset({0, 1})
]
assert not non_binary_columns, (
    f"Các cột không phải nhị phân (0/1): {non_binary_columns}"
)

mapping_keys = set(disease_map["disease_key"])
missing_mapping = sorted(set(y.unique()) - mapping_keys)
assert not missing_mapping, (
    f"Các bệnh chưa có ánh xạ chuyên khoa: {missing_mapping}"
)

print("\nKiểm tra dữ liệu thành công.")



X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=SEED,
    stratify=y,
)

print(f"\nTrain set: {X_train.shape[0]} mẫu, {X_train.shape[1]} đặc trưng")
print(f"Test set:  {X_test.shape[0]} mẫu, {X_test.shape[1]} đặc trưng")



evaluation_model = RandomForestClassifier(
    n_estimators=600,
    criterion="gini",
    max_features="sqrt",
    min_samples_leaf=1,
    class_weight="balanced_subsample",
    oob_score=True,
    random_state=SEED,
    n_jobs=-1,
)

print("\nĐang train mô hình đánh giá (RandomForest 600 trees)...")
evaluation_model.fit(X_train, y_train)

y_pred = evaluation_model.predict(X_test)

accuracy = accuracy_score(y_test, y_pred)
balanced_accuracy = balanced_accuracy_score(y_test, y_pred)
macro_f1 = f1_score(y_test, y_pred, average="macro")
weighted_f1 = f1_score(y_test, y_pred, average="weighted")

print("\n===== KẾT QUẢ ĐÁNH GIÁ =====")
print(f"Accuracy:          {accuracy:.4f}")
print(f"Balanced accuracy: {balanced_accuracy:.4f}")
print(f"Macro F1:          {macro_f1:.4f}")
print(f"Weighted F1:       {weighted_f1:.4f}")
print(f"OOB score:         {evaluation_model.oob_score_:.4f}")



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

print("\n20 bệnh có F1 thấp nhất trên tập test:")
display(
    report_df
    .drop(index=["accuracy", "macro avg", "weighted avg"], errors="ignore")
    .sort_values("f1-score")
    .head(20)
)



labels = list(evaluation_model.classes_)

cm = confusion_matrix(
    y_test,
    y_pred,
    labels=labels,
)

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

print("\nCác cặp bệnh dễ nhầm nhất:")
display(confusion_df.head(30) if not confusion_df.empty else "Không có mẫu nào bị nhầm lẫn!")



importance_df = pd.DataFrame({
    "feature": feature_names,
    "importance": evaluation_model.feature_importances_,
}).sort_values("importance", ascending=False)

importance_df.to_csv(
    os.path.join(OUTPUT_DIR, "feature_importance_v2.csv"),
    index=False,
    encoding="utf-8-sig",
)

print("\n30 đặc trưng quan trọng nhất:")
display(importance_df.head(30))



final_model = RandomForestClassifier(
    n_estimators=600,
    criterion="gini",
    max_features="sqrt",
    min_samples_leaf=1,
    class_weight="balanced_subsample",
    random_state=SEED,
    n_jobs=-1,
)

print(f"\nĐang train model cuối trên toàn bộ {len(X)} mẫu...")
final_model.fit(X, y)
print("Đã hoàn thành train model cuối.")



metrics = {
    "accuracy": float(accuracy),
    "balanced_accuracy": float(balanced_accuracy),
    "macro_f1": float(macro_f1),
    "weighted_f1": float(weighted_f1),
    "oob_score": float(evaluation_model.oob_score_),
}

bundle = {
    "model": final_model,
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

MODEL_PATH = os.path.join(OUTPUT_DIR, "ai_disease_model_v2.joblib")

joblib.dump(bundle, MODEL_PATH, compress=3)

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



loaded_bundle = joblib.load(MODEL_PATH)

assert loaded_bundle["feature_names"] == feature_names
assert len(loaded_bundle["feature_names"]) == EXPECTED_FEATURES, (
    f"Kỳ vọng {EXPECTED_FEATURES} đặc trưng trong bundle, nhận được {len(loaded_bundle['feature_names'])}"
)
assert loaded_bundle["dataset_classes"] == EXPECTED_CLASSES, (
    f"Kỳ vọng {EXPECTED_CLASSES} lớp bệnh trong bundle, nhận được {loaded_bundle['dataset_classes']}"
)

test_row = X_test.iloc[[0]][feature_names]
test_prediction = loaded_bundle["model"].predict(test_row)[0]

mapping_lookup = disease_map.set_index("disease_key").to_dict("index")

print("\n===== KIỂM TRA MODEL ĐÃ LƯU =====")
print("Dự đoán:", test_prediction)
print("Tên bệnh:", mapping_lookup[test_prediction]["disease_name_vi"])
print("Chuyên khoa:", mapping_lookup[test_prediction]["specialty"])

print("\n===== CÁC FILE ĐÃ TẠO TRONG OUTPUT_DIR =====")
for filename in sorted(os.listdir(OUTPUT_DIR)):
    print(filename)
