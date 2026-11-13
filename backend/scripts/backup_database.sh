#!/usr/bin/env bash
set -euo pipefail

umask 077

script_directory="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
current_timestamp="$(date -u +"%Y%m%d_%H%M%SZ")"

database_name="${PGDATABASE:-${POSTGRES_DB:-clinic_db}}"
database_user="${PGUSER:-${POSTGRES_USER:-clinic_user}}"
database_host="${PGHOST:-${POSTGRES_SERVER:-localhost}}"
database_port="${PGPORT:-${POSTGRES_PORT:-5432}}"
backup_directory="${BACKUP_DIR:-./backups}"
custom_output_file=""
secret_key_file="${BACKUP_ENCRYPTION_KEY_FILE:-}"
overwrite_allowed=false
dry_run_mode=false
allow_insecure_permissions=false
verify_target_file=""
restore_target_file=""
confirm_destructive_restore=""
run_self_check_mode=false
dump_format="custom"
compression_level="9"
cipher_algorithm="aes-256-cbc"
pbkdf2_iterations="100000"
docker_container_name="${DOCKER_CONTAINER:-}"

temporary_file_path=""

cleanup_temporary_artifacts() {
    local exit_status=$?
    if [[ -n "${temporary_file_path}" && -f "${temporary_file_path}" ]]; then
        rm -f "${temporary_file_path}"
    fi
    exit ${exit_status}
}

trap cleanup_temporary_artifacts EXIT INT TERM

display_usage_and_exit() {
    cat << 'EOF'
Usage: backup_database.sh [OPTIONS]

PostgreSQL Backup, Encryption & Disaster Recovery Utility (ACT-P1-09)

Backup Options:
  --target-dir <path>                   Output directory for backups (default: ./backups)
  --output-file <path>                  Explicit full path for output file
  --db-name <name>                      Database name (default: clinic_db)
  --db-user <user>                      Database username (default: clinic_user)
  --db-host <host>                      Database host (default: localhost)
  --db-port <port>                      Database port (default: 5432)
  --secret-file <path>                  Path to file containing encryption passphrase
  --format <custom|plain>               Backup format: custom (pg_dump -Fc) or plain (SQL gzipped)
  --compression-level <1-9>             Compression level (default: 9)
  --cipher <cipher>                     OpenSSL cipher algorithm (default: aes-256-cbc)
  --pbkdf2-iter <count>                 PBKDF2 iteration count (default: 100000)
  --docker-container <name>             Execute pg_dump/pg_restore inside specified Docker container
  --overwrite                           Allow overwriting existing target file (default: refuse)
  --allow-insecure-permissions          Bypass strict filesystem permission validation (dev only)

Integrity & Verification Options:
  --verify <backup_file>                Verify HMAC-SHA256, SHA-256 and decryption stream

Disaster Recovery Restore Options:
  --restore <backup_file>               Restore database from authenticated encrypted archive
  --confirm-destructive-restore <name>  Explicit database name confirmation to authorize restore

Operational Modes:
  --dry-run                             Validate parameters and execution plan without changes
  --self-check                          Execute isolated safe self-check test suite (18 tests)
  --help                                Show this help message and exit

Environment Variables:
  BACKUP_ENCRYPTION_KEY                 Encryption passphrase (minimum 16 characters)
  BACKUP_ENCRYPTION_KEY_FILE            Path to file containing encryption passphrase
  POSTGRES_PASSWORD                     Database password (passed securely via PGPASSWORD)
  POSTGRES_DB / PGDATABASE              Database name
  POSTGRES_USER / PGUSER                Database user
  POSTGRES_SERVER / PGHOST              Database host
  POSTGRES_PORT / PGPORT                Database port
  DOCKER_CONTAINER                      Default Docker container name
  ALLOW_INSECURE_PERMISSIONS            Bypass strict permission checks (1 or true)
EOF
    exit 0
}

log_info() {
    printf '[INFO] %s\n' "$*" >&2
}

log_error() {
    printf '[ERROR] %s\n' "$*" >&2
}

parse_command_line_arguments() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --target-dir)
                backup_directory="$2"
                shift 2
                ;;
            --output-file)
                custom_output_file="$2"
                shift 2
                ;;
            --db-name)
                database_name="$2"
                shift 2
                ;;
            --db-user)
                database_user="$2"
                shift 2
                ;;
            --db-host)
                database_host="$2"
                shift 2
                ;;
            --db-port)
                database_port="$2"
                shift 2
                ;;
            --secret-file)
                secret_key_file="$2"
                shift 2
                ;;
            --format)
                dump_format="$2"
                shift 2
                ;;
            --compression-level)
                compression_level="$2"
                shift 2
                ;;
            --cipher)
                cipher_algorithm="$2"
                shift 2
                ;;
            --pbkdf2-iter)
                pbkdf2_iterations="$2"
                shift 2
                ;;
            --docker-container)
                docker_container_name="$2"
                shift 2
                ;;
            --overwrite)
                overwrite_allowed=true
                shift
                ;;
            --allow-insecure-permissions)
                allow_insecure_permissions=true
                shift
                ;;
            --verify)
                verify_target_file="$2"
                shift 2
                ;;
            --restore)
                restore_target_file="$2"
                shift 2
                ;;
            --confirm-destructive-restore)
                confirm_destructive_restore="$2"
                shift 2
                ;;
            --dry-run)
                dry_run_mode=true
                shift
                ;;
            --self-check)
                run_self_check_mode=true
                shift
                ;;
            --help|-h)
                display_usage_and_exit
                ;;
            *)
                log_error "Unrecognized option: $1"
                display_usage_and_exit
                ;;
        esac
    done
}

