import assert from 'node:assert/strict';
import { simulateWhatIf } from '../src/lib/analysis/what-if-simulator.js';
import { persistSimulation } from '../src/lib/simulation/persistence.js';

const courseA = {
  course_id: 'course-a',
  course_code: '517001',
  course_name_th: 'วิชา A',
  credits: 3,
};
const courseB = {
  course_id: 'course-b',
  course_code: '517002',
  course_name_th: 'วิชา B',
  credits: 3,
};
const program = {
  program_id: 'program-cs2565',
  program_code: 'CS2565',
  program_name_th: 'วิทยาการคอมพิวเตอร์',
  curriculum_year: 2565,
  total_credits: 6,
  structures: [{
    structure_id: 'structure-required',
    category_name: 'วิชาบังคับ',
    category_type: 'required',
    required_credits: 6,
  }],
  programCourses: [courseA, courseB].map((course) => ({
    program_id: 'program-cs2565',
    structure_id: 'structure-required',
    course_id: course.course_id,
    course_type: 'required',
    study_track: 'both',
    course,
  })),
  studyPlans: [],
};
const student = {
  student_id: 'student-1',
  student_code: '65000001',
  admission_year: 2565,
};
const originalGrades = [{
  grade_id: 'grade-a',
  transcript_id: 'transcript-1',
  student_id: student.student_id,
  course_id: courseA.course_id,
  academic_year: 2568,
  semester: '2',
  grade: 'A',
  credits_attempted: 3,
  credits_earned: 3,
  is_confirmed: true,
  course: courseA,
}];
const offerings = [
  {
    offering_id: 'offering-a-2569-1',
    course_id: courseA.course_id,
    academic_year: 2569,
    semester: '1',
    status: 'confirmed',
    course: courseA,
  },
  {
    offering_id: 'offering-b-2569-2',
    course_id: courseB.course_id,
    academic_year: 2569,
    semester: '2',
    status: 'confirmed',
    course: courseB,
  },
];
const baseInput = {
  student,
  program,
  grades: originalGrades,
  prerequisites: [],
  offerings,
  rules: [],
  currentTerm: { academicYear: 2569, semester: '1' },
  creditLimits: { 1: 22, 2: 22, summer: 9 },
  studyTrack: 'both',
};

const addSimulation = simulateWhatIf({
  ...baseInput,
  actions: [{ action_type: 'add', course_id: courseB.course_id, simulated_grade: 'A' }],
});

assert.equal(addSimulation.before.roadmap.expectedGraduationTerm.key, '2569/2');
assert.equal(addSimulation.after.roadmap.expectedGraduationTerm.key, '2569/1');
assert.deepEqual(
  addSimulation.comparison.graduationTerm.before,
  addSimulation.before.roadmap.expectedGraduationTerm,
);
assert.deepEqual(
  addSimulation.comparison.graduationTerm.after,
  addSimulation.after.roadmap.expectedGraduationTerm,
);
assert.equal(addSimulation.comparison.graduationTerm.changed, true);
assert.equal(addSimulation.comparison.earnedCredits.delta, 3);
assert.equal(addSimulation.after.termGpa.some((term) => term.term === '2569/1'), true);

for (const actionType of ['drop', 'fail']) {
  const simulation = simulateWhatIf({
    ...baseInput,
    actions: [{ action_type: actionType, course_id: courseA.course_id }],
  });
  assert.equal(simulation.comparison.earnedCredits.after, 0);
  assert.equal(simulation.appliedActions[0].simulated_grade, actionType === 'drop' ? 'W' : 'F');
}

assert.equal(originalGrades.length, 1);
assert.equal(originalGrades[0].grade, 'A');
assert.equal(originalGrades[0].credits_earned, 3);

const calls = {};
const db = {
  async $transaction(callback) {
    return callback({
      analysisResult: {
        async create(args) {
          calls.analysis = args;
          return { result_id: 'result-1' };
        },
      },
      simulationSession: {
        async create(args) {
          calls.session = args;
          return {
            simulation_id: 'simulation-1',
            result_id: args.data.result_id,
            student_id: args.data.student_id,
            scenario_name: args.data.scenario_name,
            created_at: new Date('2026-08-16T00:00:00.000Z'),
            simulationCourses: args.data.simulationCourses.create,
          };
        },
      },
    });
  },
};

const saved = await persistSimulation({
  db,
  student,
  program,
  scenarioName: 'เพิ่มวิชา B และประเมินผล',
  actions: addSimulation.appliedActions,
  simulation: addSimulation,
});

assert.equal(calls.analysis.data.student_id, student.student_id);
assert.equal(calls.analysis.data.expected_graduation_term, '2569/2');
assert.equal(calls.session.data.result_id, 'result-1');
assert.equal(calls.session.data.scenario_name, 'เพิ่มวิชา B และประเมินผล');
assert.equal(calls.session.data.simulationCourses.create.length, 1);
assert.deepEqual(calls.session.data.simulationCourses.create[0], {
  course_id: courseB.course_id,
  simulated_grade: 'A',
  action_type: 'add',
});
assert.equal(saved.simulation_id, 'simulation-1');

console.log('What-if simulation tests passed.');
