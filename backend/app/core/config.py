import json
from pathlib import Path
from typing import Optional
from pydantic import computed_field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL

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
    BACKEND_CORS_ORIGINS: list[str] | str = ["http://localhost:3000", "http://127.0.0.1:3000"]
    ENABLE_DEMO_SEED: bool = False
    ENABLE_OUTBOUND_NOTIFICATIONS: bool = True
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
        return self._postgres_url("postgresql")

    @computed_field
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return self._postgres_url("postgresql+asyncpg")

    def _postgres_url(self, driver: str) -> str:
        return URL.create(
            driver,
            username=self.POSTGRES_USER,
            password=self.POSTGRES_PASSWORD,
            host=self.POSTGRES_SERVER,
            port=self.POSTGRES_PORT,
            database=self.POSTGRES_DB,
        ).render_as_string(hide_password=False)

    @property
    def is_demo(self) -> bool:
        return self.ENVIRONMENT.strip().lower() == "demo"

    @property
    def is_hosted(self) -> bool:
        return self.is_demo or self.ENVIRONMENT.strip().lower() in ("production", "prod", "staging")

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
    PAYMENT_WEBHOOK_SECRET: str = "clinic_ai_default_payment_webhook_secret_key_32bytes"

    @field_validator("SECRET_KEY")
    @classmethod
    def _validate_secret_key(cls, value: str) -> str:
        if not value or len(value) < 32:
            raise ValueError("SECRET_KEY is required and must be at least 32 characters")
        return value

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: list[str] | str) -> list[str]:
        if isinstance(value, str):
            value = value.strip()
            value = json.loads(value) if value.startswith("[") else value.split(",")
        origins = [origin.strip().rstrip("/") for origin in value if origin.strip()]
        if any("*" in origin for origin in origins):
            raise ValueError("BACKEND_CORS_ORIGINS does not accept wildcard origins")
        return origins

    @model_validator(mode="after")
    def _validate_hosted_settings(self):
        if not self.is_hosted:
            return self
        if self.DEBUG:
            raise ValueError("DEBUG must be disabled on hosted deployments")
        if not self.is_demo and self.ENABLE_DEMO_SEED:
            raise ValueError("ENABLE_DEMO_SEED requires ENVIRONMENT=demo")
        if self.is_demo and self.ENABLE_OUTBOUND_NOTIFICATIONS:
            raise ValueError("ENABLE_OUTBOUND_NOTIFICATIONS must be disabled for demo")
        if (
            "change_in_production" in self.SECRET_KEY.lower()
            or "replace_with" in self.SECRET_KEY.lower()
            or "placeholder" in self.SECRET_KEY.lower()
        ):
            raise ValueError("SECRET_KEY must be generated for this deployment")
        return self

    @field_validator("SLOT_DURATION_MINUTES")
    @classmethod
    def _validate_slot_duration(cls, value: int) -> int:
        if value not in ALLOWED_SLOT_DURATIONS:
            raise ValueError(f"SLOT_DURATION_MINUTES phải thuộc {ALLOWED_SLOT_DURATIONS}, nhận được {value}")
        return value


settings = Settings()
