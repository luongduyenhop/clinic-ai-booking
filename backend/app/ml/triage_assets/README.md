# AI Triage model assets

Nguồn tích hợp: thư mục `TestAI` của dự án, model v2.

- `ai_disease_model_v2.joblib`: RandomForest phân loại 100 bệnh từ 450 đặc trưng.
- `disease_specialty_map_v2.csv`: ánh xạ bệnh sang 5 chuyên khoa.
- `model_metrics_v2.json`: chỉ số đánh giá đi kèm lúc huấn luyện.

Model được huấn luyện bằng dữ liệu tổng hợp và chỉ hỗ trợ phân luồng ban đầu.
Không dùng kết quả để chẩn đoán, kê thuốc hoặc trì hoãn cấp cứu. Red Flag luôn
được xử lý trước model; kết quả dưới ngưỡng an toàn được chuyển Nội tổng quát.

Runtime phải dùng đúng phiên bản scikit-learn/numpy/pandas/joblib đã ghim trong
`backend/requirements.txt` để bảo đảm tương thích với bundle `joblib`.
