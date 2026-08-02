import { auditDegreeProgress } from './degree-audit.js';
import { calculateCreditsByCategory } from './credit-calculator.js';
import { calculateGpax, summarizeTermGpa } from './gpax-calculator.js';
import { buildPrerequisiteGraph } from './prerequisite-graph.js';
import { analyzeAcademicRisk } from './risk-analyzer.js';
import { buildRoadmapPlan } from './roadmap-planner.js';

export function analyzeStudentProgress({ student, program, grades = [], prerequisites = [], studyTrack, latestTranscript }) {
  const selectedStudyTrack = studyTrack || student?.studentPrograms?.[0]?.study_track || 'both';
  const gpax = calculateGpax(grades);
  const termGpa = summarizeTermGpa(grades);
  const credits = calculateCreditsByCategory(program, grades);
  const degreeAudit = auditDegreeProgress(program, grades, { studyTrack: selectedStudyTrack });
  const prerequisiteGraph = buildPrerequisiteGraph(prerequisites, grades);
  const risk = analyzeAcademicRisk({ gpax, credits, degreeAudit, prerequisiteGraph });
  const roadmap = buildRoadmapPlan({ program, grades, studyTrack: selectedStudyTrack });

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
    } : {
      hasUploadedTranscript: grades.length > 0,
    },
  };
}
