#!/usr/bin/env python3
"""
AI PR Review Script — Clinic AI Booking Backend
================================================
Script này được GitHub Actions gọi tự động khi có Pull Request.
Luồng hoạt động:
  1. Lấy full diff của PR từ GitHub API
  2. Lấy danh sách file thay đổi và commit messages
  3. Gửi tất cả cho GPT-4o với System Prompt chuẩn Senior Dev
  4. Post kết quả review trực tiếp vào PR comment trên GitHub

Yêu cầu biến môi trường (GitHub Secrets):
  - OPENAI_API_KEY
  - GITHUB_TOKEN (tự động có trong GitHub Actions)
"""

import os
import sys
import textwrap
import requests
from datetime import datetime, timezone

try:
    from openai import OpenAI
except ImportError:
    print("[ERROR] Thieu thu vien openai. Hay chay: pip install openai")
    sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# Cau hinh
# ─────────────────────────────────────────────────────────────────────────────

MODEL = "gpt-4o"
MAX_DIFF_CHARS = 100_000   # ~25K tokens — GPT-4o context 128K, dư dùng cho prompt
MAX_FILES_TO_SHOW = 30     # Giới hạn số file trong danh sách

GITHUB_API = "https://api.github.com"

# ─────────────────────────────────────────────────────────────────────────────
# System Prompt — Vai trò AI là Senior Code Reviewer
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Bạn là **Senior Software Engineer và Principal Architect** chuyên về Python backend, được giao nhiệm vụ **review Pull Request** cho dự án **Clinic AI Booking** — hệ thống đặt lịch khám phòng khám tích hợp AI.

**Stack kỹ thuật của dự án:**
- FastAPI + Python 3.11 + Pydantic v2
- SQLAlchemy 2.0 Async (ORM) + PostgreSQL 15
- Mô hình dữ liệu theo chuẩn OpenMRS Patient Pattern
- Kiến trúc phân tầng: Router → Service Layer → Models → Database
- AI Module: phân loại triệu chứng, phát hiện Red Flag y tế
- CI/CD: GitHub Actions + Ruff linter + Pytest

**Nguyên tắc khi review:**
1. Đọc kỹ TOÀN BỘ diff trước khi nhận xét — không đưa ra nhận xét sai thực tế
2. Phân biệt rõ: lỗi PHẢI sửa (blocking) vs. gợi ý nên sửa (non-blocking)
3. Khen ngợi những gì được làm đúng — không chỉ chỉ lỗi
4. Nhận xét cụ thể: chỉ rõ tên file, số dòng, đoạn code cụ thể
5. Trả lời bằng **tiếng Việt**, format Markdown rõ ràng

**Cấu trúc bắt buộc khi trả lời:**

---

## Tổng Quan PR

[Mô tả ngắn gọn PR này làm gì, phạm vi thay đổi]

---

## Kết Luận

> [!IMPORTANT]
> **PHÁN QUYẾT: ✅ APPROVE / ⚠️ APPROVE VỚI ĐIỀU KIỆN / ❌ CẦN SỬA TRƯỚC KHI MERGE**
> 
> [Lý do ngắn gọn 1-2 câu]

---

## 🔴 Lỗi Bắt Buộc Sửa Trước Khi Merge (Blocking Issues)

[Nếu không có: ghi "Không phát hiện lỗi nghiêm trọng"]

Với mỗi lỗi, dùng format:
**`tên_file.py` (dòng X):** [Mô tả lỗi cụ thể]
```python
# Code có vấn đề
```
**Cách sửa:** [Giải thích cụ thể hoặc đưa ra code fix]

---

## 🟡 Gợi Ý Cải Thiện (Non-Blocking)

[Tối đa 5 gợi ý. Nếu không có: ghi "Không có gợi ý thêm"]

---

## 🟢 Điểm Tốt Trong PR Này

[Ít nhất 2-3 điểm tốt được thực hiện đúng chuẩn, nên duy trì]

---

## 🏗️ Phân Tích Kiến Trúc

