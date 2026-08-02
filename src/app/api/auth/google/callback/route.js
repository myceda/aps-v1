import { NextResponse } from 'next/server';
import { createSessionForUser, upsertGoogleUser } from '../../../../../lib/auth/index.js';
import {
  OAUTH_STATE_COOKIE_NAME,
  setSessionCookie,
} from '../../../../../lib/auth/session.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

function getBaseUrl(request) {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

function parseStateCookie(request) {
  const rawValue = request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function getSafeReturnTo(returnTo, role) {
  if (!returnTo || !returnTo.startsWith('/') || returnTo.startsWith('//')) {
    return role === 'admin' ? '/admin' : '/student/dashboard';
  }

  if (role !== 'admin' && returnTo.startsWith('/admin')) return '/student/dashboard';
  if (role === 'admin' && returnTo.startsWith('/student')) return '/admin';

  return returnTo;
}

async function exchangeCodeForToken(request, code) {
  const callbackUrl = new URL('/api/auth/google/callback', getBaseUrl(request));
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: callbackUrl.toString(),
    grant_type: 'authorization_code',
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) {
    throw new Error('แลก Google OAuth token ไม่สำเร็จ');
  }

  return response.json();
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('โหลดข้อมูล Google account ไม่สำเร็จ');
  }

  return response.json();
}

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const stateCookie = parseStateCookie(request);

  if (!code || !state || !stateCookie || stateCookie.state !== state) {
    return NextResponse.json({ success: false, error: 'OAuth state ไม่ถูกต้อง' }, { status: 400 });
  }

  try {
    const token = await exchangeCodeForToken(request, code);
    const profile = await fetchGoogleProfile(token.access_token);
    const user = await upsertGoogleUser(profile);
    const sessionToken = await createSessionForUser(user);
    const response = NextResponse.redirect(new URL(getSafeReturnTo(stateCookie.returnTo, user.role), request.url));

    setSessionCookie(response, sessionToken);
    response.cookies.set({
      name: OAUTH_STATE_COOKIE_NAME,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ' },
      { status: 500 },
    );
  }
}
