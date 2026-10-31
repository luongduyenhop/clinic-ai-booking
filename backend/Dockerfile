# ==============================================================================
# STAGE 1: Builder - Biên dịch dependencies và wheels
# ==============================================================================
FROM python:3.11-slim AS builder

WORKDIR /build

# Cài đặt công cụ build cần thiết để biên dịch (chỉ tồn tại trong stage này)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Khởi tạo môi trường ảo biệt lập tại /opt/venv
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt


# ==============================================================================
# STAGE 2: Runner - Runtime tối giản cho production
# ==============================================================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Chỉ cài runtime thư viện kết nối PostgreSQL và curl cho healthcheck
# Tuyệt đối không cài gcc hay build-essential để giảm thiểu dung lượng và rủi ro bảo mật
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Sao chép virtualenv đã đóng gói sẵn từ Stage 1
COPY --from=builder /opt/venv /opt/venv

# Cấu hình biến môi trường Python & Virtualenv
ENV PATH="/opt/venv/bin:$PATH" \
    VIRTUAL_ENV="/opt/venv" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Thiết lập người dùng non-root tăng cường an ninh container (Security Best Practice)
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

# Sao chép mã nguồn ứng dụng và phân quyền cho appuser
COPY --chown=appuser:appgroup . /app

USER appuser

EXPOSE 8000

# Chạy FastAPI application với Uvicorn server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
