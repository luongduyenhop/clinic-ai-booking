#!/usr/bin/env python3
"""
AI PR Gatekeeper & Reviewer (GPT-4o) — Clinic AI Booking Backend
================================================================
Script tự động kích hoạt qua GitHub Actions khi có Pull Request:
  1. Lấy toàn bộ PR info, commit messages và git diff từ GitHub API
  2. Gửi dữ liệu tới GPT-4o với vai trò Lead Software Architect
  3. Đánh giá tính đủ điều kiện: ĐẠT YÊU CẦU (PASSED) hay CHƯA ĐẠT (FAILED)
  4. Đăng Official Pull Request Review lên GitHub (APPROVE hoặc REQUEST_CHANGES)
  5. Nếu CHƯA ĐẠT: Thất bại CI (exit 1) để CHẶN MERGE trên GitHub cho đến khi tác giả sửa lại!
"""

import os
import sys
import requests
from datetime import datetime, timezone

try:
    from openai import OpenAI
except ImportError:
    print("[ERROR] Thieu thu vien openai. Hay chay: pip install openai")
    sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# Cấu hình
# ─────────────────────────────────────────────────────────────────────────────

MODEL = "gpt-4o"
MAX_DIFF_CHARS = 100_000   # ~25K tokens — GPT-4o context 128K
MAX_FILES_TO_SHOW = 40
GITHUB_API = "https://api.github.com"


# ─────────────────────────────────────────────────────────────────────────────
# System Prompt — Quality Gatekeeper & Lead Architect
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Bạn là **Lead Software Architect & Gatekeeper (Người gác cổng chất lượng)** của dự án **Clinic AI Booking** (Hệ thống phòng khám tích hợp AI).
Nhiệm vụ tối thượng của bạn là: **ĐÁNH GIÁ CHÍNH XÁC XEM PULL REQUEST NÀY CÓ ĐỦ ĐIỀU KIỆN ĐỂ MERGE VÀO NHÁNH CHÍNH HAY KHÔNG**, giúp cả nhóm biết rõ code đã đạt yêu cầu chưa hay BẮT BUỘC PHẢI SỬA LẠI.

**Stack kỹ thuật của dự án:**
- FastAPI + Python 3.11 + Pydantic v2
- SQLAlchemy 2.0 Async (ORM) + PostgreSQL 15 (Mô hình CSDL chuẩn OpenMRS Patient Pattern)
- Kiến trúc phân tầng nghiêm ngặt: Router -> Service Layer -> Models -> Database
- AI Module: Sàng lọc triệu chứng, phát hiện Red Flag cấp cứu y tế
- CI/CD: GitHub Actions + Ruff linter + Pytest

**Tiêu chuẩn đánh giá điều kiện Merge:**
1. **ĐỦ ĐIỀU KIỆN MERGE (PASSED)**:
   - Không có lỗi cú pháp, logic, gọi sai thuộc tính / sai kiểu dữ liệu
   - Không có lỗ hổng bảo mật (SQL Injection, lộ secret, bypass auth)
   - Tuân thủ phân tầng (Router chỉ điều hướng, Service xử lý business logic, Model định nghĩa CSDL)
   - Đồng bộ giữa SQLAlchemy Model, Pydantic Schema và PostgreSQL schema
   - Linter và code style sạch sẽ

2. **CHƯA ĐỦ ĐIỀU KIỆN (FAILED / CHANGES REQUESTED)**:
   - Phát hiện bất kỳ lỗi nào gây crash runtime hoặc sai logic nghiệp vụ
   - Vi phạm bảo mật hoặc rò rỉ thông tin nhạy cảm
   - Vi phạm phân tầng kiến trúc nghiêm trọng
   - Phá vỡ tính toàn vẹn dữ liệu (Data Integrity / ForeignKey / Nullability)

---
**QUY TẮC BẮT BUỘC VỀ DÒNG ĐẦU TIÊN:**
Dòng ĐẦU TIÊN trong câu trả lời của bạn BẮT BUỘC PHẢI LÀ MỘT TRONG HAI DÒNG SAU (để hệ thống tự động nhận diện và khóa/mở nút merge):
`MERGE_STATUS: PASSED`
hoặc
`MERGE_STATUS: FAILED`

---
**Cấu trúc chi tiết của bản đánh giá (trả lời bằng tiếng Việt, Markdown chuẩn):**

