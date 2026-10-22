import assert from 'node:assert/strict';
import { analyzeAcademicRisk } from '../src/lib/analysis/risk-analyzer.js';

function grade(academicYear, semester, value, credits = 3, confirmed = true) {
  return {
    academic_year: academicYear,
    semester,
    grade: value,
    credits_attempted: credits,
    is_confirmed: confirmed,
  };
}

function analyze(grades) {
  const attemptedCredits = grades
    .filter((row) => row.is_confirmed !== false)
    .reduce((sum, row) => sum + Number(row.credits_attempted || 0), 0);

  return analyzeAcademicRisk({
    gpax: { gpax: 0, attemptedCredits },
    grades,
    credits: { requiredCredits: 0, completionPercent: 100 },
    degreeAudit: { missingRequiredCourses: [] },
    prerequisiteGraph: { violations: [] },
    roadmap: { unplacedCourses: [] },
  });
}

{
  const result = analyze([]);
  assert.equal(result.academicStatus, 'unclassified');
  assert.equal(result.academicStatusGpax, null);
  assert.match(result.academicStatusReason, /ไม่มีผลการเรียน/);
}

{
  const result = analyze([grade(2565, '1', 'A')]);
  assert.equal(result.academicStatus, 'unclassified');
  assert.equal(result.academicStatusGpax, 4);
  assert.match(result.academicStatusReason, /ภาคการศึกษาปกติที่ 2/);
}

{
  const result = analyze([grade(2565, '1', 'C'), grade(2565, '2', 'C')]);
  assert.equal(result.academicStatus, 'normal');
  assert.equal(result.academicStatusGpax, 2);
}

{
  const result = analyze([
    grade(2565, '1', 'C', 4),
    grade(2565, '2', 'D', 1),
  ]);
  assert.equal(result.academicStatus, 'probation_high');
  assert.equal(result.academicStatusGpax, 1.8);
}

{
  const result = analyze([grade(2565, '1', 'D+'), grade(2565, '2', 'D+')]);
  assert.equal(result.academicStatus, 'probation_low');
  assert.equal(result.academicStatusGpax, 1.5);
  assert.equal(result.consecutiveWarnings[0].code, 'gpax_below_1_80_two_regular_terms');
}

{
  const result = analyze([grade(2565, '1', 'D'), grade(2565, '2', 'F')]);
  assert.equal(result.academicStatus, 'dismissal_risk');
  assert.equal(result.academicStatusGpax, 0.5);
  assert.match(result.academicStatusReason, /เข้าข่ายพ้นสภาพ/);
}

{
  const result = analyze([
    grade(2565, '1', 'C'),
    grade(2565, '2', 'D+'),
    grade(2565, 'summer', 'A', 9),
  ]);
  assert.equal(result.academicStatus, 'probation_low');
  assert.equal(result.academicStatusGpax, 1.75);
  assert.equal(result.regularTermHistory.at(-1).key, '2565/2');
}

{
  const result = analyze([
    grade(2565, '1', 'C', 4),
    grade(2565, '1', 'D', 1),
    grade(2565, '2', 'C', 4),
    grade(2565, '2', 'D', 1),
    grade(2566, '1', 'C', 4),
    grade(2566, '1', 'D', 1),
    grade(2566, '2', 'C', 4),
    grade(2566, '2', 'D', 1),
  ]);
  assert.equal(result.academicStatus, 'probation_high');
  assert.deepEqual(
    result.consecutiveWarnings.map((warning) => warning.code),
    ['gpax_below_2_00_four_regular_terms'],
  );
}

{
  const result = analyze([
    grade(2565, '1', 'D+'),
    grade(2565, '2', 'D+', 3, false),
  ]);
  assert.equal(result.academicStatus, 'unclassified');
  assert.equal(result.regularTermHistory.length, 1);
}

console.log('Academic risk tests passed.');
