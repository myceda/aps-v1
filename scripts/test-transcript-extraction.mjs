import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractPdfTranscriptText } from '../services/pdf-extractor/index.js';
import {
  applyTranscriptExtractionQualityGate,
  normalizeGrade,
  parseTranscriptText,
  validateTranscriptRows,
} from '../src/lib/student-transcript.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const defaultFixtureDir = path.join(projectRoot, 'services', 'pdf-extractor', 'fixtures');
const rowFields = ['course_code', 'course_name', 'academic_year', 'semester', 'credits', 'grade'];
const effectiveRowFields = [
  'course_code',
  'course_name',
  'academic_year',
  'semester',
  'credits_registered',
  'credits_attempted',
  'credits_earned',
  'grade',
  'gradePoints',
  'status',
];
const gradePoints = new Map([
  ['A', 4],
  ['B+', 3.5],
  ['B', 3],
  ['C+', 2.5],
  ['C', 2],
  ['D+', 1.5],
  ['D', 1],
  ['F', 0],
]);

function formatRow(row) {
  return Object.fromEntries(rowFields.map((field) => [field, String(row?.[field] ?? '')]));
}

function formatEffectiveRow(row) {
  return Object.fromEntries(effectiveRowFields.map((field) => [field, String(row?.[field] ?? '')]));
}

function compareRows(actualRows, expectedRows, fields = rowFields, formatter = formatRow, label = 'row') {
  const failures = [];

  if (actualRows.length !== expectedRows.length) {
    failures.push(`${label} count mismatch: expected ${expectedRows.length}, got ${actualRows.length}`);
  }

  const maxRows = Math.max(actualRows.length, expectedRows.length);
  for (let index = 0; index < maxRows; index += 1) {
    const actual = formatter(actualRows[index]);
    const expected = formatter(expectedRows[index]);

    for (const field of fields) {
      if (actual[field] !== expected[field]) {
        failures.push(
          `${label} ${index + 1} ${field}: expected "${expected[field]}", got "${actual[field]}"`,
        );
      }
    }
  }

  return failures;
}

async function loadFixture(fixturePath) {
  const rawFixture = await readFile(fixturePath, 'utf8');
  return JSON.parse(rawFixture);
}

async function loadCurriculum(fixturePath) {
  const curriculumPath = path.join(path.dirname(fixturePath), 'CS2565.curriculum.json');
  try {
    return JSON.parse(await readFile(curriculumPath, 'utf8'));
  } catch {
    return { courses: {} };
  }
}

function getActualStatus(row, course, latestRowsByCode) {
  const grade = normalizeGrade(row.grade);
  const sourceRow = Number(row.row || 0);

  if (row.semester === 'transfer') return grade === 'S' ? 'transfer' : 'transfer_needs_review';
  if (grade === 'W') return 'withdrawn';
  if (!grade || grade === 'I' || grade === 'IP') return 'pending_grade';
  if (grade === 'U') return 'unsatisfactory';
  if (grade === 'F' && latestRowsByCode.get(row.course_code) !== sourceRow) return 'failed_repeated_later';
  if (latestRowsByCode.get(row.course_code) !== sourceRow) return 'repeated_later';
  if (grade === 'S' && course?.is_credit_counted === false) return 'non_credit_satisfied';
  if (grade === 'S') return 'passed_satisfactory';
  return 'passed';
}

function buildEffectiveRows(rawRows, curriculum) {
  const latestRowsByCode = new Map();
  const courseMap = new Map(Object.entries(curriculum.courses || {}));

  rawRows.forEach((row, index) => {
    const grade = normalizeGrade(row.grade);
    if (grade && grade !== 'W') latestRowsByCode.set(row.course_code, index + 1);
  });

  return rawRows
    .map((row, index) => {
      const sourceRow = index + 1;
      const course = courseMap.get(row.course_code);
      const grade = normalizeGrade(row.grade);
      const credits = Number(row.credits) || 0;
      const point = gradePoints.get(grade);
      const status = getActualStatus({ ...row, row: sourceRow }, course, latestRowsByCode);

      if (['withdrawn', 'pending_grade', 'transfer_needs_review', 'unsatisfactory', 'failed_repeated_later', 'repeated_later'].includes(status)) {
        return null;
      }

      const isGradeCounted = gradePoints.has(grade);
      const isCreditCounted = status === 'transfer' ? true : course?.is_credit_counted !== false;
      const creditsAttempted = isGradeCounted ? credits : 0;
      const creditsEarned = isCreditCounted && (isGradeCounted ? point > 0 : grade === 'S') ? credits : 0;

      return {
        sourceRow,
        academic_year: row.academic_year,
        semester: row.semester,
        course_code: row.course_code,
        course_name: row.course_name,
        credits_registered: credits,
        credits_attempted: creditsAttempted,
        credits_earned: creditsEarned,
        grade,
        gradePoints: isGradeCounted ? credits * point : 0,
        status,
      };
    })
    .filter(Boolean);
}

