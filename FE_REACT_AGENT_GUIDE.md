# HƯỚNG DẪN DÀNH CHO AGENT AI: KHỞI TẠO DỰ ÁN FRONTEND REACT CHUẨN KIẾN TRÚC

> **Mục đích tài liệu:** Hướng dẫn chi tiết từng bước để một Agent AI (hoặc lập trình viên) có thể tự động khởi tạo, cấu hình và dựng khung một dự án Frontend React mới với **công nghệ, thư viện, cấu trúc thư mục, quy ước kiến trúc và design system** tương tự dự án CafeShop hiện tại.

---

## 1. TỔNG QUAN TECH STACK & PHIÊN BẢN

| Thành phần | Công nghệ / Thư viện | Phiên bản mục tiêu | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Ngôn ngữ** | **JavaScript (ES Modules)** | ES2022+ | **TUYỆT ĐỐI KHÔNG dùng TypeScript** (theo quy ước dự án) |
| **Bundler & Build** | **Vite** | 6.x / 8.x | Cấu hình trong `vite.config.js` |
| **UI Core** | **React & React DOM** | 19.x (hoặc 18.x) | JSX, Functional Components, Hooks |
| **Routing** | **React Router DOM** | 7.x (Data Router / BrowserRouter) | ProtectedRoute theo Role, Nested Routes |
| **State Management** | **Redux Toolkit & React-Redux** | RTK 2.x, React-Redux 9.x | Reducer chia theo module (`app`, `user`, `admin`) |
| **Styling** | **Tailwind CSS v4** | 4.x (`@tailwindcss/vite`) | Sử dụng `@import "tailwindcss";`, `@theme`, `@layer` |
| **UI Component Lib** | **Ant Design (antd)** | 5.x / 6.x | Tích hợp modal, table, form controls, message |
| **HTTP Client** | **Axios** | 1.x | BaseService với request/response interceptors, refresh token, global loading counter |
| **Form & Validation** | **Formik & Yup** | Formik 2.x, Yup 1.x | Chuẩn form validation cho toàn dự án |
| **Realtime** | **@microsoft/signalr** | 10.x / 8.x | Quản lý SignalR hub connection độc lập ở Service layer |
| **Notifications** | **react-toastify & AntD message** | Toastify 11.x | Toast thông báo sự kiện, toast confirm |
| **Auth & Token** | **jwt-decode** | 4.x | Giải mã payload JWT lưu role & user ID |
| **Linter** | **ESLint** | 9.x / 10.x Flat Config | `eslint.config.js` với `eslint-plugin-react-hooks` |

---

## 2. QUY TRÌNH DỰNG DỰ ÁN TỪ ĐẦU (STEP-BY-STEP SCAFFOLDING)

Agent thực thi tuần tự các bước dòng lệnh và tạo các file cấu hình như sau:

### Bước 2.1: Khởi tạo dự án Vite (Non-interactive)
```bash
# Tạo project React sử dụng Vite template Javascript
npx -y create-vite@latest <TEN_DU_AN> --template react
cd <TEN_DU_AN>
```

### Bước 2.2: Cài đặt Dependencies chuẩn
```bash
# Core dependencies
npm install react-router-dom @reduxjs/toolkit react-redux redux axios antd @microsoft/signalr formik yup jwt-decode react-toastify

# Styling dependencies (Tailwind CSS v4)
npm install -D tailwindcss @tailwindcss/vite
```

