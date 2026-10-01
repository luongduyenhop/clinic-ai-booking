from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import computed_field, field_validator
from typing import Optional

# Thời lượng 1 lượt khám hợp lệ - khớp CHECK (thoi_luong_phut IN (15, 30, 45, 60)) của bảng lich_kham
ALLOWED_SLOT_DURATIONS = (15, 30, 45, 60)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore"
    )

    # Core Application
    PROJECT_NAME: str = "Clinic AI Booking System"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"

    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "clinic_user"
    POSTGRES_PASSWORD: str = "clinic_password"
    POSTGRES_DB: str = "clinic_db"
    DATABASE_URL: Optional[str] = None

    @computed_field
    def sync_database_url(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @computed_field
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # JWT Authentication
    SECRET_KEY: str = "super_secret_clinic_jwt_key_project_1_change_in_production_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 2  # 2 hours
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Email Service (OTP)
    SMTP_TLS: bool = True
    SMTP_PORT: int = 587
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM_EMAIL: Optional[str] = None
    EMAILS_FROM_NAME: str = "Phòng Khám Đa Khoa AI"

    # AI Module Parameters
    AI_CONFIDENCE_THRESHOLD: float = 0.60
    SLOT_DURATION_MINUTES: int = 30
    CANCELLATION_MINIMUM_HOURS: int = 2
    # Giờ khám lưu theo giờ Việt Nam (UTC+7, không có giờ mùa hè), độc lập với múi giờ của server/Docker
    CLINIC_UTC_OFFSET_HOURS: int = 7

    @field_validator("SLOT_DURATION_MINUTES")
    @classmethod
    def _validate_slot_duration(cls, value: int) -> int:
        """Cấu hình sai (VD 20 phút) phải báo lỗi ngay khi khởi động, thay vì mọi lượt đặt lịch đều lỗi 500
        do vi phạm ràng buộc CHECK trên CSDL"""
        if value not in ALLOWED_SLOT_DURATIONS:
            raise ValueError(f"SLOT_DURATION_MINUTES phải thuộc {ALLOWED_SLOT_DURATIONS}, nhận được {value}")
        return value


settings = Settings()
