# Dataset v2 & pipeline huấn luyện AI Triage (849 đặc trưng / 160 bệnh / 5 chuyên khoa)

Thư mục này chứa bộ dữ liệu và mã nguồn tái tạo model đang được backend nạp từ
`backend/app/ml/triage_assets/ai_disease_model_v2.joblib`.

> Dữ liệu là **tổng hợp (synthetic)** cho mục đích học tập/prototype.
> Mọi hồ sơ bệnh lý cần bác sĩ chuyên khoa rà soát trước khi dùng thật.

## Quy mô

- **160 bệnh lý**: cân bằng 32 bệnh cho mỗi chuyên khoa.
- **16.000 dòng mẫu**: 100 mẫu tổng hợp cho từng bệnh.
- **849 đặc trưng nhị phân**:
  - 731 triệu chứng và dấu hiệu lâm sàng (`clinical_symptom_or_sign`)
  - 24 dấu hiệu thăm khám thực thể (`exam`)
  - 23 dấu hiệu phủ định rõ ràng (`negative`, tiền tố `neg_*`)
  - 23 yếu tố nguy cơ (`risk`, tiền tố `risk_*`)
  - 22 dấu hiệu cảnh báo khẩn cấp (`red_flag`, tiền tố `red_*`)
  - 8 đặc trưng thời gian diễn tiến (`duration`)
  - 7 đặc trưng nhân khẩu học & nhóm tuổi (`demographic`)
  - 6 kiểu khởi phát (`onset`)
  - 5 mức độ nghiêm trọng (`severity`)

Năm chuyên khoa: **Mắt**, **Nội tổng quát**, **Ngoại**, **Răng Hàm Mặt**,
**Tai Mũi Họng**.

## File trong thư mục

| File | Vai trò |
| --- | --- |
| `training_data_5_specialties_v2.csv` | 849 cột đặc trưng nhị phân + cột nhãn `prognosis` (160 lớp). |
| `disease_specialty_map_v2.csv` | Ánh xạ `disease_key` → `disease_name_vi` + `specialty`. |
| `feature_dictionary_v2.csv` | Nhóm và ý nghĩa của từng đặc trưng. |
| `generate_dataset_v2.py` | Tái tạo dataset với seed cố định `20261024`. |
| `train_model_v2.py` | Huấn luyện RandomForest 600 cây và xuất bundle model. |
| `check_nlp_regression.py` | Bộ kiểm tra hồi quy NLP + định tuyến từ khóa. |

## Huấn luyện

Chạy từ thư mục `backend/` với virtualenv của backend:

```powershell
cd backend
.\.venv\Scripts\python.exe app\ml\training\train_model_v2.py
```

Mặc định script ghi kết quả vào `backend/app/ml/triage_assets/` để backend dùng
ngay. Trên Kaggle, script tự ghi vào `/kaggle/working` và đọc dữ liệu từ
`/kaggle/input`.

Script kiểm tra trước khi train:

- đúng 849 đặc trưng và 160 lớp bệnh;
- không có NaN, không có dòng trùng lặp;
- mọi giá trị đặc trưng là 0/1;
- mọi nhãn `prognosis` đều có trong `disease_specialty_map_v2.csv`.

Sau khi train, script ghi:

- `ai_disease_model_v2.joblib` (bundle model + feature names + disease map);
- `feature_names_v2.json`, `model_metrics_v2.json`;
- `disease_specialty_map_v2.csv`;
- `validation_report_v2.csv`, `top_confusions_v2.csv`, `feature_importance_v2.csv`;
- `requirements_model.txt`.

Model dùng `RandomForestClassifier(n_estimators=600, class_weight="balanced_subsample", random_state=42)`.

## Kiểm tra hồi quy NLP

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.ml.training.check_nlp_regression --strict
```

Bộ kiểm tra chạy mọi alias trong `FEATURE_ALIASES` cộng với các ca thực tế:
câu tự nhiên, không dấu, lỗi gõ, phủ định, tuổi, thời gian, mức độ, yếu tố
nguy cơ, câu dễ nhầm và cảnh báo cấp cứu. Phần định tuyến từ khóa chạy riêng
và khóa hành vi ưu tiên:

1. Chấn thương đúng cơ quan → khoa cơ quan (mắt/răng/tai-mũi-họng).
2. Chấn thương chung hoặc bụng cấp → Ngoại.
3. Đúng một nhóm từ khóa cơ quan → khoa đó.
4. Nhiều cơ quan hoặc không có từ khóa → để model quyết định.

Phủ định theo mệnh đề được xử lý (`không đau răng`, `không đau họng, chỉ đau răng`).

## Quy ước dữ liệu thiếu và phủ định

Trong cột triệu chứng thông thường, `0` nghĩa là **không được ghi nhận** (chưa
hỏi hoặc chưa ghi vào hồ sơ), không đồng nghĩa bệnh nhân chắc chắn không có
triệu chứng đó. Triệu chứng đã hỏi và ghi nhận âm tính được lưu ở cột `neg_*`
riêng (ví dụ `neg_no_fever=1`).
