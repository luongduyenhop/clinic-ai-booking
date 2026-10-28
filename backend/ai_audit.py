#!/usr/bin/env python3
"""
================================================================================
        AI AUDIT CLI (Google Gemini Pro) - Clinic AI Booking Backend
  Tự động thu thập git log + diff + ruff -> Gọi thẳng Gemini API -> Xuất báo cáo
================================================================================

Cách dùng:
  py ai_audit.py                  # Tự động review commit gần nhất bằng Gemini Pro
  py ai_audit.py --uncommitted    # Review các thay đổi chưa commit (WIP / Working Tree)
  py ai_audit.py --commits 5      # Review phạm vi 5 commit gần nhất
  py ai_audit.py --model gemini-2.0-flash  # Dùng model flash siêu nhanh
  py ai_audit.py --export-only    # Chỉ xuất file audit_context.md (không gọi API)

API Key:
  Script tự động đọc GEMINI_API_KEY từ file .env hoặc biến môi trường hệ thống.
  Nếu chưa có, script sẽ hỏi và tự động lưu vào .env để lần sau không phải nhập lại!
  (Lấy API Key hoàn toàn miễn phí tại: https://aistudio.google.com/app/apikey)
"""

import os
import sys
import argparse
import subprocess
from datetime import datetime
from pathlib import Path

# Bật UTF-8 cho terminal Windows
os.environ.setdefault("PYTHONUTF8", "1")
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Thư mục gốc backend
BASE_DIR = Path(__file__).resolve().parent
ENV_FILE = BASE_DIR / ".env"
OUTPUT_REPORT_FILE = BASE_DIR / "audit_report.md"
OUTPUT_CONTEXT_FILE = BASE_DIR / "audit_context.md"

MAX_DIFF_CHARS = 80_000  # Gemini hỗ trợ context tới >1 triệu tokens
DEFAULT_MODEL = "gemini-1.5-flash"
FALLBACK_MODELS = ["gemini-2.0-flash", "gemini-1.5-pro"]
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"

SYSTEM_PROMPT = """Bạn là **Lead Software Architect & Senior Security Reviewer** của dự án **Clinic AI Booking** (Phòng Khám AI).
Stack kỹ thuật:
- FastAPI + Python 3.11 + Pydantic v2
- SQLAlchemy 2.0 Async + PostgreSQL 15 (OpenMRS Patient Pattern)
- Kiến trúc phân tầng: Router -> Service -> Model -> Database
- Domain: Quản lý bệnh nhân, lịch hẹn khám, AI sàng lọc triệu chứng & Red Flags cấp cứu

Hãy đọc kỹ toàn bộ Git Log, Git Diff và kết quả Linter được cung cấp, sau đó đánh giá chi tiết theo format Markdown (bằng tiếng Việt):

## 1. 🔴 Lỗ Hổng & Rủi Ro Tiềm Ẩn (Bắt Buộc Sửa)
- Lỗi cú pháp, logic, bug tiềm ẩn, ngoại lệ chưa xử lý
- Rủi ro an ninh: SQL injection, hardcode credentials, bypass auth/role
- Bất đồng bộ dữ liệu: sai lệch giữa Pydantic Schemas, SQLAlchemy Models và DB

## 2. 🟡 Đánh Giá Phân Tầng Kiến Trúc & Clean Code
- Có vi phạm ranh giới phân tầng (Router -> Service -> Model) không?
- Đặt tên biến, tái sử dụng code, xử lý session database async chuẩn chưa?

## 3. 🟢 Điểm Tốt Đã Làm Được
- Những thiết kế, refactor hoặc quy chuẩn đã tuân thủ tốt, nên phát huy.

## 4. 🚀 3 Việc Cần Làm Tiếp Theo (Next Steps)
- 3 đầu việc quan trọng và cấp thiết nhất cần làm ở commit/sprint tiếp theo, nêu rõ file và lý do.
"""


# ─────────────────────────────────────────────────────────────────────────────
# Quản lý GEMINI_API_KEY
# ─────────────────────────────────────────────────────────────────────────────

def get_api_key_from_env_file() -> str:
    """Đọc GEMINI_API_KEY từ file .env nếu có."""
    if not ENV_FILE.exists():
        return ""
    try:
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("GEMINI_API_KEY="):
                    key = line.split("=", 1)[1].strip()
                    if (key.startswith('"') and key.endswith('"')) or (key.startswith("'") and key.endswith("'")):
                        key = key[1:-1]
                    return key
    except Exception:
        pass
    return ""


