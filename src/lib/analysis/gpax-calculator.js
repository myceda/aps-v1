export const gradePointMap = {
  A: 4,
  'B+': 3.5,
  B: 3,
  'C+': 2.5,
  C: 2,
  'D+': 1.5,
  D: 1,
  F: 0,
};

export const passingGrades = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'S'];

export function normalizeGradeValue(grade) {
  return String(grade || '').trim().toUpperCase();
}

export function isPassedGrade(grade, minimumGrade = 'D') {
  const normalizedGrade = normalizeGradeValue(grade);
  if (normalizedGrade === 'S') return true;
  if (!Object.hasOwn(gradePointMap, normalizedGrade)) return false;

  const normalizedMinimumGrade = normalizeGradeValue(minimumGrade);
  const minimumPoint = gradePointMap[normalizedMinimumGrade] ?? gradePointMap.D;
  return gradePointMap[normalizedGrade] >= minimumPoint;
}

export function isGpaxCountedGrade(grade) {
  return Object.hasOwn(gradePointMap, normalizeGradeValue(grade));
}

export function calculateGpax(grades = []) {
  const countedGrades = grades.filter((grade) => isGpaxCountedGrade(grade.grade));
  const attemptedCredits = countedGrades.reduce((sum, grade) => sum + Number(grade.credits_attempted || 0), 0);
  const qualityPoints = countedGrades.reduce((sum, grade) => {
    const credits = Number(grade.credits_attempted || 0);
    return sum + credits * gradePointMap[normalizeGradeValue(grade.grade)];
  }, 0);

  return {
    attemptedCredits,
    qualityPoints: Number(qualityPoints.toFixed(2)),
    gpa: attemptedCredits > 0 ? Number((qualityPoints / attemptedCredits).toFixed(2)) : 0,
    gpax: attemptedCredits > 0 ? Number((qualityPoints / attemptedCredits).toFixed(2)) : 0,
    countedGrades: countedGrades.length,
  };
}

export function summarizeTermGpa(grades = []) {
  const grouped = new Map();

  for (const grade of grades) {
    const key = `${grade.academic_year}/${grade.semester}`;
    const rows = grouped.get(key) || [];
    rows.push(grade);
    grouped.set(key, rows);
  }

  return Array.from(grouped.entries()).map(([term, termGrades]) => ({
    term,
    academic_year: termGrades[0]?.academic_year,
    semester: termGrades[0]?.semester,
    ...calculateGpax(termGrades),
  }));
}
