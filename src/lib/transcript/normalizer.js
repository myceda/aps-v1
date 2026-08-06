export const allowedSemesters = ['1', '2', 'summer', 'transfer'];
export const allowedGrades = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'W', 'S', 'U', 'I', 'IP'];

export function normalizeCourseCode(value) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '');
}

export function normalizeGrade(value) {
  return String(value || '').trim().toUpperCase().replace(/\*+$/g, '');
}

export function normalizeCourseName(value) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\u0E17\s+\u0E35\s+3/g, 'ที่ 3')
    .replace(/ท่องเทียว/g, 'ท่องเที่ยว')
    .replace(/เดินวิง/g, 'เดินวิ่ง')
    .replace(/เครือง/g, 'เครื่อง')
    .replace(/ประสบการณ์ ผู้ใช้/g, 'ประสบการณ์ผู้ใช้')
    .replace(/\u0E4Dา/g, 'ำ')
    .replace(/สําหรับ/g, 'สำหรับ')
    .replace(/คํานวณ/g, 'คำนวณ')
    .replace(/ต่ํากว่า/g, 'ต่ำกว่า')
    .replace(/ออกแบบ ประสบการณ์/g, 'ออกแบบประสบการณ์')
    .replace(/พืน/g, 'พื้น')
    .replace(/เปน/g, 'เป็น')
    .replace(/ตืน/g, 'ตื่น')
    .replace(/เพือ/g, 'เพื่อ')
    .replace(/สือ/g, 'สื่อ')
    .replace(/ทีขับ/g, 'ที่ขับ')
    .replace(/เคลือน/g, 'เคลื่อน')
    .replace(/เคลื่อนที/g, 'เคลื่อนที่')
    .replace(/ต่อเนือง/g, 'ต่อเนื่อง')
    .replace(/สิง/g, 'สิ่ง')
    .replace(/เรือง/g, 'เรื่อง')
    .replace(/ปญญา/g, 'ปัญญา')
    .replace(/สถาปตยกรรม/g, 'สถาปัตยกรรม')
    .replace(/ขันตอน/g, 'ขั้นตอน')
    .replace(/เปดโลก/g, 'เปิดโลก')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSemester(value) {
  const semester = String(value || '').trim().toLowerCase();
  if (semester === '3' || semester === 's' || semester === 'summer' || semester.includes('summer')) {
    return 'summer';
  }
  if (semester === '0' || semester === 'transfer') return 'transfer';
  if (semester.includes('ภาคต้น') || semester.includes('first')) return '1';
  if (semester.includes('ภาคปลาย') || semester.includes('second')) return '2';
  return semester;
}

export function normalizeAcademicYear(value) {
  const rawYear = String(value || '').match(/\b(?:19|20|25|26)\d{2}\b/)?.[0] || '';
  if (!rawYear) return '';

  const year = Number(rawYear);
  if (year >= 1900 && year < 2500) return String(year + 543);
  return String(year);
}

export function normalizeCredits(value) {
  const creditText = String(value || '').replace(/[^\d.]/g, '');
  const credits = Number(creditText);
  if (!Number.isFinite(credits)) return '';
  return Number.isInteger(credits) ? String(credits) : String(credits);
}

export function createEmptyTranscriptRow() {
  return {
    course_code: '',
    course_name: '',
    academic_year: '',
    semester: '1',
    credits: '',
    grade: '',
    confidence: 0,
    status: 'manual',
    source_text: '',
  };
}

export function createManualTranscriptRows(count = 8) {
  return Array.from({ length: count }, () => createEmptyTranscriptRow());
}

export function getCreditsEarned(grade, credits) {
  if (['F', 'W', 'U', 'I', 'IP'].includes(normalizeGrade(grade))) return 0;
  return Number(credits) || 0;
}
