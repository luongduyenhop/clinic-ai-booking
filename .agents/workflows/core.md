---
description: core
---

FRONTEND AGENT WORKFLOW — React + Vite + Redux + Axios

Mục đích: dùng file này làm workflow/rule cho AI Agent khi phát triển Frontend và khi nhận đặc tả API từ Backend, đặc biệt với các module Auth và News.

1. MỤC TIÊU CHUNG

Dự án Frontend hiện tại sử dụng:

React 19

Vite

React Router DOM v7

Redux Toolkit / Redux

Axios

TailwindCSS v4

Ant Design

Formik + Yup

SignalR

jwt-decode

react-toastify

mapbox-gl

Agent phải ưu tiên tích hợp vào kiến trúc hiện có, không tự ý tạo kiến trúc mới nếu chưa kiểm tra project.

Nguyên tắc cốt lõi:

Đọc structure hiện tại trước khi code.

Đọc API specification trước khi sửa UI/service/state.

Không tự đoán endpoint, HTTP method, request body, response body hoặc field name khi chưa có dữ liệu xác nhận.

Tái sử dụng code hiện có nếu đã có abstraction phù hợp.

Tách UI, API service, global state và utility rõ ràng.

Không đặt API call trực tiếp trong component nếu project đã có services/ hoặc Redux flow cho nghiệp vụ đó.

Không phá vỡ API contract để làm UI thuận tiện hơn.

Sau khi sửa phải kiểm tra import, route, state flow, loading/error state và khả năng build.

2. CẤU TRÚC DỰ KIẾN

src/
├── assets/
├── components/
├── layouts/
├── pages/
├── redux/
│   ├── store.js
│   └── slices/
├── services/
│   ├── authService.js
│   ├── newsService.js
│   └── ...
├── templates/
└── utils/

Agent phải kiểm tra cấu trúc thực tế trước khi áp dụng cấu trúc trên.

Không tạo file mới chỉ vì cấu trúc đề xuất có file đó.

Ví dụ:

Nếu đã có redux/slices/authSlice.js thì ưu tiên mở rộng file đó.

Nếu project đang dùng redux/authSlice.js thì không tự ý chuyển toàn bộ sang cấu trúc khác.

Nếu đã có Axios instance/interceptor thì phải tái sử dụng.

3. QUY TRÌNH KHI NHẬN API SPECIFICATION

Khi Agent nhận đặc tả API như:

Endpoint

HTTP Method

Request parameters

Request body

Response body

HTTP status code

Authentication requirement

Role/permission requirement

Validation/error response

Agent phải thực hiện theo thứ tự sau.

STEP 1 — ĐỌC PROJECT

Trước khi sửa code, kiểm tra:

package.json
src/
src/services/
src/redux/
src/pages/
src/components/
src/layouts/
src/templates/
src/utils/
.env
.env.example
vite.config.*

Tìm các thành phần liên quan:

Axios instance
Authorization header
JWT storage
Redux store
Auth slice
Protected Route
Role guard
Router configuration
Toast/Error handling
Loading component
Pagination component
Modal/Form component

Không code ngay khi chưa biết project đang xử lý authentication/API như thế nào.

STEP 2 — PHÂN TÍCH API CONTRACT

Tạo bảng mapping trước khi implement.

Ví dụ:

API

Method

Auth

Role

Request

Response

FE responsibility

/api/auth/login

POST

No

Public

LoginRequest

LoginResponse

Form + auth state

/api/auth/register

POST

No

Public

RegisterRequest

RegisterResponse

Form + validation

/api/news

GET

Có/Không

tùy API

Query params

News list

List + pagination

/api/news/{id}

GET

Có/Không

tùy API

route param

News detail

Detail page

Nếu API specification không đủ thông tin, Agent phải:

dùng những thông tin đã xác định;

đánh dấu phần chưa xác định;

không tự bịa contract.

Nếu có thể tiếp tục mà không cần giả định, tiếp tục implementation theo phần đã xác định.

4. QUY TẮC TÍCH HỢP AUTH API

4.1. AUTH SERVICE

Tất cả API authentication nên nằm trong service layer phù hợp, ví dụ:

src/services/authService.js

Service chịu trách nhiệm giao tiếp với Backend.

Ví dụ pattern:

import axiosClient from './axiosClient';

export const login = async (payload) => {
  const response = await axiosClient.post('/api/auth/login', payload);
  return response.data;
};

Tên axiosClient chỉ là ví dụ. Agent phải tìm tên thật trong project trước khi dùng.

Không hard-code base URL ở nhiều service khác nhau.

4.2. LOGIN FLOW

Khi nhận API login, Agent phải xác định:

Login Form
   ↓
Formik/Yup validation
   ↓
authService.login()
   ↓
API
   ↓
response
   ↓
Lưu authentication state
   ↓
Redux update
   ↓
Router navigation
   ↓
UI

Agent phải kiểm tra API trả về:

accessToken?
refreshToken?
user?
role?
permissions?
expiresAt?

Không tự suy đoán tên field.

