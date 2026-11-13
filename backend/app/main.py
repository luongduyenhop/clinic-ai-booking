import logging
import time
from contextlib import asynccontextmanager
from functools import lru_cache
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine
from app.core.exceptions import setup_exception_handlers
from app.core.response import ResponseEnvelope
from app.routers.api_v1 import api_router
from scripts.run_migrations import DEMO_SCHEMA_COMMENT
import app.models

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("clinic_backend")


@lru_cache(maxsize=1)
def _database_revision() -> str:
    backend_dir = Path(__file__).resolve().parents[1]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    revision = ScriptDirectory.from_config(config).get_current_head()
    if not revision:
        raise RuntimeError("No repository migration head was found.")
    return revision


async def _check_database() -> None:
    async with engine.connect() as conn:
        if settings.is_demo:
            rows = (await conn.execute(text(
                "SELECT version_num, obj_description('alembic_version'::regclass, 'pg_class') FROM alembic_version"
            ))).all()
            if rows != [(_database_revision(), DEMO_SCHEMA_COMMENT)]:
                raise RuntimeError("Demo database schema is not ready.")
        else:
            await conn.execute(text("SELECT 1"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 [SYSTEM STARTING] Đang kết nối Cơ sở dữ liệu PostgreSQL...")
    if settings.is_hosted:
        await _check_database()
    else:
        from app.core.database import Base

        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        except Exception:
            logger.error("Không thể khởi tạo cấu trúc cơ sở dữ liệu phát triển.")

    try:
        from starlette.concurrency import run_in_threadpool
        from app.ml.triage_model import MODEL_VERSION, get_ai_triage_model

        started = time.perf_counter()
        model = await run_in_threadpool(get_ai_triage_model)
        await run_in_threadpool(model.analyze, "đau đầu nhẹ", age=30)
        logger.info(
            "🤖 [AI MODEL READY] %s nạp xong sau %.1f giây.",
            MODEL_VERSION,
            time.perf_counter() - started,
        )
    except Exception as warmup_err:
        logger.warning(
            "⚠️ [AI MODEL WARMUP] Không nạp trước được model, request đầu tiên "
            "sẽ tự nạp: %s",
            warmup_err,
        )

    try:
        yield
    finally:
        await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    debug=settings.DEBUG,
    description="""
    ## Hệ Thống Quản Lý & Đặt Lịch Khám Bệnh Trực Tuyến Tích Hợp AI
    * **Học phần:** Project 1 (IT1.241.3) - ĐH Giao Thông Vận Tải
    * **Nhóm thực hiện:** Nhóm 2
    * **Kiến trúc:** 3-Tier mở rộng kết hợp BCE Pattern & OpenMRS 3.0 Concept Dictionary
    * **CSDL:** PostgreSQL 15 (Async SQLAlchemy 2.0)
    """,
    version="1.0.0",
    docs_url=None if settings.is_hosted else "/docs",
    redoc_url=None if settings.is_hosted else "/redoc",
    openapi_url=None if settings.is_hosted else f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

from app.core.rate_limit import limiter
from app.core.audit_middleware import PhiAuditMiddleware

app.state.limiter = limiter

app.add_middleware(PhiAuditMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

setup_exception_handlers(app)

from app.routers.auth import router as auth_router
app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(auth_router, prefix="/api", include_in_schema=False)


@app.middleware("http")
async def normalize_fe_auth_case(request, call_next):
    path = request.scope.get("path", "")
    if path.startswith("/api/Auth/"):
        request.scope["path"] = "/api/auth/" + path[len("/api/Auth/"):]
    elif path.startswith("/clinical/"):
        request.scope["path"] = "/api/v1/clinical/" + path[len("/clinical/"):]
    return await call_next(request)


@app.get("/", tags=["Health Check"])
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "status": "online",
        "docs_url": app.docs_url,
        "api_v1": settings.API_V1_STR
    }


@app.get("/health", tags=["Health Check"], response_model=ResponseEnvelope[dict])
async def health_check(response: Response):
    try:
        await _check_database()
        return ResponseEnvelope.success_response(
            data={"database": "PostgreSQL Connected", "status": "healthy"},
            message="Hệ thống Backend đang vận hành ổn định!"
        )
    except Exception:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return ResponseEnvelope.error_response(
            message="Cơ sở dữ liệu chưa sẵn sàng.",
            code=status.HTTP_503_SERVICE_UNAVAILABLE
        )
