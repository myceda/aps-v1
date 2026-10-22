import { simulateWhatIf } from '../../../../lib/analysis/what-if-simulator.js';
import { requireCs2565StudentContext } from '../../../../lib/auth/student-context.js';
import { prisma } from '../../../../lib/prisma.js';
import { persistSimulation } from '../../../../lib/simulation/persistence.js';
import { allowedGrades } from '../../../../lib/student-transcript.js';

const DEMO_CURRENT_TERM = { academicYear: 2569, semester: '1' };
const DEMO_CREDIT_LIMITS = { 1: 22, 2: 22, summer: 9 };
const MAX_ACTIONS = 20;
const VALID_ACTIONS = new Set(['add', 'drop', 'fail']);
const VALID_GRADES = new Set(allowedGrades);
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

class RequestValidationError extends Error {}

function jsonResponse(payload, status = 200) {
  return Response.json(payload, { status });
}

function normalizeActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    throw new RequestValidationError('กรุณาเลือก action และรายวิชาสำหรับจำลองก่อน');
  }
  if (actions.length > MAX_ACTIONS) {
    throw new RequestValidationError(`จำลองได้ไม่เกิน ${MAX_ACTIONS} รายการต่อครั้ง`);
  }

  const normalized = actions.map((action, index) => {
    const actionType = String(action?.action_type || '').trim().toLowerCase();
    const courseId = String(action?.course_id || '').trim();
    const simulatedGrade = String(action?.simulated_grade || '').trim().toUpperCase();

    if (!VALID_ACTIONS.has(actionType)) {
      throw new RequestValidationError(`action ลำดับที่ ${index + 1} ไม่ถูกต้อง`);
    }
    if (!courseId) {
      throw new RequestValidationError(`กรุณาเลือกรายวิชาสำหรับ action ลำดับที่ ${index + 1}`);
    }
    if (actionType === 'add' && !VALID_GRADES.has(simulatedGrade || 'A')) {
      throw new RequestValidationError(`เกรดจำลองลำดับที่ ${index + 1} ไม่ถูกต้อง`);
    }

    return {
      action_type: actionType,
      course_id: courseId,
      simulated_grade: actionType === 'add' ? simulatedGrade || 'A' : actionType === 'fail' ? 'F' : 'W',
    };
  });
  const uniqueActions = new Set(normalized.map((action) => `${action.action_type}:${action.course_id}`));
  if (uniqueActions.size !== normalized.length) {
    throw new RequestValidationError('พบ action และรายวิชาซ้ำกันใน scenario เดียวกัน');
  }

  return normalized;
}

function normalizeScenarioName(value, actions) {
  const actionTypes = Array.from(new Set(actions.map((action) => action.action_type.toUpperCase())));
  const scenarioName = String(value || '').trim()
    || `What-if ${actionTypes.join('/')} ${actions.length} รายการ`;
  if (scenarioName.length > 120) {
    throw new RequestValidationError('ชื่อ scenario ต้องไม่เกิน 120 ตัวอักษร');
  }
  return scenarioName;
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function GET(request) {
  try {
    const context = await requireCs2565StudentContext(request);
    if (context.error) return context.error;

    const sessions = await prisma.simulationSession.findMany({
      where: { student_id: context.student.student_id },
      include: {
        simulationCourses: {
          include: { course: true },
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });

    return jsonResponse({ success: true, data: sessions });
  } catch (error) {
    console.error('อ่านประวัติ What-if ไม่สำเร็จ', error);
    return jsonResponse({
      success: false,
      error: 'อ่านประวัติ What-if ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    }, 500);
  }
}

export async function POST(request) {
  try {
    const context = await requireCs2565StudentContext(request, { programInclude: PROGRAM_INCLUDE });
    if (context.error) return context.error;

    const body = await readBody(request);
    const actions = normalizeActions(body?.actions);
    const scenarioName = normalizeScenarioName(body?.scenario_name, actions);

    const { student, studentProgram, program } = context;

    const programCourseIds = new Set(program.programCourses.map((row) => row.course_id));
    if (actions.some((action) => !programCourseIds.has(action.course_id))) {
      return jsonResponse({
        success: false,
        error: 'พบรายวิชาที่ไม่อยู่ในหลักสูตรของนักศึกษา',
      }, 400);
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

    const simulation = simulateWhatIf({
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
      actions,
    });
    if (simulation.appliedActions.length !== actions.length) {
      throw new RequestValidationError('ไม่สามารถนำ action บางรายการไปจำลองได้');
    }

    const savedSession = await persistSimulation({
      db: prisma,
      student,
      program,
      scenarioName,
      actions,
      simulation,
    });

    return jsonResponse({
      success: true,
      data: {
        ...simulation,
        persistence: {
          simulation_id: savedSession.simulation_id,
          result_id: savedSession.result_id,
          scenario_name: savedSession.scenario_name,
          created_at: savedSession.created_at,
        },
      },
    }, 201);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return jsonResponse({ success: false, error: error.message }, 400);
    }
    console.error('บันทึก What-if ไม่สำเร็จ', error);
    return jsonResponse({
      success: false,
      error: 'จำลองและบันทึกแผนการเรียนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
    }, 500);
  }
}
