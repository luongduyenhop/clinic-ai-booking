# PJ2026-144: tích hợp TestAI v2.1

API chính: `POST /api/v1/ai/analyze-symptoms`.

Ví dụ request:

```json
{"trieu_chung":"Đau răng dữ dội, sưng nướu và hôi miệng","tuoi":30,"gioi_tinh":"nam"}
```

Endpoint tương thích tiếp đón: `POST /api/v1/ai-triage/analyze`, nhận
`symptoms` hoặc `trieu_chung`. Response dùng envelope chung của hệ thống.

Luồng xử lý:

1. Quét Red Flag từ CSDL và bộ quy tắc bổ sung, hỗ trợ không dấu/phủ định.
2. Nếu có Red Flag: trả cảnh báo 115, không trả khoa/bác sĩ khám thường.
3. Định tuyến từ khóa cơ quan rõ ràng (`route_by_keywords`) đứng trước ngưỡng
   model:
   - chấn thương đúng cơ quan (mắt/răng/tai-mũi-họng) → khoa cơ quan;
   - chấn thương chung hoặc bụng cấp (`cứng bụng`, `hố chậu phải`) → Ngoại;
   - đúng một nhóm từ khóa cơ quan → khoa đó;
   - nhiều nhóm cơ quan, phủ định hoặc câu không liên quan → bỏ qua, để model
     quyết định.
4. NLP trích xuất vector 849 đặc trưng, RandomForest tính xác suất 160 bệnh.
   Alias dài được ưu tiên theo vùng văn bản, nên "nôn ra máu" chỉ bật
   `vomiting_blood` thay vì thêm cả `vomiting`. Kiểm tra thanh điệu tránh nhầm
   "mặt"/"mắt", "mất"/"mắt".
5. Cộng xác suất các bệnh cùng khoa để tính điểm khoa trong 5 chuyên khoa
   (Mắt, Nội tổng quát, Ngoại, Răng Hàm Mặt, Tai Mũi Họng).
6. Khi không có từ khóa, khoa đứng đầu phải đạt ngưỡng
   `AI_CONFIDENCE_THRESHOLD` (mặc định 40%, gấp đôi xác suất nền 20% của 5
   khoa) và có ít nhất hai dấu hiệu lâm sàng nhận diện. Nếu không, trả Nội
   tổng quát với `default_assigned` và `needs_more_information`, kèm lời nhắc
   bổ sung mô tả.
7. Với ca định tuyến theo từ khóa, chỉ trả `disease_predictions` thuộc đúng
   khoa đó. Chấn thương chung không gợi ý tên bệnh Ngoại không liên quan vì
   dataset chưa có nhóm bệnh chấn thương/chỉnh hình.
8. Tra danh mục khoa/bác sĩ thật và ghi nhật ký `phan_tich_ai`, liên kết đúng
   bệnh nhân đăng nhập; khách có thể sử dụng mà không gắn hồ sơ.

Response bổ sung `recognized_symptoms`, `disease_predictions`, `model_version`.
Các điểm model là xác suất thống kê từ dữ liệu tổng hợp, chưa được hiệu chỉnh
trên bệnh nhân thật. Cần thẩm định lâm sàng trước khi sử dụng thực tế.

Model và NLP được đóng gói trong `app/ml/`, không cần đường dẫn TestAI bên ngoài.
Bundle joblib chỉ được nạp từ file tin cậy trong repository, không nhận upload
model từ người dùng. Suy luận chạy qua thread pool; model được cache theo worker.

Cài dependency bằng `python -m pip install -r requirements.txt`, hoặc rebuild
Docker để cài đúng scikit-learn 1.6.1 và các dependency đã ghim.

Kiểm thử:

```text
python -m pytest -q tests/test_ai_model_integration.py tests/test_ai_red_flags.py tests/test_ai_byt_benchmarks.py
```
