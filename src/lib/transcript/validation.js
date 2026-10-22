import {
  allowedGrades,
  allowedSemesters,
  getCreditsEarned,
  normalizeAcademicYear,
  normalizeCourseCode,
  normalizeCredits,
  normalizeGrade,
  normalizeSemester,
} from './normalizer.js';

const gradePointMap = new Map([
  ['A', 4],
  ['B+', 3.5],
  ['B', 3],
  ['C+', 2.5],
  ['C', 2],
  ['D+', 1.5],
  ['D', 1],
  ['F', 0],
]);

export function isBlankTranscriptRow(row) {
  return !normalizeCourseCode(row.course_code)
    && !String(row.course_name || '').trim()
    && !normalizeAcademicYear(row.academic_year)
    && !String(row.credits ?? '').trim()
    && !normalizeGrade(row.grade ?? row.rawGrade ?? row.raw_grade);
}

function sanitizeDatabaseText(value) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

export function validateTranscriptRows(rows, courseCatalog = []) {
  const courseMap = new Map(
    courseCatalog.map((course) => [normalizeCourseCode(course.course_code), course]),
  );
  const seen = new Map();
  let validCount = 0;

  const validatedRows = rows.map((row, index) => {
    const rowIndex = Number(row.row_index ?? row.row ?? index + 1);
    const rawInput = {
      course_code: row.course_code ?? '',
      course_name: row.course_name ?? '',
      academic_year: row.academic_year ?? '',
      semester: row.semester ?? '',
      credits: row.credits ?? '',
      grade: row.rawGrade ?? row.raw_grade ?? row.grade ?? '',
      status: row.status ?? '',
      source_text: row.source_text ?? '',
    };

    if (isBlankTranscriptRow(row)) {
      return {
        ...row,
        row_index: rowIndex,
        raw: rawInput,
        course_code: '',
        academic_year: '',
        semester: normalizeSemester(row.semester) || '1',
        credits: '',
        grade: '',
        course: null,
        issues: [],
        validation_status: 'draft',
        status: row.status || 'manual',
        confidence: Number(row.confidence || 0),
      };
    }

    const courseCode = normalizeCourseCode(row.course_code);
    const semester = normalizeSemester(row.semester);
    const grade = normalizeGrade(row.grade);
    const credits = Number(normalizeCredits(row.credits));
    const academicYear = Number(normalizeAcademicYear(row.academic_year));
    const issues = [];
    const course = courseMap.get(courseCode);
    const duplicateKey = `${courseCode}:${academicYear}:${semester}`;
    const isPendingGradeBlank = !grade;
    const isZeroCreditAllowed = ['W', 'IP'].includes(grade) && credits === 0;
    const isTransferRow = semester === 'transfer' && academicYear === 0;

    if (!courseCode || !/^(?:[A-Z]{2}\d{3}|[A-Z]?\d{5,7})$/.test(courseCode)) {
      issues.push('รหัสวิชาไม่ถูกต้อง');
    } else if (courseCatalog.length > 0 && !course) {
      issues.push('ไม่พบรหัสวิชาในคลังรายวิชา');
    }

    if (!allowedSemesters.includes(semester)) {
      issues.push('ภาคการศึกษาต้องเป็น 1, 2 หรือ summer');
    }

    if (!isTransferRow && (!Number.isInteger(academicYear) || academicYear < 2500 || academicYear > 2700)) {
      issues.push('ปีการศึกษาต้องเป็น พ.ศ. 2500-2700');
    }

    if (!Number.isInteger(credits) || credits < 0 || credits > 9 || (credits === 0 && !isZeroCreditAllowed)) {
      issues.push('หน่วยกิตต้องเป็น 1-9');
    } else if (course && credits !== course.credits && !isZeroCreditAllowed) {
      issues.push(`หน่วยกิตไม่ตรงกับคลังรายวิชา (${course.credits})`);
    }

    if (!isPendingGradeBlank && !allowedGrades.includes(grade)) {
      issues.push('เกรดไม่อยู่ในรูปแบบที่รองรับ');
    }

    if (seen.has(duplicateKey)) {
      issues.push(`ข้อมูลซ้ำกับแถว ${seen.get(duplicateKey) + 1}`);
    } else {
      seen.set(duplicateKey, index);
    }

    if (issues.length === 0) validCount += 1;

    return {
      ...row,
      row_index: rowIndex,
      raw: rawInput,
      course_code: courseCode,
      academic_year: Number.isInteger(academicYear) ? String(academicYear) : String(row.academic_year || ''),
      semester,
      credits: Number.isInteger(credits) ? String(credits) : String(row.credits || ''),
      grade,
      course,
      issues,
      validation_status: issues.length === 0 ? 'valid' : 'invalid',
      status: issues.length === 0 ? (isPendingGradeBlank ? 'pending_grade' : (row.status || 'confirmed')) : 'needs_review',
      confidence: Number(row.confidence || 0),
    };
  });

  const reviewRows = validatedRows.filter((row) => !isBlankTranscriptRow(row));
  const confirmedRows = buildConfirmedGradePayload(reviewRows);

  return {
    rows: validatedRows,
    rawRows: reviewRows,
    confirmedRows,
    summary: {
      totalRows: reviewRows.length,
      validRows: validCount,
      issueRows: reviewRows.length - validCount,
      totalCredits: reviewRows.reduce((sum, row) => sum + (Number(row.credits) || 0), 0),
      earnedCredits: reviewRows.reduce((sum, row) => sum + getCreditsEarned(row.grade, row.credits), 0),
    },
    confirmedSummary: buildConfirmedGradeSummary(confirmedRows),
  };
}

