from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_endpoint():
    """Kiểm tra endpoint gốc phản hồi trạng thái online"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "docs_url" in data


def test_validation_error_envelope():
    """Kiểm tra khi gửi payload sai thì ResponseEnvelope trả về đúng chuẩn code 422"""
    payload_invalid = {
        "ho_ten": "Test User",
        "email": "not-an-email",
        "so_dien_thoai": "123",  # Thiếu số
        "mat_khau": "123"        # Ngắn hơn 8 ký tự
    }
    response = client.post("/api/v1/auth/register", json=payload_invalid)
    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["code"] == 422
    assert "errors" in body
    assert len(body["errors"]) > 0


def test_unauthorized_access_to_protected_route():
    """Kiểm tra truy cập endpoint bảo vệ mà không có Bearer token trả về 401 chuẩn envelope"""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    body = response.json()
    assert body["success"] is False
    assert body["code"] == 401
    assert "message" in body