# [BANNER ĐÁNH GIÁ ĐIỀU KIỆN MERGE]
- Nếu PASSED:
  ## 🟢 KẾT LUẬN: ĐỦ ĐIỀU KIỆN ĐỂ MERGE (APPROVED)
  > ✅ **Code đạt chuẩn chất lượng của dự án Clinic AI Booking.**  
  > Đội ngũ có thể yên tâm tiến hành merge Pull Request này vào nhánh chính.
- Nếu FAILED:
  ## 🔴 KẾT LUẬN: CHƯA ĐỦ ĐIỀU KIỆN MERGE - YÊU CẦU LÀM LẠI (CHANGES REQUESTED)
  > ⛔ **CẢNH BÁO:** Phát hiện các lỗi nghiêm trọng cần khắc phục.  
  > **Yêu cầu tác giả sửa lại code theo danh sách bên dưới và push commit mới** để bot đánh giá lại trước khi được phép merge!

---

## 📋 Bảng Đánh Giá Tiêu Chuẩn Quality Gate
| Tiêu Chí Đánh Giá | Trạng Thái | Chi Tiết & Nhận Xét |
| :--- | :---: | :--- |
| 1. Cú pháp & Logic nghiệp vụ | [✅ Đạt / ❌ Chưa Đạt] | [Tóm tắt 1 câu] |
| 2. An toàn bảo mật & Dữ liệu nhạy cảm | [✅ Đạt / ❌ Chưa Đạt] | [Tóm tắt 1 câu] |
| 3. Tuân thủ phân tầng (Router -> Service -> Model) | [✅ Đạt / ❌ Chưa Đạt] | [Tóm tắt 1 câu] |
| 4. Đồng bộ CSDL OpenMRS & Pydantic Schema | [✅ Đạt / ❌ Chưa Đạt] | [Tóm tắt 1 câu] |
| 5. Clean Code & Khả năng bảo trì | [✅ Đạt / ❌ Chưa Đạt] | [Tóm tắt 1 câu] |

---

## 🔴 Danh Sách Lỗi Bắt Buộc Sửa Trước Khi Merge (Blocking Issues)
*(Nếu không có lỗi: Ghi rõ "🎉 Không phát hiện lỗi nghiêm trọng nào.")*  
Nếu có lỗi, với mỗi lỗi trình bày:
- **Vị trí:** `tên_file.py` (dòng X)
- **Mức độ:** [CRITICAL / HIGH]
- **Vấn đề:** [Mô tả chi tiết tại sao lỗi và hậu quả]
- **Code hiện tại:**
```python
# Đoạn code lỗi
```
- **Giải pháp khắc phục:** [Code sửa chuẩn hoặc hướng dẫn cụ thể]

---

## 🟡 Gợi Ý Cải Thiện Thêm (Non-Blocking)
*(Tối đa 3-4 gợi ý nếu có, không bắt buộc sửa để merge)*

---

## 🟢 Điểm Sáng Trong Pull Request
*(2-3 điểm tích cực mà tác giả đã làm tốt, khuyến khích phát huy)*

---