[Đánh giá: PR này có vi phạm phân tầng Router→Service→Model không? Có rò rỉ business logic vào tầng sai không? Có nguy cơ gây bất đồng bộ Schema ↔ Model ↔ DB không?]

---

## 🚀 Việc Cần Làm Sau Khi Merge (Next Steps)

[1-3 việc ưu tiên nhất nên làm ở commit/sprint tiếp theo liên quan đến PR này]

---

*Review tự động bởi GPT-4o — Đây là gợi ý kỹ thuật, Team Lead có quyền override quyết định.*
"""


# ─────────────────────────────────────────────────────────────────────────────
# Lay thong tin tu environment
# ─────────────────────────────────────────────────────────────────────────────

def get_env(key: str, required: bool = True) -> str:
    value = os.environ.get(key, "").strip()
    if required and not value:
        print(f"[ERROR] Thieu bien moi truong: {key}")
        sys.exit(1)
    return value


def load_context() -> dict:
    return {
        "openai_key": get_env("OPENAI_API_KEY"),
        "github_token": get_env("GITHUB_TOKEN"),
        "pr_number": get_env("PR_NUMBER"),
        "pr_title": get_env("PR_TITLE", required=False) or "(No title)",
        "pr_body": get_env("PR_BODY", required=False) or "(No description)",
        "pr_author": get_env("PR_AUTHOR", required=False) or "unknown",
        "base_branch": get_env("BASE_BRANCH", required=False) or "develop",
        "head_branch": get_env("HEAD_BRANCH", required=False) or "feature/unknown",
        "repo": get_env("REPO_FULL_NAME"),
        "base_sha": get_env("BASE_SHA"),
        "head_sha": get_env("HEAD_SHA"),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Lay du lieu tu GitHub API
# ─────────────────────────────────────────────────────────────────────────────

def github_get(url: str, token: str) -> dict | list | str:
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    resp = requests.get(url, headers=headers, timeout=30)
    if not resp.ok:
        print(f"[WARN] GitHub API error {resp.status_code}: {url}")
        return {}
    return resp.json()


def get_pr_diff(repo: str, pr_number: str, token: str) -> str:
    """Lay raw diff cua PR."""
    url = f"{GITHUB_API}/repos/{repo}/pulls/{pr_number}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3.diff",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    resp = requests.get(url, headers=headers, timeout=60)
    if resp.ok:
        return resp.text
    print(f"[WARN] Khong lay duoc PR diff: {resp.status_code}")
    return ""


def get_pr_files(repo: str, pr_number: str, token: str) -> list[dict]:
    """Lay danh sach file thay doi trong PR."""
    url = f"{GITHUB_API}/repos/{repo}/pulls/{pr_number}/files?per_page=100"
    data = github_get(url, token)
    if isinstance(data, list):
        return data
    return []


def get_pr_commits(repo: str, pr_number: str, token: str) -> list[dict]:
    """Lay danh sach commit trong PR."""
    url = f"{GITHUB_API}/repos/{repo}/pulls/{pr_number}/commits?per_page=50"
    data = github_get(url, token)
    if isinstance(data, list):
        return data
    return []


# ─────────────────────────────────────────────────────────────────────────────
# Xu ly va chuan bi context cho GPT-4o
# ─────────────────────────────────────────────────────────────────────────────

def summarize_files(files: list[dict]) -> str:
    """Tao ban tom tat file thay doi."""
    if not files:
        return "Khong co thong tin file."

    lines = []
    for f in files[:MAX_FILES_TO_SHOW]:
        status_map = {
            "added": "[THEM]    ",
            "modified": "[SUA]     ",
            "removed": "[XOA]     ",
            "renamed": "[DOI TEN] ",
        }
        status = status_map.get(f.get("status", ""), "[?]       ")
        filename = f.get("filename", "unknown")
        additions = f.get("additions", 0)
        deletions = f.get("deletions", 0)
        lines.append(f"{status} {filename}  (+{additions} / -{deletions})")

    if len(files) > MAX_FILES_TO_SHOW:
        lines.append(f"... va {len(files) - MAX_FILES_TO_SHOW} file khac")

    return "\n".join(lines)


def summarize_commits(commits: list[dict]) -> str:
    """Tao ban tom tat commit messages."""
    if not commits:
        return "Khong co thong tin commit."

    lines = []
    for c in commits:
        sha = c.get("sha", "")[:7]
        msg = c.get("commit", {}).get("message", "").split("\n")[0]
        author = c.get("commit", {}).get("author", {}).get("name", "unknown")
        lines.append(f"[{sha}] {author}: {msg}")

    return "\n".join(lines)


def truncate_diff(diff: str) -> str:
    """Cat bot diff neu qua dai, uu tien giu lai header va cac thay doi quan trong."""
    if len(diff) <= MAX_DIFF_CHARS:
        return diff

    truncated = diff[:MAX_DIFF_CHARS]
    # Cat tai diem dung cua dong de khong bi gian doan giua dong
    last_newline = truncated.rfind('\n')
    if last_newline > 0:
        truncated = truncated[:last_newline]

    chars_cut = len(diff) - len(truncated)
    return (
        truncated
        + f"\n\n... [Da cat bot {chars_cut:,} ky tu vi diff qua lon. "
        f"Tong diff: {len(diff):,} ky tu] ..."
    )


def build_user_message(ctx: dict, files: list, commits: list, diff: str) -> str:
    """Tao user message gui cho GPT-4o."""
    files_summary = summarize_files(files)
    commits_summary = summarize_commits(commits)
    diff_content = truncate_diff(diff)

    total_additions = sum(f.get("additions", 0) for f in files)
    total_deletions = sum(f.get("deletions", 0) for f in files)

    return f"""# Pull Request Can Review