### Bước 2.3: Cấu hình `vite.config.js`
Tạo/Cập nhật file `vite.config.js` để tích hợp React plugin và Tailwind v4:
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    port: 3000,
    open: true
  }
})
```

### Bước 2.4: Cấu hình Environment Variables (`.env.example` và `.env`)
Tạo `.env.example`:
```env
VITE_API_URL=https://localhost:7198
VITE_SIGNALR_HUB_URL=https://localhost:7198/notificationHub
```
Tạo `.env`:
```env
VITE_API_URL=https://localhost:7198
VITE_SIGNALR_HUB_URL=https://localhost:7198/notificationHub
```

---

## 3. CẤU TRÚC THƯ MỤC CHUẨN (`src/`)

Agent cần tạo toàn bộ cây thư mục theo cấu trúc phân tầng (Layered Architecture) sau:

```text
src/
├── assets/                       # Hình ảnh, logo, vector, font tĩnh
│   ├── images/
│   └── icons/
├── components/                   # UI components dùng chung & theo module
│   ├── common/                   # Header, Footer, AppInitializer, AppNotification, StatusBadge
│   ├── error/                    # ErrorBoundary.jsx, ApiErrorModal.jsx
│   ├── loading/                  # Loading.jsx, Skeleton loaders
│   ├── auth/                     # AuthModal.jsx, LoginForm.jsx, RegisterForm.jsx
│   ├── notification/             # RealtimeNotificationHandler.jsx
│   └── [feature]/                # Components theo feature (product, cart, order, admin...)
├── hooks/                        # Custom React hooks (useDebounce.js, useAuth.js, ...)
├── layouts/                      # Hoặc templates/ chứa khung giao diện layout
│   ├── UserTemplate.jsx          # Shell layout cho khách hàng (Header + Outlet + Footer)
│   └── AdminTemplate.jsx         # Shell layout cho quản trị viên (Sidebar + Header + Outlet)
├── pages/                        # Toàn bộ Page components (Mapping 1:1 với Routes)
│   ├── home/                     # HomePage.jsx
│   ├── auth/                     # LoginPage.jsx, RegisterPage.jsx
│   ├── error/                    # NotFoundPage.jsx
│   ├── [user_features]/          # CartPage, CheckoutPage, ProfilePage, OrderHistoryPage...
│   └── admin/                    # DashboardAdminPage, AdminUsersPage, AdminSettingsPage...
├── redux/                        # Global State Management (Redux Toolkit)
│   ├── actions/                  # createAsyncThunk action creators
│   │   ├── authAction.js
│   │   ├── user/                 # user-specific async actions
│   │   └── admin/                # admin-specific async actions
│   ├── slices/                   # Redux slices
│   │   ├── authSlice.js          # Auth state, login/logout, tokens
│   │   ├── uiSlice.js            # Global loading, modals, notifications
│   │   ├── user/                 # Slices nghiệp vụ người dùng
│   │   └── admin/                # Slices nghiệp vụ quản trị
│   └── store.js                  # Cấu hình store & kết hợp reducers (app, user, admin)
├── services/                     # Layer giao tiếp HTTP API & Socket
│   ├── BaseService.js            # Axios instance, Interceptors, Store Injection, Refresh Token
│   ├── signalrService.js         # Quản lý kết nối SignalR Hub
│   ├── user/                     # Services gọi API khách hàng
│   └── admin/                    # Services gọi API quản trị
├── utils/                        # Tiện ích, helper, constants
│   ├── auth/                     # authStorage.js, authRole.js (LocalStorage & Role helpers)
│   ├── constants/                # System.js (DOMAIN, TOKEN, ROLES, HTTP_STATUS)
│   ├── helpers/                  # formatCurrency.js, formatDate.js, validator.js
│   └── route/                    # ProtectedRoute.jsx (Route guard kiểm tra role)
├── App.jsx                       # Provider, Global Modals, ToastContainer, Routes
├── index.css                     # Tailwind v4 import, @theme, custom component classes
└── main.jsx                      # Entrypoint: Store injection, ErrorBoundary, BrowserRouter
```

---

## 4. CODE MẪU CHO CÁC MODULE CỐT LÕI (CORE FILES)

Khi dựng dự án, Agent AI phải tạo các file nền tảng sau để đảm bảo hệ thống chạy liền mạch:

### 4.1. `src/utils/constants/System.js`
```javascript
export const DOMAIN = import.meta.env.VITE_API_URL || 'https://localhost:7198'
export const SIGNALR_HUB = import.meta.env.VITE_SIGNALR_HUB_URL || `${DOMAIN}/notificationHub`

export const TOKEN = 'accessToken'
export const REFRESH_TOKEN = 'refreshToken'
export const USER_ROLE = 'userRole'
export const USER_INFO = 'userInfo'

// Danh sách Role chuẩn
export const ROLE_CUSTOMER = 'CUSTOMER'
export const ROLE_USER = 'USER'
export const ROLE_ADMIN = 'ADMIN'
export const ROLE_ADMINISTRATOR = 'ADMINISTRATOR'

