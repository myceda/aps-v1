import { createPassedCourseMap } from './credit-calculator.js';
import { evaluateCoursePrerequisites } from './prerequisite-graph.js';

const ROADMAP_YEARS = 8;
const SEMESTERS = ['1', '2', 'summer'];
const DEFAULT_CURRENT_TERM = { academicYear: 2569, semester: '1' };
const DEFAULT_CREDIT_LIMITS = { 1: 22, 2: 22, summer: 9 };

function normalizeCurrentTerm(currentTerm = DEFAULT_CURRENT_TERM) {
  const academicYear = Number(currentTerm.academicYear ?? currentTerm.academic_year ?? DEFAULT_CURRENT_TERM.academicYear);
  const semester = String(currentTerm.semester || DEFAULT_CURRENT_TERM.semester);
  return {
    academicYear: Number.isFinite(academicYear) ? academicYear : DEFAULT_CURRENT_TERM.academicYear,
    semester: SEMESTERS.includes(semester) ? semester : DEFAULT_CURRENT_TERM.semester,
  };
}

function normalizeRuleValue(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return {};
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function resolveCreditLimits(creditLimits = {}, rules = []) {
  const limits = { ...DEFAULT_CREDIT_LIMITS, ...creditLimits };

  for (const rule of rules) {
    if (rule?.is_active === false || !String(rule?.rule_type || '').toLowerCase().includes('credit')) continue;
    const value = normalizeRuleValue(rule.rule_value);
    if (Number.isFinite(Number(value.regular ?? value.normal))) {
      limits[1] = Number(value.regular ?? value.normal);
      limits[2] = Number(value.regular ?? value.normal);
    }
    for (const semester of SEMESTERS) {
      if (Number.isFinite(Number(value[semester]))) limits[semester] = Number(value[semester]);
    }
  }

  return limits;
}

function getTermOrder(academicYear, semester) {
  return Number(academicYear) * 10 + SEMESTERS.indexOf(String(semester)) + 1;
}

function formatTerm(academicYear, semester) {
  return `${academicYear}/${semester}`;
}

function createTerms({ currentTerm, admissionYear, creditLimits }) {
  const start = normalizeCurrentTerm(currentTerm);
  const finalAcademicYear = Number.isFinite(Number(admissionYear))
    ? Number(admissionYear) + ROADMAP_YEARS - 1
    : start.academicYear + ROADMAP_YEARS - 1;
  const terms = [];

  for (let academicYear = start.academicYear; academicYear <= finalAcademicYear; academicYear += 1) {
    for (const semester of SEMESTERS) {
      if (getTermOrder(academicYear, semester) < getTermOrder(start.academicYear, start.semester)) continue;
      terms.push({
        key: formatTerm(academicYear, semester),
        academicYear,
        academic_year: academicYear,
        semester,
        label: `ปีการศึกษา ${academicYear} ภาค ${semester === 'summer' ? 'ฤดูร้อน' : semester}`,
        creditLimit: Number(creditLimits[semester] ?? 0),
        courses: [],
        totalCredits: 0,
        confidence: 'confirmed',
        status: 'ใช้เฉพาะข้อมูลเปิดสอนที่ยืนยันแล้ว',
      });
    }
  }

  return terms;
}

function isCourseCompleted(course, passedCourses, transcriptProgress) {
  return passedCourses.has(course.course_id)
    || transcriptProgress?.satisfiedCourses?.has(course.course_id)
    || transcriptProgress?.satisfiedCourses?.has(course.course_code);
}

function getProgramRemainingCourses({ program, passedCourses, studyTrack, transcriptProgress }) {
  return (program?.programCourses || [])
    .filter((row) => row.course_type === 'required')
    .filter((row) => row.study_track === 'both' || row.study_track === studyTrack)
    .map((row) => row.course)
    .filter(Boolean)
    .filter((course) => !isCourseCompleted(course, passedCourses, transcriptProgress));
}

function getStudyPlanPriority(program, studyTrack) {
  const priority = new Map();
  for (const plan of program?.studyPlans || []) {
    if (plan.study_track !== 'both' && plan.study_track !== studyTrack) continue;
    for (const row of plan.studyPlanCourses || []) {
      const courseId = row.course_id || row.course?.course_id;
      if (!courseId) continue;
      priority.set(courseId, Number(plan.year_level || 0) * 100
        + SEMESTERS.indexOf(plan.semester) * 10
        + Number(row.recommended_order || 0));
    }
  }
  return priority;
}

function normalizeRemainingCourses(courses = []) {
  const unique = new Map();
  for (const row of courses) {
    const course = row?.course || row;
    if (!course?.course_id) continue;
    unique.set(course.course_id, {
      course_id: course.course_id,
      course_code: course.course_code,
      course_name_th: course.course_name_th,
      credits: Number(course.credits || 0),
    });
  }
  return Array.from(unique.values());
}

function findOffering(offerings, courseId, term, currentTerm) {
  const matches = offerings.filter((offering) => (
    offering.course_id === courseId
    && Number(offering.academic_year) === term.academicYear
    && String(offering.semester) === term.semester
  ));
  const confirmed = matches.find((offering) => offering.status === 'confirmed');
  if (confirmed) return { offering: confirmed, confidence: 'confirmed' };

  const planned = matches.find((offering) => offering.status === 'planned');
  const isCurrentTerm = term.key === formatTerm(currentTerm.academicYear, currentTerm.semester);
  if (planned && !isCurrentTerm) return { offering: planned, confidence: 'tentative' };
  return null;
}

function describeBlockedCourse(course, context) {
  const hasAnyOffering = context.offerings.some((offering) => offering.course_id === course.course_id);
  const prerequisite = evaluateCoursePrerequisites({
    courseId: course.course_id,
    prerequisites: context.prerequisites,
    grades: context.grades,
    projectedPassedCourseIds: context.projectedPassedCourseIds,
  });
  const maxCreditLimit = Math.max(0, ...Object.values(context.creditLimits).map(Number));

  let reason = 'ไม่พบเทอมที่ตรงทุกเงื่อนไขภายในกรอบ 8 ปี';
  let reasonCode = 'constraint_conflict';
  if (!hasAnyOffering) {
    reason = 'ไม่พบข้อมูลการเปิดสอน';
    reasonCode = 'missing_offering';
  } else if (!prerequisite.isSatisfied) {
    reason = 'วิชาบังคับก่อนยังไม่ครบ';
    reasonCode = 'prerequisite_blocked';
  } else if (course.credits > maxCreditLimit) {
    reason = 'หน่วยกิตรายวิชาเกินเพดานต่อเทอม';
    reasonCode = 'credit_limit_exceeded';
  }

  return { ...course, status: 'unavailable', reasonCode, reason };
}

export function buildRoadmapPlan({
  program,
  grades = [],
  remainingCourses,
  prerequisites = [],
  offerings = [],
  rules = [],
  currentTerm = DEFAULT_CURRENT_TERM,
  creditLimits = {},
  admissionYear,
  studyTrack = 'both',
  transcriptProgress,
}) {
  const normalizedCurrentTerm = normalizeCurrentTerm(currentTerm);
  const resolvedCreditLimits = resolveCreditLimits(creditLimits, rules);
  const passedCourses = createPassedCourseMap(grades);
  const initialRemaining = remainingCourses ?? getProgramRemainingCourses({
    program,
    passedCourses,
    studyTrack,
    transcriptProgress,
  });
  const priority = getStudyPlanPriority(program, studyTrack);
  const queue = normalizeRemainingCourses(initialRemaining)
    .filter((course) => !isCourseCompleted(course, passedCourses, transcriptProgress))
    .sort((a, b) => (priority.get(a.course_id) ?? Number.MAX_SAFE_INTEGER)
      - (priority.get(b.course_id) ?? Number.MAX_SAFE_INTEGER)
      || String(a.course_code).localeCompare(String(b.course_code)));
  const totalRemainingCourseCount = queue.length;
  const terms = createTerms({
    currentTerm: normalizedCurrentTerm,
    admissionYear,
    creditLimits: resolvedCreditLimits,
  });
  const projectedPassedCourseIds = new Set();

  for (const term of terms) {
    const completedBeforeTerm = new Set(projectedPassedCourseIds);
    const placedThisTerm = [];

    for (const course of [...queue]) {
      const offeringMatch = findOffering(offerings, course.course_id, term, normalizedCurrentTerm);
      if (!offeringMatch) continue;

      const prerequisite = evaluateCoursePrerequisites({
        courseId: course.course_id,
        prerequisites,
        grades,
        projectedPassedCourseIds: completedBeforeTerm,
        targetTermOrder: getTermOrder(term.academicYear, term.semester),
      });
      if (!prerequisite.isSatisfied) continue;
      if (term.totalCredits + course.credits > term.creditLimit) continue;

      term.courses.push({
        ...course,
        status: 'planned',
        offeringStatus: offeringMatch.offering.status,
        confidence: offeringMatch.confidence,
      });
      term.totalCredits += course.credits;
      if (offeringMatch.confidence === 'tentative') {
        term.confidence = 'tentative';
        term.status = 'มีข้อมูลเปิดสอนที่ยังไม่ยืนยัน';
      }
      placedThisTerm.push(course.course_id);
    }

    for (const courseId of placedThisTerm) {
      projectedPassedCourseIds.add(courseId);
      const queueIndex = queue.findIndex((course) => course.course_id === courseId);
      if (queueIndex >= 0) queue.splice(queueIndex, 1);
    }
  }

  const unplacedCourses = queue.map((course) => describeBlockedCourse(course, {
    offerings,
    prerequisites,
    grades,
    projectedPassedCourseIds,
    creditLimits: resolvedCreditLimits,
  }));
  const scheduledTerms = terms.filter((term) => term.courses.length > 0);
  const finalTerm = scheduledTerms.at(-1);
  const hasTentativeCourses = scheduledTerms.some((term) => term.confidence === 'tentative');
  const confidence = unplacedCourses.length > 0
    ? 'unavailable'
    : hasTentativeCourses
      ? 'tentative'
      : 'confirmed';

  return {
    years: ROADMAP_YEARS,
    currentTerm: normalizedCurrentTerm,
    creditLimits: resolvedCreditLimits,
    terms,
    hasOfficialPlan: priority.size > 0,
    remainingCourseCount: totalRemainingCourseCount,
    unplacedCourseCount: queue.length,
    scheduledCourseCount: scheduledTerms.reduce((sum, term) => sum + term.courses.length, 0),
    unplacedCourses,
    confidence,
    expectedGraduationTerm: unplacedCourses.length === 0
      ? (finalTerm ? { key: finalTerm.key, label: finalTerm.label, confidence } : {
        key: formatTerm(normalizedCurrentTerm.academicYear, normalizedCurrentTerm.semester),
        label: `ปีการศึกษา ${normalizedCurrentTerm.academicYear} ภาค ${normalizedCurrentTerm.semester}`,
        confidence,
      })
      : null,
    assumptions: [
      'สมมติว่ารายวิชาที่วางในอนาคตสอบผ่าน',
      'ใช้ข้อมูล CourseOffering และกติกาที่เปิดใช้งาน ณ เวลาวิเคราะห์',
    ],
  };
}
