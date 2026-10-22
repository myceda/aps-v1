import { requireCs2565StudentContext } from '../../../../lib/auth/student-context.js';
import { prisma } from '../../../../lib/prisma.js';
import {
  buildRawExtractedRowPayload,
  buildTranscriptSavePayload,
  normalizeCourseCode,
  parseTranscriptText,
  applyTranscriptExtractionQualityGate,
  validateTranscriptRows,
} from '../../../../lib/student-transcript.js';
import { extractPdfTranscriptText } from '../../../../../services/pdf-extractor/index.js';

export const runtime = 'nodejs';

function jsonResponse(payload, status = 200) {
  return Response.json(payload, { status });
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function readTranscriptFile(request) {
  const formData = await request.formData();
  const file = formData.get('file');

  if (!file || typeof file.arrayBuffer !== 'function') {
    return { error: 'กรุณาอัปโหลดไฟล์ transcript PDF' };
  }

  const fileName = String(file.name || 'transcript.pdf').slice(0, 180);
  const isPdf = file.type === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    return { error: 'รองรับเฉพาะไฟล์ PDF เท่านั้น' };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > 10 * 1024 * 1024) {
    return { error: 'ไฟล์ PDF ต้องมีขนาดไม่เกิน 10 MB' };
  }

  return { fileName, buffer };
}

function buildExistingDuplicateSet(grades) {
  return new Set(
    grades.map((grade) => `${grade.course.course_code}:${grade.academic_year}:${grade.semester}`),
  );
}

async function getCourseOptions(programId) {
  return prisma.course.findMany({
    where: {
      programCourses: {
        some: { program_id: programId },
      },
    },
    orderBy: { course_code: 'asc' },
    select: {
      course_id: true,
      course_code: true,
      course_name_th: true,
      course_name_en: true,
      credits: true,
      is_credit_counted: true,
    },
  });
}

export async function GET(request) {
  try {
    const context = await requireCs2565StudentContext(request);
    if (context.error) return context.error;

    const courses = await getCourseOptions(context.program.program_id);
    return jsonResponse({ success: true, data: { courses } });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message || 'โหลดคลังรายวิชาไม่สำเร็จ' }, 500);
  }
}

export async function DELETE(request) {
  try {
    const context = await requireCs2565StudentContext(request);
    if (context.error) return context.error;

    const studentId = context.student.student_id;
    const deleted = await prisma.$transaction(async (tx) => {
      const analysisResults = await tx.analysisResult.findMany({
        where: { student_id: studentId },
        select: { result_id: true },
      });
      const resultIds = analysisResults.map((result) => result.result_id);

      const simulationSessions = await tx.simulationSession.findMany({
        where: { student_id: studentId },
        select: { simulation_id: true },
      });
      const simulationIds = simulationSessions.map((session) => session.simulation_id);

      const deletedSimulationCourses = simulationIds.length > 0
        ? await tx.simulationCourse.deleteMany({
          where: { simulation_id: { in: simulationIds } },
        })
        : { count: 0 };

      const deletedSimulations = await tx.simulationSession.deleteMany({
        where: { student_id: studentId },
      });

      const deletedRecommendations = await tx.recommendation.deleteMany({
        where: {
          OR: [
            { student_id: studentId },
            ...(resultIds.length > 0 ? [{ result_id: { in: resultIds } }] : []),
          ],
        },
      });

      const deletedAnalysis = await tx.analysisResult.deleteMany({
        where: { student_id: studentId },
      });

      const deletedSemesterSummaries = await tx.transcriptSemesterSummary.deleteMany({
        where: { student_id: studentId },
      });

      await tx.transcriptRawRow.updateMany({
        where: { student_id: studentId },
        data: { grade_id: null },
      });

      const deletedGrades = await tx.studentGrade.deleteMany({
        where: { student_id: studentId },
      });

      const deletedRawRows = await tx.transcriptRawRow.deleteMany({
        where: { student_id: studentId },
      });

      const deletedUploads = await tx.transcriptUpload.deleteMany({
        where: { student_id: studentId },
      });

      return {
        uploads: deletedUploads.count,
        rawRows: deletedRawRows.count,
        grades: deletedGrades.count,
        semesterSummaries: deletedSemesterSummaries.count,
        analysisResults: deletedAnalysis.count,
        recommendations: deletedRecommendations.count,
        simulations: deletedSimulations.count,
        simulationCourses: deletedSimulationCourses.count,
      };
    });

    return jsonResponse({ success: true, data: deleted });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message || 'ล้างข้อมูล transcript ไม่สำเร็จ' }, 500);
  }
}

