export const allowedSemesters = ['1', '2', 'summer'];
export const allowedGrades = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'W', 'S', 'U', 'I'];

export const sampleTranscriptRows = [
  {
    course_code: '517101',
    course_name: 'Computer Programming I',
    academic_year: '2565',
    semester: '1',
    credits: '3',
    grade: 'B+',
  },
  {
    course_code: '517102',
    course_name: 'Computer Programming II',
    academic_year: '2565',
    semester: '2',
    credits: '3',
    grade: 'B',
  },
  {
    course_code: 'XXXXX',
    course_name: 'ตรวจรหัสวิชาจาก transcript',
    academic_year: '2566',
    semester: 'summer',
    credits: '0',
    grade: 'A',
  },
];

export function normalizeCourseCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

export function normalizeGrade(value) {
  return String(value || '').trim().toUpperCase();
}

export function normalizeSemester(value) {
  const semester = String(value || '').trim().toLowerCase();
  if (semester === '3' || semester === 's' || semester === 'summer') return 'summer';
  return semester;
}

export function createEmptyTranscriptRow() {
  return {
    course_code: '',
    course_name: '',
    academic_year: '',
    semester: '1',
    credits: '',
    grade: '',
  };
}

export function createPreviewRowsFromFile(file) {
  const baseRows = sampleTranscriptRows.map((row) => ({ ...row }));
  const fileName = file?.name || '';
  const codeMatches = Array.from(fileName.matchAll(/\b[A-Za-z]?\d{5,7}\b/g)).map((match) => match[0]);

  if (codeMatches.length > 0) {
    return codeMatches.slice(0, 8).map((courseCode, index) => ({
      ...createEmptyTranscriptRow(),
      course_code: normalizeCourseCode(courseCode),
      course_name: 'สกัดจากชื่อไฟล์ โปรดตรวจชื่อวิชา',
      academic_year: String(2565 + Math.floor(index / 2)),
      semester: index % 2 === 0 ? '1' : '2',
      credits: '3',
      grade: '',
    }));
  }

  return baseRows;
}

export function getCreditsEarned(grade, credits) {
  if (['F', 'W', 'U', 'I'].includes(normalizeGrade(grade))) return 0;
  return Number(credits) || 0;
}

export function validateTranscriptRows(rows, courseCatalog = []) {
  const courseMap = new Map(
    courseCatalog.map((course) => [normalizeCourseCode(course.course_code), course]),
  );
  const seen = new Map();
  let validCount = 0;

  const validatedRows = rows.map((row, index) => {
    const courseCode = normalizeCourseCode(row.course_code);
    const semester = normalizeSemester(row.semester);
    const grade = normalizeGrade(row.grade);
    const credits = Number(row.credits);
    const academicYear = Number(row.academic_year);
    const issues = [];
    const course = courseMap.get(courseCode);
    const duplicateKey = `${courseCode}:${academicYear}:${semester}`;

    if (!courseCode || !/^[A-Z]?\d{5,7}$/.test(courseCode)) {
      issues.push('รหัสวิชาไม่ถูกต้อง');
    } else if (courseCatalog.length > 0 && !course) {
      issues.push('ไม่พบรหัสวิชาในคลังรายวิชา');
    }

    if (!allowedSemesters.includes(semester)) {
      issues.push('ภาคการศึกษาต้องเป็น 1, 2 หรือ summer');
    }

    if (!Number.isInteger(academicYear) || academicYear < 2500 || academicYear > 2700) {
      issues.push('ปีการศึกษาต้องเป็น พ.ศ. 2500-2700');
    }

    if (!Number.isInteger(credits) || credits < 1 || credits > 9) {
      issues.push('หน่วยกิตต้องเป็น 1-9');
    } else if (course && credits !== course.credits) {
      issues.push(`หน่วยกิตไม่ตรงกับคลังรายวิชา (${course.credits})`);
    }

    if (!allowedGrades.includes(grade)) {
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
      course_code: courseCode,
      academic_year: String(row.academic_year || ''),
      semester,
      credits: String(row.credits || ''),
      grade,
      course,
      issues,
    };
  });

  return {
    rows: validatedRows,
    summary: {
      totalRows: rows.length,
      validRows: validCount,
      issueRows: rows.length - validCount,
      totalCredits: validatedRows.reduce((sum, row) => sum + (Number(row.credits) || 0), 0),
      earnedCredits: validatedRows.reduce((sum, row) => sum + getCreditsEarned(row.grade, row.credits), 0),
    },
  };
}

export function buildTranscriptSavePayload(rows) {
  return rows.map((row) => ({
    course_code: normalizeCourseCode(row.course_code),
    academic_year: Number(row.academic_year),
    semester: normalizeSemester(row.semester),
    grade: normalizeGrade(row.grade),
    credits: Number(row.credits),
  }));
}
