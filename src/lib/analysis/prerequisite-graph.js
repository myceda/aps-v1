import { isPassedGrade } from './gpax-calculator.js';

function getCourseId(row, relationName = 'course') {
  return row[`${relationName}_id`] || row[relationName]?.course_id;
}

function getFirstPassedTerm(grades = []) {
  const passedTerms = new Map();

  for (const grade of grades) {
    if (!isPassedGrade(grade.grade)) continue;
    const courseId = getCourseId(grade);
    if (!courseId) continue;

    const termOrder = Number(grade.academic_year || 0) * 10 + (
      grade.semester === 'summer' ? 3 : Number(grade.semester || 0)
    );
    const current = passedTerms.get(courseId);
    if (!current || termOrder < current.termOrder) {
      passedTerms.set(courseId, { termOrder, grade });
    }
  }

  return passedTerms;
}

export function buildPrerequisiteGraph(prerequisites = [], grades = []) {
  const passedTerms = getFirstPassedTerm(grades);
  const takenCourseIds = new Set(grades.map((grade) => getCourseId(grade)).filter(Boolean));

  const nodes = new Map();
  const edges = prerequisites.map((prerequisite) => {
    const courseId = getCourseId(prerequisite);
    const requiredCourseId = getCourseId(prerequisite, 'requiredCourse');
    const targetCourse = prerequisite.course || {};
    const requiredCourse = prerequisite.requiredCourse || {};

    nodes.set(courseId, {
      course_id: courseId,
      course_code: targetCourse.course_code,
      course_name_th: targetCourse.course_name_th,
      passed: passedTerms.has(courseId),
      taken: takenCourseIds.has(courseId),
    });
    nodes.set(requiredCourseId, {
      course_id: requiredCourseId,
      course_code: requiredCourse.course_code,
      course_name_th: requiredCourse.course_name_th,
      passed: passedTerms.has(requiredCourseId),
      taken: takenCourseIds.has(requiredCourseId),
    });

    const targetTerm = passedTerms.get(courseId)?.termOrder;
    const requiredTerm = passedTerms.get(requiredCourseId)?.termOrder;
    const isSatisfied = Boolean(requiredTerm && (!targetTerm || requiredTerm <= targetTerm));

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

  const violations = edges.filter((edge) => takenCourseIds.has(edge.course_id) && !edge.isSatisfied);

  return {
    nodes: Array.from(nodes.values()).filter((node) => node.course_id),
    edges,
    violations,
    isValid: violations.length === 0,
  };
}
