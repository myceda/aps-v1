import { NextResponse } from 'next/server';
import { requireUser } from '../../../lib/auth/index.js';
import { prisma } from '../../../lib/prisma.js';

export async function GET(request) {
  const auth = await requireUser(request);
  if (auth.error) return auth.error;

  try {
    const programs = await prisma.program.findMany({
      orderBy: { curriculum_year: 'desc' },
    });
    return NextResponse.json({ success: true, data: programs });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
