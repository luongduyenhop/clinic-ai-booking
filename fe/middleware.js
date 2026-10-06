import { NextResponse } from 'next/server';

const ROLE_PATH_MAP = {
  '/doctor': ['DOCTOR'],
  '/reception': ['RECEPTIONIST'],
  '/admin': ['ADMIN'],
  '/patient': ['PATIENT'],
};

export function middleware(request) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get('access_token')?.value;
  const role = request.cookies.get('user_role')?.value;

  // 1. Chưa đăng nhập -> chuyển hướng về trang chủ kèm query ?redirect=...
  if (!token) {
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Tìm danh sách vai trò được phép cho prefix path
  const matchedPrefix = Object.keys(ROLE_PATH_MAP).find(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (matchedPrefix) {
    const allowedRoles = ROLE_PATH_MAP[matchedPrefix];
    if (!role || !allowedRoles.includes(role)) {
      // Đã đăng nhập nhưng sai vai trò -> chuyển về /forbidden
      const forbiddenUrl = new URL('/forbidden', request.url);
      return NextResponse.redirect(forbiddenUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/doctor/:path*',
    '/reception/:path*',
    '/admin/:path*',
    '/patient/:path*',
  ],
};
