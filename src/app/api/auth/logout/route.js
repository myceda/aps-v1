import { NextResponse } from 'next/server';
import { clearSessionCookie } from '../../../../lib/auth/session.js';

export async function POST(request) {
  const response = NextResponse.redirect(new URL('/', request.url));
  clearSessionCookie(response);
  return response;
}

export async function GET(request) {
  const response = NextResponse.redirect(new URL('/', request.url));
  clearSessionCookie(response);
  return response;
}
