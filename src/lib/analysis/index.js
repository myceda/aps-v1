import { auditDegreeProgress } from './degree-audit.js';
import { calculateCreditsByCategory } from './credit-calculator.js';
import { calculateGpax, gradePointMap, summarizeTermGpa } from './gpax-calculator.js';
import { buildPrerequisiteGraph } from './prerequisite-graph.js';
import { analyzeAcademicRisk } from './risk-analyzer.js';
import { buildRoadmapPlan } from './roadmap-planner.js';

const equivalentCourseCodes = new Map([
  ['517100', ['517101']],
  ['517371', ['517493']],
  ['517372', ['517494']],
]);

function getEquivalentCodes(courseCode) {
  const code = String(courseCode || '').trim().toUpperCase();
  return new Set([code, ...(equivalentCourseCodes.get(code) || [])]);
}

function addProgramCourseMatch(progressSet, programCourseByCode, rawCode) {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!code) return;

  for (const [programCode, programCourse] of programCourseByCode.entries()) {
    if (!getEquivalentCodes(programCode).has(code)) continue;
    progressSet.add(programCode);
    if (programCourse.course_id) progressSet.add(programCourse.course_id);
  }
}

function buildTranscriptProgress(latestTranscript, program) {
  const rawRows = latestTranscript?.rawRows || [];
  const programCourseByCode = new Map(
    (program?.programCourses || [])
      .map((programCourse) => [String(programCourse.course?.course_code || '').trim().toUpperCase(), programCourse])
      .filter(([courseCode]) => courseCode),
  );
  const satisfiedCourses = new Set();
  const pendingCourses = new Set();

  for (const row of rawRows) {
    const code = row.normalized_code || row.raw_course_code;
    const grade = String(row.normalized_grade ?? row.raw_grade ?? '').trim().toUpperCase();
    const status = String(row.extraction_status || '').trim().toLowerCase();

    if (!grade || grade === 'I' || grade === 'IP' || status === 'pending_grade') {
      addProgramCourseMatch(pendingCourses, programCourseByCode, code);
      continue;
    }

    if (
      status === 'passed'
      || status === 'passed_satisfactory'
      || status === 'non_credit_satisfied'
      || status === 'transfer'
    ) {
      addProgramCourseMatch(satisfiedCourses, programCourseByCode, code);
    }
  }

  return { satisfiedCourses, pendingCourses };
}

function buildTranscriptSummary(latestTranscript, grades = []) {
  const rawRows = latestTranscript?.rawRows || [];
  const registeredCredits = rawRows.reduce((sum, row) => (
    sum + Number(row.normalized_credits ?? row.raw_credits ?? 0)
  ), 0);
  const pendingCredits = rawRows
    .filter((row) => {
      const grade = String(row.normalized_grade ?? row.raw_grade ?? '').trim().toUpperCase();
      return !grade || grade === 'I' || grade === 'IP';
    })
    .reduce((sum, row) => sum + Number(row.normalized_credits ?? row.raw_credits ?? 0), 0);
  const passedCredits = grades.reduce((sum, grade) => sum + Number(grade.credits_earned || 0), 0);
  const attemptedCredits = grades.reduce((sum, grade) => sum + Number(grade.credits_attempted || 0), 0);
  const gradePoints = grades.reduce((sum, grade) => sum + (
    Number(grade.credits_attempted || 0) * Number(gradePointMap[String(grade.grade || '').toUpperCase()] ?? 0)
  ), 0);

  return {
    registeredCredits,
    pendingCredits,
    passedCredits,
    attemptedCredits,
    gradePoints: Number(gradePoints.toFixed(2)),
  };
}

export function analyzeStudentProgress({
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
}) {
  const selectedStudyTrack = studyTrack || student?.studentPrograms?.[0]?.study_track || 'both';
  const transcriptProgress = buildTranscriptProgress(latestTranscript, program);
  const gpax = calculateGpax(grades);
  const termGpa = summarizeTermGpa(grades);
  const credits = calculateCreditsByCategory(program, grades);
  const degreeAudit = auditDegreeProgress(program, grades, { studyTrack: selectedStudyTrack, transcriptProgress });
  const prerequisiteGraph = buildPrerequisiteGraph(prerequisites, grades);
  const roadmap = buildRoadmapPlan({
    program,
    grades,
    remainingCourses: [
      ...degreeAudit.pendingRequiredCourses,
      ...degreeAudit.missingRequiredCourses,
    ],
    prerequisites,
    offerings,
    rules,
    currentTerm,
    creditLimits,
    admissionYear: student?.admission_year,
    studyTrack: selectedStudyTrack,
    transcriptProgress,
  });
  const risk = analyzeAcademicRisk({ gpax, grades, credits, degreeAudit, prerequisiteGraph, roadmap });

  return {
    student: student ? {
      student_id: student.student_id,
      student_code: student.student_code,
      admission_year: student.admission_year,
    } : null,
    program: program ? {
      program_id: program.program_id,
      program_code: program.program_code,
      program_name_th: program.program_name_th,
      curriculum_year: program.curriculum_year,
      total_credits: program.total_credits,
    } : null,
    studyTrack: selectedStudyTrack,
    gpax,
    termGpa,
    credits,
    degreeAudit,
    risk,
    prerequisiteGraph,
    roadmap,
    transcript: latestTranscript ? {
      transcript_id: latestTranscript.transcript_id,
      file_name: latestTranscript.file_name,
      uploaded_at: latestTranscript.uploaded_at,
      extracted_status: latestTranscript.extracted_status,
      hasUploadedTranscript: true,
      summary: buildTranscriptSummary(latestTranscript, grades),
    } : {
      hasUploadedTranscript: grades.length > 0,
      summary: buildTranscriptSummary(null, grades),
    },
  };
}
