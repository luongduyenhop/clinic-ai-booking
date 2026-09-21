#!/usr/bin/env python3
"""
================================================================================
           AI AUDIT CLI (GPT-4o) - Clinic AI Booking Backend
  Tự động thu thập git log + diff + ruff -> Gọi thẳng OpenAI API -> Xuất báo cáo
================================================================================

Cách dùng:
  py ai_audit.py                  # Tự động review commit gần nhất bằng GPT-4o
  py ai_audit.py --uncommitted    # Review các thay đổi chưa commit (WIP / Working Tree)
  py ai_audit.py --commits 5      # Review phạm vi 5 commit gần nhất
  py ai_audit.py --model gpt-4o-mini  # Dùng model mini tiết kiệm chi phí
  py ai_audit.py --export-only    # Chỉ xuất file audit_context.md (không gọi API)

API Key:
  Script tự động đọc OPENAI_API_KEY từ file .env hoặc biến môi trường hệ thống.
  Nếu chưa có, script sẽ hỏi và tự động lưu vào .env để lần sau không phải nhập lại!
"""

import os
import sys
import json
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

MAX_DIFF_CHARS = 40_000  # Giới hạn an toàn cho diff (~10k tokens)
DEFAULT_MODEL = "gpt-4o"
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

SYSTEM_PROMPT = """Bạn là **Senior Software Architect & Principal Security Reviewer** của dự án **Clinic AI Booking** (Phòng Khám AI).
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
# Quản lý OPENAI_API_KEY
# ─────────────────────────────────────────────────────────────────────────────

def get_api_key_from_env_file() -> str:
    """Đọc OPENAI_API_KEY từ file .env nếu có."""
    if not ENV_FILE.exists():
        return ""
    try:
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("OPENAI_API_KEY="):
                    key = line.split("=", 1)[1].strip()
                    # Loại bỏ dấu nháy đơn/kép nếu có
                    if (key.startswith('"') and key.endswith('"')) or (key.startswith("'") and key.endswith("'")):
                        key = key[1:-1]
                    return key
    except Exception:
        pass
    return ""


def save_api_key_to_env_file(api_key: str):
    """Lưu OPENAI_API_KEY vào file .env."""
    try:
        if ENV_FILE.exists():
            content = ENV_FILE.read_text(encoding="utf-8")
            if "OPENAI_API_KEY=" in content:
                lines = [
                    f"OPENAI_API_KEY={api_key}" if line.startswith("OPENAI_API_KEY=") else line
                    for line in content.splitlines()
                ]
                content = "\n".join(lines) + "\n"
            else:
                content += f"\n# OpenAI API Key (dùng cho AI Code Audit & Review)\nOPENAI_API_KEY={api_key}\n"
            ENV_FILE.write_text(content, encoding="utf-8")
        else:
            # Tạo .env mới từ .env.example hoặc tạo mới
            example_file = BASE_DIR / ".env.example"
            header = ""
            if example_file.exists():
                header = example_file.read_text(encoding="utf-8") + "\n"
            header += f"\n# OpenAI API Key (dùng cho AI Code Audit & Review)\nOPENAI_API_KEY={api_key}\n"
            ENV_FILE.write_text(header, encoding="utf-8")
        print("   [OK] Đã lưu OPENAI_API_KEY vào file .env!")
    except Exception as e:
        print(f"   [CẢNH BÁO] Không thể ghi vào .env: {e}")


def resolve_api_key() -> str:
    """Tìm API key qua env var, .env hoặc hỏi người dùng trực tiếp."""
    # 1. Biến môi trường hệ thống
    key = os.environ.get("OPENAI_API_KEY", "").strip()
    if key:
        return key

    # 2. Đọc từ file .env
    key = get_api_key_from_env_file()
    if key:
        return key

    # 3. Hỏi người dùng trên terminal
    print("\n" + "=" * 65)
    print("  [?] CHƯA TÌM THẤY OPENAI_API_KEY")
    print("=" * 65)
    print("  Để tự động gọi GPT-4o mà không cần copy/paste thủ công,")
    print("  vui lòng nhập OpenAI API Key của bạn (bắt đầu bằng sk-...):")
    try:
        user_key = input("  > API Key: ").strip()
    except (EOFError, KeyboardInterrupt):
        print("\n[Huỷ bỏ] Không có API Key. Thoát.")
        sys.exit(1)

    if not user_key:
        print("[Lỗi] API Key không được để trống!")
        sys.exit(1)

    # Hỏi có muốn lưu vào .env không
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

    # Cắt ngắn diff nếu quá lớn để không tràn context
    if len(git_diff) > MAX_DIFF_CHARS:
        cut_len = len(git_diff) - MAX_DIFF_CHARS
        git_diff = git_diff[:MAX_DIFF_CHARS] + f"\n\n... [Đã cắt bớt {cut_len:,} ký tự diff để tối ưu token] ..."

    # Chạy Ruff check
    ruff_res = run_cmd(["py", "-m", "ruff", "check", ".", "--output-format=concise"])
    if not ruff_res:
        ruff_res = run_cmd(["python", "-m", "ruff", "check", ".", "--output-format=concise"])
    if not ruff_res or "All checks passed" in ruff_res:
        ruff_output = "All checks passed! (Không phát hiện lỗi cú pháp hay linting)"
    else:
        ruff_output = ruff_res

    # Thống kê thành viên an toàn (truyền HEAD để không treo stdin)
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
# Gọi OpenAI API (Hỗ trợ streaming hoặc request chuẩn)
# ─────────────────────────────────────────────────────────────────────────────

def call_openai_api(api_key: str, prompt: str, model: str = DEFAULT_MODEL) -> str:
    """Gọi OpenAI API sử dụng thư viện requests (hoặc urllib nếu requests thiếu)."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2
    }

    try:
        import requests
        resp = requests.post(OPENAI_API_URL, headers=headers, json=payload, timeout=120)
        if not resp.ok:
            try:
                err_data = resp.json()
                err_msg = err_data.get("error", {}).get("message", resp.text)
            except Exception:
                err_msg = resp.text
            raise RuntimeError(f"OpenAI API trả về mã lỗi {resp.status_code}: {err_msg}")

        result_json = resp.json()
        return result_json["choices"][0]["message"]["content"]
    except ImportError:
        # Fallback sang urllib chuẩn của Python
        import urllib.request
        req = urllib.request.Request(
            OPENAI_API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["choices"][0]["message"]["content"]


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="AI Audit CLI (GPT-4o) - Tự động review code không cần copy/paste thủ công",
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
        help=f"Model OpenAI sử dụng (mặc định: {DEFAULT_MODEL})"
    )
    parser.add_argument(
        "--export-only",
        action="store_true",
        help="Chỉ xuất context ra file audit_context.md, không gọi API"
    )

    args = parser.parse_args()

    print("\n" + "=" * 65)
    print("  🤖 AI CODE AUDITOR (GPT-4o) - Clinic AI Booking")
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

    # 3. Gọi GPT-4o
    print(f"\n[2/3] Đang gửi dữ liệu tới OpenAI ({args.model}) để phân tích...")
    print("      (Vui lòng đợi vài giây để AI đọc toàn bộ diff và viết báo cáo...)")

    try:
        review_result = call_openai_api(api_key, prompt_text, model=args.model)
    except Exception as e:
        print(f"\n[LỖI GỌI API] {e}")
        print(f"Bạn vẫn có thể mở file '{OUTPUT_CONTEXT_FILE.name}' để copy thủ công nếu cần.")
        sys.exit(1)

    # 4. Xuất kết quả
    report_content = f"""# 🏥 BÁO CÁO AI CODE AUDIT ({args.model.upper()})
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
    print("  [3/3] KẾT QUẢ REVIEW TỪ GPT-4o:")
    print("=" * 65 + "\n")
    print(review_result)
    print("\n" + "=" * 65)
    print(f"  [XONG] Toàn bộ báo cáo đã được lưu vào: {OUTPUT_REPORT_FILE.name}")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    main()
