import { analyzeStudentProgress } from './index.js';
import { isGpaxCountedGrade, isPassedGrade } from './gpax-calculator.js';

const VALID_ACTIONS = new Set(['add', 'drop', 'fail']);

function getCourseId(row) {
  return row.course_id || row.course?.course_id;
}

function getExpectedGraduationTerm(roadmap) {
  return roadmap?.expectedGraduationTerm || null;
}

function buildCourseLookup(program) {
  const rows = program?.programCourses || [];
  const courses = new Map();

  for (const row of rows) {
    if (!row.course_id || !row.course) continue;
    courses.set(row.course_id, row.course);
  }

  return courses;
}

function makeSimulatedGrade({ course, student, latestTranscript, action, simulatedGrade, currentTerm }) {
  const grade = action === 'fail' ? 'F' : simulatedGrade || 'A';
  const passed = isPassedGrade(grade);
  const credits = Number(course.credits || 0);
  const gpaxCounted = isGpaxCountedGrade(grade);

  return {
    grade_id: `simulation-${action}-${course.course_id}`,
    transcript_id: latestTranscript?.transcript_id || 'simulation-transcript',
    student_id: student?.student_id || 'simulation-student',
    course_id: course.course_id,
    academic_year: Number(currentTerm?.academicYear ?? currentTerm?.academic_year ?? 2569),
    semester: String(currentTerm?.semester || '1'),
    grade,
    credits_attempted: gpaxCounted ? credits : 0,
    credits_earned: passed ? credits : 0,
    is_confirmed: false,
    course,
  };
}

function applySimulationActions({ grades, actions, courses, student, latestTranscript, currentTerm }) {
  let simulatedGrades = grades.map((grade) => ({ ...grade }));
  const appliedActions = [];

  for (const action of actions) {
    const actionType = String(action.action_type || '').toLowerCase();
    const course = courses.get(action.course_id);

    if (!VALID_ACTIONS.has(actionType) || !course) continue;

    if (actionType === 'drop') {
      simulatedGrades = simulatedGrades.filter((grade) => getCourseId(grade) !== course.course_id);
    }

    if (actionType === 'fail') {
      const hasExistingGrade = simulatedGrades.some((grade) => getCourseId(grade) === course.course_id);
      simulatedGrades = simulatedGrades.map((grade) => (
        getCourseId(grade) === course.course_id
          ? { ...grade, grade: 'F', credits_earned: 0, course }
          : grade
      ));

      if (!hasExistingGrade) {
        simulatedGrades.push(makeSimulatedGrade({
          course,
          student,
          latestTranscript,
          action: actionType,
          currentTerm,
        }));
      }
    }

    if (actionType === 'add') {
      const remainingGrades = simulatedGrades.filter((grade) => getCourseId(grade) !== course.course_id);
      simulatedGrades = [
        ...remainingGrades,
        makeSimulatedGrade({
          course,
          student,
          latestTranscript,
          action: actionType,
          simulatedGrade: action.simulated_grade,
          currentTerm,
        }),
      ];
    }

    appliedActions.push({
      action_type: actionType,
      course_id: course.course_id,
      course_code: course.course_code,
      course_name_th: course.course_name_th,
      simulated_grade: actionType === 'fail'
        ? 'F'
        : actionType === 'drop'
          ? 'W'
          : action.simulated_grade || 'A',
    });
  }

  return { simulatedGrades, appliedActions };
}

function compareNumbers(beforeValue, afterValue) {
  const before = Number(beforeValue || 0);
  const after = Number(afterValue || 0);

  return {
    before,
    after,
    delta: Number((after - before).toFixed(2)),
  };
}

function buildComparison(beforeAnalysis, afterAnalysis) {
  const beforeGraduationTerm = getExpectedGraduationTerm(beforeAnalysis.roadmap);
  const afterGraduationTerm = getExpectedGraduationTerm(afterAnalysis.roadmap);

  return {
    gpax: compareNumbers(beforeAnalysis.gpax?.gpax, afterAnalysis.gpax?.gpax),
    earnedCredits: compareNumbers(beforeAnalysis.credits?.earnedCredits, afterAnalysis.credits?.earnedCredits),
    remainingCredits: compareNumbers(beforeAnalysis.credits?.remainingCredits, afterAnalysis.credits?.remainingCredits),
    missingRequiredCourses: compareNumbers(
      beforeAnalysis.degreeAudit?.missingRequiredCourses?.length,
      afterAnalysis.degreeAudit?.missingRequiredCourses?.length,
    ),
    graduationTerm: {
      before: beforeGraduationTerm,
      after: afterGraduationTerm,
      changed: beforeGraduationTerm?.key !== afterGraduationTerm?.key,
    },
    offeringConfidence: {
      before: beforeAnalysis.roadmap?.confidence || 'unavailable',
      after: afterAnalysis.roadmap?.confidence || 'unavailable',
      changed: beforeAnalysis.roadmap?.confidence !== afterAnalysis.roadmap?.confidence,
    },
  };
}

function buildPrerequisiteImpact(beforeGraph, afterGraph, appliedActions) {
  const actionCourseIds = new Set(appliedActions.map((action) => action.course_id));
  const beforeViolations = new Set((beforeGraph?.violations || []).map((edge) => edge.prerequisite_id));
  const newViolations = (afterGraph?.violations || []).filter((edge) => !beforeViolations.has(edge.prerequisite_id));
  const affectedEdges = (afterGraph?.edges || []).filter((edge) => (
    actionCourseIds.has(edge.course_id) || actionCourseIds.has(edge.required_course_id)
  ));

  return {
    newViolations,
    affectedEdges,
    hasImpact: newViolations.length > 0 || affectedEdges.length > 0,
  };
}

function buildOfferingImpact({ offerings, appliedActions }) {
  const actionCourseIds = new Set(appliedActions.map((action) => action.course_id));
  const affectedOfferings = offerings
    .filter((offering) => actionCourseIds.has(offering.course_id))
    .map((offering) => ({
      offering_id: offering.offering_id,
      course_id: offering.course_id,
      course_code: offering.course?.course_code,
      academic_year: offering.academic_year,
      semester: offering.semester,
      status: offering.status,
    }));

  return {
    affectedOfferings,
    hasImpact: affectedOfferings.length > 0,
  };
}

export function simulateWhatIf({
  student,
  program,
  grades = [],
  prerequisites = [],
  offerings = [],
  rules = [],
  currentTerm,
  creditLimits,
  studyTrack,
  latestTranscript,
  actions = [],
}) {
  const courses = buildCourseLookup(program);
  const before = analyzeStudentProgress({
    student,
    program,
    grades,
    prerequisites,
    offerings,
    rules,
    currentTerm,
    creditLimits,
    studyTrack,
    latestTranscript,
  });
  const { simulatedGrades, appliedActions } = applySimulationActions({
    grades,
    actions,
    courses,
    student,
    latestTranscript,
    currentTerm,
  });
  const after = analyzeStudentProgress({
    student,
    program,
    grades: simulatedGrades,
    prerequisites,
    offerings,
    rules,
    currentTerm,
    creditLimits,
    studyTrack,
    latestTranscript,
  });

  return {
    appliedActions,
    before,
    after,
    comparison: buildComparison(before, after),
    prerequisiteImpact: buildPrerequisiteImpact(before.prerequisiteGraph, after.prerequisiteGraph, appliedActions),
    offeringImpact: buildOfferingImpact({ offerings, appliedActions }),
  };
}
