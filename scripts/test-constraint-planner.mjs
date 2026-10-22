import assert from 'node:assert/strict';
import { buildRoadmapPlan } from '../src/lib/analysis/roadmap-planner.js';
import { evaluateCoursePrerequisites } from '../src/lib/analysis/prerequisite-graph.js';

const course = (id, credits = 3) => ({
  course_id: id,
  course_code: id,
  course_name_th: `วิชา ${id}`,
  credits,
});
const offering = (courseId, academicYear, semester, status = 'confirmed') => ({
  offering_id: `${courseId}-${academicYear}-${semester}`,
  course_id: courseId,
  academic_year: academicYear,
  semester,
  status,
});
const prerequisite = (target, required, minimumGrade = 'D', conditionType = 'required') => ({
  prerequisite_id: `${target}-needs-${required}`,
  course_id: target,
  required_course_id: required,
  minimum_grade: minimumGrade,
  condition_type: conditionType,
});

function plan(overrides = {}) {
  return buildRoadmapPlan({
    grades: [],
    remainingCourses: [],
    prerequisites: [],
    offerings: [],
    rules: [],
    currentTerm: { academicYear: 2569, semester: '1' },
    creditLimits: { 1: 22, 2: 22, summer: 9 },
    ...overrides,
  });
}

{
  const result = plan({
    remainingCourses: [course('A'), course('B')],
    prerequisites: [prerequisite('B', 'A')],
    offerings: [
      offering('A', 2569, '1'),
      offering('B', 2569, '1'),
      offering('B', 2569, '2'),
    ],
  });

  assert.deepEqual(result.terms.find((term) => term.key === '2569/1').courses.map((row) => row.course_id), ['A']);
  assert.deepEqual(result.terms.find((term) => term.key === '2569/2').courses.map((row) => row.course_id), ['B']);
  assert.equal(result.expectedGraduationTerm.key, '2569/2');
}

{
  const result = plan({
    remainingCourses: [course('A', 20), course('B', 3)],
    offerings: [offering('A', 2569, '1'), offering('B', 2569, '1'), offering('B', 2569, '2')],
  });
  assert.equal(result.terms.find((term) => term.key === '2569/1').totalCredits, 20);
  assert.equal(result.terms.find((term) => term.key === '2569/2').totalCredits, 3);
}

{
  const result = plan({ remainingCourses: [course('NO-OFFERING')] });
  assert.equal(result.confidence, 'unavailable');
  assert.equal(result.expectedGraduationTerm, null);
  assert.equal(result.unplacedCourses[0].reasonCode, 'missing_offering');
}

{
  const result = plan({
    remainingCourses: [course('PLANNED')],
    offerings: [
      offering('PLANNED', 2569, '1', 'planned'),
      offering('PLANNED', 2569, '2', 'planned'),
    ],
  });
  assert.equal(result.terms.find((term) => term.key === '2569/1').courses.length, 0);
  assert.equal(result.terms.find((term) => term.key === '2569/2').courses[0].course_id, 'PLANNED');
  assert.equal(result.confidence, 'tentative');
}

{
  const result = plan({
    remainingCourses: [course('A'), course('B')],
    offerings: [
      offering('A', 2569, '1'),
      offering('B', 2569, '1'),
      offering('B', 2569, '2'),
    ],
    rules: [{
      rule_type: 'credit_limit',
      rule_value: { regular: 3, summer: 0 },
      is_active: true,
    }],
  });
  assert.equal(result.creditLimits[1], 3);
  assert.equal(result.terms.find((term) => term.key === '2569/1').courses.length, 1);
  assert.equal(result.terms.find((term) => term.key === '2569/2').courses.length, 1);
}

{
  const grades = [{
    course_id: 'FOUNDATION',
    academic_year: 2568,
    semester: '2',
    grade: 'D',
  }];
  const minimumGradeResult = evaluateCoursePrerequisites({
    courseId: 'ADVANCED',
    prerequisites: [prerequisite('ADVANCED', 'FOUNDATION', 'C')],
    grades,
  });
  assert.equal(minimumGradeResult.isSatisfied, false);

  const laterPassingGradeResult = evaluateCoursePrerequisites({
    courseId: 'ADVANCED',
    prerequisites: [prerequisite('ADVANCED', 'FOUNDATION', 'C')],
    grades: [
      ...grades,
      { course_id: 'FOUNDATION', academic_year: 2569, semester: '2', grade: 'B' },
    ],
    targetTermOrder: 25691,
  });
  assert.equal(laterPassingGradeResult.isSatisfied, false);

  const alternativeResult = evaluateCoursePrerequisites({
    courseId: 'ADVANCED',
    prerequisites: [
      prerequisite('ADVANCED', 'FOUNDATION', 'C', 'alternative'),
      prerequisite('ADVANCED', 'ALTERNATIVE', 'D', 'alternative'),
    ],
    grades: [{ course_id: 'ALTERNATIVE', academic_year: 2568, semester: '2', grade: 'B' }],
  });
  assert.equal(alternativeResult.isSatisfied, true);
}

console.log('Constraint planner tests passed.');
