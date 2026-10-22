import assert from 'node:assert/strict';
import { after, beforeEach, mock, test } from 'node:test';

const sessionStudent = {
  student_id: 'student-session',
  student_code: '65000001',
};
const csProgram = {
  program_id: 'program-cs2565',
  program_code: 'CS2565',
  programCourses: [{ course_id: 'course-1', course: { course_id: 'course-1' } }],
  courseOfferings: [],
  rules: [],
};

const state = {
  authResult: { user: { user_id: 'user-session' }, student: sessionStudent },
  studentProgram: {
    student_program_id: 'student-program-session',
    student_id: sessionStudent.student_id,
    study_track: 'research',
    program: csProgram,
  },
  calls: [],
  simulationInput: null,
  persistenceInput: null,
};

const prisma = {
  studentProgram: {
    findFirst: async (args) => {
      state.calls.push({ model: 'studentProgram', args });
      return state.studentProgram;
    },
  },
  studentGrade: {
    findMany: async (args) => {
      state.calls.push({ model: 'studentGrade', args });
      return [];
    },
  },
  prerequisite: {
    findMany: async (args) => {
      state.calls.push({ model: 'prerequisite', args });
      return [];
    },
  },
  transcriptUpload: {
    findFirst: async (args) => {
      state.calls.push({ model: 'transcriptUpload', args });
      return null;
    },
  },
  simulationSession: {
    findMany: async (args) => {
      state.calls.push({ model: 'simulationSession', args });
      return [];
    },
  },
  course: {
    findMany: async (args) => {
      state.calls.push({ model: 'course', args });
      return [];
    },
  },
};

mock.module('../src/lib/auth/index.js', {
  namedExports: {
    requireStudent: async () => (
      typeof state.authResult === 'function' ? state.authResult() : state.authResult
    ),
  },
});
mock.module('../src/lib/prisma.js', { namedExports: { prisma } });
mock.module('../src/lib/analysis/index.js', {
  namedExports: {
    analyzeStudentProgress: (input) => ({
      student_id: input.student.student_id,
      program_id: input.program.program_id,
      study_track: input.studyTrack,
    }),
  },
});
mock.module('../src/lib/analysis/what-if-simulator.js', {
  namedExports: {
    simulateWhatIf: (input) => {
      state.simulationInput = input;
      return { appliedActions: input.actions, before: {}, after: {}, comparison: {} };
    },
  },
});
mock.module('../src/lib/simulation/persistence.js', {
  namedExports: {
    persistSimulation: async (input) => {
      state.persistenceInput = input;
      return {
        simulation_id: 'simulation-1',
        result_id: 'result-1',
        scenario_name: input.scenarioName,
        created_at: new Date('2026-08-16T00:00:00.000Z'),
      };
    },
  },
});
mock.module('../services/pdf-extractor/index.js', {
  namedExports: {
    extractPdfTranscriptText: async () => ({ text: '', method: 'mock' }),
  },
});

const analysisRoute = await import('../src/app/api/student/analysis/route.js');
const simulationRoute = await import('../src/app/api/student/simulation/route.js');
const transcriptRoute = await import('../src/app/api/student/transcript/route.js');
const { CS2565_CONTEXT_ERROR } = await import('../src/lib/auth/student-context.js');

after(() => mock.restoreAll());

beforeEach(() => {
  state.authResult = { user: { user_id: 'user-session' }, student: sessionStudent };
  state.studentProgram = {
    student_program_id: 'student-program-session',
    student_id: sessionStudent.student_id,
    study_track: 'research',
    program: csProgram,
  };
  state.calls = [];
  state.simulationInput = null;
  state.persistenceInput = null;
});

async function readJson(response) {
  return { status: response.status, body: await response.json() };
}

