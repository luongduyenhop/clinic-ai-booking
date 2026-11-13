# ==============================================================================
# STAGE 1: Builder - Biên dịch production bundle React + Vite
# ==============================================================================
FROM node:24-alpine AS builder

WORKDIR /app

# Tận dụng Docker layer caching cho dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Sao chép mã nguồn giao diện
COPY . .

# Cấu hình biến môi trường build-time
# URL tương đối giúp trình duyệt gửi API qua cùng tên miền với giao diện.
ARG VITE_DEMO_MODE=false
ENV VITE_API_URL="" \
    VITE_DEMO_MODE=${VITE_DEMO_MODE} \
    NODE_ENV=production

RUN npm run build

# ==============================================================================
# STAGE 2: Runner - Nginx Web Server siêu nhẹ phục vụ Static Files & Reverse Proxy
# ==============================================================================
FROM nginxinc/nginx-unprivileged:stable-alpine AS runner

# Sao chép cấu hình Nginx tối ưu cho SPA và reverse proxy API
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Sao chép bản build tĩnh từ stage builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 3000

# Healthcheck định kỳ qua endpoint /healthz
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
