import { NextResponse } from 'next/server';
import { evaluateAdminReadiness } from '../../../../lib/admin/readiness.js';
import { requireAdmin } from '../../../../lib/auth/index.js';
import { prisma } from '../../../../lib/prisma.js';

const DEMO_PROGRAM_CODE = 'CS2565';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return auth.error;

  try {
    const program = await prisma.program.findUnique({
      where: { program_code: DEMO_PROGRAM_CODE },
      include: {
        structures: true,
        programCourses: true,
        studyPlans: {
          include: {
            studyPlanCourses: {
              include: { course: true },
            },
          },
        },
        courseOfferings: true,
        rules: true,
      },
    });

    const courseIds = program?.programCourses.map((item) => item.course_id) || [];
    const prerequisites = courseIds.length > 0
      ? await prisma.prerequisite.findMany({
          where: { course_id: { in: courseIds } },
        })
      : [];
    const readiness = evaluateAdminReadiness({ program, prerequisites });

    return NextResponse.json({
      success: true,
      program: program
        ? {
            program_id: program.program_id,
            program_code: program.program_code,
            program_name_th: program.program_name_th,
            status: program.status,
          }
        : null,
      ...readiness,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'ไม่สามารถตรวจความพร้อมของหลักสูตรได้' },
      { status: 500 },
    );
  }
}