function getEffectiveTranscriptStatus(row, latestRowsByCode) {
  const grade = normalizeGrade(row.grade);
  const sourceRow = Number(row.row_index ?? row.row ?? 0);

  if (normalizeSemester(row.semester) === 'transfer') return grade === 'S' ? 'transfer' : 'transfer_needs_review';
  if (grade === 'W') return 'withdrawn';
  if (!grade || grade === 'I' || grade === 'IP') return 'pending_grade';
  if (grade === 'U') return 'unsatisfactory';
  if (grade === 'F' && latestRowsByCode.get(normalizeCourseCode(row.course_code)) !== sourceRow) return 'failed_repeated_later';
  if (latestRowsByCode.get(normalizeCourseCode(row.course_code)) !== sourceRow) return 'repeated_later';
  if (grade === 'S' && row.course?.is_credit_counted === false) return 'non_credit_satisfied';
  if (grade === 'S') return 'passed_satisfactory';
  return 'passed';
}

function buildLatestRowsByCode(rows) {
  const latestRowsByCode = new Map();

  for (const row of rows) {
    const grade = normalizeGrade(row.grade);
    if (!grade || grade === 'W') continue;
    latestRowsByCode.set(normalizeCourseCode(row.course_code), Number(row.row_index ?? row.row ?? 0));
  }

  return latestRowsByCode;
}

function shouldCreateConfirmedGrade(row, latestRowsByCode) {
  const status = getEffectiveTranscriptStatus(row, latestRowsByCode);
  const skippedStatuses = new Set([
    'withdrawn',
    'pending_grade',
    'unsatisfactory',
    'transfer_needs_review',
    'non_credit_satisfied',
    'repeated_later',
    'failed_repeated_later',
  ]);

  return row.validation_status === 'valid'
    && row.course
    && !skippedStatuses.has(status);
}

export function buildConfirmedGradePayload(rows) {
  const latestRowsByCode = buildLatestRowsByCode(rows);

  return rows.filter((row) => shouldCreateConfirmedGrade(row, latestRowsByCode)).map((row) => {
    const grade = normalizeGrade(row.grade);
    const credits = Number(normalizeCredits(row.credits));
    const point = gradePointMap.get(grade);
    const status = getEffectiveTranscriptStatus(row, latestRowsByCode);
    const isGpaxCounted = gradePointMap.has(grade);
    const isCreditCounted = status === 'transfer' ? true : row.course?.is_credit_counted !== false;

    return {
      course_code: normalizeCourseCode(row.course_code),
      academic_year: Number(normalizeAcademicYear(row.academic_year)),
      semester: normalizeSemester(row.semester),
      grade,
      credits,
      credits_registered: credits,
      credits_attempted: isGpaxCounted ? credits : 0,
      credits_earned: isCreditCounted && (isGpaxCounted ? point > 0 : grade === 'S') ? credits : 0,
      gradePoints: isGpaxCounted ? credits * point : 0,
      status,
      raw_row_index: Number(row.row_index ?? row.row ?? 0),
    };
  });
}

export const buildTranscriptSavePayload = buildConfirmedGradePayload;

export function buildConfirmedGradeSummary(rows) {
  return {
    totalRows: rows.length,
    totalCredits: rows.reduce((sum, row) => sum + (Number(row.credits_attempted ?? row.credits) || 0), 0),
    earnedCredits: rows.reduce((sum, row) => sum + (Number(row.credits_earned) || 0), 0),
  };
}

export function buildRawExtractedRowPayload(rows) {
  return rows.filter((row) => !isBlankTranscriptRow(row)).map((row, index) => ({
    row_index: Number(row.row_index ?? row.row ?? index + 1),
    course_code: normalizeCourseCode(row.course_code),
    course_name: sanitizeDatabaseText(row.course_name),
    academic_year: sanitizeDatabaseText(row.academic_year),
    semester: normalizeSemester(row.semester),
    credits: normalizeCredits(row.credits),
    grade: normalizeGrade(row.grade),
    raw_course_code: sanitizeDatabaseText(row.raw?.course_code ?? row.course_code),
    raw_course_name: sanitizeDatabaseText(row.raw?.course_name ?? row.course_name),
    raw_academic_year: sanitizeDatabaseText(row.raw?.academic_year ?? row.academic_year),
    raw_semester: sanitizeDatabaseText(row.raw?.semester ?? row.semester),
    raw_credits: sanitizeDatabaseText(row.raw?.credits ?? row.credits),
    raw_grade: sanitizeDatabaseText(row.raw?.grade ?? row.rawGrade ?? row.grade),
    source_text: sanitizeDatabaseText(row.raw?.source_text ?? row.source_text),
    status: sanitizeDatabaseText(row.status || 'needs_review'),
    validation_status: sanitizeDatabaseText(row.validation_status || 'invalid'),
    confidence: Number(row.confidence || 0),
    issues: row.issues || [],
  }));
}
