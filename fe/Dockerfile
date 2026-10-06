# ==============================================================================
# STAGE 1: Dependencies Resolver (deps) - Cài đặt dependencies cô lập
# ==============================================================================
FROM node:18-alpine AS deps
# libc6-compat cần thiết cho một số thư viện C-bindings trên nền tảng Alpine
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Chỉ copy file mô tả gói để tận dụng tối đa Docker layer cache
COPY package.json package-lock.json ./
RUN npm ci

# ==============================================================================
# STAGE 2: Source Code Builder (builder) - Biên dịch Next.js sang Standalone
# ==============================================================================
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Tắt telemetry thu thập dữ liệu của Next.js
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Biến môi trường Build-time: NEXT_PUBLIC_* được inline tĩnh vào code client
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ENABLE_ROLE_SWITCHER=true
ENV NEXT_PUBLIC_ENABLE_ROLE_SWITCHER=$NEXT_PUBLIC_ENABLE_ROLE_SWITCHER

RUN npm run build

# ==============================================================================
# STAGE 3: Production Runner (runner) - Môi trường chạy siêu nhẹ (~120MB)
# ==============================================================================
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Bảo mật: Thiết lập tài khoản non-root (nextjs:nodejs)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy tài nguyên tĩnh
COPY --from=builder /app/public ./public

# Phân quyền cache directory
RUN mkdir .next && chown nextjs:nodejs .next

# Tận dụng Next.js Standalone build: Chỉ copy server tối giản và static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
