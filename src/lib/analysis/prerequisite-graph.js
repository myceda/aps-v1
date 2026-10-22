import { isPassedGrade } from './gpax-calculator.js';

function getCourseId(row, relationName = 'course') {
  const idField = relationName === 'requiredCourse' ? 'required_course_id' : `${relationName}_id`;
  return row?.[idField] || row?.[relationName]?.course_id;
}

function getTermOrder(row) {
  const semesterOrder = row?.semester === 'summer' ? 3 : Number(row?.semester || 0);
  return Number(row?.academic_year || 0) * 10 + semesterOrder;
}

function buildPassedCourseAttempts(grades = []) {
  const attempts = new Map();

  for (const grade of grades) {
    const courseId = getCourseId(grade);
    if (!courseId || !isPassedGrade(grade.grade)) continue;
    const courseAttempts = attempts.get(courseId) || [];
    courseAttempts.push(grade);
    attempts.set(courseId, courseAttempts);
  }

  return attempts;
}

function isRequirementSatisfied(edge, passedAttempts, projectedPassedCourseIds, targetTermOrder) {
  const requiredCourseId = getCourseId(edge, 'requiredCourse');
  if (projectedPassedCourseIds.has(requiredCourseId)) return true;

  const attempts = passedAttempts.get(requiredCourseId) || [];
  return attempts.some((attempt) => (
    isPassedGrade(attempt.grade, edge.minimum_grade || 'D')
    && (targetTermOrder == null || getTermOrder(attempt) < targetTermOrder)
  ));
}

export function evaluateCoursePrerequisites({
  courseId,
  prerequisites = [],
  grades = [],
  projectedPassedCourseIds = new Set(),
  targetTermOrder,
}) {
  const coursePrerequisites = prerequisites.filter((row) => getCourseId(row) === courseId);
  const passedAttempts = buildPassedCourseAttempts(grades);
  const required = coursePrerequisites.filter((row) => row.condition_type !== 'alternative');
  const alternatives = coursePrerequisites.filter((row) => row.condition_type === 'alternative');

  const unsatisfiedRequired = required.filter((edge) => (
    !isRequirementSatisfied(edge, passedAttempts, projectedPassedCourseIds, targetTermOrder)
  ));
  const alternativeSatisfied = alternatives.length === 0 || alternatives.some((edge) => (
    isRequirementSatisfied(edge, passedAttempts, projectedPassedCourseIds, targetTermOrder)
  ));

  return {
    isSatisfied: unsatisfiedRequired.length === 0 && alternativeSatisfied,
    unsatisfiedRequired,
    unsatisfiedAlternatives: alternativeSatisfied ? [] : alternatives,
  };
}

export function buildPrerequisiteGraph(prerequisites = [], grades = []) {
  const passedAttempts = buildPassedCourseAttempts(grades);
  const takenCourseIds = new Set(grades.map((grade) => getCourseId(grade)).filter(Boolean));
  const nodes = new Map();

  const edges = prerequisites.map((prerequisite) => {
    const courseId = getCourseId(prerequisite);
    const requiredCourseId = getCourseId(prerequisite, 'requiredCourse');
    const targetCourse = prerequisite.course || {};
    const requiredCourse = prerequisite.requiredCourse || {};
    const targetGrades = grades.filter((grade) => getCourseId(grade) === courseId);
    const firstTargetTermOrder = targetGrades.length > 0
      ? Math.min(...targetGrades.map(getTermOrder))
      : undefined;
    const isSatisfied = isRequirementSatisfied(
      prerequisite,
      passedAttempts,
      new Set(),
      firstTargetTermOrder,
    );

    if (courseId) {
      nodes.set(courseId, {
        course_id: courseId,
        course_code: targetCourse.course_code,
        course_name_th: targetCourse.course_name_th,
        passed: passedAttempts.has(courseId),
        taken: takenCourseIds.has(courseId),
      });
    }
    if (requiredCourseId) {
      nodes.set(requiredCourseId, {
        course_id: requiredCourseId,
        course_code: requiredCourse.course_code,
        course_name_th: requiredCourse.course_name_th,
        passed: passedAttempts.has(requiredCourseId),
        taken: takenCourseIds.has(requiredCourseId),
      });
    }

    return {
      prerequisite_id: prerequisite.prerequisite_id,
      course_id: courseId,
      course_code: targetCourse.course_code,
      required_course_id: requiredCourseId,
      required_course_code: requiredCourse.course_code,
      condition_type: prerequisite.condition_type,
      minimum_grade: prerequisite.minimum_grade,
      isSatisfied,
    };
  });

  const violations = [];
  const takenTargets = new Set(edges.filter((edge) => takenCourseIds.has(edge.course_id)).map((edge) => edge.course_id));
  for (const courseId of takenTargets) {
    const evaluation = evaluateCoursePrerequisites({ courseId, prerequisites, grades });
    violations.push(...evaluation.unsatisfiedRequired.map((row) => (
      edges.find((edge) => edge.prerequisite_id === row.prerequisite_id)
    )).filter(Boolean));

    if (evaluation.unsatisfiedAlternatives.length > 0) {
      const firstAlternative = evaluation.unsatisfiedAlternatives[0];
      const edge = edges.find((item) => item.prerequisite_id === firstAlternative.prerequisite_id);
      if (edge) violations.push({ ...edge, alternativeOptions: evaluation.unsatisfiedAlternatives.length });
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
    violations,
    isValid: violations.length === 0,
  };
}
