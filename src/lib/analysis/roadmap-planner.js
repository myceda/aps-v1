import { createPassedCourseMap } from './credit-calculator.js';

const ROADMAP_YEARS = 8;
const SEMESTERS = ['1', '2', 'summer'];

function formatTerm(yearLevel, semester) {
  const semesterLabel = semester === 'summer' ? 'ฤดูร้อน' : semester;
  return `ปี ${yearLevel} เทอม ${semesterLabel}`;
}

function getPlannedCourseCodes(studyPlan = {}) {
  return (studyPlan.studyPlanCourses || [])
    .map((row) => row.course?.course_code)
    .filter(Boolean);
}

function createEmptyTerms() {
  const terms = [];

  for (let yearLevel = 1; yearLevel <= ROADMAP_YEARS; yearLevel += 1) {
    for (const semester of SEMESTERS) {
      terms.push({
        key: `${yearLevel}-${semester}`,
        yearLevel,
        semester,
        label: formatTerm(yearLevel, semester),
        courses: [],
        totalCredits: 0,
        status: yearLevel <= 4 ? 'ตามแผนหลักสูตร' : 'แผนสำรองถึงปี 8',
      });
    }
  }

  return terms;
}

function makeCourseStatus(course, passedCourses) {
  const courseId = course.course_id;
  const passed = courseId ? passedCourses.has(courseId) : false;

  return {
    course_id: courseId,
    course_code: course.course_code,
    course_name_th: course.course_name_th,
    credits: Number(course.credits || 0),
    status: passed ? 'passed' : 'remaining',
  };
}

function appendCourseToTerm(term, course) {
  term.courses.push(course);
  term.totalCredits += Number(course.credits || 0);
}

function findTerm(terms, yearLevel, semester) {
  return terms.find((term) => term.yearLevel === yearLevel && term.semester === semester);
}

function placeUnplannedRemainingCourses(terms, remainingCourses) {
  let cursor = 0;

  for (const course of remainingCourses) {
    let placed = false;

    while (cursor < terms.length && !placed) {
      const term = terms[cursor];
      if (term.totalCredits <= 15 || term.courses.length === 0) {
        appendCourseToTerm(term, course);
        placed = true;
      }
      cursor += 1;
    }

    if (!placed) {
      appendCourseToTerm(terms[terms.length - 1], course);
    }
  }
}

export function buildRoadmapPlan({ program, grades = [], studyTrack = 'both' }) {
  const passedCourses = createPassedCourseMap(grades);
  const terms = createEmptyTerms();
  const usedCourseCodes = new Set();

  const studyPlans = (program?.studyPlans || [])
    .filter((plan) => plan.study_track === 'both' || plan.study_track === studyTrack)
    .sort((a, b) => (
      Number(a.year_level) - Number(b.year_level)
      || SEMESTERS.indexOf(a.semester) - SEMESTERS.indexOf(b.semester)
    ));

  for (const plan of studyPlans) {
    const term = findTerm(terms, Number(plan.year_level), plan.semester);
    if (!term) continue;

    const planCourses = [...(plan.studyPlanCourses || [])].sort((a, b) => (
      Number(a.recommended_order || 0) - Number(b.recommended_order || 0)
    ));

    for (const row of planCourses) {
      if (!row.course?.course_code || usedCourseCodes.has(row.course.course_code)) continue;
      appendCourseToTerm(term, makeCourseStatus(row.course, passedCourses));
      usedCourseCodes.add(row.course.course_code);
    }
  }

  const requiredProgramCourses = (program?.programCourses || [])
    .filter((row) => row.course_type === 'required')
    .filter((row) => row.study_track === 'both' || row.study_track === studyTrack);

  const unplannedRemainingCourses = requiredProgramCourses
    .filter((row) => row.course?.course_code && !usedCourseCodes.has(row.course.course_code))
    .filter((row) => !passedCourses.has(row.course_id))
    .map((row) => makeCourseStatus(row.course, passedCourses));

  placeUnplannedRemainingCourses(terms, unplannedRemainingCourses);

  const termsWithCourses = terms.map((term) => ({
    ...term,
    completedCourses: term.courses.filter((course) => course.status === 'passed').length,
    remainingCourses: term.courses.filter((course) => course.status !== 'passed').length,
  }));

  return {
    years: ROADMAP_YEARS,
    terms: termsWithCourses,
    hasOfficialPlan: studyPlans.some((plan) => getPlannedCourseCodes(plan).length > 0),
    remainingCourseCount: termsWithCourses.reduce((sum, term) => sum + term.remainingCourses, 0),
  };
}