export const ADMIN_ROLES = [ROLE_ADMIN, ROLE_ADMINISTRATOR]
export const CUSTOMER_ROLES = [ROLE_CUSTOMER, ROLE_USER, ROLE_ADMIN, ROLE_ADMINISTRATOR]
```

### 4.2. `src/utils/auth/authStorage.js`
```javascript
import { TOKEN, REFRESH_TOKEN, USER_ROLE, USER_INFO } from '../constants/System'

export const readAuthFromStorage = () => {
    try {
        const accessToken = localStorage.getItem(TOKEN)
        const refreshToken = localStorage.getItem(REFRESH_TOKEN)
        const role = localStorage.getItem(USER_ROLE)
        const userRaw = localStorage.getItem(USER_INFO)
        const user = userRaw ? JSON.parse(userRaw) : null
        return { accessToken, refreshToken, role, user }
    } catch {
        return { accessToken: null, refreshToken: null, role: null, user: null }
    }
}

export const saveFullAuth = ({ accessToken, refreshToken, role, user }) => {
    if (accessToken) localStorage.setItem(TOKEN, accessToken)
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN, refreshToken)
    if (role) localStorage.setItem(USER_ROLE, role)
    if (user) localStorage.setItem(USER_INFO, JSON.stringify(user))
}

export const clearAuthStorage = () => {
    localStorage.removeItem(TOKEN)
    localStorage.removeItem(REFRESH_TOKEN)
    localStorage.removeItem(USER_ROLE)
    localStorage.removeItem(USER_INFO)
}

export const writeAuthToStorage = (patch = {}) => {
    if (patch.accessToken !== undefined) {
        patch.accessToken ? localStorage.setItem(TOKEN, patch.accessToken) : localStorage.removeItem(TOKEN)
    }
    if (patch.refreshToken !== undefined) {
        patch.refreshToken ? localStorage.setItem(REFRESH_TOKEN, patch.refreshToken) : localStorage.removeItem(REFRESH_TOKEN)
    }
    if (patch.role !== undefined) {
        patch.role ? localStorage.setItem(USER_ROLE, patch.role) : localStorage.removeItem(USER_ROLE)
    }
    if (patch.user !== undefined) {
        patch.user ? localStorage.setItem(USER_INFO, JSON.stringify(patch.user)) : localStorage.removeItem(USER_INFO)
    }
}
```

### 4.3. `src/services/BaseService.js` (Store Injection & Interceptors)
```javascript
import axios from 'axios'
import { DOMAIN, TOKEN, REFRESH_TOKEN } from '../utils/constants/System'

export const http = axios.create({
    baseURL: DOMAIN,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Store injection để dispatch actions mà không bị circular dependencies
let appStore = null
export const injectStore = (store) => {
    appStore = store
}

function dispatchStartLoading() {
    if (appStore) appStore.dispatch({ type: 'ui/startGlobalLoading' })
}

function dispatchStopLoading() {
    if (appStore) appStore.dispatch({ type: 'ui/stopGlobalLoading' })
}

function dispatchLogout() {
    if (appStore) appStore.dispatch({ type: 'auth/logout' })
}

// Interceptor Request: Gắn Bearer Token và đếm Loading
http.interceptors.request.use((config) => {
    if (!config.__skipGlobalLoading) {
        config.__globalLoadingCountered = true
        dispatchStartLoading()
    }
    const token = localStorage.getItem(TOKEN)
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
}, (error) => {
    dispatchStopLoading()
    return Promise.reject(error)
})

// Interceptor Response: Giảm Loading Counter & Quản lý 401 Refresh Token
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) prom.reject(error)
        else prom.resolve(token)
    })
    failedQueue = []
}

