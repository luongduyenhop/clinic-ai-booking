import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from passlib.context import CryptContext
from jose import jwt, JWTError
from app.core.config import settings

# Cấu hình Bcrypt hashing với rounds chuẩn
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Băm mật khẩu 1 chiều bằng thuật toán BCrypt"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Kiểm tra mật khẩu nhập vào khớp với chuỗi băm BCrypt"""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(subject: Any, role: str, expires_delta: Optional[timedelta] = None) -> str:
    """Phát hành JSON Web Token (JWT) có mã hóa thông tin người dùng và vai trò"""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "role": role
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Giải mã và xác thực chữ ký của JWT token"""
    if not token:
        return None
    token = token.strip().strip('"').strip("'")
    while token.lower().startswith("bearer "):
        token = token[7:].strip().strip('"').strip("'")
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def generate_otp(length: int = 6) -> str:
    """Sinh mã xác thực OTP ngẫu nhiên gồm các chữ số an toàn cryptographically"""
    return "".join(secrets.choice("0123456789") for _ in range(length))