function compareSummary(effectiveRows, rawRows, expectedSummary) {
  const computed = {
    registeredCredits: rawRows.reduce((sum, row) => sum + (Number(row.credits) || 0), 0),
    passedCredits: effectiveRows.reduce((sum, row) => sum + (Number(row.credits_earned) || 0), 0),
    attemptedCredits: effectiveRows.reduce((sum, row) => sum + (Number(row.credits_attempted) || 0), 0),
    gradePoints: effectiveRows.reduce((sum, row) => sum + (Number(row.gradePoints) || 0), 0),
  };
  computed.gpax = computed.attemptedCredits > 0
    ? Number((computed.gradePoints / computed.attemptedCredits).toFixed(2))
    : 0;

  return Object.entries(expectedSummary || {}).flatMap(([field, expected]) => {
    if (field === 'gpax') return computed.gpax === Number(expected) ? [] : [`summary ${field}: expected "${expected}", got "${computed.gpax}"`];
    return computed[field] === Number(expected) ? [] : [`summary ${field}: expected "${expected}", got "${computed[field]}"`];
  });
}

async function runFixture(fixturePath) {
  const fixture = await loadFixture(fixturePath);
  const curriculum = await loadCurriculum(fixturePath);
  const pdfPath = fixture.pdf;
  const pdfBuffer = await readFile(pdfPath);
  const extraction = await extractPdfTranscriptText(pdfBuffer, path.basename(pdfPath));
  const parsedRows = parseTranscriptText(extraction.text);
  const gatedResult = applyTranscriptExtractionQualityGate(extraction, parsedRows);
  const rows = gatedResult.rows;
  const validation = validateTranscriptRows(rows, []);
  const failures = [];
  const expectedMethod = fixture.expected?.method || fixture.verification?.expectedExtractionMethod;
  const expectedStatus = fixture.expected?.status || fixture.verification?.expectedExtractionStatus;

  if (expectedMethod && extraction.method !== expectedMethod) {
    failures.push(`method mismatch: expected ${expectedMethod}, got ${extraction.method}`);
  }
  if (expectedStatus && gatedResult.extraction.status !== expectedStatus) {
    failures.push(`status mismatch: expected ${expectedStatus}, got ${gatedResult.extraction.status}`);
  }

  if (fixture.schemaVersion === 2 && fixture.rawRows) {
    const actualRawRows = rows.map((row, index) => ({ ...row, row: index + 1 }));
    const actualEffectiveRows = buildEffectiveRows(actualRawRows, curriculum);

    failures.push(...compareRows(actualRawRows, fixture.rawRows, rowFields, formatRow, 'raw row'));
    failures.push(...compareRows(
      actualEffectiveRows,
      fixture.effectiveRows,
      effectiveRowFields,
      formatEffectiveRow,
      'effective row',
    ));
    failures.push(...compareSummary(actualEffectiveRows, actualRawRows, fixture.officialFinalSummary));
  } else {
    failures.push(...compareRows(rows, fixture.expected.rows));
  }

  const label = path.basename(fixturePath);
  console.log(`${label}: ${failures.length === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`  method=${extraction.method} status=${gatedResult.extraction.status} rows=${rows.length}`);
  console.log(`  validRows=${validation.summary.validRows} issueRows=${validation.summary.issueRows}`);

  if (failures.length > 0) {
    for (const failure of failures.slice(0, 20)) {
      console.error(`  - ${failure}`);
    }
    if (failures.length > 20) {
      console.error(`  - ...and ${failures.length - 20} more failures`);
    }
  }

  return failures.length;
}

async function main() {
  const requestedFixtures = process.argv.slice(2);
  const fixturePaths = requestedFixtures.length > 0
    ? requestedFixtures.map((fixture) => path.resolve(process.cwd(), fixture))
    : [path.join(defaultFixtureDir, 'CS_F.json')];

  let failureCount = 0;
  for (const fixturePath of fixturePaths) {
    failureCount += await runFixture(fixturePath);
  }

  if (failureCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
