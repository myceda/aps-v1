import { NextResponse } from 'next/server';
import { analyzeStudentProgress } from '../../../../lib/analysis/index.js';
import { requireStudent } from '../../../../lib/auth/index.js';
import { prisma } from '../../../../lib/prisma.js';

function jsonResponse(payload, status = 200) {
  return NextResponse.json(payload, { status });
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

export async function GET(request) {
  const auth = await requireStudent(request);
  if (auth.error) return auth.error;

  try {
    const student = auth.student;
    const studentProgram = await getCurrentStudentProgram(student);
    const program = studentProgram?.program;
    if (!program) {
      return jsonResponse({
        success: false,
        error: 'ยังไม่พบหลักสูตรสำหรับวิเคราะห์',
      }, 404);
    }

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
