#!/usr/bin/env python3
"""
================================================================================
            AI AUDIT SCRIPT - Clinic AI Booking Backend
  Gom context git log + diff + ruff -> audit_context.md -> paste vao ChatGPT
================================================================================

Cach dung:
  py ai_audit.py               # Xuat context cua 5 commit gan nhat
  py ai_audit.py --commits 10  # Xuat context cua 10 commit gan nhat
  py ai_audit.py --full        # Them full diff tung file vao context

Sau khi chay:
  -> File audit_context.md duoc tao trong thu muc hien tai
  -> Copy toan bo noi dung file do va paste vao ChatGPT
"""

import os
import subprocess
import sys
import argparse
from datetime import datetime
from pathlib import Path

# Bat UTF-8 mode cho Python tren Windows
os.environ.setdefault("PYTHONUTF8", "1")


# ─────────────────────────────────────────────────────────────────────────────
# Cau hinh
# ─────────────────────────────────────────────────────────────────────────────
OUTPUT_FILE = "audit_context.md"
MAX_DIFF_CHARS = 8000  # Gioi han ky tu cho git diff (tranh token overflow)
MAX_LOG_ENTRIES = 5    # Mac dinh lay 5 commit gan nhat


SYSTEM_PROMPT = """
╔══════════════════════════════════════════════════════════════════════════════╗
║                    SYSTEM PROMPT - DÁN VÀO GEMINI/CHATGPT                   ║
╚══════════════════════════════════════════════════════════════════════════════╝

**Role:** Bạn là Principal Software Architect và Senior Security Reviewer của dự án
Phòng Khám AI (Clinic AI Booking) - hệ thống FastAPI + PostgreSQL + Async SQLAlchemy.

**Nhiệm vụ:** Tôi sẽ cung cấp cho bạn:
1. Tóm tắt lịch sử commit gần nhất.
2. Git diff chi tiết của đợt cập nhật này.
3. Output của Ruff linter.
4. Thống kê file đã thay đổi.

**Hãy đánh giá theo đúng cấu trúc sau (trả lời bằng tiếng Việt):**

### 1. 🔴 Lỗ hổng & Rủi ro tiềm ẩn
Chỉ ra lỗi logic, rủi ro bảo mật, nguy cơ bất đồng bộ dữ liệu
(giữa SQLAlchemy Model và DB Schema / API Response).

### 2. 🟡 Phân tích kiến trúc
Code mới có vi phạm tính đóng gói, phân tầng (Router → Service → Model) không?
Có dependency cycle, business logic rò rỉ vào tầng sai không?

### 3. 🟢 Điểm tốt trong commit này
Những gì được thực hiện đúng chuẩn, nên duy trì.

### 4. 🚀 3 Hành động tiếp theo quan trọng nhất (Next Steps)
3 việc cụ thể, ưu tiên nhất cần làm trong commit tiếp theo.
Ghi rõ: tên file/module cần sửa, lý do, mức độ ưu tiên (CRITICAL / HIGH / MEDIUM).

---
**Context dự án:**
- FastAPI + SQLAlchemy 2.0 Async + PostgreSQL 15
- Kiến trúc: Router → Service Layer → SQLAlchemy Models
- Domain: Phòng khám AI (đặt lịch, AI phân loại triệu chứng, hồ sơ bệnh nhân)
- Chuẩn: OpenMRS Patient Pattern, Pydantic v2, Python 3.11
"""


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def run_cmd(cmd: list[str], capture_stderr: bool = False) -> str:
    """Chạy command và trả về stdout. Trả về chuỗi rỗng nếu lỗi."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        output = result.stdout
        if capture_stderr and result.stderr:
            output += result.stderr
        return output.strip()
    except FileNotFoundError:
        return f"[ERROR] Không tìm thấy lệnh: {' '.join(cmd)}"
    except Exception as e:
        return f"[ERROR] {e}"


def truncate(text: str, max_chars: int, label: str = "") -> str:
    """Cắt bớt nội dung quá dài để tránh tràn token."""
    if len(text) <= max_chars:
        return text
    truncated = text[:max_chars]
    lines_cut = text[max_chars:].count('\n')
    return truncated + f"\n\n... [Đã cắt bớt {len(text) - max_chars:,} ký tự / ~{lines_cut} dòng để tránh tràn token] ..."


def section(title: str, content: str, lang: str = "") -> str:
    """Tạo một section markdown chuẩn."""
    if not content:
        content = "_Không có dữ liệu_"
    code_block = f"```{lang}\n{content}\n```" if lang else content
    return f"\n## {title}\n\n{code_block}\n"


def check_git_repo() -> bool:
    """Kiểm tra có đang trong git repo không."""
    result = subprocess.run(
        ["git", "rev-parse", "--git-dir"],
        capture_output=True
    )
    return result.returncode == 0


def check_ruff_available() -> bool:
    """Kiểm tra ruff đã được cài chưa."""
    result = subprocess.run(
        ["python", "-m", "ruff", "--version"],
        capture_output=True
    )
    if result.returncode != 0:
        result = subprocess.run(
            ["py", "-m", "ruff", "--version"],
            capture_output=True
        )
    return result.returncode == 0


# ─────────────────────────────────────────────────────────────────────────────
# Thu thập dữ liệu
# ─────────────────────────────────────────────────────────────────────────────

def get_branch_info() -> dict:
    """Lấy thông tin branch hiện tại."""
    branch = run_cmd(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    remote = run_cmd(["git", "remote", "get-url", "origin"])
    last_commit_hash = run_cmd(["git", "rev-parse", "--short", "HEAD"])
    return {
        "branch": branch,
        "remote": remote,
        "last_commit": last_commit_hash
    }


def get_git_log(n: int) -> str:
    """Lấy n commit gần nhất theo format ngắn gọn."""
    return run_cmd([
        "git", "log", f"-n{n}",
        "--pretty=format:[%h] %ad | %an | %s",
        "--date=short"
    ])


def get_git_diff(full: bool = False) -> str:
    """Lấy git diff giữa HEAD~1 và HEAD."""
    if full:
        diff = run_cmd(["git", "diff", "HEAD~1", "HEAD"])
    else:
        # Chỉ lấy diff ngắn gọn (stat + diff của từng file)
        diff = run_cmd(["git", "diff", "HEAD~1", "HEAD", "--stat"])
        diff += "\n\n" + run_cmd(["git", "diff", "HEAD~1", "HEAD", "-U3"])  # Context 3 dòng thay vì 10

    return truncate(diff, MAX_DIFF_CHARS)


def get_changed_files() -> str:
    """Lấy danh sách file đã thay đổi trong commit cuối."""
    return run_cmd(["git", "diff", "HEAD~1", "HEAD", "--name-status"])


def get_ruff_output() -> str:
    """Chạy ruff check và lấy kết quả."""
    # Thử python trước, nếu không được thì thử py
    for python_cmd in [["python", "-m", "ruff"], ["py", "-m", "ruff"]]:
        result = subprocess.run(
            python_cmd + ["check", ".", "--output-format=concise"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace"
        )
        if result.returncode in [0, 1]:  # 0 = clean, 1 = co loi (binh thuong)
            output = result.stdout.strip()
            if not output:
                return "All checks passed! (Ruff: Khong co loi nao)"
            return output

    return "[WARNING] Khong the chay ruff. Hay chay: py -m pip install ruff"


def get_project_stats() -> str:
    """Thống kê nhanh về codebase."""
    stats = []

    # Đếm số file Python
    py_files = run_cmd(["git", "ls-files", "*.py"])
    py_count = len(py_files.splitlines()) if py_files else 0
    stats.append(f"- Tổng file Python được track bởi git: **{py_count} file**")

    # Tổng commit
    total_commits = run_cmd(["git", "rev-list", "--count", "HEAD"])
    stats.append(f"- Tổng số commit trong branch: **{total_commits}**")

    # Contributor
    contributors = run_cmd(["git", "shortlog", "-sn", "--no-merges"])
    if contributors:
        stats.append(f"\n**Đóng góp theo thành viên:**\n```\n{contributors}\n```")

    return "\n".join(stats)


# ─────────────────────────────────────────────────────────────────────────────
# Tổng hợp và xuất ra file
# ─────────────────────────────────────────────────────────────────────────────

def generate_audit_context(n_commits: int = 5, full_diff: bool = False) -> Path:
    """Tong hop toan bo context va ghi ra file markdown."""

    print("[...] Dang thu thap du lieu tu Git...")

    if not check_git_repo():
        print("[ERR] Thu muc hien tai khong phai Git repository!")
        print("      Hay chay script nay tu thu muc goc cua du an backend/")
        sys.exit(1)

    # Thu thập dữ liệu
    branch_info = get_branch_info()
    print(f"   Branch: {branch_info['branch']} | Commit: {branch_info['last_commit']}")

    git_log = get_git_log(n_commits)
    print(f"   Git log: {n_commits} commit gan nhat")

    changed_files = get_changed_files()
    print(f"   File thay doi: {len(changed_files.splitlines())} file")

    git_diff = get_git_diff(full=full_diff)
    diff_size = len(git_diff)
    print(f"   Git diff: {diff_size:,} ky tu {'(full)' if full_diff else '(rut gon)'}")

    print("[...] Dang chay Ruff linter...")
    ruff_output = get_ruff_output()
    ruff_clean = "SACH" if "All checks passed" in ruff_output or "Khong co loi" in ruff_output else "CO CANH BAO"
    print(f"   Ruff: {ruff_clean}")

    project_stats = get_project_stats()

    # Tổng hợp nội dung markdown
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    content = f"""# 🏥 AI Audit Context – Clinic AI Booking Backend
> Được tạo tự động lúc: `{timestamp}`
> Branch: `{branch_info['branch']}` | Commit cuối: `{branch_info['last_commit']}`
> Repository: {branch_info['remote']}

