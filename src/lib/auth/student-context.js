import { prisma } from '../prisma.js';
import { requireStudent } from './index.js';

export const DEMO_PROGRAM_CODE = 'CS2565';
export const CS2565_CONTEXT_ERROR = 'บัญชีนักศึกษานี้ไม่ได้ผูกกับหลักสูตร CS2565 ที่รองรับใน Demo';

function jsonResponse(payload, status) {
  return Response.json(payload, { status });
}

export async function requireCs2565StudentContext(request, { programInclude } = {}) {
  const auth = await requireStudent(request);
  if (auth.error) return { error: auth.error };

  const studentProgram = await prisma.studentProgram.findFirst({
    where: { student_id: auth.student.student_id },
    orderBy: { enrolled_at: 'desc' },
    include: {
      program: programInclude ? { include: programInclude } : true,
    },
  });

  if (studentProgram?.program?.program_code !== DEMO_PROGRAM_CODE) {
    return {
      error: jsonResponse({
        success: false,
        error: CS2565_CONTEXT_ERROR,
      }, 403),
    };
  }

  return {
    user: auth.user,
    student: auth.student,
    studentProgram,
    program: studentProgram.program,
  };
}
