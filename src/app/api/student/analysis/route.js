import { analyzeStudentProgress } from '../../../../lib/analysis/index.js';
import { requireCs2565StudentContext } from '../../../../lib/auth/student-context.js';
import { prisma } from '../../../../lib/prisma.js';

const DEMO_CURRENT_TERM = { academicYear: 2569, semester: '1' };
const DEMO_CREDIT_LIMITS = { 1: 22, 2: 22, summer: 9 };
const PROGRAM_INCLUDE = {
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
  courseOfferings: {
    where: { status: { in: ['confirmed', 'planned'] } },
    include: { course: true },
    orderBy: [{ academic_year: 'asc' }, { semester: 'asc' }],
  },
  rules: {
    where: { is_active: true },
    orderBy: [{ rule_type: 'asc' }, { rule_name: 'asc' }],
  },
};

function jsonResponse(payload, status = 200) {
  return Response.json(payload, { status });
}

export async function GET(request) {
  try {
    const context = await requireCs2565StudentContext(request, { programInclude: PROGRAM_INCLUDE });
    if (context.error) return context.error;

    const { student, studentProgram, program } = context;

    const [grades, prerequisites, latestTranscript] = await Promise.all([
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
      prisma.transcriptUpload.findFirst({
        where: { student_id: student.student_id },
        orderBy: { uploaded_at: 'desc' },
        include: {
          rawRows: {
            orderBy: { row_index: 'asc' },
          },
        },
      }),
    ]);

    const analysis = analyzeStudentProgress({
      student,
      program,
      grades,
      prerequisites,
      offerings: program.courseOfferings,
      rules: program.rules,
      currentTerm: DEMO_CURRENT_TERM,
      creditLimits: DEMO_CREDIT_LIMITS,
      studyTrack: studentProgram.study_track,
      latestTranscript,
    });

    return jsonResponse({ success: true, data: analysis });
  } catch (error) {
    return jsonResponse({
      success: false,
      error: error.message || 'วิเคราะห์สถานะการเรียนไม่สำเร็จ',
    }, 500);
  }
}
