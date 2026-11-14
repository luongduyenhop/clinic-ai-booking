set -Eeuo pipefail

APP_DIR="${1:?Thieu tham so APP_DIR}"
RELEASE_SHA="${2:-unknown}"
INCOMING="$APP_DIR/.deploy-incoming"
WAIT_TIMEOUT="${DEPLOY_WAIT_TIMEOUT:-300}"

log()  { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
fail() { printf '::error::%s\n' "$*"; exit 1; }

cd "$APP_DIR" || fail "Khong vao duoc thu muc $APP_DIR"
command -v docker >/dev/null || fail "VPS chua cai Docker"
docker compose version >/dev/null 2>&1 || fail "VPS chua co Docker Compose v2"
[ -f "$INCOMING/release.tar.gz" ] || fail "Thieu $INCOMING/release.tar.gz"
[ -f "$INCOMING/fe-dist.tar.gz" ] || fail "Thieu $INCOMING/fe-dist.tar.gz"

running_label() {
  docker ps -a \
    --filter "label=com.docker.compose.project.working_dir=$APP_DIR" \
    --filter "label=com.docker.compose.service=backend" \
    --format "{{.Label \"$1\"}}" 2>/dev/null | head -n 1
}

PROJECT_NAME="$(running_label com.docker.compose.project)"
CONFIG_FILES="$(running_label com.docker.compose.project.config_files)"
LABEL_ENV_FILE="$(running_label com.docker.compose.project.environment_file)"

COMPOSE_FILE_PATH="${CONFIG_FILES%%,*}"
if [ -z "$COMPOSE_FILE_PATH" ] || [ ! -f "$COMPOSE_FILE_PATH" ]; then
  COMPOSE_FILE_PATH="$APP_DIR/docker-compose.vps.yml"
fi

ENV_FILE=""
if [ -n "$LABEL_ENV_FILE" ] && [ -f "${LABEL_ENV_FILE%%,*}" ]; then
  ENV_FILE="${LABEL_ENV_FILE%%,*}"
else
  for candidate in "$APP_DIR/.env.demo" "$APP_DIR/.env"; do
    if [ -f "$candidate" ]; then ENV_FILE="$candidate"; break; fi
  done
fi

BACKUP_DIR="$APP_DIR/.deploy-backup/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
for f in docker-compose.yml docker-compose.vps.yml fe/nginx.conf fe/Dockerfile.vps RELEASE; do
  if [ -f "$f" ]; then cp --parents "$f" "$BACKUP_DIR/"; fi
done
ls -1dt "$APP_DIR"/.deploy-backup/*/ 2>/dev/null | tail -n +6 | xargs -r rm -rf || true

log "Giai nen ma nguon commit ${RELEASE_SHA:0:7}"
tar -xzf "$INCOMING/release.tar.gz" -C "$APP_DIR"
rm -rf "$APP_DIR/fe/dist"
mkdir -p "$APP_DIR/fe/dist"
tar -xzf "$INCOMING/fe-dist.tar.gz" -C "$APP_DIR/fe/dist"

if [ -f "$APP_DIR/docker-compose.vps.yml" ]; then
  COMPOSE_FILE_PATH="$APP_DIR/docker-compose.vps.yml"
fi

env_has() { grep -qE "^$1=.+" "$2" 2>/dev/null; }
env_get() { { grep -E "^$1=" "$2" 2>/dev/null || true; } | tail -n 1 | cut -d= -f2- | tr -d '\r'; }
env_set() {
  local key="$1" value="$2" file="$3" tmp
  tmp="$(mktemp "$file.XXXXXX")"
  { grep -vE "^$key=" "$file" || true; } | tr -d '\r' > "$tmp"
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  chmod 600 "$tmp"
  mv "$tmp" "$file"
}

CORE_KEYS="POSTGRES_PASSWORD SECRET_KEY PAYMENT_WEBHOOK_SECRET DEMO_PASSWORD"
OPTIONAL_KEYS="CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET SEPAY_API_KEY SEPAY_WEBHOOK_TOKEN SEPAY_BANK_NAME SEPAY_ACCOUNT_NUMBER SEPAY_ACCOUNT_NAME"
INCOMING_ENV="$INCOMING/deploy.env"

if [ -z "$PROJECT_NAME" ]; then
  [ -n "$ENV_FILE" ] && PROJECT_NAME="$(env_get COMPOSE_PROJECT_NAME "$ENV_FILE")"
  [ -n "$PROJECT_NAME" ] || PROJECT_NAME="$(env_get COMPOSE_PROJECT_NAME .env.demo.example)"
  PROJECT_NAME="${PROJECT_NAME:-clinic-demo}"
fi
DB_VOLUME_EXISTS=0
if docker volume inspect "${PROJECT_NAME}_postgres_data" >/dev/null 2>&1; then DB_VOLUME_EXISTS=1; fi

if [ -z "$ENV_FILE" ]; then
  [ "$DB_VOLUME_EXISTS" -eq 0 ] || fail "Khong tim thay .env.demo/.env nhung da co volume ${PROJECT_NAME}_postgres_data. Khoi phuc env file cu truoc khi deploy (khong tao mat khau moi)."
  ENV_FILE="$APP_DIR/.env.demo"
  log "Lan dau trien khai: tao $(basename "$ENV_FILE") tu .env.demo.example"
  ( umask 077; grep -vE "^($(echo "$CORE_KEYS" | tr ' ' '|'))=" .env.demo.example | tr -d '\r' > "$ENV_FILE" )
fi
chmod 600 "$ENV_FILE"

for key in $CORE_KEYS; do
  if ! env_has "$key" "$ENV_FILE"; then
    if [ "$key" = "POSTGRES_PASSWORD" ] && [ "$DB_VOLUME_EXISTS" -eq 1 ]; then
      fail "$(basename "$ENV_FILE") thieu POSTGRES_PASSWORD trong khi DB da khoi tao - bo sung tay dung mat khau cu."
    fi
    value="$(env_get "$key" "$INCOMING_ENV")"
    [ -n "$value" ] || value="$(openssl rand -hex 32)"
    env_set "$key" "$value" "$ENV_FILE"
    log "Bo sung $key con thieu trong $(basename "$ENV_FILE")"
  fi
done

for key in $OPTIONAL_KEYS; do
  value="$(env_get "$key" "$INCOMING_ENV")"
  if [ -n "$value" ] && [ "$value" != "$(env_get "$key" "$ENV_FILE")" ]; then
    env_set "$key" "$value" "$ENV_FILE"
    log "Cap nhat $key tu GitHub Secrets"
  fi
done

log "Project=$PROJECT_NAME | compose=$(basename "$COMPOSE_FILE_PATH") | env=$(basename "$ENV_FILE")"
compose() {
  docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE_PATH" --env-file "$ENV_FILE" "$@"
}

dump_diagnostics() {
  log "Trang thai container:"
  compose ps -a || true
  log "Log gan nhat (bootstrap/backend/frontend):"
  compose logs --no-color --tail=60 bootstrap backend frontend 2>&1 | tail -n 180 || true
}
trap 'dump_diagnostics' ERR

compose config --quiet
log "Tam dung frontend va backend cu de giai phong RAM cho bootstrap va build"
compose stop frontend backend >/dev/null 2>&1 || true
log "Build image va khoi dong stack (doi toi da ${WAIT_TIMEOUT}s)"
compose up -d --build --wait --wait-timeout "$WAIT_TIMEOUT"

log "Khoi dong lai frontend de nhan dia chi backend moi"
compose restart frontend

FRONT_ADDR="$(compose port frontend 3000 2>/dev/null | head -n 1)"
FRONT_ADDR="${FRONT_ADDR:-127.0.0.1:3000}"
FRONT_ADDR="${FRONT_ADDR/0.0.0.0/127.0.0.1}"
log "Kiem tra http://$FRONT_ADDR/healthz"
healthy=0
for attempt in $(seq 1 30); do
  if curl -fsS --max-time 5 "http://$FRONT_ADDR/healthz" >/dev/null 2>&1; then
    healthy=1
    log "Health check OK (lan thu $attempt)"
    break
  fi
  sleep 3
done
if [ "$healthy" -ne 1 ]; then
  dump_diagnostics
  trap - ERR
  fail "Health check that bai sau 90s tai http://$FRONT_ADDR/healthz"
fi
trap - ERR

printf '%s\n' "$RELEASE_SHA" > "$APP_DIR/RELEASE"
compose ps
docker image prune -f >/dev/null 2>&1 || true
rm -rf "$INCOMING"
log "Deploy thanh cong commit ${RELEASE_SHA:0:7}"
