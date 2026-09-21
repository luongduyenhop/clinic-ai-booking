import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.core.config import settings
from app.core.database import engine, Base
from app.core.exceptions import setup_exception_handlers
from app.core.response import ResponseEnvelope
from app.routers.api_v1 import api_router
# Import toàn bộ models để Base.metadata nhận biết đầy đủ các bảng
import app.models

# Cấu hình Logging có cấu trúc
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("clinic_backend")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Quản lý vòng đời ứng dụng: Khởi tạo kết nối CSDL và dọn dẹp khi tắt server"""
    logger.info("🚀 [SYSTEM STARTING] Đang kết nối Cơ sở dữ liệu PostgreSQL...")
    try:
        async with engine.begin() as conn:
            # Tự động tạo bảng nếu chưa có (phục vụ môi trường dev chạy ngay)
            await conn.run_sync(Base.metadata.create_all)
            logger.info("✅ [DATABASE CONNECTED] Toàn bộ Entity Models đã được khởi tạo trên PostgreSQL.")

        # Tự động nạp dữ liệu mẫu ban đầu nếu CSDL trống (Zero-Config / Out-of-the-box Docker startup)
        try:
            from seed_data import seed_database
            await seed_database()
        except Exception as seed_err:
            logger.warning(f"⚠️ [AUTO SEED] Bỏ qua nạp dữ liệu mẫu: {str(seed_err)}")
    except Exception as e:
        logger.error(f"❌ [DATABASE ERROR] Không thể kết nối tới PostgreSQL: {str(e)}")
    
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

# 1. Cấu hình CORS cho phép ứng dụng Next.js kết nối an toàn
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Đăng ký bộ xử lý lỗi toàn cục (Global Exception Handler)
setup_exception_handlers(app)

# 3. Đăng ký Routers API v1
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Health Check"])
async def root():
    """Endpoint gốc kiểm tra trạng thái hoạt động của Backend"""
    return {
        "service": settings.PROJECT_NAME,
        "status": "online",
        "docs_url": "/docs",
        "api_v1": settings.API_V1_STR
    }


@app.get("/health", tags=["Health Check"], response_model=ResponseEnvelope[dict])
async def health_check():
    """Kiểm tra sức khỏe kết nối CSDL PostgreSQL"""
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