## Thong Tin PR
- **PR #{ctx['pr_number']}**: {ctx['pr_title']}
- **Tac gia**: @{ctx['pr_author']}
- **Merge**: `{ctx['head_branch']}` -> `{ctx['base_branch']}`
- **Pham vi**: {len(files)} file thay doi | +{total_additions} dong them / -{total_deletions} dong xoa

## Mo Ta PR (do tac gia viet)
{ctx['pr_body'] or '(Khong co mo ta)'}

## Danh Sach File Thay Doi
```
{files_summary}
```

## Lich Su Commit Trong PR
```
{commits_summary}
```

## Toan Bo Git Diff
```diff
{diff_content}
```

---
**Hay review PR nay theo dung cau truc da quy dinh trong System Prompt. Tra loi bang tieng Viet.**
"""


# ─────────────────────────────────────────────────────────────────────────────
# Goi OpenAI API
# ─────────────────────────────────────────────────────────────────────────────

def call_gpt4o(api_key: str, user_message: str) -> str:
    """Goi GPT-4o va tra ve noi dung review."""
    client = OpenAI(api_key=api_key)

    print(f"[...] Dang gui {len(user_message):,} ky tu toi GPT-4o...")

    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            max_tokens=4096,
            temperature=0.2,   # Thap de output nhat quan, co the du bao
        )
        return response.choices[0].message.content or ""
    except Exception as e:
        print(f"[ERROR] OpenAI API loi: {e}")
        raise


# ─────────────────────────────────────────────────────────────────────────────
# Post comment vao PR tren GitHub
# ─────────────────────────────────────────────────────────────────────────────

def post_pr_comment(repo: str, pr_number: str, token: str, body: str) -> bool:
    """Dang comment review vao PR."""
    url = f"{GITHUB_API}/repos/{repo}/issues/{pr_number}/comments"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    # Them header nhan dien bot va timestamp
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    full_body = (
        f"> 🤖 **AI Code Review** — Tự động bởi GPT-4o | {now_str}\n"
        f"> PR #{pr_number} · `{repo}`\n\n"
        + body
        + "\n\n---\n"
        + "*⚡ Review này được tạo tự động. "
        + "Team Lead có quyền override bất kỳ nhận xét nào.*"
    )

    resp = requests.post(
        url,
        headers=headers,
        json={"body": full_body},
        timeout=30
    )

    if resp.ok:
        comment_url = resp.json().get("html_url", "")
        print(f"[OK] Da post comment thanh cong: {comment_url}")
        return True
    else:
        print(f"[ERROR] Khong post duoc comment: {resp.status_code} - {resp.text}")
        return False


def delete_old_bot_comments(repo: str, pr_number: str, token: str) -> None:
    """Xoa comment cu cua bot (tranh spam khi co nhieu commit push vao PR)."""
    url = f"{GITHUB_API}/repos/{repo}/issues/{pr_number}/comments?per_page=100"
    comments = github_get(url, token)

    if not isinstance(comments, list):
        return

    deleted = 0
    for comment in comments:
        body = comment.get("body", "")
        # Nhan dien comment cua bot
        if "AI Code Review" in body and "GPT-4o" in body:
            del_url = f"{GITHUB_API}/repos/{repo}/issues/comments/{comment['id']}"
            headers = {
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.v3+json",
            }
            resp = requests.delete(del_url, headers=headers, timeout=15)
            if resp.status_code == 204:
                deleted += 1

    if deleted:
        print(f"[OK] Da xoa {deleted} comment cu cua bot (tranh spam PR)")


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("\n" + "=" * 60)
    print("  AI PR Review — Clinic AI Booking (GPT-4o)")
    print("=" * 60 + "\n")

    # 1. Load env
    ctx = load_context()
    print(f"[OK] PR #{ctx['pr_number']}: {ctx['pr_title']}")
    print(f"     {ctx['head_branch']} -> {ctx['base_branch']}")

    # 2. Lay du lieu tu GitHub
    print("\n[...] Dang lay du lieu tu GitHub API...")
    files = get_pr_files(ctx["repo"], ctx["pr_number"], ctx["github_token"])
    commits = get_pr_commits(ctx["repo"], ctx["pr_number"], ctx["github_token"])
    diff = get_pr_diff(ctx["repo"], ctx["pr_number"], ctx["github_token"])

    print(f"[OK] Files: {len(files)} | Commits: {len(commits)} | Diff: {len(diff):,} ky tu")

    if not diff and not files:
        print("[WARN] Khong co du lieu de review. Ket thuc.")
        sys.exit(0)

    # 3. Xoa comment cu de tranh spam
    print("\n[...] Kiem tra va xoa comment cu cua bot...")
    delete_old_bot_comments(ctx["repo"], ctx["pr_number"], ctx["github_token"])

    # 4. Tao user message
    user_message = build_user_message(ctx, files, commits, diff)
    print(f"\n[OK] Da chuan bi context: {len(user_message):,} ky tu")

    # 5. Goi GPT-4o
    print("\n[...] Dang goi GPT-4o de review...")
    try:
        review_content = call_gpt4o(ctx["openai_key"], user_message)
        print(f"[OK] GPT-4o tra ve: {len(review_content):,} ky tu")
    except Exception:
        # Neu GPT-4o loi, post comment thong bao thay vi fail CI
        error_body = textwrap.dedent("""
            ## ⚠️ AI Code Review Tạm Thời Không Khả Dụng

            Hệ thống AI Review gặp lỗi khi kết nối OpenAI API.

            **Hành động cần thực hiện:**
            - Team Lead vui lòng review PR này thủ công
            - Kiểm tra lại `OPENAI_API_KEY` trong GitHub Secrets nếu lỗi tiếp diễn
        """).strip()
        post_pr_comment(ctx["repo"], ctx["pr_number"], ctx["github_token"], error_body)
        sys.exit(0)  # Khong fail CI vi loi AI — CI chinh van chay binh thuong

    # 6. Post comment vao PR
    print("\n[...] Dang post review comment vao PR...")
    success = post_pr_comment(ctx["repo"], ctx["pr_number"], ctx["github_token"], review_content)

    if success:
        print("\n" + "=" * 60)
        print("  [DONE] AI Review hoan thanh!")
        print("=" * 60)
    else:
        # Khong fail CI, chi warn
        print("[WARN] Post comment that bai nhung CI van tiep tuc.")
        sys.exit(0)


if __name__ == "__main__":
    main()
