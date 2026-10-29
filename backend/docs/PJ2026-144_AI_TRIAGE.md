# PJ2026-144: tích hợp TestAI v2

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
3. NLP trích xuất vector 450 đặc trưng, RandomForest tính xác suất 100 bệnh.
4. Cộng xác suất các bệnh cùng khoa để tính điểm khoa. Loại khoa Nhi nếu
   không có bằng chứng người bệnh là trẻ em.
5. Khoa đứng đầu phải đạt 60% và có ít nhất hai dấu hiệu lâm sàng nhận diện.
   Nếu không, trả Nội tổng quát với `default_assigned` và
   `needs_more_information`, kèm lời nhắc bổ sung mô tả.
6. Tra danh mục khoa/bác sĩ thật và ghi nhật ký `phan_tich_ai`, liên kết đúng
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
