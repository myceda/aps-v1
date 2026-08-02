import { NextResponse } from 'next/server';
import { getSessionFromRequest, redirectToLogin } from './lib/auth/session.js';

function forbidden() {
  return NextResponse.json(
    { success: false, error: 'ไม่มีสิทธิ์ใช้งานส่วนนี้' },
    { status: 403 },
  );
}

function unauthorized() {
  return NextResponse.json(
    { success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' },
    { status: 401 },
  );
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const session = await getSessionFromRequest(request);

  if (pathname.startsWith('/api/auth')) return NextResponse.next();

  if (pathname.startsWith('/api/admin')) {
    if (!session) return unauthorized();
    if (session.role !== 'admin') return forbidden();
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/student')) {
    if (!session) return unauthorized();
    if (session.role !== 'student') return forbidden();
    return NextResponse.next();
  }

  if (pathname.startsWith('/api')) {
    if (!session) return unauthorized();
    return NextResponse.next();
  }

  if (pathname.startsWith('/admin')) {
    if (!session) return redirectToLogin(request);
    if (session.role !== 'admin') return NextResponse.redirect(new URL('/student/dashboard', request.url));
  }

  if (pathname.startsWith('/student')) {
    if (!session) return redirectToLogin(request);
    if (session.role !== 'student') return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/student/:path*', '/api/:path*'],
};
