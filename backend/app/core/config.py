from pathlib import Path
from typing import Optional, List, Union
from pydantic import computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ALLOWED_SLOT_DURATIONS = (15, 30, 45, 60)
ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(ENV_PATH), ".env"),
        env_ignore_empty=True,
        extra="ignore"
    )

    PROJECT_NAME: str = "Clinic AI Booking System"
    API_V1_STR: str = "/api/v1"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    BACKEND_CORS_ORIGINS: Union[List[str], str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    INITIAL_ADMIN_EMAIL: str = "admin@clinic.com"
    INITIAL_ADMIN_PASSWORD: Optional[str] = None
    ENABLE_DEMO_SEED: bool = False
    ENABLE_OUTBOUND_NOTIFICATIONS: bool = False

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

    SECRET_KEY: str
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
    PAYMENT_WEBHOOK_SECRET: str

    @field_validator("SECRET_KEY")
    @classmethod
    def _validate_secret_key(cls, value: str) -> str:
        if not value or len(value.strip()) < 32:
            raise ValueError("SECRET_KEY is required and must be at least 32 characters")
        lowered = value.lower()
        forbidden = ("replace_with", "placeholder", "changeme", "change_me", "your_secret_key")
        if any(term in lowered for term in forbidden):
            raise ValueError("SECRET_KEY cannot use an insecure placeholder value")
        return value

    @field_validator("PAYMENT_WEBHOOK_SECRET")
    @classmethod
    def _validate_payment_webhook_secret(cls, value: str) -> str:
        if not value or len(value.strip()) < 32:
            raise ValueError("PAYMENT_WEBHOOK_SECRET is required and must be at least 32 characters")
        lowered = value.lower()
        forbidden = ("replace_with", "placeholder", "changeme", "change_me", "your_secret_key")
        if any(term in lowered for term in forbidden):
            raise ValueError("PAYMENT_WEBHOOK_SECRET cannot use an insecure placeholder value")
        return value

    @field_validator("SLOT_DURATION_MINUTES")
    @classmethod
    def _validate_slot_duration(cls, value: int) -> int:
        if value not in ALLOWED_SLOT_DURATIONS:
            raise ValueError(f"SLOT_DURATION_MINUTES phải thuộc {ALLOWED_SLOT_DURATIONS}, nhận được {value}")
        return value

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def _assemble_cors_origins(cls, value: Union[str, List[str]]) -> List[str]:
        origins: List[str] = []
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                return []
            if stripped.startswith("[") and stripped.endswith("]"):
                import json
                try:
                    parsed = json.loads(stripped)
                    origins = [str(item).strip().rstrip("/") for item in parsed if str(item).strip()]
                except Exception:
                    origins = [x.strip().rstrip("/") for x in stripped.split(",") if x.strip()]
            else:
                origins = [x.strip().rstrip("/") for x in stripped.split(",") if x.strip()]
        elif isinstance(value, (list, tuple, set)):
            origins = [str(item).strip().rstrip("/") for item in value if str(item).strip()]
        else:
            origins = []

        for origin in origins:
            if origin == "*" or "*" in origin:
                raise ValueError("Wildcard '*' is not permitted in BACKEND_CORS_ORIGINS when credentials are enabled")
        return origins


settings = Settings()