## 🚀 Hướng Dẫn Hành Động Tiếp Theo
- Nếu FAILED: 2-3 việc tác giả cần làm ngay tại máy local, test lại và push commit mới.
- Nếu PASSED: Hướng dẫn Reviewer / Team Lead tiến hành Approve và Merge.
"""


# ─────────────────────────────────────────────────────────────────────────────
# Đọc Environment Context từ GitHub Actions
# ─────────────────────────────────────────────────────────────────────────────

def get_env(key: str, required: bool = True) -> str:
    value = os.environ.get(key, "").strip()
    if required and not value:
        print(f"[ERROR] Thiếu biến môi trường: {key}")
        sys.exit(1)
    return value


def load_context() -> dict:
    return {
        "openai_key": get_env("OPENAI_API_KEY"),
        "github_token": get_env("GITHUB_TOKEN"),
        "pr_number": get_env("PR_NUMBER"),
        "pr_title": get_env("PR_TITLE", required=False) or "(Không có tiêu đề)",
        "pr_body": get_env("PR_BODY", required=False) or "(Không có mô tả)",
        "pr_author": get_env("PR_AUTHOR", required=False) or "unknown",
        "base_branch": get_env("BASE_BRANCH", required=False) or "develop",
        "head_branch": get_env("HEAD_BRANCH", required=False) or "feature/unknown",
        "repo": get_env("REPO_FULL_NAME"),
        "base_sha": get_env("BASE_SHA"),
        "head_sha": get_env("HEAD_SHA"),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Gọi GitHub API
# ─────────────────────────────────────────────────────────────────────────────

def github_get(url: str, token: str) -> dict | list | str:
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    resp = requests.get(url, headers=headers, timeout=30)
    if not resp.ok:
        print(f"[WARN] GitHub API lỗi {resp.status_code}: {url}")
        return {}
    return resp.json()


def get_pr_diff(repo: str, pr_number: str, token: str) -> str:
    url = f"{GITHUB_API}/repos/{repo}/pulls/{pr_number}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3.diff",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    resp = requests.get(url, headers=headers, timeout=60)
    if resp.ok:
        return resp.text
    print(f"[WARN] Không lấy được PR diff: {resp.status_code}")
    return ""


def get_pr_files(repo: str, pr_number: str, token: str) -> list[dict]:
    url = f"{GITHUB_API}/repos/{repo}/pulls/{pr_number}/files?per_page=100"
    data = github_get(url, token)
    return data if isinstance(data, list) else []


def get_pr_commits(repo: str, pr_number: str, token: str) -> list[dict]:
    url = f"{GITHUB_API}/repos/{repo}/pulls/{pr_number}/commits?per_page=50"
    data = github_get(url, token)
    return data if isinstance(data, list) else []


# ─────────────────────────────────────────────────────────────────────────────
# Chuẩn bị Prompt cho GPT-4o
# ─────────────────────────────────────────────────────────────────────────────

def summarize_files(files: list[dict]) -> str:
    if not files:
        return "Không có thông tin file."
    lines = []
    for f in files[:MAX_FILES_TO_SHOW]:
        status_map = {
            "added": "[THÊM]   ",
            "modified": "[SỬA]    ",
            "removed": "[XÓA]    ",
            "renamed": "[ĐỔI TÊN]",
        }
        status = status_map.get(f.get("status", ""), "[?]      ")
        filename = f.get("filename", "unknown")
        additions = f.get("additions", 0)
        deletions = f.get("deletions", 0)
        lines.append(f"{status} {filename}  (+{additions} / -{deletions})")
    if len(files) > MAX_FILES_TO_SHOW:
        lines.append(f"... và {len(files) - MAX_FILES_TO_SHOW} file khác")
    return "\n".join(lines)


def summarize_commits(commits: list[dict]) -> str:
    if not commits:
        return "Không có thông tin commit."
    lines = []
    for c in commits:
        sha = c.get("sha", "")[:7]
        msg = c.get("commit", {}).get("message", "").split("\n")[0]
        author = c.get("commit", {}).get("author", {}).get("name", "unknown")
        lines.append(f"[{sha}] {author}: {msg}")
    return "\n".join(lines)


def truncate_diff(diff: str) -> str:
    if len(diff) <= MAX_DIFF_CHARS:
        return diff
    truncated = diff[:MAX_DIFF_CHARS]
    last_newline = truncated.rfind('\n')
    if last_newline > 0:
        truncated = truncated[:last_newline]
    cut_len = len(diff) - len(truncated)
    return truncated + f"\n\n... [Đã cắt bớt {cut_len:,} ký tự diff để tránh vượt quá token] ..."


def build_user_message(ctx: dict, files: list, commits: list, diff: str) -> str:
    files_summary = summarize_files(files)
    commits_summary = summarize_commits(commits)
    diff_content = truncate_diff(diff)
    total_additions = sum(f.get("additions", 0) for f in files)
    total_deletions = sum(f.get("deletions", 0) for f in files)

    return f"""# PULL REQUEST CẦN ĐÁNH GIÁ ĐIỀU KIỆN MERGE

## Thông Tin Pull Request
- **PR #{ctx['pr_number']}**: {ctx['pr_title']}
- **Tác giả**: @{ctx['pr_author']}
- **Nhánh muốn merge**: `{ctx['head_branch']}` -> `{ctx['base_branch']}`
- **Thống kê thay đổi**: {len(files)} file | +{total_additions} dòng thêm / -{total_deletions} dòng xóa

## Mô Tả Của Tác Giả PR
{ctx['pr_body'] or '(Không có mô tả)'}

## Danh Sách File Thay Đổi
```
{files_summary}
```

## Lịch Sử Các Commit Trong PR
```
{commits_summary}
```

## Toàn Bộ Git Diff Cần Soi
```diff
{diff_content}
```