http.interceptors.response.use(
    (response) => {
        if (response.config.__globalLoadingCountered) {
            dispatchStopLoading()
        }
        return response
    },
    async (error) => {
        const originalRequest = error.config
        if (originalRequest?.__globalLoadingCountered) {
            dispatchStopLoading()
        }

        if (error.response?.status === 401 && !originalRequest._retry) {
            const refreshToken = localStorage.getItem(REFRESH_TOKEN)
            if (!refreshToken) {
                dispatchLogout()
                return Promise.reject(error)
            }

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject })
                }).then(token => {
                    originalRequest.headers.Authorization = `Bearer ${token}`
                    return http(originalRequest)
                }).catch(err => Promise.reject(err))
            }

            originalRequest._retry = true
            isRefreshing = true

            try {
                const res = await axios.post(`${DOMAIN}/api/Auth/refresh-token`, { refreshToken })
                const newAccessToken = res.data.accessToken || res.data.token
                const newRefreshToken = res.data.refreshToken || refreshToken

                localStorage.setItem(TOKEN, newAccessToken)
                localStorage.setItem(REFRESH_TOKEN, newRefreshToken)

                if (appStore) {
                    appStore.dispatch({
                        type: 'auth/hydrateTokens',
                        payload: { accessToken: newAccessToken, refreshToken: newRefreshToken },
                    })
                }

                processQueue(null, newAccessToken)
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
                return http(originalRequest)
            } catch (refreshErr) {
                processQueue(refreshErr, null)
                dispatchLogout()
                return Promise.reject(refreshErr)
            } finally {
                isRefreshing = false
            }
        }

        return Promise.reject(error)
    }
)
```

### 4.4. `src/redux/slices/uiSlice.js`
```javascript
import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    loadingCount: 0,
    apiError: null,
}

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        startGlobalLoading: (state) => {
            state.loadingCount += 1
        },
        stopGlobalLoading: (state) => {
            state.loadingCount = Math.max(0, state.loadingCount - 1)
        },
        setApiError: (state, action) => {
            state.apiError = action.payload
        },
        clearApiError: (state) => {
            state.apiError = null
        },
    },
})

export const { startGlobalLoading, stopGlobalLoading, setApiError, clearApiError } = uiSlice.actions
export default uiSlice.reducer
```

### 4.5. `src/redux/store.js`
```javascript
import { configureStore, combineReducers } from '@reduxjs/toolkit'
import authReducer from './slices/authSlice'
import uiReducer from './slices/uiSlice'

const appReducer = combineReducers({
    auth: authReducer,
    ui: uiReducer,
})

const userAppReducer = combineReducers({
    // Đăng ký các slice nghiệp vụ user ở đây
})

const adminAppReducer = combineReducers({
    // Đăng ký các slice nghiệp vụ admin ở đây
})

export const store = configureStore({
    reducer: {
        app: appReducer,
        user: userAppReducer,
        admin: adminAppReducer,
    },
})
```

### 4.6. `src/utils/route/ProtectedRoute.jsx`
```javascript
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'

export default function ProtectedRoute({ allowedRoles = [] }) {
    const location = useLocation()
    const { isAuthenticated, role } = useSelector((state) => state.app.auth)

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    if (allowedRoles.length > 0 && (!role || !allowedRoles.includes(role.toUpperCase()))) {
        return <Navigate to="/" replace />
    }

    return <Outlet />
}
```

### 4.7. `src/index.css` (Tailwind v4 & Design System)
```css
@import "tailwindcss";

