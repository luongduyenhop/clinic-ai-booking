from app.core.security import hash_password, verify_password, create_access_token, decode_access_token, generate_otp


def test_password_hashing():
    """Kiểm tra mã hóa BCrypt một chiều và xác thực mật khẩu"""
    raw_password = "DoctorSecurePass@2026"
    hashed = hash_password(raw_password)

    assert hashed != raw_password
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$")
    assert verify_password(raw_password, hashed) is True
    assert verify_password("WrongPassword123", hashed) is False


def test_otp_generation():
    """Kiểm tra sinh mã OTP ngẫu nhiên đúng 6 chữ số"""
    for _ in range(20):
        otp = generate_otp(6)
        assert len(otp) == 6
        assert otp.isdigit()


def test_jwt_token_encode_decode():
    """Kiểm tra tạo và giải mã JWT Bearer Token kèm thông tin vai trò"""
    user_id = 42
    role = "bac_si"

    token = create_access_token(subject=user_id, role=role)
    assert isinstance(token, str)
    assert len(token) > 20

    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == str(user_id)
    assert payload["role"] == role
    assert "exp" in payload


def test_jwt_token_invalid():
    """Kiểm tra giải mã token giả mạo trả về None"""
    invalid_token = "eyJhGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.invalidsignature"
    payload = decode_access_token(invalid_token)
    assert payload is None


def test_jwt_token_sanitization():
    """Kiểm tra tự động làm sạch tiền tố 'Bearer ', dấu ngoặc kép và khoảng trắng thừa"""
    token = create_access_token(subject=100, role="benh_nhan")
    
    # 1. Có tiền tố Bearer
    assert decode_access_token(f"Bearer {token}") is not None
    # 2. Có tiền tố bearer chữ thường
    assert decode_access_token(f"bearer {token}") is not None
    # 3. Kèm ngoặc kép
    assert decode_access_token(f'"{token}"') is not None
    # 4. Kèm cả Bearer và ngoặc kép
    assert decode_access_token(f'"Bearer {token}"') is not None
    # 5. Kèm khoảng trắng
    assert decode_access_token(f"  Bearer   {token}  ") is not None