---
Hãy đánh giá nghiêm ngặt xem PR này CÓ ĐỦ ĐIỀU KIỆN ĐỂ MERGE KHÔNG.
Nhớ bắt đầu dòng đầu tiên bằng: `MERGE_STATUS: PASSED` hoặc `MERGE_STATUS: FAILED`.
"""


# ─────────────────────────────────────────────────────────────────────────────
# Gọi OpenAI API
# ─────────────────────────────────────────────────────────────────────────────

def call_gpt4o(api_key: str, user_message: str) -> str:
    client = OpenAI(api_key=api_key)
    print(f"[...] Đang gửi {len(user_message):,} ký tự tới GPT-4o để đánh giá...")
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        max_tokens=4096,
        temperature=0.1,  # Rất thấp để phán quyết nhất quán, logic chặt chẽ
    )
    return response.choices[0].message.content or ""


# ─────────────────────────────────────────────────────────────────────────────
# Phân tích Phán Quyết (Verdict Parser)
# ─────────────────────────────────────────────────────────────────────────────

def parse_merge_verdict(raw_content: str) -> tuple[bool, str]:
    """
    Phân tích dòng MERGE_STATUS từ GPT-4o:
    Trả về: (is_passed: bool, clean_markdown_body: str)
    """
    lines = raw_content.strip().splitlines()
    is_passed = True
    found_tag = False
    cleaned_lines = []

    for line in lines:
        stripped = line.strip()
        if "MERGE_STATUS:" in stripped:
            found_tag = True
            if "FAILED" in stripped.upper():
                is_passed = False
            elif "PASSED" in stripped.upper():
                is_passed = True
            continue  # Bỏ dòng tag kỹ thuật ra khỏi bài đánh giá hiển thị
        cleaned_lines.append(line)

    clean_body = "\n".join(cleaned_lines).strip()

    # Fallback nếu model quên in đúng cú pháp MERGE_STATUS
    if not found_tag:
        upper = raw_content.upper()
        if "CHƯA ĐỦ ĐIỀU KIỆN" in upper or "CHANGES REQUESTED" in upper or "FAILED" in upper or "LÀM LẠI" in upper:
            is_passed = False
        else:
            is_passed = True

    return is_passed, clean_body


# ─────────────────────────────────────────────────────────────────────────────
# Đăng Official Pull Request Review lên GitHub
# ─────────────────────────────────────────────────────────────────────────────

def delete_old_bot_reviews_and_comments(repo: str, pr_number: str, token: str) -> None:
    """Xóa các comment đánh giá cũ của bot khi tác giả vừa push commit mới."""
    url = f"{GITHUB_API}/repos/{repo}/issues/{pr_number}/comments?per_page=100"
    comments = github_get(url, token)
    if isinstance(comments, list):
        for comment in comments:
            body = comment.get("body", "")
            if "AI PR Gatekeeper" in body or "AI Code Review" in body:
                del_url = f"{GITHUB_API}/repos/{repo}/issues/comments/{comment['id']}"
                requests.delete(
                    del_url,
                    headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"},
                    timeout=15
                )


def submit_official_pr_review(repo: str, pr_number: str, token: str, body: str, is_passed: bool) -> bool:
    """
    Đăng Official Pull Request Review:
    - Nếu ĐẠT: event = "APPROVE"
    - Nếu CHƯA ĐẠT: event = "REQUEST_CHANGES" (Chính thức yêu cầu làm lại)
    """
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    badge = "🟢 **ĐẠT TIÊU CHUẨN MERGE**" if is_passed else "🔴 **CHƯA ĐẠT - YÊU CẦU SỬA LẠI**"

    full_body = (
        f"> 🤖 **AI PR Gatekeeper (GPT-4o)** | {badge} | {now_str}\n"
        f"> Đánh giá điều kiện gộp mã nguồn cho PR #{pr_number}\n\n"
        + body
        + "\n\n---\n"
        + "*⚡ Đánh giá tự động bởi GPT-4o Quality Gate. Team Lead có thẩm quyền cao nhất để phê duyệt.*"
    )

    # 1. Thử gửi qua Official Pull Request Review API
    review_url = f"{GITHUB_API}/repos/{repo}/pulls/{pr_number}/reviews"
    event_type = "APPROVE" if is_passed else "REQUEST_CHANGES"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    payload = {
        "body": full_body,
        "event": event_type
    }

    resp = requests.post(review_url, headers=headers, json=payload, timeout=30)

    if resp.status_code in (200, 201):
        print(f"[OK] Đã đăng Official PR Review ({event_type}) thành công!")
        return True

    # 2. Fallback sang Issue Comment nếu gặp 422 (ví dụ tự review hoặc token bị giới hạn)
    print(f"[WARN] Review API trả về {resp.status_code}, fallback sang PR comment thông thường...")
    fallback_url = f"{GITHUB_API}/repos/{repo}/issues/{pr_number}/comments"
    fb_resp = requests.post(fallback_url, headers=headers, json={"body": full_body}, timeout=30)
    if fb_resp.ok:
        print("[OK] Đã đăng bản đánh giá vào PR comment thành công!")
        return True
    else:
        print(f"[ERROR] Không thể đăng comment: {fb_resp.status_code} - {fb_resp.text}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("\n" + "=" * 65)
    print("  AI PR Gatekeeper (GPT-4o) — Kiểm Tra Điều Kiện Merge")
    print("=" * 65 + "\n")

    # 1. Tải context
    ctx = load_context()
    print(f"[INFO] PR #{ctx['pr_number']}: {ctx['pr_title']}")
    print(f"       {ctx['head_branch']} -> {ctx['base_branch']}")

    # 2. Thu thập dữ liệu
    print("\n[...] Đang lấy dữ liệu diff từ GitHub API...")
    files = get_pr_files(ctx["repo"], ctx["pr_number"], ctx["github_token"])
    commits = get_pr_commits(ctx["repo"], ctx["pr_number"], ctx["github_token"])
    diff = get_pr_diff(ctx["repo"], ctx["pr_number"], ctx["github_token"])
    print(f"[INFO] Files: {len(files)} | Commits: {len(commits)} | Diff: {len(diff):,} ký tự")

    if not diff and not files:
        print("[WARN] Không có thay đổi nào trong PR để đánh giá. Kết thúc.")
        sys.exit(0)

    # 3. Dọn dẹp comment cũ của bot
    delete_old_bot_reviews_and_comments(ctx["repo"], ctx["pr_number"], ctx["github_token"])

    # 4. Chuẩn bị prompt
    user_message = build_user_message(ctx, files, commits, diff)

    # 5. Gọi GPT-4o
    print("\n[...] Đang phân tích mã nguồn và kiểm tra điều kiện merge...")
    try:
        raw_review = call_gpt4o(ctx["openai_key"], user_message)
    except Exception as e:
        print(f"[ERROR] Lỗi gọi OpenAI: {e}")
        # Báo lỗi nhưng không làm sập CI nếu chỉ là lỗi mạng tạm thời
        err_msg = (
            "## ⚠️ AI PR Gatekeeper Tạm Thời Gián Đoạn\n\n"
            "Không thể kết nối với OpenAI API để đánh giá tự động. "
            "Team Lead vui lòng kiểm tra thủ công PR này."
        )
        submit_official_pr_review(ctx["repo"], ctx["pr_number"], ctx["github_token"], err_msg, is_passed=True)
        sys.exit(0)

    # 6. Phân tích kết quả ĐẠT / CHƯA ĐẠT
    is_passed, clean_body = parse_merge_verdict(raw_review)

    # 7. Đăng kết quả lên PR
    print("\n[...] Đang đăng kết quả đánh giá lên Pull Request...")
    submit_official_pr_review(ctx["repo"], ctx["pr_number"], ctx["github_token"], clean_body, is_passed=is_passed)

    # 8. Thực thi cổng chất lượng (Enforce Quality Gate)
    print("\n" + "=" * 65)
    if is_passed:
        print("  🎉 [KẾT QUẢ]: CODE ĐỦ ĐIỀU KIỆN ĐỂ MERGE (APPROVED)!")
        print("  ✓ Không có lỗi nghiêm trọng. Nút merge được phép mở.")
        print("=" * 65 + "\n")
        sys.exit(0)
    else:
        print("  ❌ [KẾT QUẢ]: CODE CHƯA ĐẠT YÊU CẦU - BỊ TỪ CHỐI (REQUEST CHANGES)!")
        print("  ⛔ Phát hiện lỗi bắt buộc sửa (Blocking Issues).")
        print("  ⛔ GitHub Actions sẽ đánh dấu FAILED để KHÓA NÚT MERGE.")
        print("  -> Yêu cầu tác giả xem chi tiết trên PR, sửa code và push commit mới!")
        print("=" * 65 + "\n")
        sys.exit(1)  # THẤT BẠI CI ĐỂ KHÓA NÚT MERGE TRÊN GITHUB!


if __name__ == "__main__":
    main()