@theme {
  --font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

@layer base {
  body {
    @apply bg-slate-50 text-slate-800 antialiased selection:bg-sky-200 selection:text-sky-900;
    font-family: var(--font-sans);
  }
}

@layer components {
  /* Reusable Status Badge Component */
  .status-badge {
    @apply inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold shadow-2xs;
  }
  .status-dot {
    @apply w-1.5 h-1.5 rounded-full;
  }

  /* Admin Action Buttons */
  .admin-action-btn {
    @apply inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-xl border whitespace-nowrap text-xs font-bold shadow-2xs transition-all cursor-pointer;
  }
  .admin-action-btn-edit {
    @apply border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-amber-600 hover:border-amber-300;
  }
  .admin-action-btn-delete {
    @apply border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300;
  }

  /* Form Inputs */
  .custom-admin-input {
    @apply w-full rounded-2xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-200;
  }
  .custom-admin-input-error {
    @apply border-red-300 focus:border-red-500 focus:ring-red-200;
  }
}

@layer utilities {
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
}
```

### 4.8. `src/main.jsx` & `src/App.jsx`
- **`src/main.jsx`**:
```javascript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { store } from './redux/store'
import { injectStore } from './services/BaseService'
import ErrorBoundary from './components/error/ErrorBoundary'

// Inject Redux Store vào Axios Service Layer
injectStore(store)

createRoot(document.getElementById('root')).render(
    <ErrorBoundary>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </ErrorBoundary>
)
```

- **`src/App.jsx`**:
```javascript
import { Provider } from 'react-redux'
import { Route, Routes, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { store } from './redux/store'
import Loading from './components/loading/Loading'
import ApiErrorModal from './components/error/ApiErrorModal'
import UserTemplate from './layouts/UserTemplate'
import AdminTemplate from './layouts/AdminTemplate'
import ProtectedRoute from './utils/route/ProtectedRoute'
import { ADMIN_ROLES, CUSTOMER_ROLES } from './utils/constants/System'

// Import Pages
import HomePage from './pages/home/HomePage'
import LoginPage from './pages/auth/LoginPage'
import NotFoundPage from './pages/error/NotFoundPage'

function App() {
    return (
        <Provider store={store}>
            <ToastContainer position="top-right" autoClose={4000} />
            <Loading />
            <ApiErrorModal />
            <Routes>
                {/* Client / User Routes */}
                <Route element={<UserTemplate />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    
                    {/* Protected User Routes */}
                    <Route element={<ProtectedRoute allowedRoles={CUSTOMER_ROLES} />}>
                        {/* <Route path="/profile" element={<ProfilePage />} /> */}
                    </Route>
                    <Route path="*" element={<NotFoundPage />} />
                </Route>

                {/* Admin Routes */}
                <Route element={<ProtectedRoute allowedRoles={ADMIN_ROLES} />}>
                    <Route path="/admin" element={<AdminTemplate />}>
                        {/* <Route index element={<DashboardAdminPage />} /> */}
                    </Route>
                </Route>
            </Routes>
        </Provider>
    )
}

export default App
```

---

## 5. QUY TẮC PHÁT TRIỂN & RÀNG BUỘC KIẾN TRÚC (BẮT BUỘC CHO AGENT AI)

Khi phát triển thêm màn hình, tính năng hoặc sửa lỗi, Agent AI phải tuân thủ nghiêm ngặt các quy tắc sau:

1. **Luồng dữ liệu bắt buộc (Data Flow):**
   $$\text{Service (Axios)} \longrightarrow \text{createAsyncThunk (actions)} \longrightarrow \text{Redux Slice} \longrightarrow \text{UI Component/Page}$$
   - **Tuyệt đối không** gọi `axios` hoặc `http` trực tiếp trong component JSX.
   - Component React chỉ chịu trách nhiệm hiển thị (presentation), tương tác người dùng (interaction) và dispatch action.
2. **Quản lý State:**
   - **Local State (`useState`):** Ưu tiên cho trạng thái nội bộ của component (mở modal nhỏ, tab active cục bộ, input tạm).
   - **Global State (Redux):** Dùng cho Auth, User Profile, Cart, UI Global Loading, dữ liệu chia sẻ giữa nhiều màn hình.
3. **Form & Validation:**
   - Sử dụng **Formik** và **Yup** cho toàn bộ form nhập liệu (Login, Register, CRUD Admin).
   - Không tự sáng tạo cơ chế validate khác.
4. **UI Styling:**
   - Sử dụng **Ant Design** kết hợp **Tailwind CSS v4**.
   - Không tự ý cài đặt thêm các thư viện UI khác như Material UI, Bootstrap, Chakra UI.
5. **Realtime (SignalR):**
   - Đặt kết nối trong service layer (`signalrService.js`).
   - Khởi tạo lắng nghe qua component chung (như `RealtimeNotificationHandler.jsx`) gắn tại `App.jsx`, dispatch vào Redux khi nhận event.
6. **Không sử dụng TypeScript:**
   - Giữ nguyên định dạng file `.js` và `.jsx`. Không tạo file `.ts` / `.tsx`.
7. **Xử lý lỗi & Loading:**
   - Luôn xử lý 3 trạng thái: `loading`, `error`, và `empty state` cho mọi trang lấy dữ liệu từ API.

---

## 6. CHECKLIST KIỂM TRA CHO AGENT AI TRƯỚC KHI BÀN GIAO
- [ ] Chạy `npm run lint` không báo lỗi cú pháp hoặc hook dependencies.
- [ ] Chạy `npm run build` tạo thành công thư mục `dist/` không có cảnh báo nghiêm trọng.
- [ ] Cấu trúc thư mục đúng chuẩn phân tầng: `components`, `hooks`, `layouts`, `pages`, `redux`, `services`, `utils`.
- [ ] Store Injection hoạt động đúng, không gây lỗi circular import khi gọi API.
- [ ] Đã có file `.env.example` với hướng dẫn đặt URL backend.