async function extractTranscriptRows(request, context) {
  const upload = await readTranscriptFile(request);
  if (upload.error) {
    return jsonResponse({ success: false, error: upload.error }, 422);
  }

  const extraction = await extractPdfTranscriptText(upload.buffer, upload.fileName);
  const parsedRows = parseTranscriptText(extraction.text);
  const gatedResult = applyTranscriptExtractionQualityGate(extraction, parsedRows);
  const courses = await getCourseOptions(context.program.program_id);
  const validation = validateTranscriptRows(gatedResult.rows, courses);
  const manualReviewRequired = gatedResult.extraction.status === 'needs_manual_entry';

  return jsonResponse({
    success: true,
    data: {
      file_name: upload.fileName,
      extraction: {
        method: gatedResult.extraction.method,
        status: gatedResult.extraction.status,
        warnings: gatedResult.extraction.warnings,
        quality: gatedResult.extraction.quality,
        textLength: gatedResult.extraction.text.length,
      },
      manual_review: {
        required: manualReviewRequired,
        reason: gatedResult.extraction.quality?.decision || gatedResult.extraction.method || 'manual_entry_required',
        parsedRows: gatedResult.extraction.quality?.parsedRows ?? parsedRows.length,
        completeRows: gatedResult.extraction.quality?.completeRows ?? 0,
        suggestedBlankRows: manualReviewRequired ? 8 : 0,
      },
      rows: validation.rows,
      raw_rows: validation.rawRows,
      confirmed_rows: validation.confirmedRows,
      validation,
    },
  });
}

export async function POST(request) {
  let context;
  try {
    context = await requireCs2565StudentContext(request);
    if (context.error) return context.error;
  } catch (error) {
    return jsonResponse({ success: false, error: error.message || 'ตรวจสอบหลักสูตรนักศึกษาไม่สำเร็จ' }, 500);
  }

  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    try {
      return await extractTranscriptRows(request, context);
    } catch (error) {
      return jsonResponse({ success: false, error: error.message || 'สกัดข้อมูลจาก PDF ไม่สำเร็จ' }, 500);
    }
  }

  const payload = await readBody(request);
  const fileName = String(payload.file_name || 'transcript.pdf').slice(0, 180);
  const rawRows = Array.isArray(payload.raw_rows)
    ? payload.raw_rows
    : Array.isArray(payload.rows)
      ? payload.rows
      : [];

  if (payload.confirm !== true) {
    return jsonResponse({ success: false, error: 'ต้องยืนยันข้อมูล transcript ก่อนบันทึก' }, 422);
  }

  if (rawRows.length === 0) {
    return jsonResponse({ success: false, error: 'ต้องมีรายการวิชาอย่างน้อย 1 แถวก่อนบันทึก' }, 422);
  }

  try {
    const student = context.student;
    const courses = await getCourseOptions(context.program.program_id);
    if (courses.length === 0) {
      return jsonResponse({
        success: false,
        error: 'ยังไม่พบหลักสูตรสำหรับจับคู่รายวิชา กรุณาตรวจรหัสวิชาหรือให้ผู้ดูแลระบบกำหนดหลักสูตรให้นักศึกษา',
      }, 422);
    }

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
    const saveRows = buildTranscriptSavePayload(validation.rows);
    const existingDuplicateSet = buildExistingDuplicateSet(existingGrades);
    const duplicateRows = saveRows.filter((row) => (
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

    const courseMap = new Map(courses.map((course) => [normalizeCourseCode(course.course_code), course]));
    const rawSaveRows = buildRawExtractedRowPayload(validation.rows);
    const transcript = await prisma.$transaction(async (tx) => {
      const createdTranscript = await tx.transcriptUpload.create({
        data: {
          student_id: student.student_id,
          file_name: fileName,
          extracted_status: 'success',
        },
      });

      await tx.transcriptRawRow.createMany({
        data: rawSaveRows.map((row) => ({
          transcript_id: createdTranscript.transcript_id,
          student_id: student.student_id,
          course_id: courseMap.get(row.course_code)?.course_id,
          row_index: row.row_index,
          raw_course_code: row.raw_course_code,
          raw_course_name: row.raw_course_name,
          raw_academic_year: row.raw_academic_year,
          raw_semester: row.raw_semester,
          raw_credits: row.raw_credits,
          raw_grade: row.raw_grade,
          normalized_code: row.course_code,
          normalized_year: row.academic_year ? Number(row.academic_year) : null,
          normalized_semester: row.semester,
          normalized_credits: row.credits ? Number(row.credits) : null,
          normalized_grade: row.grade,
          confidence: row.confidence,
          extraction_status: row.status,
          validation_status: row.validation_status,
          issues: row.issues,
          source_text: row.source_text,
        })),
      });

      for (const row of saveRows) {
        const grade = await tx.studentGrade.create({
          data: {
            transcript_id: createdTranscript.transcript_id,
            student_id: student.student_id,
            course_id: courseMap.get(row.course_code).course_id,
            academic_year: row.academic_year,
            semester: row.semester,
            grade: row.grade,
            credits_attempted: row.credits_attempted,
            credits_earned: row.credits_earned,
            is_confirmed: true,
          },
        });

        await tx.transcriptRawRow.update({
          where: {
            transcript_id_row_index: {
              transcript_id: createdTranscript.transcript_id,
              row_index: row.raw_row_index,
            },
          },
          data: { grade_id: grade.grade_id },
        });
      }

      return createdTranscript;
    });

    return jsonResponse({
      success: true,
      data: {
        transcript_id: transcript.transcript_id,
        rawRows: rawSaveRows.length,
        confirmedRows: saveRows.length,
        savedRows: saveRows.length,
        totalCredits: validation.confirmedSummary.totalCredits,
        earnedCredits: validation.confirmedSummary.earnedCredits,
        rawTotalCredits: validation.summary.totalCredits,
        rawEarnedCredits: validation.summary.earnedCredits,
      },
    }, 201);
  } catch (error) {
    return jsonResponse({ success: false, error: error.message || 'บันทึก transcript ไม่สำเร็จ' }, 500);
  }
}