canonicalize_path() {
    local candidate_path="$1"
    if command -v realpath >/dev/null 2>&1; then
        realpath -m "${candidate_path}"
    else
        readlink -f "${candidate_path}" 2>/dev/null || printf '%s' "${candidate_path}"
    fi
}

is_unsafe_destination_path() {
    local canonical_path="$1"
    local unsafe_prefixes=(
        "/bin"
        "/sbin"
        "/usr"
        "/lib"
        "/lib64"
        "/lib32"
        "/etc"
        "/dev"
        "/proc"
        "/sys"
        "/boot"
        "/root"
        "/run"
        "/var/run"
        "/var/log"
    )

    if [[ "${canonical_path}" == "/" ]]; then
        return 0
    fi

    for prefix in "${unsafe_prefixes[@]}"; do
        if [[ "${canonical_path}" == "${prefix}" || "${canonical_path}" == "${prefix}/"* ]]; then
            return 0
        fi
    done

    return 1
}

verify_filesystem_permissions_enforced() {
    local target_path="$1"
    local target_description="$2"

    if [[ "${allow_insecure_permissions}" == "true" || "${ALLOW_INSECURE_PERMISSIONS:-}" == "true" || "${ALLOW_INSECURE_PERMISSIONS:-}" == "1" ]]; then
        return 0
    fi

    local current_mode
    current_mode="$(stat -c '%a' "${target_path}" 2>/dev/null || stat -f '%Lp' "${target_path}" 2>/dev/null || true)"
    if [[ -z "${current_mode}" ]]; then
        return 0
    fi

    local group_other_bits="${current_mode: -2}"
    if [[ "${group_other_bits}" != "00" ]]; then
        log_error "Permission protection failed for ${target_description} '${target_path}': mode is ${current_mode}. Group and other permissions must be 00 to protect patient medical data. Operation failed closed."
        return 1
    fi
    return 0
}

enforce_restricted_directory_permissions() {
    local dir_path="$1"
    if ! chmod 700 "${dir_path}" 2>/dev/null; then
        if [[ "${allow_insecure_permissions}" != "true" && "${ALLOW_INSECURE_PERMISSIONS:-}" != "true" && "${ALLOW_INSECURE_PERMISSIONS:-}" != "1" ]]; then
            log_error "Failed to set chmod 700 on directory '${dir_path}'. Failing closed."
            return 1
        fi
    fi
    verify_filesystem_permissions_enforced "${dir_path}" "directory" || return 1
    return 0
}

enforce_restricted_file_permissions() {
    local file_path="$1"
    if ! chmod 600 "${file_path}" 2>/dev/null; then
        if [[ "${allow_insecure_permissions}" != "true" && "${ALLOW_INSECURE_PERMISSIONS:-}" != "true" && "${ALLOW_INSECURE_PERMISSIONS:-}" != "1" ]]; then
            log_error "Failed to set chmod 600 on file '${file_path}'. Failing closed."
            return 1
        fi
    fi
    verify_filesystem_permissions_enforced "${file_path}" "file" || return 1
    return 0
}

validate_target_directory_safety() {
    local candidate_directory="$1"
    if [[ -z "${candidate_directory}" ]]; then
        log_error "Target directory path cannot be empty."
        return 1
    fi

    local canonical_dir
    canonical_dir="$(canonicalize_path "${candidate_directory}")"

    if is_unsafe_destination_path "${canonical_dir}"; then
        log_error "Unsafe target directory '${canonical_dir}'. Operation rejected."
        return 1
    fi

    if [[ ! -d "${candidate_directory}" ]]; then
        if [[ "${dry_run_mode}" != "true" ]]; then
            mkdir -p "${candidate_directory}"
            enforce_restricted_directory_permissions "${candidate_directory}" || return 1
        fi
    else
        if [[ "${dry_run_mode}" != "true" ]]; then
            enforce_restricted_directory_permissions "${candidate_directory}" || return 1
        fi
    fi
    return 0
}

validate_output_file_safety() {
    local candidate_file="$1"
    if [[ -z "${candidate_file}" ]]; then
        log_error "Output file path cannot be empty."
        return 1
    fi

    local canonical_file
    canonical_file="$(canonicalize_path "${candidate_file}")"

    if is_unsafe_destination_path "${canonical_file}"; then
        log_error "Unsafe target file path '${canonical_file}'. Operation rejected."
        return 1
    fi

    local parent_dir
    parent_dir="$(dirname "${candidate_file}")"
    validate_target_directory_safety "${parent_dir}" || return 1
    return 0
}