4.3. JWT

Nếu Backend trả JWT:

decode JWT bằng jwt-decode khi cần đọc claims ở FE;

không coi việc decode JWT là kiểm tra tính hợp lệ của token;

quyền truy cập thực tế vẫn phải được Backend bảo vệ;

FE chỉ dùng role/permission để điều khiển trải nghiệm và route/UI.

Agent phải tìm cách project hiện đang lưu token:

localStorage
sessionStorage
cookie
Redux
memory

Không đổi cơ chế storage toàn bộ project trừ khi API requirement yêu cầu.

4.4. AXIOS INTERCEPTOR

Nếu project đã có interceptor:

Request interceptor
→ gắn Authorization

Response interceptor
→ xử lý 401/403
→ refresh token nếu project hỗ trợ
→ logout nếu session hết hạn

Agent phải tái sử dụng interceptor.

Không viết logic thêm token riêng trong từng API service.

5. QUY TẮC AUTHORIZATION / ROLE

Backend mới là nơi quyết định quyền thật sự.

Frontend chỉ chịu trách nhiệm:

Ẩn/hiện UI
Route protection
Điều hướng
Hiển thị thông báo

Ví dụ:

Public
├── Login
├── Register

Authenticated
├── Profile
├── My orders

Admin
├── Dashboard
├── News management

Agent phải kiểm tra route guard/template hiện tại trước.

Nếu project đã có:

ProtectedRoute
RoleRoute
PrivateRoute
AdminTemplate
UserTemplate

thì mở rộng abstraction hiện có thay vì tạo hệ thống mới.

6. QUY TẮC REGISTER / OTP / AUTH FLOW

Khi API specification có:

Register
Verify OTP
Resend OTP
Login
Refresh Token
Logout
Forgot Password
Reset Password

Agent phải xem đây là một authentication flow, không phải các form tách rời.

Ví dụ:

Register
  ↓
OTP required
  ↓
Verify OTP
  ↓
Registration completed
  ↓
Login / redirect

Mỗi bước phải mapping chính xác với API contract.

Formik + Yup dùng cho validation phía client, nhưng không thay thế validation của Backend.

7. QUY TẮC TÍCH HỢP NEWS API

News nên được tổ chức theo module rõ ràng.

Ví dụ:

services/newsService.js
pages/news/
components/news/
redux/slices/newsSlice.js

Tên folder/file thực tế phải tuân theo project hiện tại.

Không bắt buộc phải tạo cả 4 nhóm trên nếu nghiệp vụ đơn giản hoặc project đã có cấu trúc khác.

8. NEWS SERVICE

Service phải map API 1:1 với contract.

Ví dụ concept:

export const getNews = async (params) => {
  const response = await axiosClient.get('/api/news', { params });
  return response.data;
};

export const getNewsById = async (id) => {
  const response = await axiosClient.get(`/api/news/${id}`);
  return response.data;
};

Các API CRUD nếu có:

GET    /api/news
GET    /api/news/{id}
POST   /api/news
PUT    /api/news/{id}
DELETE /api/news/{id}

Phải lấy chính xác method/path từ API specification.

9. NEWS STATE MANAGEMENT

Dùng Redux khi dữ liệu cần dùng ở nhiều component/page hoặc cần quản lý trạng thái nghiệp vụ ở cấp global.

Ví dụ state:

{
  items: [],
  selectedNews: null,
  loading: false,
  error: null,
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0
  }
}

Đây chỉ là ví dụ.

Agent phải mapping theo response thật của API.

Không tự thêm state field nếu không cần.

10. NEWS LIST FLOW

News Page
   ↓
useEffect / Redux thunk / existing data-fetch pattern
   ↓
newsService.getNews()
   ↓
Backend
   ↓
Response
   ↓
Redux state
   ↓
News Table / Cards

UI phải xử lý ít nhất:

Loading
Success + data
Empty
API error

Nếu API hỗ trợ pagination/search/filter/sort thì phải map đúng query parameter.

Ví dụ:

?page=1&pageSize=10&keyword=coffee

Không tự đổi tên thành pageNumber, limit, search nếu backend không quy định như vậy.

11. NEWS DETAIL FLOW

News List
   ↓
Click item
   ↓
Navigate `/news/:id`
   ↓
Read route param
   ↓
getNewsById(id)
   ↓
Render detail

Agent phải kiểm tra React Router v7 implementation hiện tại trước khi thêm route.

12. NEWS ADMIN CRUD FLOW

Nếu API yêu cầu quyền Admin:

Admin Page
   ↓
Permission/Role UI guard
   ↓
Formik + Yup
   ↓
newsService.create/update/delete
   ↓
API
   ↓
Toast
   ↓
Refresh/Update Redux

Sau mutation thành công:

cập nhật Redux state nếu hợp lý;

hoặc refetch list theo pattern hiện tại;

hiển thị feedback bằng react-toastify nếu project đang dùng;

đóng Modal / reset Form theo flow hiện có.

13. FORM RULES

Đối với Login/Register/Create News/Edit News:

Formik
   ↓
