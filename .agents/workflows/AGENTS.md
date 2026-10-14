---
description: 
---

Mục tiêu: Mọi AI Agent phải hiểu project trước khi sửa và phải code đúng kiến trúc, không chỉ làm cho chạy được.
Quy trình bắt buộc:
UNDERSTAND → ANALYZE → PLAN → EXPLAIN → ASK → CONFIRM → IMPLEMENT → TEST → REVIEW

Không đoán mò. Thiếu thông tin phải kiểm tra source hoặc hỏi User. Không tự đoán business rule, UI behavior, API contract, route, state, permission, folder, package, error/loading/empty behavior, responsive behavior.

Nếu có nhiều thiết kế hợp lý, trình bày các option, ưu/nhược điểm và hỏi User. Không tự quyết định architectural/business decision.

Trước khi code phải đọc project thực tế: package.json, lockfile, src/, entry point, router, Redux store/provider, API/Axios layer, auth, file liên quan, test liên quan, env/config/build nếu có ảnh hưởng.

package.json và lockfile là source of truth cho dependency. Không tin trí nhớ hoặc tài liệu thay cho package thực tế. Trước khi thêm package: kiểm tra package hiện có, cách project đang giải quyết vấn đề, lý do cần package mới, sau đó chờ User xác nhận.

Phải tìm code tương tự để REUSE → EXTEND → CREATE NEW. Không tạo implementation thứ hai cho logic đã tồn tại.

Phải xác định layer, dependency flow và architecture impact trước khi code. Không bypass abstraction hiện tại chỉ vì cách trực tiếp nhanh hơn.

Không sửa code trước approval. Trước approval chỉ được đọc, tìm kiếm, phân tích, hỏi, thiết kế, lập plan. Không tạo/xóa/sửa file code, cài package, đổi config có behavior, migration, commit, push.

Approval hợp lệ: OK, Approve, Tiến hành, Làm đi, Code đi, Proceed hoặc tương đương.

Nếu User đổi requirement sau plan và ảnh hưởng thiết kế, cập nhật plan và quay lại approval gate.

Không tự ý đổi scope: không refactor ngoài phạm vi, rename hàng loạt, format cả project, upgrade dependency, đổi state/router architecture, đổi API contract, đổi build/deploy setup. Vấn đề ngoài scope chỉ báo cáo và đề xuất task riêng.

Task phải được phân loại: Bug fix, New feature, Refactor, Performance, Security, UI/UX, State, Routing, API, Testing, Build/Tooling, Docker/Deployment, Config, Documentation.

Đánh giá: RISK LOW/MEDIUM/HIGH; ARCHITECTURAL IMPACT NONE/LOW/MEDIUM/HIGH; API IMPACT NONE/NON-BREAKING/BREAKING; STATE IMPACT NONE/LOCAL/GLOBAL; DEPENDENCY IMPACT NONE/EXISTING/NEW.

Impact phải xét UI, State, Routing, API, Performance, Security, Testing, Deployment nếu liên quan.

Debug theo: Expected → Actual → Reproduce → Root cause → Affected layer → Fix → Regression test. Ưu tiên root cause, không chỉ chữa symptom.

Không over-engineering: không tạo abstraction/pattern/package mới nếu không cần. Không under-engineering: không hard-code, duplicate logic, bỏ validation/error handling/authorization/test.

React component chủ yếu render UI, props, event handling, composition. Business/feature logic phức tạp phải dùng abstraction hiện có như hook, service, Redux.

Local state cho state chỉ thuộc component/feature nhỏ. Redux cho state cần chia sẻ rộng hoặc có lifecycle/logic tập trung. Không đưa mọi state vào Redux. Không tạo slice mới nếu slice hiện tại có thể mở rộng hợp lý.

API phải đi theo abstraction hiện tại: Component/Redux → Feature API → Axios client → interceptor → Backend. Không tạo Axios instance thứ hai nếu không có lý do được duyệt. Không gọi API rải rác trong component nếu project đã có service layer.

Routing tập trung ở routing layer. Phải kiểm tra public/protected route, role/permission, redirect, query params. Frontend guard không thay thế backend authorization.

Ant Design + Tailwind CSS phải theo convention hiện tại. Không thêm UI framework khác nếu chưa được duyệt.

Formik + Yup nếu project đang dùng: reuse pattern, tách validation hợp lý, xử lý submitting/server error/reset.

SignalR phải kiểm tra lifecycle, cleanup, reconnect và duplicate handler/connection.

Với task performance phải xem unnecessary rerender, request trùng, list lớn, pagination/lazy loading, bundle impact; không thêm optimization phức tạp nếu chưa cần.

Security: không đưa secret vào frontend; không coi frontend là security boundary; auth/permission thực tế phải được backend kiểm tra.

Database/backend contract: frontend không tự thay đổi API/schema hay giả định behavior backend khi chưa xác nhận.

Nếu phát hiện architecture hiện tại có vấn đề nhưng ngoài task: không âm thầm refactor. Báo Current → Problem → Impact → Proposed improvement.

Trước code phải gửi đúng cấu trúc:

TASK ANALYSIS

Understanding

Current Architecture

Relevant Files

Root Cause / Problem

Architecture Compliance

Impact Analysis

Questions / Ambiguities

Proposed Design

Files To Change

Files To Add

Testing Plan

Risks

Approval Required

Chưa thay đổi code. Chờ User xác nhận.
28. Sau approval mới triển khai. Sau triển khai phải test và self-review: architecture, code quality, security, performance, maintainability, regression.
29. Final report phải có: Implemented, Files Changed, Architecture Flow, Tests, Validation, Known Issues, Recommendations. Không nói hoàn thành nếu còn lỗi đã biết. Nếu test không chạy được phải nói rõ lý do.
30. Golden rule: Không đánh đổi architecture để nhanh hơn; không tự quyết định thay User; không biến task thành refactor lớn; mọi nghi vấn phải hỏi.