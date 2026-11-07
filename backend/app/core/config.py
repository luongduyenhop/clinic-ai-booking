from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import computed_field, field_validator
from typing import Optional

ALLOWED_SLOT_DURATIONS = (15, 30, 45, 60)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_ignore_empty=True,
        extra="ignore"
    )

    PROJECT_NAME: str = "Clinic AI Booking System"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = True
    ENVIRONMENT: str = "development"
    INITIAL_ADMIN_EMAIL: str = "admin@clinic.com"
    INITIAL_ADMIN_PASSWORD: Optional[str] = None

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

    SECRET_KEY: str = "super_secret_clinic_jwt_key_project_1_change_in_production_2026"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 2
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    SMTP_TLS: bool = True
    SMTP_PORT: int = 587
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAILS_FROM_EMAIL: Optional[str] = None
    EMAILS_FROM_NAME: str = "Phòng Khám Đa Khoa AI"

    AI_CONFIDENCE_THRESHOLD: float = 0.40
    SLOT_DURATION_MINUTES: int = 30
    CANCELLATION_MINIMUM_HOURS: int = 2
    CLINIC_UTC_OFFSET_HOURS: int = 7
    CLS_UPLOAD_DIR: Optional[str] = None
    CLINIC_PARENT_AGENCY: str = "SỞ Y TẾ TP. HỒ CHÍ MINH"
    CLINIC_NAME: str = "PHÒNG KHÁM ĐA KHOA THÔNG MINH CLINIC-AI"
    CLINIC_ADDRESS: str = "Khu Công Nghệ Cao, TP. Thủ Đức"
    CLINIC_PHONE: str = "1900 6868"

    @field_validator("SLOT_DURATION_MINUTES")
    @classmethod
    def _validate_slot_duration(cls, value: int) -> int:
        if value not in ALLOWED_SLOT_DURATIONS:
            raise ValueError(f"SLOT_DURATION_MINUTES phải thuộc {ALLOWED_SLOT_DURATIONS}, nhận được {value}")
        return value


settings = Settings()