function createGuardedHandlerCalls() {
  return [
    ['analysis GET', () => analysisRoute.GET(new Request('http://localhost/api/student/analysis'))],
    ['simulation GET', () => simulationRoute.GET(new Request('http://localhost/api/student/simulation'))],
    ['simulation POST', () => simulationRoute.POST(new Request('http://localhost/api/student/simulation', {
      method: 'POST',
    }))],
    ['transcript GET', () => transcriptRoute.GET(new Request('http://localhost/api/student/transcript'))],
    ['transcript DELETE', () => transcriptRoute.DELETE(new Request('http://localhost/api/student/transcript', {
      method: 'DELETE',
    }))],
    ['transcript POST', () => transcriptRoute.POST(new Request('http://localhost/api/student/transcript', {
      method: 'POST',
    }))],
  ];
}

async function assertEveryHandlerRejected(expectedStatus, expectedError) {
  for (const [name, callHandler] of createGuardedHandlerCalls()) {
    const result = await readJson(await callHandler());
    assert.equal(result.status, expectedStatus, name);
    assert.equal(result.body.success, false, name);
    assert.equal(result.body.error, expectedError, name);
  }
}

test('Student API ทุก handler ส่งต่อ 401 เมื่อยังไม่มี session', async () => {
  const error = 'กรุณาเข้าสู่ระบบก่อนใช้งาน';
  state.authResult = () => ({
    error: Response.json({ success: false, error }, { status: 401 }),
  });

  await assertEveryHandlerRejected(401, error);

  assert.equal(state.calls.length, 0);
});

test('Student API ทุก handler ส่งต่อ 403 เมื่อผู้ใช้ไม่ใช่นักศึกษา', async () => {
  const error = 'อนุญาตเฉพาะนักศึกษาเท่านั้น';
  state.authResult = () => ({
    error: Response.json({ success: false, error }, { status: 403 }),
  });

  await assertEveryHandlerRejected(403, error);

  assert.equal(state.calls.length, 0);
});

test('Student API ทุก handler ปฏิเสธ non-CS2565 ด้วย 403 และข้อความเดียวกัน', async () => {
  state.studentProgram = {
    ...state.studentProgram,
    program: { program_id: 'program-it2565', program_code: 'IT2565' },
  };

  await assertEveryHandlerRejected(403, CS2565_CONTEXT_ERROR);
});

test('analysis ใช้ student, program และ study track จาก session context เท่านั้น', async () => {
  const request = new Request(
    'http://localhost/api/student/analysis?student_id=student-attacker&program_id=program-attacker&study_track=cooperative',
  );

  const result = await readJson(await analysisRoute.GET(request));

  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data, {
    student_id: sessionStudent.student_id,
    program_id: csProgram.program_id,
    study_track: 'research',
  });
  const contextQuery = state.calls.find((call) => call.model === 'studentProgram');
  const gradeQuery = state.calls.find((call) => call.model === 'studentGrade');
  assert.equal(contextQuery.args.where.student_id, sessionStudent.student_id);
  assert.equal(gradeQuery.args.where.student_id, sessionStudent.student_id);
});

test('simulation เพิกเฉย client-selected identity และ persist ด้วย session context', async () => {
  const request = new Request('http://localhost/api/student/simulation', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      student_id: 'student-attacker',
      program_id: 'program-attacker',
      study_track: 'cooperative',
      scenario_name: 'Session-owned scenario',
      actions: [{ action_type: 'add', course_id: 'course-1', simulated_grade: 'A' }],
    }),
  });

  const result = await readJson(await simulationRoute.POST(request));

  assert.equal(result.status, 201);
  assert.equal(state.simulationInput.student.student_id, sessionStudent.student_id);
  assert.equal(state.simulationInput.program.program_id, csProgram.program_id);
  assert.equal(state.simulationInput.studyTrack, 'research');
  assert.equal(state.persistenceInput.student.student_id, sessionStudent.student_id);
  assert.equal(state.persistenceInput.program.program_id, csProgram.program_id);
});

test('transcript จำกัด course options ด้วย program จาก session context', async () => {
  const request = new Request(
    'http://localhost/api/student/transcript?student_id=student-attacker&program_id=program-attacker',
  );

  const result = await readJson(await transcriptRoute.GET(request));

  assert.equal(result.status, 200);
  const courseQuery = state.calls.find((call) => call.model === 'course');
  assert.equal(courseQuery.args.where.programCourses.some.program_id, csProgram.program_id);
});