def save_api_key_to_env_file(api_key: str):
    """Lưu GEMINI_API_KEY vào file .env."""
    try:
        if ENV_FILE.exists():
            content = ENV_FILE.read_text(encoding="utf-8")
            if "GEMINI_API_KEY=" in content:
                lines = [
                    f"GEMINI_API_KEY={api_key}" if line.startswith("GEMINI_API_KEY=") else line
                    for line in content.splitlines()
                ]
                content = "\n".join(lines) + "\n"
            else:
                content += f"\n# Google Gemini API Key (dùng cho AI Code Audit & Review)\nGEMINI_API_KEY={api_key}\n"
            ENV_FILE.write_text(content, encoding="utf-8")
        else:
            example_file = BASE_DIR / ".env.example"
            header = ""
            if example_file.exists():
                header = example_file.read_text(encoding="utf-8") + "\n"
            header += f"\n# Google Gemini API Key (dùng cho AI Code Audit & Review)\nGEMINI_API_KEY={api_key}\n"
            ENV_FILE.write_text(header, encoding="utf-8")
        print("   [OK] Đã lưu GEMINI_API_KEY vào file .env!")
    except Exception as e:
        print(f"   [CẢNH BÁO] Không thể ghi vào .env: {e}")


def resolve_api_key() -> str:
    """Tìm API key qua env var, .env hoặc hỏi người dùng trực tiếp."""
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if key:
        return key

    key = get_api_key_from_env_file()
    if key:
        return key

    print("\n" + "=" * 65)
    print("  [?] CHƯA TÌM THẤY GEMINI_API_KEY")
    print("=" * 65)
    print("  Lấy API Key miễn phí tại: https://aistudio.google.com/app/apikey")
    print("  Vui lòng nhập Google Gemini API Key của bạn (bắt đầu bằng AIza...):")
    try:
        user_key = input("  > API Key: ").strip()
    except (EOFError, KeyboardInterrupt):
        print("\n[Huỷ bỏ] Không có API Key. Thoát.")
        sys.exit(1)

    if not user_key:
        print("[Lỗi] API Key không được để trống!")
        sys.exit(1)

    try:
        save_choice = input("  > Bạn có muốn lưu vào .env để lần sau không cần nhập lại? (Y/n): ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        save_choice = "y"

    if save_choice in ("", "y", "yes"):
        save_api_key_to_env_file(user_key)

    return user_key


# ─────────────────────────────────────────────────────────────────────────────
# Thu thập thông tin Git & Ruff
# ─────────────────────────────────────────────────────────────────────────────

def run_cmd(cmd: list[str]) -> str:
    """Chạy command an toàn, không treo stdin."""
    try:
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            cwd=BASE_DIR
        )
        return res.stdout.strip()
    except Exception as e:
        return f"[Lỗi lệnh {' '.join(cmd)}: {e}]"