---

> **📌 Cách dùng file này:**
> 1. Copy System Prompt in ra terminal sau khi chạy script
> 2. Dán vào Gemini (ai.google.dev) hoặc ChatGPT
> 3. Dán tiếp toàn bộ nội dung file này vào
> 4. Nhấn Enter và đọc phân tích

---
{section("📜 Lịch Sử Commit Gần Nhất", git_log, "text")}
{section("📁 Danh Sách File Thay Đổi (Commit Cuối)", changed_files, "diff")}
{section("🔍 Git Diff Chi Tiết (Commit Cuối)", git_diff, "diff")}
{section("⚡ Kết Quả Ruff Linter", ruff_output, "text")}
{section("📊 Thống Kê Dự Án", project_stats)}

---

## 🎯 Yêu Cầu Phân Tích

Dựa trên context trên, hãy:
1. Chỉ ra các **lỗ hổng bảo mật** và **lỗi logic** trong code vừa thay đổi
2. Phân tích xem commit này có **vi phạm kiến trúc phân tầng** không
3. Phát hiện nguy cơ **bất đồng bộ** giữa SQLAlchemy Model và DB Schema
4. Đề xuất **3 việc ưu tiên nhất** cho commit tiếp theo

> **Context kiến trúc:** FastAPI + SQLAlchemy 2.0 Async + PostgreSQL 15
> **Domain:** Phòng khám AI (đặt lịch, AI phân loại triệu chứng, hồ sơ bệnh nhân)
> **Chuẩn:** OpenMRS Patient Pattern, Pydantic v2, Python 3.11
"""

    # Ghi ra file
    output_path = Path(OUTPUT_FILE)
    output_path.write_text(content, encoding="utf-8")

    return output_path


# ─────────────────────────────────────────────────────────────────────────────
# Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Tạo AI Audit Context cho Clinic AI Booking Backend",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ví dụ:
  py ai_audit.py                 # 5 commit gần nhất (mặc định)
  py ai_audit.py --commits 10   # 10 commit gần nhất
  py ai_audit.py --full          # Full git diff (nhiều token hơn)
        """
    )
    parser.add_argument(
        "--commits", "-n",
        type=int,
        default=MAX_LOG_ENTRIES,
        help=f"Số commit gần nhất cần lấy (mặc định: {MAX_LOG_ENTRIES})"
    )
    parser.add_argument(
        "--full",
        action="store_true",
        help="Lấy full git diff thay vì rút gọn (cẩn thận tràn token)"
    )
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("  [AI AUDIT] Clinic AI Booking Backend")
    print("=" * 60 + "\n")

    output_path = generate_audit_context(n_commits=args.commits, full_diff=args.full)
    file_size = output_path.stat().st_size

    print(f"\n[OK] Da tao: {output_path.absolute()}")
    print(f"     Kich thuoc: {file_size:,} bytes (~{file_size // 4:,} tokens uoc tinh)")

    print("\n" + "=" * 60)
    print("  SYSTEM PROMPT -- DAN VAO CHATGPT TRUOC KHI PASTE CONTEXT")
    print("=" * 60)
    print(SYSTEM_PROMPT)

    print("=" * 60)
    print("  BUOC TIEP THEO")
    print("=" * 60)
    print(f"""
1. Mo file: {output_path.absolute()}
2. Copy toan bo noi dung file
3. Mo ChatGPT (chat.openai.com)
4. Dan System Prompt o tren -> Nhan Enter
5. Dan noi dung file -> Nhan Enter -> Doc phan tich!
""")


if __name__ == "__main__":
    main()
