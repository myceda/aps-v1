import { calculateGpax } from './gpax-calculator.js';

const REGULAR_SEMESTERS = new Set(['1', '2']);
const SEMESTER_ORDER = { 1: 1, 2: 2, summer: 3 };

function getTermOrder(grade) {
  return Number(grade.academic_year || 0) * 10 + (SEMESTER_ORDER[String(grade.semester)] || 0);
}

function buildRegularTermHistory(grades = []) {
  const confirmedGrades = grades
    .filter((grade) => grade?.is_confirmed !== false)
    .sort((a, b) => getTermOrder(a) - getTermOrder(b));
  const regularTerms = new Map();

  for (const grade of confirmedGrades) {
    const semester = String(grade.semester || '');
    if (!REGULAR_SEMESTERS.has(semester)) continue;
    const key = `${grade.academic_year}/${semester}`;
    regularTerms.set(key, {
      key,
      academicYear: Number(grade.academic_year),
      semester,
      order: getTermOrder(grade),
    });
  }

  return Array.from(regularTerms.values())
    .sort((a, b) => a.order - b.order)
    .map((term) => {
      const cumulativeGrades = confirmedGrades.filter((grade) => getTermOrder(grade) <= term.order);
      return {
        ...term,
        ...calculateGpax(cumulativeGrades),
      };
    });
}

function classifyAcademicStatus(regularTermHistory) {
  const latestTerm = regularTermHistory.at(-1);

  if (!latestTerm || latestTerm.countedGrades === 0 || latestTerm.attemptedCredits === 0) {
    return {
      academicStatus: 'unclassified',
      academicStatusGpax: null,
      academicStatusReason: 'ยังจำแนกสถานภาพไม่ได้ เพราะไม่มีผลการเรียนที่นำมาคำนวณ GPAX',
    };
  }

  if (regularTermHistory.length < 2) {
    return {
      academicStatus: 'unclassified',
      academicStatusGpax: latestTerm.gpax,
      academicStatusReason: `GPAX ${latestTerm.gpax.toFixed(2)} — ยังไม่จำแนกสถานภาพจนกว่าจะสิ้นภาคการศึกษาปกติที่ 2`,
    };
  }

  if (latestTerm.gpax >= 2) {
    return {
      academicStatus: 'normal',
      academicStatusGpax: latestTerm.gpax,
      academicStatusReason: `GPAX ${latestTerm.gpax.toFixed(2)} อยู่ในเกณฑ์สถานภาพปกติ`,
    };
  }
  if (latestTerm.gpax >= 1.8) {
    return {
      academicStatus: 'probation_high',
      academicStatusGpax: latestTerm.gpax,
      academicStatusReason: `GPAX ${latestTerm.gpax.toFixed(2)} อยู่ในช่วงโปรสูง ควรปรึกษาอาจารย์ที่ปรึกษา`,
    };
  }
  if (latestTerm.gpax >= 1.5) {
    return {
      academicStatus: 'probation_low',
      academicStatusGpax: latestTerm.gpax,
      academicStatusReason: `GPAX ${latestTerm.gpax.toFixed(2)} อยู่ในช่วงโปรต่ำและมีความเสี่ยงระดับวิกฤต`,
    };
  }

  return {
    academicStatus: 'dismissal_risk',
    academicStatusGpax: latestTerm.gpax,
    academicStatusReason: `GPAX ${latestTerm.gpax.toFixed(2)} เข้าข่ายพ้นสภาพ โปรดตรวจสอบกับงานทะเบียน`,
  };
}

function hasTrailingTermsBelow(regularTermHistory, threshold, count) {
  if (regularTermHistory.length < count) return false;
  return regularTermHistory.slice(-count).every((term) => (
    term.attemptedCredits > 0 && term.gpax < threshold
  ));
}

function buildConsecutiveWarnings(regularTermHistory) {
  const warnings = [];

  if (hasTrailingTermsBelow(regularTermHistory, 1.8, 2)) {
    warnings.push({
      code: 'gpax_below_1_80_two_regular_terms',
      message: 'GPAX ต่ำกว่า 1.80 ต่อเนื่อง 2 ภาคการศึกษาปกติ มีความเสี่ยงพ้นสภาพ',
    });
  }
  if (hasTrailingTermsBelow(regularTermHistory, 2, 4)) {
    warnings.push({
      code: 'gpax_below_2_00_four_regular_terms',
      message: 'GPAX ต่ำกว่า 2.00 ต่อเนื่อง 4 ภาคการศึกษาปกติ มีความเสี่ยงพ้นสภาพ',
    });
  }

  return warnings;
}

export function analyzeAcademicRisk({
  gpax,
  grades = [],
  credits,
  degreeAudit,
  prerequisiteGraph,
  roadmap,
}) {
  const regularTermHistory = buildRegularTermHistory(grades);
  const status = classifyAcademicStatus(regularTermHistory);
  const consecutiveWarnings = buildConsecutiveWarnings(regularTermHistory);
  const hasLowCreditProgress = credits.requiredCredits > 0 && credits.completionPercent < 50;
  const hasMissingRequiredCourses = degreeAudit.missingRequiredCourses.length > 0;
  const hasPrerequisiteIssues = prerequisiteGraph.violations.length > 0;
  const hasUnplacedCourses = (roadmap?.unplacedCourses || []).length > 0;

  const riskFactors = [];
  if (status.academicStatus !== 'normal') riskFactors.push(status.academicStatusReason);
  riskFactors.push(...consecutiveWarnings.map((warning) => warning.message));
  if (hasLowCreditProgress) riskFactors.push('หน่วยกิตสะสมยังต่ำกว่า 50% ของหลักสูตร');
  if (hasMissingRequiredCourses) riskFactors.push('ยังมีรายวิชาบังคับที่ไม่ผ่าน');
  if (hasPrerequisiteIssues) riskFactors.push('มีรายวิชาที่เรียนโดยเงื่อนไขวิชาบังคับก่อนยังไม่ครบ');
  if (hasUnplacedCourses) {
    riskFactors.push(`มี ${roadmap.unplacedCourses.length} รายวิชาที่ยังวางแผนไม่ได้จาก prerequisite, offering หรือเพดานหน่วยกิต`);
  }

  let graduationRisk = 'normal';
  if (hasUnplacedCourses) {
    graduationRisk = 'unavailable';
  } else if (status.academicStatus === 'dismissal_risk') {
    graduationRisk = 'dismissal_risk';
  } else if (status.academicStatus === 'probation_low') {
    graduationRisk = 'probation_low';
  } else if (status.academicStatus === 'probation_high') {
    graduationRisk = 'probation_high';
  } else if (status.academicStatus === 'unclassified') {
    graduationRisk = 'unclassified';
  } else if (hasLowCreditProgress || hasMissingRequiredCourses || hasPrerequisiteIssues) {
    graduationRisk = 'low_graduation_risk';
  }

  return {
    academicStatus: status.academicStatus,
    academicStatusGpax: status.academicStatusGpax,
    academicStatusReason: status.academicStatusReason,
    graduationRisk,
    consecutiveWarnings,
    regularTermHistory,
    riskFactors,
    summary: riskFactors.length > 0
      ? riskFactors.join(', ')
      : `${status.academicStatusReason} และไม่พบความเสี่ยงสำคัญอื่นจากข้อมูลที่มี`,
    latestCalculatedGpax: gpax?.attemptedCredits > 0 ? gpax.gpax : null,
    advisory: 'APS เป็นระบบช่วยวางแผน สถานภาพจริงต้องยืนยันกับมหาวิทยาลัย',
  };
}
