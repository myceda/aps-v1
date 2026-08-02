import { NextResponse } from 'next/server';
import { OAUTH_STATE_COOKIE_NAME } from '../../../../lib/auth/session.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

function getBaseUrl(request) {
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

function getSafeReturnTo(request) {
  const returnTo = new URL(request.url).searchParams.get('returnTo') || '/';
  if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return '/';
  return returnTo;
}

function requireGoogleConfig() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required');
  }
}

export async function GET(request) {
  try {
    requireGoogleConfig();

    const state = crypto.randomUUID();
    const callbackUrl = new URL('/api/auth/google/callback', getBaseUrl(request));
    const authUrl = new URL(GOOGLE_AUTH_URL);
    authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', callbackUrl.toString());
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'openid email profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('prompt', 'select_account');

    const response = NextResponse.redirect(authUrl);
    response.cookies.set({
      name: OAUTH_STATE_COOKIE_NAME,
      value: JSON.stringify({ state, returnTo: getSafeReturnTo(request) }),
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message || 'เริ่ม Google OAuth ไม่สำเร็จ' },
      { status: 500 },
    );
  }
}
