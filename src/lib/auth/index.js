import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '../prisma.js';
import {
  AUTH_COOKIE_NAME,
  createSessionToken,
  getSessionFromRequest,
  verifySessionToken,
} from './session.js';

function jsonResponse(payload, status = 200) {
  return NextResponse.json(payload, { status });
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getAdminEmails() {
  return new Set(
    String(process.env.APS_ADMIN_EMAILS || '')
      .split(',')
      .map((email) => normalizeEmail(email))
      .filter(Boolean),
  );
}

function getStudentCodeFromEmail(email, userId) {
  const localPart = normalizeEmail(email).split('@')[0] || 'student';
  const safeLocalPart = localPart.replace(/[^a-z0-9]/g, '').toUpperCase().slice(0, 16) || 'STUDENT';
  return `APS-${safeLocalPart}-${userId.slice(0, 8).toUpperCase()}`;
}

function getDefaultAdmissionYear() {
  return new Date().getFullYear() + 543;
}

function includeProfile() {
  return {
    student: {
      include: {
        studentPrograms: {
          include: { program: true },
          orderBy: { enrolled_at: 'desc' },
        },
      },
    },
    admin: true,
  };
}

async function ensureRoleProfile(user) {
  if (user.role === 'admin') {
    await prisma.admin.upsert({
      where: { user_id: user.user_id },
      update: {},
      create: { user_id: user.user_id },
    });
    return;
  }

  await prisma.student.upsert({
    where: { user_id: user.user_id },
    update: {},
    create: {
      user_id: user.user_id,
      student_code: getStudentCodeFromEmail(user.email, user.user_id),
      admission_year: getDefaultAdmissionYear(),
    },
  });
}

export async function upsertGoogleUser(googleProfile) {
  const email = normalizeEmail(googleProfile.email);
  if (!email) throw new Error('Google account did not return an email');

  const adminEmails = getAdminEmails();
  const role = adminEmails.has(email) ? 'admin' : 'student';
  const googleId = String(googleProfile.sub || googleProfile.id || '');
  if (!googleId) throw new Error('Google account did not return a stable id');

  const user = await prisma.user.upsert({
    where: { google_id: googleId },
    update: {
      email,
      name: googleProfile.name || email,
      role,
    },
    create: {
      email,
      name: googleProfile.name || email,
      role,
      google_id: googleId,
    },
  });

  await ensureRoleProfile(user);

  return prisma.user.findUnique({
    where: { user_id: user.user_id },
    include: includeProfile(),
  });
}

export async function createSessionForUser(user) {
  return createSessionToken(user);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const session = await verifySessionToken(token);
  if (!session) return null;

  return prisma.user.findUnique({
    where: { user_id: session.userId },
    include: includeProfile(),
  });
}

export async function getCurrentUserFromRequest(request) {
  const session = await getSessionFromRequest(request);
  if (!session) return null;

  return prisma.user.findUnique({
    where: { user_id: session.userId },
    include: includeProfile(),
  });
}

export async function requireUser(request) {
  const user = await getCurrentUserFromRequest(request);

  if (!user) {
    return {
      error: jsonResponse({ success: false, error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, 401),
    };
  }

  return { user };
}

export async function requireStudent(request) {
  const { user, error } = await requireUser(request);
  if (error) return { error };

  if (user.role !== 'student' || !user.student) {
    return {
      error: jsonResponse({ success: false, error: 'อนุญาตเฉพาะนักศึกษาเท่านั้น' }, 403),
    };
  }

  return { user, student: user.student };
}

export async function requireAdmin(request) {
  const { user, error } = await requireUser(request);
  if (error) return { error };

  if (user.role !== 'admin' || !user.admin) {
    return {
      error: jsonResponse({ success: false, error: 'อนุญาตเฉพาะผู้ดูแลระบบเท่านั้น' }, 403),
    };
  }

  return { user, admin: user.admin };
}
