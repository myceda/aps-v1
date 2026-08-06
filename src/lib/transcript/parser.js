import {
  allowedGrades,
  createEmptyTranscriptRow,
  normalizeAcademicYear,
  normalizeCourseName,
  normalizeCourseCode,
  normalizeCredits,
  normalizeGrade,
  normalizeSemester,
} from './normalizer.js';

const courseCodePattern = /\b(?:[A-Za-z]{2}\d{3}|[A-Za-z]?\d{5,7})\b/;
const creditPattern = /\b([0-9](?:\.0)?)\b/;
const termPattern = /([0123])\s*\/\s*((?:0|19|20|25|26)\d{1,3})/;
const gradeTokens = new Set(allowedGrades);
const noiseLinePattern = /^(?:คะแนนเกรด|รหัสวิชา|รวม|This semester|Cumulative to this semester|GPAX|GPA|ผลการเรียน|CR:|CP:|CA:|GP:|เฉลี่ย|ระดับผลการเรียน|คำอธิบาย|Point Average|Registered|Passed|Attempted|หน้าแรกนักศึกษา|สถานภาพนักศึกษา|พระราชวังสนามจันทร์|วิทยาศาสตร์|วิทยาการคอมพิวเตอร์)/i;

function hasThaiText(value) {
  return /[\u0E00-\u0E7F]/.test(String(value || ''));
}

function findTermContext(line, currentContext) {
  const cleanLine = String(line || '').replace(/\u0000/g, '');
  const termMatch = cleanLine.match(termPattern);
  const explicitSemester = cleanLine.match(/(?:semester|sem|term)[^\dA-Za-z]*(summer|[123])/i);
  let semester = currentContext.semester;
  let academicYear = normalizeAcademicYear(cleanLine) || currentContext.academic_year;

  if (cleanLine.includes('รายวิชาโอนย้าย')) {
    semester = 'transfer';
    academicYear = '0';
  } else if (cleanLine.includes('ภาคการศึกษา') && termMatch) {
    semester = normalizeSemester(termMatch[1]);
    academicYear = termMatch[2] === '0' ? '0' : normalizeAcademicYear(termMatch[2]);
  } else if (explicitSemester) {
    semester = normalizeSemester(explicitSemester[1]);
  } else if (/summer/i.test(cleanLine)) {
    semester = 'summer';
  }

  return {
    academic_year: academicYear,
    semester,
  };
}

function isNoiseLine(line) {
  const cleanLine = normalizeCourseName(line);
  return !cleanLine || noiseLinePattern.test(cleanLine);
}

function isNameOnlyLine(line) {
  const cleanLine = normalizeCourseName(line);
  return cleanLine
    && hasThaiText(cleanLine)
    && !courseCodePattern.test(cleanLine)
    && !termPattern.test(cleanLine)
    && !isNoiseLine(cleanLine);
}

function joinSplitCourseRows(lines) {
  const joinedLines = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const courseCodeMatch = line.match(courseCodePattern);
    const startsWithCode = courseCodeMatch && (courseCodeMatch.index || 0) === 0;
    const courseSegment = startsWithCode ? line.slice(courseCodeMatch[0].length).trim() : '';
    const hasNameAfterCode = hasThaiText(courseSegment);
    const previousLine = joinedLines.at(-1);
    const nextLine = lines[index + 1];

    if (startsWithCode && !hasNameAfterCode && isNameOnlyLine(previousLine) && isNameOnlyLine(nextLine)) {
      joinedLines.pop();
      joinedLines.push(`${courseCodeMatch[0]} ${previousLine} ${nextLine} ${courseSegment}`);
      index += 1;
    } else {
      joinedLines.push(line);
    }
  }

  return joinedLines;
}

function inferCourseName(line, courseCode, credits, grade) {
  let name = line.replace(courseCode, ' ');

  if (grade) {
    name = name.replace(new RegExp(`(^|\\s)${grade.replace('+', '\\+')}(?=\\s|$)`, 'i'), ' ');
  }

  name = name
    .replace(/\s+/g, ' ')
    .trim();

  name = name.replace(/\b(19|20|25|26)\d{2}\b/g, '').replace(/\s+/g, ' ').trim();
  return normalizeCourseName(name);
}

function scoreRow(row) {
  let score = 0;
  if (row.course_code) score += 0.3;
  if (row.academic_year) score += 0.15;
  if (row.semester) score += 0.15;
  if (row.credits) score += 0.15;
  if (row.grade) score += 0.2;
  if (row.course_name) score += 0.05;
  return Math.min(1, Number(score.toFixed(2)));
}

function parseLine(line, context) {
  const courseCodeMatch = line.match(courseCodePattern);
  const courseCode = courseCodeMatch?.[0] || '';
  if (!courseCode) return null;

  const courseSegment = line.slice((courseCodeMatch.index || 0) + courseCode.length).trim();
  const tokens = courseSegment.split(/\s+/).map((token) => token.replace(/[.,;:()[\]]+$/g, ''));
  const gradeIndex = tokens.findLastIndex((token) => gradeTokens.has(normalizeGrade(token)));
  const hasPendingGradeShape = gradeIndex === -1
    && tokens.length >= 2
    && /^\d+(?:\.\d+)?$/.test(tokens.at(-1))
    && /^\d+$/.test(tokens.at(-2));
  const grade = hasPendingGradeShape ? '' : normalizeGrade(gradeIndex >= 0 ? tokens[gradeIndex] : '');
  const creditToken = gradeIndex > 0 ? tokens[gradeIndex - 1] : '';
  const pendingCreditToken = hasPendingGradeShape ? tokens.at(-2) : '';
  const fallbackCredits = Array.from(courseSegment.matchAll(new RegExp(creditPattern, 'g'))).map((match) => match[1]);
  const fallbackCredit = hasPendingGradeShape ? fallbackCredits.at(-2) : fallbackCredits.at(-1);
  const credits = normalizeCredits(creditToken.match(creditPattern)?.[1] || fallbackCredit || '');
  const academicYear = normalizeAcademicYear(line) || context.academic_year;
  const explicitSemester = line.match(/(?:semester|sem|term)[^\dA-Za-z]*(summer|[123])/i);
  const semester = normalizeSemester(explicitSemester?.[1] || context.semester);

  const nameTokens = gradeIndex > 0
    ? tokens.slice(0, gradeIndex - 1)
    : tokens.slice(0, hasPendingGradeShape ? -2 : undefined);

  const row = {
    ...createEmptyTranscriptRow(),
    course_code: normalizeCourseCode(courseCode),
    course_name: inferCourseName(nameTokens.join(' '), courseCode, pendingCreditToken || credits, grade),
    academic_year: academicYear,
    semester: semester || '1',
    credits: pendingCreditToken || credits,
    grade,
    source_text: line,
  };

  row.confidence = scoreRow(row);
  row.status = row.confidence >= 0.8 && allowedGrades.includes(row.grade) ? 'extracted' : 'needs_review';
  return row;
}

export function parseTranscriptText(text) {
  const normalizedText = String(text || '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n');
  const lines = joinSplitCourseRows(normalizedText.split('\n').map((line) => line.trim()).filter(Boolean));
  const rows = [];
  let context = { academic_year: '', semester: '1' };

  for (const line of lines) {
    context = findTermContext(line, context);
    const row = parseLine(line, context);
    if (row) rows.push(row);
  }

  return rows;
}
