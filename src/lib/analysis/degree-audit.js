import { createPassedCourseMap } from './credit-calculator.js';

export function auditDegreeProgress(program, grades = [], options = {}) {
  const passedCourses = createPassedCourseMap(grades);
  const studyTrack = options.studyTrack || 'both';
  const programCourses = (program?.programCourses || []).filter((programCourse) => (
    programCourse.study_track === 'both' || programCourse.study_track === studyTrack
  ));

  const requiredCourseRows = programCourses.filter((programCourse) => (
    programCourse.course_type === 'required'
  ));
  const missingRequiredCourses = requiredCourseRows
    .filter((programCourse) => !passedCourses.has(programCourse.course_id))
    .map((programCourse) => ({
      course_id: programCourse.course_id,
      course_code: programCourse.course?.course_code,
      course_name_th: programCourse.course?.course_name_th,
      credits: programCourse.course?.credits || 0,
      category_name: programCourse.structure?.category_name,
    }));

  const completedRequiredCourses = requiredCourseRows.length - missingRequiredCourses.length;

  return {
    program_id: program?.program_id,
    program_code: program?.program_code,
    studyTrack,
    requiredCourses: requiredCourseRows.length,
    completedRequiredCourses,
    missingRequiredCourses,
    isRequiredCourseComplete: missingRequiredCourses.length === 0,
  };
}
