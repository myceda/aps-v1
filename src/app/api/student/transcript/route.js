import { NextResponse } from 'next/server';
import { requireStudent } from '../../../../lib/auth/index.js';
import { prisma } from '../../../../lib/prisma.js';
import {
  buildTranscriptSavePayload,
  getCreditsEarned,
  validateTranscriptRows,
} from '../../../../lib/student-transcript.js';

function jsonResponse(payload, status = 200) {
  return NextResponse.json(payload, { status });
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function buildExistingDuplicateSet(grades) {
  return new Set(
    grades.map((grade) => `${grade.course.course_code}:${grade.academic_year}:${grade.semester}`),
  );
}

async function getCourseOptions(student) {
  return prisma.course.findMany({
    where: {
      programCourses: {
        some: {
          program: {
            studentPrograms: {
              some: { student_id: student.student_id },
            },
          },
        },
      },
    },
    orderBy: { course_code: 'asc' },
    select: {
      course_id: true,
      course_code: true,
      course_name_th: true,
      course_name_en: true,
      credits: true,
    },
  });
}

export async function GET(request) {
  const auth = await requireStudent(request);
  if (auth.error) return auth.error;

  try {
    const courses = await getCourseOptions(auth.student);
    return jsonResponse({ success: true, data: { courses } });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message || 'โหลดคลังรายวิชาไม่สำเร็จ' }, 500);
  }
}

export async function POST(request) {
  const auth = await requireStudent(request);
  if (auth.error) return auth.error;

  const payload = await readBody(request);
  const fileName = String(payload.file_name || 'transcript.pdf').slice(0, 180);
  const rawRows = Array.isArray(payload.rows) ? payload.rows : [];

  if (rawRows.length === 0) {
    return jsonResponse({ success: false, error: 'ต้องมีรายการวิชาอย่างน้อย 1 แถวก่อนบันทึก' }, 422);
  }

  try {
    const student = auth.student;
    const courses = await getCourseOptions(student);
    const validation = validateTranscriptRows(rawRows, courses);

    if (validation.summary.issueRows > 0) {
      return jsonResponse({
        success: false,
        error: 'ยังมีข้อมูลที่ต้องแก้ก่อนบันทึก',
        validation,
      }, 422);
    }

    const existingGrades = await prisma.studentGrade.findMany({
      where: { student_id: student.student_id },
      include: { course: true },
    });
    const existingDuplicateSet = buildExistingDuplicateSet(existingGrades);
    const duplicateRows = validation.rows.filter((row) => (
      existingDuplicateSet.has(`${row.course_code}:${Number(row.academic_year)}:${row.semester}`)
    ));

    if (duplicateRows.length > 0) {
      return jsonResponse({
        success: false,
        error: 'พบเกรดซ้ำกับข้อมูลที่เคยบันทึกแล้ว',
        duplicateRows: duplicateRows.map((row) => ({
          course_code: row.course_code,
          academic_year: row.academic_year,
          semester: row.semester,
        })),
      }, 409);
    }

    const saveRows = buildTranscriptSavePayload(validation.rows);
    const transcript = await prisma.transcriptUpload.create({
      data: {
        student_id: student.student_id,
        file_name: fileName,
        extracted_status: 'needs_review',
      },
    });

    const courseMap = new Map(courses.map((course) => [course.course_code, course]));
    await prisma.studentGrade.createMany({
      data: saveRows.map((row) => ({
        transcript_id: transcript.transcript_id,
        student_id: student.student_id,
        course_id: courseMap.get(row.course_code).course_id,
        academic_year: row.academic_year,
        semester: row.semester,
        grade: row.grade,
        credits_attempted: row.credits,
        credits_earned: getCreditsEarned(row.grade, row.credits),
        is_confirmed: true,
      })),
    });

    return jsonResponse({
      success: true,
      data: {
        transcript_id: transcript.transcript_id,
        savedRows: saveRows.length,
        totalCredits: validation.summary.totalCredits,
        earnedCredits: validation.summary.earnedCredits,
      },
    }, 201);
  } catch (error) {
    return jsonResponse({ success: false, error: error.message || 'บันทึก transcript ไม่สำเร็จ' }, 500);
  }
}
