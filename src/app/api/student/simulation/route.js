import { NextResponse } from 'next/server';
import { simulateWhatIf } from '../../../../lib/analysis/what-if-simulator.js';
import { requireStudent } from '../../../../lib/auth/index.js';
import { prisma } from '../../../../lib/prisma.js';

const VALID_ACTIONS = new Set(['add', 'drop', 'fail']);

function jsonResponse(payload, status = 200) {
  return NextResponse.json(payload, { status });
}

function normalizeActions(actions) {
  if (!Array.isArray(actions)) return [];

  return actions
    .map((action) => ({
      action_type: String(action.action_type || '').toLowerCase(),
      course_id: String(action.course_id || ''),
      simulated_grade: String(action.simulated_grade || '').toUpperCase(),
    }))
    .filter((action) => VALID_ACTIONS.has(action.action_type) && action.course_id);
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function getCurrentStudentProgram(student) {
  if (!student?.student_id) return null;

  return prisma.studentProgram.findFirst({
    where: { student_id: student.student_id },
    orderBy: { enrolled_at: 'desc' },
    include: {
      program: {
        include: {
          structures: { orderBy: [{ category_type: 'asc' }, { category_name: 'asc' }] },
          programCourses: {
            include: { course: true, structure: true },
            orderBy: { created_at: 'asc' },
          },
          studyPlans: {
            include: {
              studyPlanCourses: {
                include: { course: true },
                orderBy: { recommended_order: 'asc' },
              },
            },
            orderBy: [{ year_level: 'asc' }, { semester: 'asc' }],
          },
        },
      },
    },
  });
}

export async function POST(request) {
  const auth = await requireStudent(request);
  if (auth.error) return auth.error;

  try {
    const body = await readBody(request);
    const actions = normalizeActions(body.actions);

    if (actions.length === 0) {
      return jsonResponse({
        success: false,
        error: 'กรุณาเลือก action และรายวิชาสำหรับจำลองก่อน',
      }, 400);
    }

    const student = auth.student;
    const studentProgram = await getCurrentStudentProgram(student);
    const program = studentProgram?.program;
    if (!program) {
      return jsonResponse({
        success: false,
        error: 'ยังไม่พบหลักสูตรสำหรับจำลอง',
      }, 404);
    }

    const [grades, prerequisites, offerings, latestTranscript] = await Promise.all([
      prisma.studentGrade.findMany({
        where: { student_id: student.student_id },
        include: { course: true },
        orderBy: [{ academic_year: 'asc' }, { semester: 'asc' }, { created_at: 'asc' }],
      }),
      prisma.prerequisite.findMany({
        where: {
          course: {
            programCourses: {
              some: { program_id: program.program_id },
            },
          },
        },
        include: { course: true, requiredCourse: true },
        orderBy: { created_at: 'asc' },
      }),
      prisma.courseOffering.findMany({
        where: { program_id: program.program_id },
        include: { course: true },
        orderBy: [{ academic_year: 'asc' }, { semester: 'asc' }],
      }),
      prisma.transcriptUpload.findFirst({
        where: { student_id: student.student_id },
        orderBy: { uploaded_at: 'desc' },
      }),
    ]);

    const simulation = simulateWhatIf({
      student,
      program,
      grades,
      prerequisites,
      offerings,
      studyTrack: studentProgram.study_track,
      latestTranscript,
      actions,
    });

    return jsonResponse({ success: true, data: simulation });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message || 'จำลองแผนการเรียนไม่สำเร็จ',
    }, 500);
  }
}
