---
description: 
---

ARCHITECTURE.md

Mục tiêu: Mô tả kiến trúc frontend để AI Agent đọc trước khi code. Source of truth cuối cùng là code thực tế + package.json + lockfile.

1. Tech Stack

React 19
Vite
JavaScript hoặc TypeScript theo package/source thực tế; không tự đổi ngôn ngữ
react-router-dom 7.x
Redux Toolkit + Redux
Tailwind CSS 4
Ant Design
Formik + Yup
Axios
SignalR client
Node.js version theo project/package/ Docker

2. Architecture Flow

Page/Route → Feature UI → Hook/Feature Logic → Redux hoặc Local State → Feature API/Service → Axios Client → Backend REST API
Realtime: SignalR Connection → Event Handler → Redux/Feature State → Selector/Hook → UI
Routing: React Router → Public/Protected Route → Page → Feature UI
Styling: Ant Design + Tailwind + custom styling theo convention hiện tại

3. Project Discovery

Trước task phải đọc package.json, lockfile, src/, entry point, router, store/provider, API/Axios, auth, file liên quan, test, env/build/deploy nếu ảnh hưởng. Không đoán cấu trúc folder nếu chưa kiểm tra.

4. Layer Responsibilities

App/Application: entry point, providers, router, global setup.
Pages: route-level screen, composition, orchestration ở mức page.
Features: UI + logic theo từng domain/feature.
Components: reusable presentation/UI; không chứa business logic phức tạp nếu đã có abstraction phù hợp.
Hooks: reusable React logic và feature interaction.
Store/Redux: global/shared state, reducers, actions, selectors, async flow theo convention hiện tại.
API/Services: backend communication và mapping/error handling theo abstraction hiện tại.
Utils/Common: logic dùng chung, không biến thành nơi chứa mọi thứ.

5. State Management

Local state: modal, input draft, temporary UI state, state chỉ thuộc một component.
Redux: shared/domain state cần dùng ở nhiều nơi hoặc có lifecycle/logic tập trung.
Không đưa mọi state vào Redux.
Không tạo duplicate source of truth.
Derived data nên tính bằng selector thay vì lưu lại nếu có thể.

6. Redux Toolkit

Store tập trung bằng configureStore theo implementation hiện tại.
Slice đại diện state domain hợp lý, không tạo slice cho từng component nhỏ.
Async state phải xử lý loading/success/error theo convention hiện tại.
Selector lấy đúng dữ liệu cần thiết; tránh subscribe vào state lớn không cần thiết.
Reducer không chứa side effect.

7. API / Axios

Flow ưu tiên: Component/Redux → Feature API → Axios Client → Interceptor → Backend.
Axios client có thể quản lý base URL, common headers, auth behavior, error normalization theo source hiện tại.
Không tạo nhiều Axios instance nếu cùng purpose.
Không gọi axios trực tiếp rải rác trong component khi đã có API abstraction.

8. Authentication

Phải đọc implementation thực tế để xác định token/cookie, refresh token, auth state, interceptor, logout, current-user và route guard.
Không tự ý đổi auth architecture.
Không lưu secret/private key ở frontend.
Vite env có thể được bundle ra client; chỉ đưa public configuration vào frontend.

9. Routing

React Router chịu trách nhiệm client-side navigation.
Route definition tập trung.
Phải xác định public/protected routes, role/permission, redirect, nested route, query params theo project.
Frontend guard chỉ kiểm soát UX/navigation; backend vẫn phải authorization.

10. UI System

Ant Design ưu tiên cho component UI chuẩn như form control, table, modal, drawer, dropdown, pagination, notification nếu project đang dùng.
Tailwind ưu tiên cho layout, spacing, responsive utilities và visual composition nhỏ.
Dùng cách project đang dùng; không thêm Bootstrap/MUI/UI framework khác nếu chưa được duyệt.

11. Forms

Formik quản lý form state theo pattern hiện tại.
Yup quản lý validation schema nếu project đang dùng.
Flow: Form → Formik → Yup → Submit → API/Redux → Success/Error.
Phải xử lý initial values, touched/errors, submitting/loading, server error, reset.

12. SignalR

Realtime flow: Connection → subscribe event → update feature/global state → selector/hook → UI.
Phải quản lý start/stop, cleanup listener, reconnect nếu cần và tránh duplicate handlers/connections.

13. Component Design

Component có responsibility rõ.
Page nên compose các feature components.
Ví dụ: ProductPage → ProductFilter + ProductList → ProductCard + Pagination.
Không tạo God Component chỉ để làm nhanh.
Không tách component máy móc nếu abstraction không đem lại giá trị.

14. UI States

API feature nên xác định Loading → Success/Data, Empty và Error.
Không để màn hình trắng/crash khi request fail.
Error message phải theo UX/error convention hiện tại.

15. Performance

Xem unnecessary rerender, selector scope, duplicate request, effect dependency, list lớn, pagination, lazy loading/code splitting khi cần, image/bundle size.
Chỉ tối ưu phức tạp khi có vấn đề hoặc lý do rõ ràng.

16. Security

Frontend không phải security boundary.
Không expose secret, private key, credential.
Không render dữ liệu không tin cậy bằng cách bỏ qua cơ chế escaping/sanitization hiện tại.
Authorization thật sự phải do backend kiểm tra.

17. Dependencies

Package thực tế phải kiểm tra từ package.json và lockfile.
Nhóm công nghệ hiện tại: React 19, Vite, Router 7.x, Redux Toolkit/Redux, Tailwind 4, Ant Design, Formik/Yup, Axios, SignalR.
Tên package và version thực tế có thể khác tài liệu; package.json là source of truth.
Không thêm dependency mới nếu chưa qua approval gate trong AGENTS.md.

18. Testing

Dùng test framework thực tế trong package.json.
Ưu tiên test feature behavior, state transitions, user interaction quan trọng, route protection, API behavior, loading/error/empty state.
Mock theo boundary, không mock mọi thứ máy móc.

19. Build / Docker / Nginx

Flow thường: Source → Vite build → static assets → Nginx/hosting → Browser.
Nếu deploy Docker phải kiểm tra Dockerfile, compose và nginx config thực tế.
SPA với React Router cần server fallback về index.html nếu server không tự hỗ trợ client-side routes.

20. Environment

Không commit secret.
Phân biệt public build-time configuration và server-side secret.
Khi đổi env key phải kiểm tra .env.example, Docker, CI/CD và docs nếu có.

21. Feature Design Checklist

Mỗi feature mới phải xác định: domain, page/route, local hay global state, API, validation, auth/permission, reusable component, realtime, performance, dependency.
Điểm nào chưa xác định từ source code hoặc requirement phải hỏi User.

22. Anti-Patterns

God Component; API trong render; Global Everything; duplicate Axios/SignalR client; utility rải rác không boundary; dependency sprawl; bypass abstraction; duplicate source of truth.

23. Source of Truth Hierarchy

1 User requirement đã xác nhận
2 package.json
3 lockfile
4 source code
5 config thực tế
6 ARCHITECTURE.md
7 README/comments
8 Agent assumption
Nếu tài liệu và code khác nhau, báo mismatch thay vì tự đoán.

24. Mục tiêu

Mỗi feature mới phải hòa vào kiến trúc hiện tại, reuse abstraction hiện có, thay đổi tối thiểu, dễ test, dễ bảo trì và không tạo kiến trúc mới bên trong project.