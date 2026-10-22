import { createPassedCourseMap } from './credit-calculator.js';

function hasCourseProgress(programCourse, progressSet) {
  return progressSet.has(programCourse.course_id) || progressSet.has(programCourse.course?.course_code);
}

export function auditDegreeProgress(program, grades = [], options = {}) {
  const passedCourses = createPassedCourseMap(grades);
  const satisfiedCourses = options.transcriptProgress?.satisfiedCourses || new Set();
  const pendingCourses = options.transcriptProgress?.pendingCourses || new Set();
  const studyTrack = options.studyTrack || 'both';
  const programCourses = (program?.programCourses || []).filter((programCourse) => (
    programCourse.study_track === 'both' || programCourse.study_track === studyTrack
  ));

  const requiredCourseRows = programCourses.filter((programCourse) => (
    programCourse.course_type === 'required'
  ));
  const completedRequiredRows = requiredCourseRows.filter((programCourse) => (
    passedCourses.has(programCourse.course_id) || hasCourseProgress(programCourse, satisfiedCourses)
  ));
  const pendingRequiredCourses = requiredCourseRows
    .filter((programCourse) => !completedRequiredRows.includes(programCourse))
    .filter((programCourse) => hasCourseProgress(programCourse, pendingCourses))
    .map((programCourse) => ({
      course_id: programCourse.course_id,
      course_code: programCourse.course?.course_code,
      course_name_th: programCourse.course?.course_name_th,
      credits: programCourse.course?.credits || 0,
      category_name: programCourse.structure?.category_name,
    }));
  const missingRequiredCourses = requiredCourseRows
    .filter((programCourse) => !completedRequiredRows.includes(programCourse))
    .filter((programCourse) => !hasCourseProgress(programCourse, pendingCourses))
    .map((programCourse) => ({
      course_id: programCourse.course_id,
      course_code: programCourse.course?.course_code,
      course_name_th: programCourse.course?.course_name_th,
      credits: programCourse.course?.credits || 0,
      category_name: programCourse.structure?.category_name,
    }));

  const completedRequiredCourses = completedRequiredRows.length;

  return {
    program_id: program?.program_id,
    program_code: program?.program_code,
    studyTrack,
    requiredCourses: requiredCourseRows.length,
    completedRequiredCourses,
    pendingRequiredCourses,
    missingRequiredCourses,
    isRequiredCourseComplete: missingRequiredCourses.length === 0,
  };
}
