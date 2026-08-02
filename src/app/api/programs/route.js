import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma.js';

// API สำหรับดึงรายการหลักสูตร CS65, IT65 จาก PostgreSQL
export async function GET() {
  try {
    const programs = await prisma.program.findMany({
      orderBy: { curriculum_year: 'desc' },
    });
    return NextResponse.json({ success: true, data: programs });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
