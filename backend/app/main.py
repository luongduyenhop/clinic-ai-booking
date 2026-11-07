import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine, Base
from app.core.exceptions import setup_exception_handlers
from app.core.response import ResponseEnvelope
from app.routers.api_v1 import api_router
import app.models

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("clinic_backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 [SYSTEM STARTING] Đang kết nối Cơ sở dữ liệu PostgreSQL...")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            logger.info("✅ [DATABASE CONNECTED] Toàn bộ Entity Models đã được khởi tạo trên PostgreSQL.")

        try:
            from seed_data import seed_database
            await seed_database()
        except Exception as seed_err:
            logger.warning(f"⚠️ [AUTO SEED] Bỏ qua nạp dữ liệu mẫu: {str(seed_err)}")
    except Exception as e:
        logger.error(f"❌ [DATABASE ERROR] Không thể kết nối tới PostgreSQL: {str(e)}")

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

    yield
    
    logger.info("🛑 [SYSTEM STOPPING] Đóng kết nối PostgreSQL Engine...")
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="""
    ## Hệ Thống Quản Lý & Đặt Lịch Khám Bệnh Trực Tuyến Tích Hợp AI
    * **Học phần:** Project 1 (IT1.241.3) - ĐH Giao Thông Vận Tải
    * **Nhóm thực hiện:** Nhóm 2
    * **Kiến trúc:** 3-Tier mở rộng kết hợp BCE Pattern & OpenMRS 3.0 Concept Dictionary
    * **CSDL:** PostgreSQL 15 (Async SQLAlchemy 2.0)
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

from app.core.rate_limit import limiter

app.state.limiter = limiter

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
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
    return await call_next(request)


@app.get("/", tags=["Health Check"])
async def root():
    return {
        "service": settings.PROJECT_NAME,
        "status": "online",
        "docs_url": "/docs",
        "api_v1": settings.API_V1_STR
    }


@app.get("/health", tags=["Health Check"], response_model=ResponseEnvelope[dict])
async def health_check():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return ResponseEnvelope.success_response(
            data={"database": "PostgreSQL Connected", "status": "healthy"},
            message="Hệ thống Backend đang vận hành ổn định!"
        )
    except Exception as e:
        return ResponseEnvelope.error_response(
            message=f"Lỗi kết nối CSDL: {str(e)}",
            code=status.HTTP_503_SERVICE_UNAVAILABLE
        )
