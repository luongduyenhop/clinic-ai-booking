# AI Triage model assets

Nguồn tích hợp: thư mục `TestAI` của dự án, model v2.1.

- `ai_disease_model_v2.joblib`: RandomForest phân loại 160 bệnh từ 849 đặc trưng.
- `disease_specialty_map_v2.csv`: ánh xạ bệnh sang 5 chuyên khoa
  (Mắt, Nội tổng quát, Ngoại, Răng Hàm Mặt, Tai Mũi Họng).
- `model_metrics_v2.json`: chỉ số đánh giá đi kèm lúc huấn luyện.
- `feature_names_v2.json`: danh sách 849 tên đặc trưng để đối chiếu khi debug.

Bộ dữ liệu và pipeline tái tạo model nằm ở `backend/app/ml/training/`
(xem `training/DATASET_V2_README.md`).

Model được huấn luyện bằng dữ liệu tổng hợp và chỉ hỗ trợ phân luồng ban đầu.
Không dùng kết quả để chẩn đoán, kê thuốc hoặc trì hoãn cấp cứu. Red Flag luôn
được xử lý trước model; kết quả dưới ngưỡng an toàn được chuyển Nội tổng quát.

Ngoài ngưỡng model, backend có tầng định tuyến từ khóa cơ quan rõ ràng
(`route_by_keywords`) chạy sau Red Flag nhưng trước ngưỡng tin cậy: chấn thương
đúng cơ quan → khoa cơ quan; chấn thương chung/bụng cấp → Ngoại; đúng một nhóm
cơ quan → khoa đó; đa cơ quan hoặc phủ định → để model quyết định.

Model 5 chuyên khoa có xác suất nền 20% mỗi khoa, nên ngưỡng định tuyến mặc
định là `AI_CONFIDENCE_THRESHOLD=0.40` (gấp đôi nền ngẫu nhiên).

Runtime phải dùng đúng phiên bản scikit-learn/numpy/pandas/joblib đã ghim trong
`backend/requirements.txt` để bảo đảm tương thích với bundle `joblib`.
