import { isPassedGrade } from './gpax-calculator.js';

export function createPassedCourseMap(grades = []) {
  const passedCourses = new Map();

  for (const grade of grades) {
    if (!isPassedGrade(grade.grade)) continue;

    const courseId = grade.course_id || grade.course?.course_id;
    if (!courseId) continue;

    const current = passedCourses.get(courseId);
    const earnedCredits = Number(grade.credits_earned ?? grade.course?.credits ?? 0);
    if (!current || earnedCredits >= Number(current.credits_earned || 0)) {
      passedCourses.set(courseId, { ...grade, credits_earned: earnedCredits });
    }
  }

  return passedCourses;
}

export function calculateCreditsByCategory(program, grades = []) {
  const passedCourses = createPassedCourseMap(grades);
  const structures = program?.structures || [];
  const programCourses = program?.programCourses || [];

  const categories = structures.map((structure) => {
    const structureCourses = programCourses.filter(
      (programCourse) => programCourse.structure_id === structure.structure_id,
    );
    const completedCourses = structureCourses.filter((programCourse) => (
      passedCourses.has(programCourse.course_id)
    ));
    const earnedCredits = completedCourses.reduce((sum, programCourse) => (
      sum + Number(programCourse.course?.credits || passedCourses.get(programCourse.course_id)?.credits_earned || 0)
    ), 0);
    const requiredCredits = Number(structure.required_credits || 0);

    return {
      structure_id: structure.structure_id,
      category_name: structure.category_name,
      category_type: structure.category_type,
      requiredCredits,
      earnedCredits,
      remainingCredits: Math.max(0, requiredCredits - earnedCredits),
      completedCourses: completedCourses.length,
      requiredCourses: structureCourses.length,
      isComplete: earnedCredits >= requiredCredits,
    };
  });

  const earnedCredits = categories.reduce((sum, category) => sum + category.earnedCredits, 0);
  const requiredCredits = Number(program?.total_credits || 0);

  return {
    earnedCredits,
    requiredCredits,
    remainingCredits: Math.max(0, requiredCredits - earnedCredits),
    completionPercent: requiredCredits > 0 ? Math.min(100, Math.round((earnedCredits / requiredCredits) * 100)) : 0,
    categories,
  };
}