def collect_audit_data(n_commits: int = 1, uncommitted: bool = False) -> dict:
    """Gom toàn bộ dữ liệu Git diff, log và linter."""
    branch = run_cmd(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    last_sha = run_cmd(["git", "rev-parse", "--short", "HEAD"])

    if uncommitted:
        mode_desc = "Thay đổi chưa commit (Uncommitted Working Tree & Staged)"
        git_diff_stat = run_cmd(["git", "diff", "HEAD", "--stat"])
        git_diff = run_cmd(["git", "diff", "HEAD", "-U3"])
        changed_files = run_cmd(["git", "diff", "HEAD", "--name-status"])
        git_log = run_cmd(["git", "log", "-n", "3", "--pretty=format:[%h] %ad | %an | %s", "--date=short"])
    else:
        mode_desc = f"{n_commits} commit gần nhất trên nhánh '{branch}'"
        target_ref = f"HEAD~{n_commits}"
        git_diff_stat = run_cmd(["git", "diff", target_ref, "HEAD", "--stat"])
        git_diff = run_cmd(["git", "diff", target_ref, "HEAD", "-U3"])
        changed_files = run_cmd(["git", "diff", target_ref, "HEAD", "--name-status"])
        git_log = run_cmd(["git", "log", "-n", str(n_commits), "--pretty=format:[%h] %ad | %an | %s", "--date=short"])

    if len(git_diff) > MAX_DIFF_CHARS:
        cut_len = len(git_diff) - MAX_DIFF_CHARS
        git_diff = git_diff[:MAX_DIFF_CHARS] + f"\n\n... [Đã cắt bớt {cut_len:,} ký tự diff để tối ưu] ..."

    ruff_res = run_cmd(["py", "-m", "ruff", "check", ".", "--output-format=concise"])
    if not ruff_res:
        ruff_res = run_cmd(["python", "-m", "ruff", "check", ".", "--output-format=concise"])
    if not ruff_res or "All checks passed" in ruff_res:
        ruff_output = "All checks passed! (Không phát hiện lỗi cú pháp hay linting)"
    else:
        ruff_output = ruff_res

    shortlog = run_cmd(["git", "shortlog", "-sn", "--no-merges", "HEAD"])

    return {
        "branch": branch,
        "last_sha": last_sha,
        "mode_desc": mode_desc,
        "git_log": git_log,
        "changed_files": changed_files,
        "git_diff_stat": git_diff_stat,
        "git_diff": git_diff,
        "ruff_output": ruff_output,
        "shortlog": shortlog,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }


def build_audit_prompt(data: dict) -> str:
    """Ghép context thành prompt gửi cho AI."""
    return f"""# THÔNG TIN MÃ NGUỒN CẦN AUDIT
- **Dự án**: Clinic AI Booking (FastAPI Backend)
- **Thời gian**: {data['timestamp']}
- **Nhánh**: `{data['branch']}` | **Commit**: `{data['last_sha']}`
- **Phạm vi**: {data['mode_desc']}

---
## 1. LỊCH SỬ COMMIT GẦN NHẤT
```text
{data['git_log'] or 'Không có commit nào'}
```

## 2. FILE THAY ĐỔI & THỐNG KÊ
```text
{data['changed_files'] or 'Không có file thay đổi'}
```
**Diff Stat:**
```text
{data['git_diff_stat'] or 'Không có thay đổi'}
```

## 3. CHI TIẾT GIT DIFF
```diff
{data['git_diff'] or 'Diff rỗng'}
```

## 4. KẾT QUẢ RUFF LINTER
```text
{data['ruff_output']}
```

---
Hãy đánh giá mã nguồn trên theo đúng 4 mục yêu cầu. Trả lời bằng tiếng Việt.
"""


# ─────────────────────────────────────────────────────────────────────────────
# Gọi Google Gemini API (Tự động nhận diện model khả dụng)
# ─────────────────────────────────────────────────────────────────────────────

def get_available_gemini_models(api_key: str) -> list[str]:
    """Truy vấn trực tiếp Google API để lấy danh sách các model khả dụng cho API Key này."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    try:
        import requests
        resp = requests.get(url, timeout=15)
        if resp.ok:
            data = resp.json()
            models = []
            for m in data.get("models", []):
                methods = m.get("supportedGenerationMethods", [])
                if "generateContent" in methods:
                    name = m.get("name", "").replace("models/", "")
                    if any(bad in name.lower() for bad in ["-tts", "embedding", "imagen", "aqa", "realtime"]):
                        continue
                    if "gemini" in name.lower():
                        models.append(name)
            if models:
                def priority(name: str) -> int:
                    score = 0
                    if "3.6-flash" in name:
                        score += 100
                    elif "3.1-pro" in name:
                        score += 90
                    elif "3.0-flash" in name:
                        score += 80
                    elif "3.0-pro" in name:
                        score += 70
                    elif "3" in name and "flash" in name:
                        score += 60
                    elif "3" in name and "pro" in name:
                        score += 50
                    elif "flash" in name:
                        score += 30
                    elif "pro" in name:
                        score += 20
                    return -score

                models.sort(key=priority)
                return models
    except Exception as e:
        print(f"[WARN] Không thể lấy danh sách model tự động: {e}")

    return ["gemini-3.6-flash", "gemini-3.1-pro-preview", "gemini-2.5-flash", "gemini-1.5-flash"]


def call_gemini_api(api_key: str, prompt: str, primary_model: str = DEFAULT_MODEL) -> str:
    """Gọi Gemini API với cơ chế tự động nhận diện model khả dụng của Google."""
    try:
        import requests
    except ImportError:
        print("[LỖI] Thiếu thư viện requests. Hãy chạy: py -m pip install requests")
        sys.exit(1)

    clean_key = api_key.strip().strip('"').strip("'").replace("\n", "").replace("\r", "")
    candidate_models = get_available_gemini_models(clean_key)
    if primary_model not in candidate_models:
        candidate_models.insert(0, primary_model)

    payload = {
        "systemInstruction": {
            "parts": [{"text": SYSTEM_PROMPT}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 4096
        }
    }
    headers = {"Content-Type": "application/json"}

    errors = []
    for model in candidate_models[:4]:
        url = f"{GEMINI_API_BASE}/{model}:generateContent?key={clean_key}"
        print(f"      -> Đang gửi dữ liệu tới Google Gemini ({model})...")
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=90)
            if resp.ok:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    review_text = "".join(p.get("text", "") for p in parts)
                    if review_text.strip():
                        return review_text
                    else:
                        errors.append(f"Model '{model}': Trả về phản hồi rỗng.")
                else:
                    feedback = data.get("promptFeedback", {})
                    errors.append(f"Model '{model}': Bị chặn bởi promptFeedback: {feedback}")
            else:
                err_msg = f"HTTP {resp.status_code} ({model}): {resp.text[:300]}"
                print(f"      [WARN] {err_msg}")
                errors.append(err_msg)
        except Exception as e:
            err_msg = f"ConnectionError ({model}): {e}"
            print(f"      [WARN] {err_msg}")
            errors.append(err_msg)

    combined_errors = "\n".join(f"- {e}" for e in errors)
    raise RuntimeError(f"Tất cả các model Gemini đều thất bại:\n{combined_errors}")


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="AI Audit CLI (Gemini Pro) - Tự động review code không cần copy/paste thủ công",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument(
        "--commits", "-n",
        type=int,
        default=1,
        help="Số lượng commit gần nhất cần review (mặc định: 1)"
    )
    parser.add_argument(
        "--uncommitted", "-u",
        action="store_true",
        help="Review toàn bộ các thay đổi chưa commit trong thư mục làm việc"
    )
    parser.add_argument(
        "--model", "-m",
        type=str,
        default=DEFAULT_MODEL,
        help=f"Model Gemini sử dụng (mặc định: {DEFAULT_MODEL})"
    )
    parser.add_argument(
        "--export-only",
        action="store_true",
        help="Chỉ xuất context ra file audit_context.md, không gọi API"
    )

    args = parser.parse_args()

    print("\n" + "=" * 65)
    print("  🤖 AI CODE AUDITOR (Google Gemini Pro) - Clinic AI Booking")
    print("=" * 65)

    # 1. Thu thập dữ liệu
    print("\n[1/3] Đang thu thập Git diff, logs và kiểm tra linter...")
    data = collect_audit_data(n_commits=args.commits, uncommitted=args.uncommitted)
    prompt_text = build_audit_prompt(data)

    # Lưu context ra file dự phòng
    OUTPUT_CONTEXT_FILE.write_text(prompt_text, encoding="utf-8")
    print(f"   ✓ Nhánh: {data['branch']} | Commit: {data['last_sha']}")
    print(f"   ✓ Phạm vi: {data['mode_desc']}")
    print(f"   ✓ Kích thước diff: {len(data['git_diff']):,} ký tự")
    print(f"   ✓ Đã lưu context dự phòng: {OUTPUT_CONTEXT_FILE.name}")

    if args.export_only:
        print("\n[OK] Chế độ --export-only: Đã lưu context, không gọi API.")
        return

    # 2. Lấy API Key
    api_key = resolve_api_key()

    # 3. Gọi Gemini Pro
    print(f"\n[2/3] Đang gửi dữ liệu tới Google Gemini ({args.model}) để phân tích...")
    print("      (Vui lòng đợi vài giây để AI đọc toàn bộ diff và viết báo cáo...)")

    try:
        review_result = call_gemini_api(api_key, prompt_text, primary_model=args.model)
    except Exception as e:
        print(f"\n[LỖI GỌI API] {e}")
        print(f"Bạn vẫn có thể mở file '{OUTPUT_CONTEXT_FILE.name}' để copy thủ công nếu cần.")
        sys.exit(1)

    # 4. Xuất kết quả
    report_content = f"""# 🏥 BÁO CÁO AI CODE AUDIT (GEMINI PRO)
> **Thời gian tạo:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  
> **Nhánh:** `{data['branch']}` | **Commit:** `{data['last_sha']}`  
> **Phạm vi kiểm tra:** {data['mode_desc']}  

---

{review_result}

---
*Báo cáo được tạo tự động bởi `py ai_audit.py` (Clinic AI Booking System).*
"""
    OUTPUT_REPORT_FILE.write_text(report_content, encoding="utf-8")

    print("\n" + "=" * 65)
    print("  [3/3] KẾT QUẢ REVIEW TỪ GEMINI PRO:")
    print("=" * 65 + "\n")
    print(review_result)
    print("\n" + "=" * 65)
    print(f"  [XONG] Toàn bộ báo cáo đã được lưu vào: {OUTPUT_REPORT_FILE.name}")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