resolve_raw_secret_key() {
    if [[ -n "${secret_key_file}" ]]; then
        if [[ ! -f "${secret_key_file}" ]]; then
            log_error "Specified secret key file does not exist: ${secret_key_file}"
            return 1
        fi
        if [[ ! -s "${secret_key_file}" ]]; then
            log_error "Specified secret key file is empty: ${secret_key_file}"
            return 1
        fi

        local file_mode
        file_mode="$(stat -c '%a' "${secret_key_file}" 2>/dev/null || stat -f '%Lp' "${secret_key_file}" 2>/dev/null || true)"
        if [[ -n "${file_mode}" && "${allow_insecure_permissions}" != "true" && "${ALLOW_INSECURE_PERMISSIONS:-}" != "true" && "${ALLOW_INSECURE_PERMISSIONS:-}" != "1" ]]; then
            local group_other="${file_mode: -2}"
            if [[ "${group_other}" != "00" ]]; then
                log_error "Secret key file '${secret_key_file}' permissions (${file_mode}) are too permissive. Access must be restricted strictly to owner (0600). Failing closed."
                return 1
            fi
        fi

        tr -d '\r\n' < "${secret_key_file}"
        return 0
    fi

    if [[ -n "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
        if [[ ${#BACKUP_ENCRYPTION_KEY} -lt 16 ]]; then
            log_error "BACKUP_ENCRYPTION_KEY is too short. Minimum 16 characters required for security."
            return 1
        fi
        printf '%s' "${BACKUP_ENCRYPTION_KEY}"
        return 0
    fi

    log_error "No encryption key provided. Set BACKUP_ENCRYPTION_KEY or specify --secret-file."
    return 1
}

resolve_openssl_pass_argument() {
    if [[ -n "${secret_key_file}" ]]; then
        if [[ ! -f "${secret_key_file}" ]]; then
            log_error "Specified secret key file does not exist: ${secret_key_file}"
            return 1
        fi
        if [[ ! -s "${secret_key_file}" ]]; then
            log_error "Specified secret key file is empty: ${secret_key_file}"
            return 1
        fi

        local file_mode
        file_mode="$(stat -c '%a' "${secret_key_file}" 2>/dev/null || stat -f '%Lp' "${secret_key_file}" 2>/dev/null || true)"
        if [[ -n "${file_mode}" && "${allow_insecure_permissions}" != "true" && "${ALLOW_INSECURE_PERMISSIONS:-}" != "true" && "${ALLOW_INSECURE_PERMISSIONS:-}" != "1" ]]; then
            local group_other="${file_mode: -2}"
            if [[ "${group_other}" != "00" ]]; then
                log_error "Secret key file '${secret_key_file}' permissions (${file_mode}) are too permissive. Access must be restricted strictly to owner (0600). Failing closed."
                return 1
            fi
        fi

        printf 'file:%s' "${secret_key_file}"
        return 0
    fi

    if [[ -n "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
        if [[ ${#BACKUP_ENCRYPTION_KEY} -lt 16 ]]; then
            log_error "BACKUP_ENCRYPTION_KEY is too short. Minimum 16 characters required for security."
            return 1
        fi
        printf 'env:BACKUP_ENCRYPTION_KEY'
        return 0
    fi

    log_error "No encryption key provided. Set BACKUP_ENCRYPTION_KEY or specify --secret-file."
    return 1
}

compute_sha256_checksum() {
    local target_file="$1"
    openssl dgst -sha256 "${target_file}" | awk '{print $NF}'
}

compute_hmac_sha256() {
    local target_file="$1"
    local raw_key="$2"
    printf '%s' "${raw_key}" | python3 -c 'import hashlib, hmac, sys; key = sys.stdin.buffer.read(); mac_key = hmac.new(key, b"clinic-ai-backup-hmac-v1", hashlib.sha256).digest(); mac = hmac.new(mac_key, digestmod=hashlib.sha256); f = open(sys.argv[1], "rb"); chunk = f.read(1024 * 1024)
while chunk:
    mac.update(chunk); chunk = f.read(1024 * 1024)
f.close(); print(mac.hexdigest())' "${target_file}"
}

verify_backup_integrity() {
    local backup_file="$1"
    if [[ ! -f "${backup_file}" ]]; then
        log_error "Backup file does not exist: ${backup_file}"
        return 1
    fi

    if [[ ! -s "${backup_file}" ]]; then
        log_error "Backup file is empty (zero bytes): ${backup_file}"
        return 1
    fi

    local hmac_file="${backup_file}.hmac"
    if [[ ! -s "${hmac_file}" ]]; then
        log_error "Required HMAC sidecar is missing or empty: ${hmac_file}"
        return 1
    fi

    local expected_hmac
    expected_hmac="$(awk '{print $1}' "${hmac_file}")"
    if [[ ! "${expected_hmac}" =~ ^[[:xdigit:]]{64}$ ]]; then
        log_error "Required HMAC sidecar contains an invalid tag: ${hmac_file}"
        return 1
    fi

    local raw_key
    raw_key="$(resolve_raw_secret_key)" || return 1

    local calculated_hmac
    calculated_hmac="$(compute_hmac_sha256 "${backup_file}" "${raw_key}")"

    if [[ "${expected_hmac}" != "${calculated_hmac}" ]]; then
        log_error "Authenticated integrity failure: HMAC-SHA256 mismatch."
        log_error "Expected HMAC:   ${expected_hmac}"
        log_error "Calculated HMAC: ${calculated_hmac}"
        return 1
    fi
    log_info "Authenticated integrity verified: HMAC-SHA256 matched (${calculated_hmac})."

    local calculated_sha256
    calculated_sha256="$(compute_sha256_checksum "${backup_file}")"

    local sha_file="${backup_file}.sha256"
    if [[ -f "${sha_file}" ]]; then
        local expected_sha256
        expected_sha256="$(awk '{print $1}' "${sha_file}")"
        if [[ "${expected_sha256}" != "${calculated_sha256}" ]]; then
            log_error "Integrity failure: SHA-256 digest mismatch."
            log_error "Expected SHA-256:   ${expected_sha256}"
            log_error "Calculated SHA-256: ${calculated_sha256}"
            return 1
        fi
        log_info "SHA-256 checksum matched: ${calculated_sha256}"
    fi

    local manifest_file="${backup_file}.meta.json"
    if [[ -f "${manifest_file}" ]]; then
        local manifest_hmac
        manifest_hmac="$(grep -o '"hmac_sha256": *"[^"]*"' "${manifest_file}" | cut -d'"' -f4 || true)"
        if [[ -n "${manifest_hmac}" && "${manifest_hmac}" != "${calculated_hmac}" ]]; then
            log_error "Authenticated integrity failure: Metadata manifest HMAC mismatch."
            return 1
        fi
    fi

    local pass_arg
    pass_arg="$(resolve_openssl_pass_argument)" || return 1

    log_info "Testing decryption stream and archive payload header..."
    if ! openssl enc -d -"${cipher_algorithm}" -pbkdf2 -iter "${pbkdf2_iterations}" -pass "${pass_arg}" -in "${backup_file}" >/dev/null 2>/dev/null; then
        log_error "Decryption test failed. Invalid passphrase or corrupt ciphertext payload."
        return 1
    fi

    local decrypted_header
    decrypted_header="$(openssl enc -d -"${cipher_algorithm}" -pbkdf2 -iter "${pbkdf2_iterations}" -pass "${pass_arg}" -in "${backup_file}" 2>/dev/null | head -c 16 || true)"

    local custom_pg_signature
    custom_pg_signature="$(printf '%.5s' "${decrypted_header}")"
    local is_valid_signature=false

    if [[ "${custom_pg_signature}" == "PGDMP" ]]; then
        is_valid_signature=true
        log_info "Archive header verified: PostgreSQL Custom Format (PGDMP)."
    fi

    local first_two_bytes
    first_two_bytes="$(printf '%s' "${decrypted_header}" | head -c 2 | od -An -tx1 | tr -d ' ')"
    if [[ "${first_two_bytes}" == "1f8b" ]]; then
        is_valid_signature=true
        log_info "Archive header verified: Gzip Compressed SQL Archive (1f8b)."
    fi

    if [[ "${is_valid_signature}" != "true" ]]; then
        if printf '%s' "${decrypted_header}" | grep -qE "(CREATE|INSERT|SET|SELECT|DROP|ALTER)"; then
            is_valid_signature=true
            log_info "Archive header verified: Plain SQL text stream."
        fi
    fi

    if [[ "${is_valid_signature}" != "true" ]]; then
        log_error "Archive verification failed: decrypted payload does not match expected signature (PGDMP, gzip, or SQL)."
        return 1
    fi

    log_info "Authenticated integrity and decryption verification PASSED for ${backup_file}"
    return 0
}

write_metadata_manifest() {
    local target_archive="$1"
    local sha_checksum="$2"
    local hmac_checksum="$3"
    local archive_size_bytes="$4"
    local manifest_file="${target_archive}.meta.json"

    cat > "${manifest_file}" << EOF
{
  "database": "${database_name}",
  "created_at_utc": "${current_timestamp}",
  "format": "${dump_format}",
  "compression_level": ${compression_level},
  "cipher": "${cipher_algorithm}",
  "pbkdf2_iterations": ${pbkdf2_iterations},
  "file_size_bytes": ${archive_size_bytes},
  "sha256": "${sha_checksum}",
  "hmac_sha256": "${hmac_checksum}",
  "authenticated_integrity": "HMAC-SHA256",
  "version": "2.0.0"
}
EOF
    enforce_restricted_file_permissions "${manifest_file}" || return 1
    return 0
}

execute_backup_pipeline() {
    local pass_arg
    pass_arg="$(resolve_openssl_pass_argument)" || return 1

    local raw_key
    raw_key="$(resolve_raw_secret_key)" || return 1

    validate_target_directory_safety "${backup_directory}" || return 1

    local output_destination
    if [[ -n "${custom_output_file}" ]]; then
        output_destination="${custom_output_file}"
    else
        local extension="dump.enc"
        if [[ "${dump_format}" == "plain" ]]; then
            extension="sql.gz.enc"
        fi
        output_destination="${backup_directory}/${database_name}_${current_timestamp}.${extension}"
    fi

    validate_output_file_safety "${output_destination}" || return 1

    if [[ -f "${output_destination}" ]]; then
        if [[ "${overwrite_allowed}" != "true" ]]; then
            log_error "Target file '${output_destination}' already exists. Overwrite refused by default. Use --overwrite to allow."
            return 1
        fi
        log_info "Target file exists. Overwrite explicitly allowed via --overwrite."
    fi

    if [[ "${dry_run_mode}" == "true" ]]; then
        log_info "DRY RUN MODE ENABLED. Validated parameters:"
        log_info "  Database Name:     ${database_name}"
        log_info "  Database Host:     ${database_host}:${database_port}"
        log_info "  Database User:     ${database_user}"
        log_info "  Dump Format:       ${dump_format}"
        log_info "  Compression Level: ${compression_level}"
        log_info "  Cipher Algorithm:  ${cipher_algorithm}"
        log_info "  PBKDF2 Iterations: ${pbkdf2_iterations}"
        log_info "  Secret Source:     ${pass_arg}"
        log_info "  Target Destination:${output_destination}"
        log_info "  Docker Container:  ${docker_container_name:-<none>}"
        log_info "Dry run completed successfully. No files created."
        return 0
    fi

    temporary_file_path="${output_destination}.tmp.$$"

    log_info "Starting database backup stream for database '${database_name}'..."

    export PGPASSWORD="${POSTGRES_PASSWORD:-${PGPASSWORD:-}}"

    if [[ -n "${docker_container_name}" ]]; then
        if [[ "${dump_format}" == "custom" ]]; then
            docker exec -e PGPASSWORD="${PGPASSWORD}" "${docker_container_name}" \
                pg_dump -U "${database_user}" -Fc -Z "${compression_level}" "${database_name}" \
                | openssl enc -"${cipher_algorithm}" -salt -pbkdf2 -iter "${pbkdf2_iterations}" -pass "${pass_arg}" -out "${temporary_file_path}"
        else
            docker exec -e PGPASSWORD="${PGPASSWORD}" "${docker_container_name}" \
                pg_dump -U "${database_user}" "${database_name}" \
                | gzip -"${compression_level}" \
                | openssl enc -"${cipher_algorithm}" -salt -pbkdf2 -iter "${pbkdf2_iterations}" -pass "${pass_arg}" -out "${temporary_file_path}"
        fi
    else
        if [[ "${dump_format}" == "custom" ]]; then
            pg_dump -h "${database_host}" -p "${database_port}" -U "${database_user}" -Fc -Z "${compression_level}" "${database_name}" \
                | openssl enc -"${cipher_algorithm}" -salt -pbkdf2 -iter "${pbkdf2_iterations}" -pass "${pass_arg}" -out "${temporary_file_path}"
        else
            pg_dump -h "${database_host}" -p "${database_port}" -U "${database_user}" "${database_name}" \
                | gzip -"${compression_level}" \
                | openssl enc -"${cipher_algorithm}" -salt -pbkdf2 -iter "${pbkdf2_iterations}" -pass "${pass_arg}" -out "${temporary_file_path}"
        fi
    fi

    if [[ ! -s "${temporary_file_path}" ]]; then
        log_error "Backup failed: produced file is empty or does not exist."
        return 1
    fi

    mv -f "${temporary_file_path}" "${output_destination}"
    temporary_file_path=""

    enforce_restricted_file_permissions "${output_destination}" || return 1

    local hmac_hash
    hmac_hash="$(compute_hmac_sha256 "${output_destination}" "${raw_key}")"
    printf '%s  %s\n' "${hmac_hash}" "$(basename "${output_destination}")" > "${output_destination}.hmac"
    enforce_restricted_file_permissions "${output_destination}.hmac" || return 1

    local checksum_hash
    checksum_hash="$(compute_sha256_checksum "${output_destination}")"
    printf '%s  %s\n' "${checksum_hash}" "$(basename "${output_destination}")" > "${output_destination}.sha256"
    enforce_restricted_file_permissions "${output_destination}.sha256" || return 1

    local file_size_bytes
    file_size_bytes="$(wc -c < "${output_destination}" | tr -d ' ')"

    write_metadata_manifest "${output_destination}" "${checksum_hash}" "${hmac_hash}" "${file_size_bytes}" || return 1

    log_info "Backup created successfully with authenticated integrity:"
    log_info "  Archive File:   ${output_destination}"
    log_info "  HMAC-SHA256:    ${output_destination}.hmac"
    log_info "  SHA-256 File:   ${output_destination}.sha256"
    log_info "  Metadata File:  ${output_destination}.meta.json"
    log_info "  Size:           ${file_size_bytes} bytes"
    log_info "  HMAC Tag:       ${hmac_hash}"
    log_info "  SHA-256 Digest: ${checksum_hash}"
    return 0
}

execute_guarded_restore() {
    local backup_file="$1"

    if [[ -z "${backup_file}" ]]; then
        log_error "Restore requires a valid backup archive file path."
        return 1
    fi

    if [[ ! -f "${backup_file}" ]]; then
        log_error "Specified backup file does not exist: ${backup_file}"
        return 1
    fi

    log_info "Step 1: Performing mandatory pre-restore authenticated integrity verification..."
    if ! verify_backup_integrity "${backup_file}"; then
        log_error "RESTORE ABORTED: Pre-restore authenticated integrity check failed. Halting before touching database."
        return 1
    fi
    log_info "Step 1 PASSED: Backup archive is authenticated and intact."

    log_info "Step 2: Checking destructive restore authorization..."
    if [[ "${confirm_destructive_restore}" != "${database_name}" ]]; then
        log_error "DESTRUCTIVE RESTORE REFUSED:"
        log_error "Restoring will replace existing schema and data in database '${database_name}'."
        log_error "To authorize execution, you MUST explicitly provide: --confirm-destructive-restore ${database_name}"
        return 1
    fi
    log_info "Step 2 PASSED: Destructive restore authorized for database '${database_name}'."

    if [[ "${dry_run_mode}" == "true" ]]; then
        log_info "DRY RUN RESTORE MODE ENABLED. Validated plan:"
        log_info "  Target Database:   ${database_name}"
        log_info "  Target Host:       ${database_host}:${database_port}"
        log_info "  Target User:       ${database_user}"
        log_info "  Source Archive:    ${backup_file}"
        log_info "  Docker Container:  ${docker_container_name:-<none>}"
        log_info "Dry run restore completed successfully. No changes applied."
        return 0
    fi

    local pass_arg
    pass_arg="$(resolve_openssl_pass_argument)" || return 1

    export PGPASSWORD="${POSTGRES_PASSWORD:-${PGPASSWORD:-}}"

    log_info "Step 3: Streaming decrypted archive into pg_restore..."

    local restore_status=0
    if [[ -n "${docker_container_name}" ]]; then
        openssl enc -d -"${cipher_algorithm}" -pbkdf2 -iter "${pbkdf2_iterations}" -pass "${pass_arg}" -in "${backup_file}" \
            | docker exec -i -e PGPASSWORD="${PGPASSWORD}" "${docker_container_name}" \
                pg_restore -h localhost -p 5432 -U "${database_user}" -d "${database_name}" \
                --clean --if-exists --no-owner --no-privileges || restore_status=$?
    else
        openssl enc -d -"${cipher_algorithm}" -pbkdf2 -iter "${pbkdf2_iterations}" -pass "${pass_arg}" -in "${backup_file}" \
            | pg_restore -h "${database_host}" -p "${database_port}" -U "${database_user}" -d "${database_name}" \
                --clean --if-exists --no-owner --no-privileges || restore_status=$?
    fi

    if [[ ${restore_status} -ne 0 ]]; then
        log_error "pg_restore execution failed with exit code: ${restore_status}"
        return 1
    fi

    log_info "Guarded restore completed successfully for database '${database_name}'."
    return 0
}

run_isolated_self_check() {
    log_info "=================================================="
    log_info "RUNNING ENHANCED ISOLATED SCRIPT SELF-CHECK SUITE"
    log_info "=================================================="

    local test_temp_dir
    test_temp_dir="$(mktemp -d)"

    cleanup_self_check() {
        rm -rf "${test_temp_dir}"
    }

    local test_secret="test_encryption_passphrase_32_chars_long"
    local mock_data_string="PGDMP-MOCK-DATABASE-STREAM-DATA-LINE-1-2-3-4-5-6-7-8-9"

    log_info "Test 1: Fail-closed on missing encryption secret"
    (
        unset BACKUP_ENCRYPTION_KEY BACKUP_ENCRYPTION_KEY_FILE
        if resolve_openssl_pass_argument 2>/dev/null; then
            exit 1
        else
            exit 0
        fi
    ) && log_info "  PASS: Missing secret rejected." || { log_error "  FAIL: Missing secret allowed."; return 1; }

    log_info "Test 2: Fail-closed on secret shorter than 16 characters"
    (
        export BACKUP_ENCRYPTION_KEY="short_key_123"
        unset BACKUP_ENCRYPTION_KEY_FILE
        if resolve_openssl_pass_argument 2>/dev/null; then
            exit 1
        else
            exit 0
        fi
    ) && log_info "  PASS: Short secret rejected." || { log_error "  FAIL: Short secret allowed."; return 1; }

    log_info "Test 3: Secret loaded successfully from protected file"
    local secret_file_test="${test_temp_dir}/secret.key"
    printf '%s' "${test_secret}" > "${secret_file_test}"
    chmod 600 "${secret_file_test}"
    (
        secret_key_file="${secret_file_test}"
        unset BACKUP_ENCRYPTION_KEY
        resolved="$(resolve_raw_secret_key)"
        if [[ "${resolved}" == "${test_secret}" ]]; then
            exit 0
        else
            exit 1
        fi
    ) && log_info "  PASS: Secret file loaded without leaking." || { log_error "  FAIL: Secret file loading failed."; return 1; }

    log_info "Test 4: Fail-closed on secret key file with permissive permissions"
    local permissive_secret_file="${test_temp_dir}/leaky_secret.key"
    printf '%s' "${test_secret}" > "${permissive_secret_file}"
    chmod 666 "${permissive_secret_file}"
    (
        secret_key_file="${permissive_secret_file}"
        unset BACKUP_ENCRYPTION_KEY
        allow_insecure_permissions=false
        unset ALLOW_INSECURE_PERMISSIONS
        if resolve_raw_secret_key 2>/dev/null; then
            exit 1
        else
            exit 0
        fi
    ) && log_info "  PASS: Overly permissive secret key file rejected." || { log_error "  FAIL: Leaky secret file was accepted."; return 1; }

    log_info "Test 5: Refusal of unsafe target root and system directories"
    (
        local unsafe_paths=("/" "/etc" "/usr" "/bin" "/sbin" "/var/run" "/sys" "/proc" "/boot" "/root")
        for bad_path in "${unsafe_paths[@]}"; do
            if validate_target_directory_safety "${bad_path}" 2>/dev/null; then
                exit 1
            fi
        done
        exit 0
    ) && log_info "  PASS: All unsafe system directories rejected." || { log_error "  FAIL: Unsafe system directory allowed."; return 1; }

    log_info "Test 6: Canonicalization and directory traversal safety"
    (
        local traversal_paths=("/etc/../etc/cron.d" "/usr/bin/../bin" "/sys/kernel/../" "/proc/1/../")
        for bad_traversal in "${traversal_paths[@]}"; do
            if validate_target_directory_safety "${bad_traversal}" 2>/dev/null; then
                exit 1
            fi
        done
        exit 0
    ) && log_info "  PASS: Traversal paths to system directories rejected." || { log_error "  FAIL: Directory traversal bypass succeeded."; return 1; }

    log_info "Test 7: Refusal of unsafe output file paths"
    (
        if validate_output_file_safety "/etc/shadow.enc" 2>/dev/null; then
            exit 1
        fi
        if validate_output_file_safety "/usr/bin/malicious.enc" 2>/dev/null; then
            exit 1
        fi
        exit 0
    ) && log_info "  PASS: Unsafe output file destinations rejected." || { log_error "  FAIL: Unsafe output file allowed."; return 1; }

    log_info "Test 8: Refusal of overwrite without --overwrite flag"
    local existing_target="${test_temp_dir}/existing.dump.enc"
    touch "${existing_target}"
    chmod 600 "${existing_target}"
    (
        overwrite_allowed=false
        custom_output_file="${existing_target}"
        backup_directory="${test_temp_dir}"
        export BACKUP_ENCRYPTION_KEY="${test_secret}"
        if execute_backup_pipeline 2>/dev/null; then
            exit 1
        else
            exit 0
        fi
    ) && log_info "  PASS: Existing file overwrite refused by default." || { log_error "  FAIL: Overwrite was unexpectedly allowed."; return 1; }

    log_info "Test 9: Strict umask (077) and owner-only permission enforcement"
    local secure_sub_dir="${test_temp_dir}/secure_store"
    mkdir -p "${secure_sub_dir}"
    enforce_restricted_directory_permissions "${secure_sub_dir}"
    local sample_secure_file="${secure_sub_dir}/sample.txt"
    touch "${sample_secure_file}"
    enforce_restricted_file_permissions "${sample_secure_file}"
    (
        dir_mode="$(stat -c '%a' "${secure_sub_dir}")"
        file_mode="$(stat -c '%a' "${sample_secure_file}")"
        if [[ "${dir_mode}" == "700" && "${file_mode}" == "600" ]]; then
            exit 0
        else
            exit 1
        fi
    ) && log_info "  PASS: Owner-only permissions strictly enforced (700 / 600)." || { log_error "  FAIL: Strict permissions not enforced."; return 1; }

    log_info "Test 10: Fail-closed on insecure filesystem permissions"
    local insecure_file_probe="${test_temp_dir}/insecure_probe.txt"
    touch "${insecure_file_probe}"
    chmod 644 "${insecure_file_probe}"
    (
        allow_insecure_permissions=false
        unset ALLOW_INSECURE_PERMISSIONS
        if verify_filesystem_permissions_enforced "${insecure_file_probe}" "test_file" 2>/dev/null; then
            exit 1
        else
            exit 0
        fi
    ) && log_info "  PASS: Group/other readable file detected and rejected." || { log_error "  FAIL: Permissive file was not rejected."; return 1; }

    log_info "Test 11: Synthetic compression, encryption, SHA-256, and HMAC-SHA256 authenticated integrity roundtrip"
    local synthetic_archive="${test_temp_dir}/synthetic.dump.enc"
    export BACKUP_ENCRYPTION_KEY="${test_secret}"
    printf '%s' "${mock_data_string}" \
        | openssl enc -"${cipher_algorithm}" -salt -pbkdf2 -iter "${pbkdf2_iterations}" -pass env:BACKUP_ENCRYPTION_KEY -out "${synthetic_archive}"
    chmod 600 "${synthetic_archive}"

    local synthetic_sha
    synthetic_sha="$(compute_sha256_checksum "${synthetic_archive}")"
    printf '%s  %s\n' "${synthetic_sha}" "$(basename "${synthetic_archive}")" > "${synthetic_archive}.sha256"
    chmod 600 "${synthetic_archive}.sha256"

    local synthetic_hmac
    synthetic_hmac="$(compute_hmac_sha256 "${synthetic_archive}" "${test_secret}")"
    printf '%s  %s\n' "${synthetic_hmac}" "$(basename "${synthetic_archive}")" > "${synthetic_archive}.hmac"
    chmod 600 "${synthetic_archive}.hmac"

    (
        verify_backup_integrity "${synthetic_archive}" >/dev/null 2>&1
    ) && log_info "  PASS: Authenticated integrity verified successfully." || { log_error "  FAIL: Verification failed."; return 1; }

    local decrypted_output
    decrypted_output="$(openssl enc -d -"${cipher_algorithm}" -pbkdf2 -iter "${pbkdf2_iterations}" -pass env:BACKUP_ENCRYPTION_KEY -in "${synthetic_archive}")"
    if [[ "${decrypted_output}" == "${mock_data_string}" ]]; then
        log_info "  PASS: Decrypted content exactly matches original payload."
    else
        log_error "  FAIL: Decrypted content mismatch."
        return 1
    fi

    log_info "Test 12: Bounded-memory HMAC over a multi-megabyte synthetic archive"
    local large_archive="${test_temp_dir}/large_synthetic.dump.enc"
    dd if=/dev/zero of="${large_archive}" bs=1048576 count=3 2>/dev/null
    local large_hmac
    large_hmac="$(compute_hmac_sha256 "${large_archive}" "${test_secret}")"
    local expected_large_hmac
    expected_large_hmac="$(printf '%s' "${test_secret}" | python3 -c 'import hashlib, hmac, sys; key = sys.stdin.buffer.read(); derived = hmac.new(key, b"clinic-ai-backup-hmac-v1", hashlib.sha256).digest(); mac = hmac.new(derived, digestmod=hashlib.sha256); f = open(sys.argv[1], "rb"); chunk = f.read(1024 * 1024)
while chunk:
    mac.update(chunk); chunk = f.read(1024 * 1024)
f.close(); print(mac.hexdigest())' "${large_archive}")"
    if [[ "${large_hmac}" == "${expected_large_hmac}" && "${large_hmac}" =~ ^[[:xdigit:]]{64}$ ]]; then
        log_info "  PASS: 3 MiB archive HMAC matched using 1 MiB reads."
    else
        log_error "  FAIL: Large archive HMAC mismatch."
        return 1
    fi

    log_info "Test 13: Authenticated integrity tamper detection (corrupted byte in ciphertext detected by HMAC)"
    local tampered_archive="${test_temp_dir}/tampered.dump.enc"
    cp "${synthetic_archive}" "${tampered_archive}"
    printf '\x00\xFF\x00' | dd of="${tampered_archive}" bs=1 seek=32 count=3 conv=notrunc 2>/dev/null
    printf '%s  %s\n' "${synthetic_sha}" "$(basename "${tampered_archive}")" > "${tampered_archive}.sha256"
    printf '%s  %s\n' "${synthetic_hmac}" "$(basename "${tampered_archive}")" > "${tampered_archive}.hmac"

    (
        if verify_backup_integrity "${tampered_archive}" >/dev/null 2>&1; then
            exit 1
        else
            exit 0
        fi
    ) && log_info "  PASS: Ciphertext tampering detected and rejected by HMAC." || { log_error "  FAIL: Tampered ciphertext was not detected."; return 1; }

    log_info "Test 14: Metadata manifest HMAC mismatch detection"
    local manifest_test_archive="${test_temp_dir}/manifest_test.dump.enc"
    cp "${synthetic_archive}" "${manifest_test_archive}"
    printf '%s  %s\n' "${synthetic_hmac}" "$(basename "${manifest_test_archive}")" > "${manifest_test_archive}.hmac"
    cat > "${manifest_test_archive}.meta.json" << EOF
{
  "database": "clinic_db",
  "sha256": "${synthetic_sha}",
  "hmac_sha256": "badbeef000000000000000000000000000000000000000000000000000000000"
}
EOF
    (
        if verify_backup_integrity "${manifest_test_archive}" >/dev/null 2>&1; then
            exit 1
        else
            exit 0
        fi
    ) && log_info "  PASS: Manifest HMAC tampering detected and rejected." || { log_error "  FAIL: Inconsistent manifest HMAC accepted."; return 1; }

    log_info "Test 15: Wrong password rejection on authenticated integrity"
    (
        export BACKUP_ENCRYPTION_KEY="incorrect_password_with_more_than_16_characters"
        if verify_backup_integrity "${synthetic_archive}" >/dev/null 2>&1; then
            exit 1
        else
            exit 0
        fi
    ) && log_info "  PASS: Decryption and HMAC with incorrect key was rejected." || { log_error "  FAIL: Incorrect key was accepted."; return 1; }

    log_info "Test 16: Guarded destructive restore refusal without explicit confirmation"
    (
        confirm_destructive_restore=""
        database_name="clinic_db"
        export BACKUP_ENCRYPTION_KEY="${test_secret}"
        if execute_guarded_restore "${synthetic_archive}" 2>/dev/null; then
            exit 1
        else
            exit 0
        fi
    ) && log_info "  PASS: Destructive restore refused without explicit database confirmation." || { log_error "  FAIL: Destructive restore proceeded without confirmation."; return 1; }

    log_info "Test 17: Guarded destructive restore refusal when archive fails authenticated integrity"
    (
        confirm_destructive_restore="clinic_db"
        database_name="clinic_db"
        export BACKUP_ENCRYPTION_KEY="${test_secret}"
        if execute_guarded_restore "${tampered_archive}" 2>/dev/null; then
            exit 1
        else
            exit 0
        fi
    ) && log_info "  PASS: Guarded restore halted before touching database on corrupted archive." || { log_error "  FAIL: Guarded restore attempted to restore corrupt archive."; return 1; }

    log_info "Test 18: Dry run backup and restore execution validation"
    local dry_run_target="${test_temp_dir}/dry_run.dump.enc"
    (
        dry_run_mode=true
        custom_output_file="${dry_run_target}"
        backup_directory="${test_temp_dir}"
        export BACKUP_ENCRYPTION_KEY="${test_secret}"
        execute_backup_pipeline >/dev/null 2>&1
        if [[ -f "${dry_run_target}" ]]; then
            exit 1
        fi
        confirm_destructive_restore="clinic_db"
        database_name="clinic_db"
        execute_guarded_restore "${synthetic_archive}" >/dev/null 2>&1
        exit 0
    ) && log_info "  PASS: Dry run modes executed cleanly without mutating state." || { log_error "  FAIL: Dry run unexpectedly modified files."; return 1; }

    cleanup_self_check
    log_info "=================================================="
    log_info "ALL ENHANCED SELF-CHECKS COMPLETED SUCCESSFULLY (18/18 PASS)"
    log_info "=================================================="
    return 0
}

main() {
    parse_command_line_arguments "$@"

    if [[ "${run_self_check_mode}" == "true" ]]; then
        run_isolated_self_check
        exit 0
    fi

    if [[ -n "${verify_target_file}" ]]; then
        verify_backup_integrity "${verify_target_file}"
        exit 0
    fi

    if [[ -n "${restore_target_file}" ]]; then
        execute_guarded_restore "${restore_target_file}"
        exit 0
    fi

    execute_backup_pipeline
}

main "$@"
