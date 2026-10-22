const REQUIRED_SEMESTERS = ['1', '2', 'summer'];
const USABLE_OFFERING_STATUSES = new Set(['planned', 'confirmed']);

function unique(values) {
  return [...new Set(values)];
}

function getCourseLabel(course) {
  if (!course) return 'ไม่ทราบรหัสวิชา';
  return course.course_code || course.course_id || 'ไม่ทราบรหัสวิชา';
}

function createCheck(id, label, passed, detail) {
  return { id, label, passed, detail };
}

export function evaluateAdminReadiness({ program, prerequisites = [] }) {
  const structures = program?.structures || [];
  const programCourses = program?.programCourses || [];
  const studyPlans = program?.studyPlans || [];
  const offerings = (program?.courseOfferings || []).filter((offering) => (
    USABLE_OFFERING_STATUSES.has(offering.status)
  ));
  const activeRules = (program?.rules || []).filter((rule) => rule.is_active);
  const studyPlanCourseCount = studyPlans.reduce(
    (total, plan) => total + (plan.studyPlanCourses || []).length,
    0,
  );

  const coveredSemesters = new Set(offerings.map((offering) => offering.semester));
  const missingSemesters = REQUIRED_SEMESTERS.filter((semester) => !coveredSemesters.has(semester));
  const offeringKeys = new Set(
    offerings.map((offering) => `${offering.course_id}:${offering.semester}`),
  );
  const missingStudyPlanOfferings = unique(
    studyPlans.flatMap((plan) => (
      (plan.studyPlanCourses || [])
        .filter((item) => !offeringKeys.has(`${item.course_id}:${plan.semester}`))
        .map((item) => `${getCourseLabel(item.course)} (${plan.semester})`)
    )),
  );

  const checks = [
    createCheck(
      'program',
      'พบหลักสูตร CS2565',
      Boolean(program),
      program ? `${program.program_name_th} (${program.program_code})` : 'ไม่พบหลักสูตร CS2565',
    ),
    createCheck(
      'program-active',
      'หลักสูตรเปิดใช้งาน',
      program?.status === 'active',
      program?.status === 'active' ? 'สถานะ active' : `สถานะปัจจุบัน: ${program?.status || 'ไม่พบข้อมูล'}`,
    ),
    createCheck(
      'structures',
      'กำหนดโครงสร้างหลักสูตรแล้ว',
      structures.length > 0,
      `${structures.length} หมวด`,
    ),
    createCheck(
      'program-courses',
      'ผูกรายวิชาเข้ากับหลักสูตรแล้ว',
      programCourses.length > 0,
      `${programCourses.length} รายวิชา`,
    ),
    createCheck(
      'prerequisites',
      'มีข้อมูลวิชาบังคับก่อน',
      prerequisites.length > 0,
      `${prerequisites.length} เงื่อนไข`,
    ),
    createCheck(
      'study-plans',
      'มีแผนการเรียนและรายวิชาในแผน',
      studyPlans.length > 0 && studyPlanCourseCount > 0,
      `${studyPlans.length} แผน, ${studyPlanCourseCount} รายวิชา`,
    ),
    createCheck(
      'semester-coverage',
      'มี CourseOffering ครบเทอม 1, 2 และ summer',
      missingSemesters.length === 0,
      missingSemesters.length === 0
        ? `ครบทุกเทอม (${offerings.length} รายการ)`
        : `ขาดเทอม: ${missingSemesters.join(', ')}`,
    ),
    createCheck(
      'study-plan-offerings',
      'รายวิชาใน StudyPlan มี offering ตรงเทอมแนะนำ',
      studyPlanCourseCount > 0 && missingStudyPlanOfferings.length === 0,
      studyPlanCourseCount === 0
        ? 'ยังไม่มีรายวิชาใน StudyPlan'
        : missingStudyPlanOfferings.length === 0
          ? 'ครบทุกรายวิชาตามเทอมแนะนำ'
          : `ขาด ${missingStudyPlanOfferings.length} รายการ: ${missingStudyPlanOfferings.slice(0, 5).join(', ')}`,
    ),
    createCheck(
      'active-rules',
      'มีกติกาการวิเคราะห์ที่เปิดใช้งาน',
      activeRules.length > 0,
      `${activeRules.length} กติกา`,
    ),
  ];

  const passedCount = checks.filter((check) => check.passed).length;

  return {
    ready: checks.every((check) => check.passed),
    percentage: Math.round((passedCount / checks.length) * 100),
    checks,
    issues: checks.filter((check) => !check.passed).map((check) => check.detail),
    summary: {
      structures: structures.length,
      programCourses: programCourses.length,
      prerequisites: prerequisites.length,
      studyPlans: studyPlans.length,
      studyPlanCourses: studyPlanCourseCount,
      courseOfferings: offerings.length,
      activeRules: activeRules.length,
    },
  };
}