Yup
   ↓
Submit
   ↓
Service

Agent phải phân biệt:

Client validation
Server validation

Ví dụ Backend trả:

{
  "errors": {
    "email": ["Email already exists"]
  }
}

Agent phải xem response thật rồi mới viết mapping lỗi.

Không đoán cấu trúc validation error.

14. ERROR HANDLING

Phải kiểm tra các trường hợp chính:

200 / 201 / 204 → success
400 → bad request / validation
401 → unauthenticated
403 → forbidden
404 → not found
409 → conflict nếu API sử dụng
500 → server error

Frontend không tự biến status thành message trái với API contract.

Ưu tiên:

Backend message
→ field errors nếu có
→ fallback message của FE

15. LOADING STATE

Mỗi request quan trọng phải tránh các trạng thái UI khó hiểu như:

double submit
button vẫn bấm nhiều lần
spinner không tắt
page trắng khi API fail

Agent phải kiểm tra pattern loading hiện tại trước và tái sử dụng.

16. KHÔNG ĐƯỢC LÀM

Agent KHÔNG được:

❌ Tự bịa endpoint
❌ Tự bịa request/response field
❌ Gọi API trực tiếp rải rác trong component nếu đã có service layer
❌ Tạo thêm Redux nếu local state là đủ
❌ Tạo thêm abstraction trùng với code hiện có
❌ Đổi Router architecture không cần thiết
❌ Đổi Axios architecture không cần thiết
❌ Đổi package/dependency nếu không có lý do
❌ Xóa code cũ khi chưa xác định code đó còn được sử dụng hay không
❌ Hard-code JWT/token/role trong component
❌ Tin frontend role-check là cơ chế bảo mật duy nhất
❌ Sửa Backend/API contract từ phía Frontend để “cho dễ làm”

17. QUY TRÌNH IMPLEMENT CHUẨN

Mỗi task API integration phải đi qua pipeline:

1. READ
   ↓
2. UNDERSTAND
   ↓
3. MAP API CONTRACT
   ↓
4. FIND EXISTING CODE
   ↓
5. DESIGN MINIMAL CHANGES
   ↓
6. IMPLEMENT SERVICE
   ↓
7. IMPLEMENT REDUX STATE nếu cần
   ↓
8. IMPLEMENT PAGE/COMPONENT
   ↓
9. CONNECT ROUTER
   ↓
10. CONNECT AUTH/ROLE nếu cần
   ↓
11. HANDLE LOADING/ERROR/EMPTY
   ↓
12. VERIFY BUILD/LINT
   ↓
13. REVIEW CHANGES

Không thực hiện bước 8 trước khi hiểu service/state architecture.

18. NGUYÊN TẮC MINIMAL CHANGE

Khi task yêu cầu thêm API News hoặc Auth, Agent phải ưu tiên:

Existing code
      ↓
Reuse
      ↓
Extend
      ↓
Refactor only when necessary

Mục tiêu là thay đổi ít file nhất nhưng vẫn giữ code rõ ràng.

Không refactor toàn project chỉ vì phát hiện một cách tổ chức khác “đẹp hơn”.

19. CHECKLIST SAU KHI CODE

Agent phải tự kiểm tra:

API

[ ] HTTP method đúng
[ ] Endpoint đúng
[ ] Query params đúng
[ ] Path params đúng
[ ] Request body đúng
[ ] Response mapping đúng
[ ] Status/error handling đúng

Auth

[ ] Token được xử lý đúng pattern hiện tại
[ ] 401 được xử lý
[ ] Role/permission được map đúng
[ ] Protected route đúng

UI

[ ] Loading
[ ] Empty state
[ ] Error state
[ ] Success feedback
[ ] Form validation
[ ] Disable submit khi đang request nếu cần

Codebase

[ ] Không tạo duplicate service
[ ] Không tạo duplicate component
[ ] Không hard-code API URL
[ ] Import đúng
[ ] Route đúng
[ ] Không có dead code mới

Build

Nếu môi trường cho phép, chạy:

npm install
npm run build

Và chạy lint nếu project có script:

npm run lint

Không được báo “đã test” nếu Agent chưa thực sự chạy command.

20. OUTPUT FORMAT BẮT BUỘC CỦA AGENT

Sau khi hoàn thành task, Agent phải báo cáo theo format:

## API INTEGRATION SUMMARY

### 1. API đã tích hợp
- Method: ...
- Endpoint: ...
- Auth: ...
- Role: ...

### 2. Files đã tạo/sửa
- ...
- ...

### 3. Flow
UI → Service → Redux (nếu có) → API → UI

### 4. Validation
- ...

### 5. Error handling
- ...

### 6. Verification
- npm run build: PASS/FAIL/NOT RUN
- npm run lint: PASS/FAIL/NOT RUN

### 7. Assumptions / blockers
- ...

Agent phải phân biệt rõ:

CONFIRMED = có trong API/project
ASSUMED = giả định
NOT FOUND = chưa tìm thấy
BLOCKED = không thể triển khai do thiếu contract