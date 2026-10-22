import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const TRACKS = ['research', 'cooperative'];

const seededGoogleIds = [
  'demo-student-phase-2',
  'seed-normal-student',
  'seed-f-grade-student',
  'seed-w-grade-student',
  'seed-repeated-student',
  'seed-prerequisite-block-student',
  'seed-probation-student',
  'seed-credit-shortage-student',
];

const legacySeededGoogleIds = [
  'phase6-normal-student',
  'phase6-f-grade-student',
  'phase6-prerequisite-student',
  'phase6-credit-short-student',
  'phase6-probation-student',
];

const legacyDemoCourseCodes = ['517101', '517102', '517201', '517301', '517401'];
const legacyDemoStructureNames = ['วิชาเอกบังคับ'];

const gradePointMap: Record<string, number> = {
  A: 4,
  'B+': 3.5,
  B: 3,
  'C+': 2.5,
  C: 2,
  'D+': 1.5,
  D: 1,
  F: 0,
};

type ProgramSeed = {
  code: string;
  nameTh: string;
  nameEn: string;
  totalCredits: number;
  structures: {
    key: string;
    categoryName: string;
    requiredCredits: number;
    categoryType: string;
    description?: string;
  }[];
  courses: CourseSeed[];
  prerequisites: { courseCode: string; requiredCourseCode: string; minimumGrade?: string }[];
  plan: PlanSeed[];
};

type CourseSeed = {
  code: string;
  nameTh: string;
  nameEn: string;
  credits: number;
  structureKey: string;
  courseType?: 'required' | 'elective';
  tracks?: string[];
  isCreditCounted?: boolean;
};

type PlanSeed = {
  yearLevel: number;
  semester: string;
  courseCodes: string[];
  tracks?: string[];
};

type GradeSeed = {
  courseCode: string;
  academicYear: number;
  semester: string;
  grade: string;
};

type CurriculumCatalogCourse = {
  course_code: string;
  course_name_th: string;
  course_name_en?: string;
  credits: number;
  category: string;
  course_type?: 'required' | 'elective';
  is_credit_counted?: boolean;
};

type CurriculumCatalog = {
  program: {
    programCode: string;
    curriculumYear: number;
    nameTh: string;
    nameEn?: string;
    totalCredits: number;
  };
  courses: Record<string, CurriculumCatalogCourse>;
  studyPlans?: {
    studyTrack: string;
    yearLevel: number;
    semester: string;
    courseCodes: string[];
  }[];
};

const cs65Seed: ProgramSeed = {
  code: 'CS65',
  nameTh: 'วิทยาศาสตรบัณฑิต สาขาวิชาวิทยาการคอมพิวเตอร์',
  nameEn: 'Bachelor of Science Program in Computer Science',
  totalCredits: 126,
  structures: [
    {
      key: 'general-required',
      categoryName: 'หมวดวิชาศึกษาทั่วไป - วิชาบังคับ',
      requiredCredits: 24,
      categoryType: 'general',
      description: 'โครงสร้างหลักสูตร CS65: หมวดศึกษาทั่วไปบังคับ',
    },
    {
      key: 'general-elective',
      categoryName: 'หมวดวิชาศึกษาทั่วไป - วิชาเลือก',
      requiredCredits: 6,
      categoryType: 'general',
      description: 'โครงสร้างหลักสูตร CS65: หมวดศึกษาทั่วไปเลือก',
    },
    {
      key: 'foundation',
      categoryName: 'หมวดวิชาเฉพาะ - วิชาเสริมพื้นฐาน',
      requiredCredits: 3,
      categoryType: 'specific',
      description: 'ไม่นับหน่วยกิต ใช้เตรียมพื้นฐานทางคณิตศาสตร์/วิทยาศาสตร์',
    },
    {
      key: 'core',
      categoryName: 'หมวดวิชาเฉพาะ - วิชาแกน',
      requiredCredits: 15,
      categoryType: 'specific',
      description: 'กลุ่มคณิตศาสตร์ สถิติ และวิทยาศาสตร์พื้นฐาน',
    },
    {
      key: 'major-required',
      categoryName: 'หมวดวิชาเฉพาะด้าน - วิชาบังคับ',
      requiredCredits: 56,
      categoryType: 'specific',
      description: 'วิชาเอกบังคับของหลักสูตรวิทยาการคอมพิวเตอร์',
    },
    {
      key: 'major-elective-research',
      categoryName: 'หมวดวิชาเฉพาะด้าน - วิชาบังคับเลือก แผนโครงงานวิจัย',
      requiredCredits: 4,
      categoryType: 'specific',
      description: 'หน่วยกิตโครงงานวิจัย',
    },
    {
      key: 'major-elective-cooperative',
      categoryName: 'หมวดวิชาเฉพาะด้าน - วิชาบังคับเลือก แผนสหกิจศึกษา',
      requiredCredits: 10,
      categoryType: 'specific',
      description: 'หน่วยกิตเตรียมสหกิจและสหกิจศึกษา',
    },
    {
      key: 'major-choice-research',
      categoryName: 'หมวดวิชาเฉพาะด้าน - วิชาเลือก แผนโครงงานวิจัย',
      requiredCredits: 15,
      categoryType: 'specific',
      description: 'วิชาเลือกเฉพาะด้านสำหรับแผนโครงงานวิจัย',
    },
    {
      key: 'major-choice-cooperative',
      categoryName: 'หมวดวิชาเฉพาะด้าน - วิชาเลือก แผนสหกิจศึกษา',
      requiredCredits: 9,
      categoryType: 'specific',
      description: 'วิชาเลือกเฉพาะด้านสำหรับแผนสหกิจศึกษา',
    },
    {
      key: 'free-elective',
      categoryName: 'หมวดวิชาเลือกเสรี',
      requiredCredits: 6,
      categoryType: 'free',
      description: 'วิชาเลือกเสรี',
    },
  ],
  courses: [
    { code: 'SU101', nameTh: 'ศิลปะศิลปากร', nameEn: 'Silpakorn Arts', credits: 3, structureKey: 'general-required' },
    { code: 'SU201', nameTh: 'ภาษาอังกฤษในยุคดิจิทัล', nameEn: 'English in the Digital Era', credits: 3, structureKey: 'general-required' },
    { code: 'SU301', nameTh: 'พลเมืองตื่นรู้', nameEn: 'Active Citizenship', credits: 3, structureKey: 'general-required' },
    { code: 'SU401', nameTh: 'ความเป็นผู้ประกอบการที่ขับเคลื่อนด้วยนวัตกรรม', nameEn: 'Innovation-driven Entrepreneurship', credits: 3, structureKey: 'general-required' },
    { code: 'SU402', nameTh: 'นวัตกรรมและการออกแบบ', nameEn: 'Innovation and Design', credits: 3, structureKey: 'general-required' },
    { code: 'SUXXX-GE1', nameTh: 'วิชาเลือกในหมวดวิชาศึกษาทั่วไป 1', nameEn: 'General Education Elective I', credits: 3, structureKey: 'general-elective', courseType: 'elective' },
    { code: 'SUXXX-GE2', nameTh: 'วิชาเลือกในหมวดวิชาศึกษาทั่วไป 2', nameEn: 'General Education Elective II', credits: 3, structureKey: 'general-elective', courseType: 'elective' },
    { code: '511100', nameTh: 'ความรู้พื้นฐานสำหรับแคลคูลัส', nameEn: 'Precalculus', credits: 3, structureKey: 'foundation' },
    { code: '511108', nameTh: 'แคลคูลัสสำหรับนักวิทยาศาสตร์คณนา 1', nameEn: 'Calculus for Computational Scientists I', credits: 3, structureKey: 'core' },
    { code: '511109', nameTh: 'แคลคูลัสสำหรับนักวิทยาศาสตร์คณนา 2', nameEn: 'Calculus for Computational Scientists II', credits: 3, structureKey: 'core' },
    { code: '511246', nameTh: 'พีชคณิตเชิงเส้นและการประยุกต์', nameEn: 'Linear Algebra with Applications', credits: 3, structureKey: 'core' },
    { code: '515104', nameTh: 'สถิติสำหรับคอมพิวเตอร์', nameEn: 'Statistics for Computing', credits: 3, structureKey: 'core' },
    { code: '517101', nameTh: 'ความรอบรู้และความเป็นพลเมืองดิจิทัล', nameEn: 'Digital Literacy and Citizenship', credits: 3, structureKey: 'major-required' },
    { code: '517121', nameTh: 'ทักษะการเขียนโปรแกรมคอมพิวเตอร์ 1', nameEn: 'Computer Programming Skill I', credits: 4, structureKey: 'major-required' },
    { code: '517122', nameTh: 'ทักษะการเขียนโปรแกรมคอมพิวเตอร์ 2', nameEn: 'Computer Programming Skill II', credits: 4, structureKey: 'major-required' },
    { code: '517211', nameTh: 'การรู้เท่าทันและความเป็นพลเมืองดิจิทัล', nameEn: 'Digital Literacy and Citizenship', credits: 3, structureKey: 'major-required' },
    { code: '517212', nameTh: 'คณิตศาสตร์สำหรับคอมพิวเตอร์', nameEn: 'Mathematics for Computer Science', credits: 3, structureKey: 'major-required' },
    { code: '517221', nameTh: 'โครงสร้างข้อมูล', nameEn: 'Data Structure', credits: 3, structureKey: 'major-required' },
    { code: '517222', nameTh: 'ขั้นตอนวิธีและการวิเคราะห์', nameEn: 'Algorithm and Analysis', credits: 3, structureKey: 'major-required' },
    { code: '517231', nameTh: 'การออกแบบฐานข้อมูล', nameEn: 'Database Design', credits: 3, structureKey: 'major-required' },
    { code: '517241', nameTh: 'ระบบปฏิบัติการ', nameEn: 'Operating Systems', credits: 3, structureKey: 'major-required' },
    { code: '517251', nameTh: 'วิศวกรรมซอฟต์แวร์', nameEn: 'Software Engineering', credits: 3, structureKey: 'major-required' },
    { code: '517261', nameTh: 'เครือข่ายคอมพิวเตอร์', nameEn: 'Computer Networks', credits: 3, structureKey: 'major-required' },
    { code: '517321', nameTh: 'ปัญญาประดิษฐ์', nameEn: 'Artificial Intelligence', credits: 3, structureKey: 'major-required' },
    { code: '517331', nameTh: 'การพัฒนาเว็บแอปพลิเคชัน', nameEn: 'Web Application Development', credits: 3, structureKey: 'major-required' },
    { code: '517351', nameTh: 'ความมั่นคงปลอดภัยไซเบอร์', nameEn: 'Cybersecurity', credits: 3, structureKey: 'major-required' },
    { code: '517361', nameTh: 'การคำนวณแบบคลาวด์', nameEn: 'Cloud Computing', credits: 3, structureKey: 'major-required' },
    { code: '517493', nameTh: 'โครงงานวิจัย 1', nameEn: 'Research Project I', credits: 1, structureKey: 'major-elective-research', tracks: ['research'] },
    { code: '517494', nameTh: 'โครงงานวิจัย 2', nameEn: 'Research Project II', credits: 2, structureKey: 'major-elective-research', tracks: ['research'] },
    { code: '517481', nameTh: 'เตรียมสหกิจศึกษา', nameEn: 'Pre-cooperative Education', credits: 1, structureKey: 'major-elective-cooperative', tracks: ['cooperative'] },
    { code: '517482', nameTh: 'สหกิจศึกษา', nameEn: 'Cooperative Education', credits: 9, structureKey: 'major-elective-cooperative', tracks: ['cooperative'] },
    { code: '517441', nameTh: 'หัวข้อคัดสรรทางวิทยาการคอมพิวเตอร์ 1', nameEn: 'Selected Topics in Computer Science I', credits: 3, structureKey: 'major-choice-research', courseType: 'elective', tracks: ['research'] },
    { code: '517442', nameTh: 'หัวข้อคัดสรรทางวิทยาการคอมพิวเตอร์ 2', nameEn: 'Selected Topics in Computer Science II', credits: 3, structureKey: 'major-choice-research', courseType: 'elective', tracks: ['research'] },
    { code: '517451', nameTh: 'วิทยาการข้อมูลเบื้องต้น', nameEn: 'Introduction to Data Science', credits: 3, structureKey: 'major-choice-cooperative', courseType: 'elective', tracks: ['cooperative'] },
    { code: '517452', nameTh: 'อินเทอร์เน็ตของสรรพสิ่ง', nameEn: 'Internet of Things', credits: 3, structureKey: 'major-choice-cooperative', courseType: 'elective', tracks: ['cooperative'] },
    { code: 'FREE-CS1', nameTh: 'วิชาเลือกเสรี 1', nameEn: 'Free Elective I', credits: 3, structureKey: 'free-elective', courseType: 'elective' },
    { code: 'FREE-CS2', nameTh: 'วิชาเลือกเสรี 2', nameEn: 'Free Elective II', credits: 3, structureKey: 'free-elective', courseType: 'elective' },
  ],
  prerequisites: [
    { courseCode: '511109', requiredCourseCode: '511108' },
    { courseCode: '517122', requiredCourseCode: '517121' },
    { courseCode: '517221', requiredCourseCode: '517122' },
    { courseCode: '517222', requiredCourseCode: '517221' },
    { courseCode: '517231', requiredCourseCode: '517122' },
    { courseCode: '517321', requiredCourseCode: '517222' },
    { courseCode: '517331', requiredCourseCode: '517231' },
    { courseCode: '517361', requiredCourseCode: '517261' },
    { courseCode: '517494', requiredCourseCode: '517493' },
  ],
  plan: [
    { yearLevel: 1, semester: '1', courseCodes: ['SU101', 'SU201', 'SU301', '511100', '511108', '517101'] },
    { yearLevel: 1, semester: '2', courseCodes: ['SU402', '511109', '515104', '517121', 'SUXXX-GE1'] },
    { yearLevel: 2, semester: '1', courseCodes: ['511246', '517122', '517211', '517212', '517221', 'SUXXX-GE2'] },
    { yearLevel: 2, semester: '2', courseCodes: ['SU401', '517222', '517231', '517241', '517251', 'FREE-CS1'] },
    { yearLevel: 3, semester: '1', courseCodes: ['517261', '517321', '517331', '517351', '517441', 'FREE-CS2'], tracks: ['research'] },
    { yearLevel: 3, semester: '1', courseCodes: ['517261', '517321', '517331', '517351', '517451', 'FREE-CS2'], tracks: ['cooperative'] },
    { yearLevel: 3, semester: '2', courseCodes: ['517361', '517493', '517442'], tracks: ['research'] },
    { yearLevel: 3, semester: '2', courseCodes: ['517361', '517481', '517452'], tracks: ['cooperative'] },
    { yearLevel: 4, semester: '1', courseCodes: ['517494'], tracks: ['research'] },
    { yearLevel: 4, semester: '1', courseCodes: ['517482'], tracks: ['cooperative'] },
    { yearLevel: 4, semester: '2', courseCodes: ['517441', '517442'], tracks: ['research'] },
    { yearLevel: 4, semester: '2', courseCodes: ['517451', '517452'], tracks: ['cooperative'] },
  ],
};

const it65Seed: ProgramSeed = {
  code: 'IT65',
  nameTh: 'วิทยาศาสตรบัณฑิต สาขาวิชาเทคโนโลยีสารสนเทศ',
  nameEn: 'Bachelor of Science Program in Information Technology',
  totalCredits: 133,
  structures: [
    { key: 'general', categoryName: 'หมวดวิชาศึกษาทั่วไป', requiredCredits: 30, categoryType: 'general', description: 'โครงสร้างหลักสูตร IT65: หมวดศึกษาทั่วไป' },
    { key: 'foundation', categoryName: 'หมวดวิชาเฉพาะ - วิชาเสริมพื้นฐานทางคณิตศาสตร์', requiredCredits: 3, categoryType: 'specific', description: 'วิชาเสริมพื้นฐานทางคณิตศาสตร์' },
    { key: 'core', categoryName: 'หมวดวิชาเฉพาะ - วิชาแกน', requiredCredits: 9, categoryType: 'specific', description: 'วิชาแกนของหลักสูตรเทคโนโลยีสารสนเทศ' },
    { key: 'major-required-research', categoryName: 'หมวดวิชาเฉพาะด้าน - วิชาบังคับ แผนโครงงานวิจัย', requiredCredits: 76, categoryType: 'specific', description: 'วิชาบังคับสำหรับแผนโครงงานวิจัย' },
    { key: 'major-required-cooperative', categoryName: 'หมวดวิชาเฉพาะด้าน - วิชาบังคับ แผนสหกิจศึกษา', requiredCredits: 82, categoryType: 'specific', description: 'วิชาบังคับสำหรับแผนสหกิจศึกษา' },
    { key: 'major-elective-research', categoryName: 'หมวดวิชาเฉพาะด้าน - วิชาเลือก แผนโครงงานวิจัย', requiredCredits: 12, categoryType: 'specific', description: 'วิชาเลือกเฉพาะด้านสำหรับแผนโครงงานวิจัย' },
    { key: 'major-elective-cooperative', categoryName: 'หมวดวิชาเฉพาะด้าน - วิชาเลือก แผนสหกิจศึกษา', requiredCredits: 6, categoryType: 'specific', description: 'วิชาเลือกเฉพาะด้านสำหรับแผนสหกิจศึกษา' },
    { key: 'free-elective', categoryName: 'หมวดวิชาเลือกเสรี', requiredCredits: 6, categoryType: 'free', description: 'วิชาเลือกเสรี' },
  ],
  courses: [
    { code: 'IT-SU101', nameTh: 'ศิลปะศิลปากร', nameEn: 'Silpakorn Arts', credits: 3, structureKey: 'general' },
    { code: 'IT-SU201', nameTh: 'ภาษาอังกฤษในยุคดิจิทัล', nameEn: 'English in the Digital Era', credits: 3, structureKey: 'general' },
    { code: 'IT-SU301', nameTh: 'พลเมืองตื่นรู้', nameEn: 'Active Citizenship', credits: 3, structureKey: 'general' },
    { code: 'IT-SU402', nameTh: 'นวัตกรรมและการออกแบบ', nameEn: 'Innovation and Design', credits: 3, structureKey: 'general' },
    { code: 'IT-SUXXX-GE1', nameTh: 'วิชาเลือกในหมวดวิชาศึกษาทั่วไป', nameEn: 'General Education Elective', credits: 3, structureKey: 'general', courseType: 'elective' },
    { code: '511100-IT', nameTh: 'ความรู้พื้นฐานสำหรับแคลคูลัส', nameEn: 'Precalculus', credits: 3, structureKey: 'foundation' },
    { code: '511113', nameTh: 'แคลคูลัสสำหรับเทคโนโลยีสารสนเทศ', nameEn: 'Calculus for Information Technology', credits: 3, structureKey: 'core' },
    { code: '515105', nameTh: 'สถิติสำหรับเทคโนโลยีสารสนเทศ', nameEn: 'Statistics for Information Technology', credits: 3, structureKey: 'core' },
    { code: '520101', nameTh: 'พื้นฐานคอมพิวเตอร์และวิทยาการสารสนเทศ', nameEn: 'Fundamentals of Computer and Information Science', credits: 3, structureKey: 'core' },
    { code: '517121-IT', nameTh: 'ทักษะการเขียนโปรแกรมคอมพิวเตอร์ 1', nameEn: 'Computer Programming Skill I', credits: 4, structureKey: 'major-required-research' },
    { code: '520213', nameTh: 'โครงสร้างข้อมูลพื้นฐานและการประยุกต์', nameEn: 'Basic Data Structures and Applications', credits: 3, structureKey: 'major-required-research' },
    { code: '520214', nameTh: 'ดิจิทัลแพลตฟอร์มและโครงสร้างพื้นฐาน', nameEn: 'Digital Platform and Infrastructure', credits: 3, structureKey: 'major-required-research' },
    { code: '520221', nameTh: 'ระบบฐานข้อมูล', nameEn: 'Database Systems', credits: 3, structureKey: 'major-required-research' },
    { code: '520222', nameTh: 'การพัฒนาซอฟต์แวร์เชิงวัตถุและการประยุกต์', nameEn: 'Object-oriented Software Development and Applications', credits: 3, structureKey: 'major-required-research' },
    { code: '520223', nameTh: 'ภาษาเอสคิวแอลเบื้องต้น', nameEn: 'Basic SQL', credits: 1, structureKey: 'major-required-research' },
    { code: '520231', nameTh: 'การวิเคราะห์ข้อมูล', nameEn: 'Data Analytics', credits: 3, structureKey: 'major-required-research' },
    { code: '520232', nameTh: 'การเล่าเรื่องและการสร้างภาพนิทัศน์จากข้อมูล', nameEn: 'Data Storytelling and Visualization', credits: 3, structureKey: 'major-required-research' },
    { code: '520241', nameTh: 'หลักของเครือข่ายคอมพิวเตอร์', nameEn: 'Principles of Computer Networks', credits: 3, structureKey: 'major-required-research' },
    { code: '520242', nameTh: 'ความปลอดภัยของระบบสารสนเทศ', nameEn: 'Information System Security', credits: 3, structureKey: 'major-required-research' },
    { code: '520331', nameTh: 'การจัดการโครงการเทคโนโลยีสารสนเทศ', nameEn: 'Information Technology Project Management', credits: 3, structureKey: 'major-required-research' },
    { code: '520341', nameTh: 'การพัฒนาเว็บแอปพลิเคชัน', nameEn: 'Web Application Development', credits: 3, structureKey: 'major-required-research' },
    { code: '520351', nameTh: 'การประมวลผลแบบคลาวด์สำหรับองค์กร', nameEn: 'Enterprise Cloud Computing', credits: 3, structureKey: 'major-required-research' },
    { code: '520361', nameTh: 'ประสบการณ์ผู้ใช้และส่วนต่อประสาน', nameEn: 'User Experience and Interface Design', credits: 3, structureKey: 'major-required-research' },
    { code: '520371', nameTh: 'โครงงานเทคโนโลยีสารสนเทศ 1', nameEn: 'Information Technology Project I', credits: 2, structureKey: 'major-required-research', tracks: ['research'] },
    { code: '520372', nameTh: 'โครงงานเทคโนโลยีสารสนเทศ 2', nameEn: 'Information Technology Project II', credits: 2, structureKey: 'major-required-research', tracks: ['research'] },
    { code: '520481', nameTh: 'เตรียมสหกิจศึกษา', nameEn: 'Pre-cooperative Education', credits: 1, structureKey: 'major-required-cooperative', tracks: ['cooperative'] },
    { code: '520482', nameTh: 'สหกิจศึกษา', nameEn: 'Cooperative Education', credits: 9, structureKey: 'major-required-cooperative', tracks: ['cooperative'] },
    { code: '520441', nameTh: 'หัวข้อคัดสรรทางเทคโนโลยีสารสนเทศ 1', nameEn: 'Selected Topics in Information Technology I', credits: 3, structureKey: 'major-elective-research', courseType: 'elective', tracks: ['research'] },
    { code: '520442', nameTh: 'หัวข้อคัดสรรทางเทคโนโลยีสารสนเทศ 2', nameEn: 'Selected Topics in Information Technology II', credits: 3, structureKey: 'major-elective-research', courseType: 'elective', tracks: ['research'] },
    { code: '520451', nameTh: 'วิศวกรรมข้อมูล', nameEn: 'Data Engineering', credits: 3, structureKey: 'major-elective-cooperative', courseType: 'elective', tracks: ['cooperative'] },
    { code: '520452', nameTh: 'การวิเคราะห์ธุรกิจดิจิทัล', nameEn: 'Digital Business Analytics', credits: 3, structureKey: 'major-elective-cooperative', courseType: 'elective', tracks: ['cooperative'] },
    { code: 'FREE-IT1', nameTh: 'วิชาเลือกเสรี 1', nameEn: 'Free Elective I', credits: 3, structureKey: 'free-elective', courseType: 'elective' },
    { code: 'FREE-IT2', nameTh: 'วิชาเลือกเสรี 2', nameEn: 'Free Elective II', credits: 3, structureKey: 'free-elective', courseType: 'elective' },
  ],
  prerequisites: [
    { courseCode: '520213', requiredCourseCode: '517121-IT' },
    { courseCode: '520221', requiredCourseCode: '520213' },
    { courseCode: '520222', requiredCourseCode: '517121-IT' },
    { courseCode: '520223', requiredCourseCode: '520221' },
    { courseCode: '520231', requiredCourseCode: '520221' },
    { courseCode: '520232', requiredCourseCode: '520231' },
    { courseCode: '520242', requiredCourseCode: '520241' },
    { courseCode: '520341', requiredCourseCode: '520222' },
    { courseCode: '520372', requiredCourseCode: '520371' },
  ],
  plan: [
    { yearLevel: 1, semester: '1', courseCodes: ['IT-SU101', 'IT-SU201', 'IT-SU301', '511100-IT', '511113', '517121-IT', '520101'] },
    { yearLevel: 1, semester: '2', courseCodes: ['IT-SU402', '515105', '520213', '520214', '520361', 'FREE-IT1', 'IT-SUXXX-GE1'] },
    { yearLevel: 2, semester: '1', courseCodes: ['520221', '520222', '520223', '520231', '520232', '520241', '520242', 'FREE-IT2'] },
    { yearLevel: 2, semester: '2', courseCodes: ['520331', '520341', '520351', '520441'], tracks: ['research'] },
    { yearLevel: 2, semester: '2', courseCodes: ['520331', '520341', '520351', '520451'], tracks: ['cooperative'] },
    { yearLevel: 3, semester: '1', courseCodes: ['520371', '520442'], tracks: ['research'] },
    { yearLevel: 3, semester: '1', courseCodes: ['520481', '520452'], tracks: ['cooperative'] },
    { yearLevel: 3, semester: '2', courseCodes: ['520372'], tracks: ['research'] },
    { yearLevel: 3, semester: '2', courseCodes: ['520482'], tracks: ['cooperative'] },
    { yearLevel: 4, semester: '1', courseCodes: ['520441', '520442'], tracks: ['research'] },
    { yearLevel: 4, semester: '1', courseCodes: ['520451', '520452'], tracks: ['cooperative'] },
    { yearLevel: 4, semester: '2', courseCodes: ['520331'], tracks: ['research'] },
    { yearLevel: 4, semester: '2', courseCodes: ['520351'], tracks: ['cooperative'] },
  ],
};

const curriculumCatalogDir = path.join(process.cwd(), 'services', 'pdf-extractor', 'fixtures');

const csCatalogStructureMap: Record<string, string> = {
  general_required: 'general-required',
  general_elective: 'general-elective',
  foundation: 'foundation',
  core: 'core',
  major_required: 'major-required',
  major_elective: 'major-choice-research',
  research_track_required: 'major-elective-research',
  cooperative_track_required: 'major-elective-cooperative',
  external_or_free_elective: 'free-elective',
  free_elective: 'free-elective',
};

const itCatalogStructureMap: Record<string, string> = {
  general_required: 'general',
  general_elective: 'general',
  foundation: 'foundation',
  core: 'core',
  major_required: 'major-required-research',
  major_elective: 'major-elective-research',
  research_track_required: 'major-required-research',
  cooperative_track_required: 'major-required-cooperative',
  free_elective: 'free-elective',
};

const itCourseCodeAliases: Record<string, string> = {
  'IT-SU101': 'SU101',
  'IT-SU201': 'SU201',
  'IT-SU301': 'SU301',
  'IT-SU402': 'SU402',
  'IT-SUXXX-GE1': 'SUXXX-GE1',
  '511100-IT': '511100',
  '517121-IT': '517121',
  '520371': '520493',
  '520372': '520494',
  '520441': '520481',
  '520442': '520482',
};

function loadCurriculumCatalog(fileName: string): CurriculumCatalog {
  return JSON.parse(readFileSync(path.join(curriculumCatalogDir, fileName), 'utf8')) as CurriculumCatalog;
}

function normalizeCourseCode(code: string, aliases: Record<string, string>) {
  return aliases[code] || code;
}

function normalizeSeedCodes(seed: ProgramSeed, aliases: Record<string, string>): ProgramSeed {
  return {
    ...seed,
    courses: seed.courses.map((course) => ({
      ...course,
      code: normalizeCourseCode(course.code, aliases),
    })),
    prerequisites: seed.prerequisites.map((prerequisite) => ({
      ...prerequisite,
      courseCode: normalizeCourseCode(prerequisite.courseCode, aliases),
      requiredCourseCode: normalizeCourseCode(prerequisite.requiredCourseCode, aliases),
    })),
    plan: seed.plan.map((plan) => ({
      ...plan,
      courseCodes: plan.courseCodes.map((courseCode) => normalizeCourseCode(courseCode, aliases)),
    })),
  };
}

function tracksForCatalogCourse(course: CurriculumCatalogCourse) {
  if (course.category === 'research_track_required') return ['research'];
  if (course.category === 'cooperative_track_required') return ['cooperative'];
  return undefined;
}

function catalogCourseToSeed(course: CurriculumCatalogCourse, structureMap: Record<string, string>): CourseSeed {
  return {
    code: course.course_code,
    nameTh: course.course_name_th,
    nameEn: course.course_name_en || course.course_name_th,
    credits: course.credits,
    structureKey: structureMap[course.category] || 'free-elective',
    courseType: course.course_type || 'required',
    tracks: tracksForCatalogCourse(course),
    isCreditCounted: course.is_credit_counted ?? true,
  };
}

function mergeCatalogIntoSeed(
  seed: ProgramSeed,
  catalogFileName: string,
  structureMap: Record<string, string>,
  aliases: Record<string, string> = {},
): ProgramSeed {
  const catalog = loadCurriculumCatalog(catalogFileName);
  const normalizedSeed = normalizeSeedCodes(seed, aliases);
  const courseMap = new Map<string, CourseSeed>();

  for (const course of normalizedSeed.courses) {
    courseMap.set(course.code, course);
  }

  for (const course of Object.values(catalog.courses)) {
    courseMap.set(course.course_code, catalogCourseToSeed(course, structureMap));
  }

  const catalogPlan = catalog.studyPlans?.map((plan) => ({
    yearLevel: plan.yearLevel,
    semester: plan.semester,
    courseCodes: plan.courseCodes,
    tracks: [plan.studyTrack],
  }));

  return {
    ...normalizedSeed,
    code: catalog.program.programCode,
    nameTh: catalog.program.nameTh,
    nameEn: catalog.program.nameEn || normalizedSeed.nameEn,
    totalCredits: catalog.program.totalCredits,
    courses: [...courseMap.values()],
    plan: catalogPlan || normalizedSeed.plan,
  };
}

function getEarnedCredits(grade: string, credits: number) {
  return gradePointMap[grade] > 0 || grade === 'S' ? credits : 0;
}

function getAttemptedCredits(grade: string, credits: number) {
  return Object.hasOwn(gradePointMap, grade) ? credits : 0;
}

async function upsertProgram(seed: ProgramSeed) {
  return prisma.program.upsert({
    where: { program_code: seed.code },
    update: {
      program_name_th: seed.nameTh,
      program_name_en: seed.nameEn,
      curriculum_year: 2565,
      total_credits: seed.totalCredits,
      status: 'active',
    },
    create: {
      program_code: seed.code,
      program_name_th: seed.nameTh,
      program_name_en: seed.nameEn,
      curriculum_year: 2565,
      total_credits: seed.totalCredits,
      status: 'active',
    },
  });
}

async function upsertCourse(seed: CourseSeed) {
  return prisma.course.upsert({
    where: { course_code: seed.code },
    update: {
      course_name_th: seed.nameTh,
      course_name_en: seed.nameEn,
      credits: seed.credits,
      is_credit_counted: seed.isCreditCounted ?? true,
    },
    create: {
      course_code: seed.code,
      course_name_th: seed.nameTh,
      course_name_en: seed.nameEn,
      credits: seed.credits,
      is_credit_counted: seed.isCreditCounted ?? true,
    },
  });
}

async function upsertStructure(programId: string, structure: ProgramSeed['structures'][number]) {
  const existing = await prisma.programStructure.findFirst({
    where: { program_id: programId, category_name: structure.categoryName },
  });

  if (existing) {
    return prisma.programStructure.update({
      where: { structure_id: existing.structure_id },
      data: {
        required_credits: structure.requiredCredits,
        category_type: structure.categoryType,
        description: structure.description,
      },
    });
  }

  return prisma.programStructure.create({
    data: {
      program_id: programId,
      category_name: structure.categoryName,
      required_credits: structure.requiredCredits,
      category_type: structure.categoryType,
      description: structure.description,
    },
  });
}

async function ensureProgramCourse(programId: string, structureId: string, courseId: string, course: CourseSeed, track: string) {
  const existing = await prisma.programCourse.findFirst({
    where: { program_id: programId, course_id: courseId, study_track: track },
  });

  const data = {
    structure_id: structureId,
    course_type: course.courseType || 'required',
    study_track: track,
  };

  if (existing) {
    return prisma.programCourse.update({
      where: { program_course_id: existing.program_course_id },
      data,
    });
  }

  return prisma.programCourse.create({
    data: {
      program_id: programId,
      course_id: courseId,
      ...data,
    },
  });
}

async function ensurePrerequisite(courseId: string, requiredCourseId: string, minimumGrade = 'D') {
  const existing = await prisma.prerequisite.findFirst({
    where: { course_id: courseId, required_course_id: requiredCourseId, condition_type: 'required' },
  });

  if (existing) {
    return prisma.prerequisite.update({
      where: { prerequisite_id: existing.prerequisite_id },
      data: { minimum_grade: minimumGrade },
    });
  }

  return prisma.prerequisite.create({
    data: {
      course_id: courseId,
      required_course_id: requiredCourseId,
      condition_type: 'required',
      minimum_grade: minimumGrade,
    },
  });
}

async function ensureStudyPlan(programId: string, track: string, yearLevel: number, semester: string, courseIds: string[]) {
  const plan = await prisma.studyPlan.upsert({
    where: {
      program_id_study_track_year_level_semester: {
        program_id: programId,
        study_track: track,
        year_level: yearLevel,
        semester,
      },
    },
    update: {},
    create: {
      program_id: programId,
      study_track: track,
      year_level: yearLevel,
      semester,
    },
  });

  await prisma.studyPlanCourse.deleteMany({ where: { study_plan_id: plan.study_plan_id } });
  await prisma.studyPlanCourse.createMany({
    data: courseIds.map((courseId, index) => ({
      study_plan_id: plan.study_plan_id,
      course_id: courseId,
      recommended_order: index + 1,
    })),
  });
}

async function ensureOffering(programId: string, courseId: string, academicYear: number, semester: string) {
  return prisma.courseOffering.upsert({
    where: {
      program_id_course_id_academic_year_semester: {
        program_id: programId,
        course_id: courseId,
        academic_year: academicYear,
        semester,
      },
    },
    update: { status: 'confirmed' },
    create: {
      program_id: programId,
      course_id: courseId,
      academic_year: academicYear,
      semester,
      status: 'confirmed',
    },
  });
}

async function ensureGradeMapping(grade: string, gradePoint: number, isPassing: boolean, isCreditEarned: boolean) {
  const existing = await prisma.gradeMapping.findFirst({ where: { course_id: null, grade } });

  if (existing) {
    return prisma.gradeMapping.update({
      where: { grade_mapping_id: existing.grade_mapping_id },
      data: { grade_point: gradePoint, is_passing: isPassing, is_credit_earned: isCreditEarned },
    });
  }

  return prisma.gradeMapping.create({
    data: {
      grade,
      grade_point: gradePoint,
      is_passing: isPassing,
      is_credit_earned: isCreditEarned,
    },
  });
}

async function clearLegacySeedCurriculumData(programId: string) {
  const legacyStructures = await prisma.programStructure.findMany({
    where: {
      program_id: programId,
      category_name: { in: legacyDemoStructureNames },
    },
    select: { structure_id: true },
  });
  const legacyStructureIds = legacyStructures.map((structure) => structure.structure_id);

  await prisma.courseOffering.deleteMany({
    where: {
      program_id: programId,
      course: { course_code: { in: legacyDemoCourseCodes } },
    },
  });

  await prisma.programCourse.deleteMany({
    where: {
      program_id: programId,
      OR: [
        { structure_id: { in: legacyStructureIds } },
        { course: { course_code: { in: legacyDemoCourseCodes } } },
      ],
    },
  });

  await prisma.programStructure.deleteMany({
    where: {
      structure_id: { in: legacyStructureIds },
    },
  });
}

async function clearSeededStudentAcademicData() {
  const students = await prisma.student.findMany({
    where: { user: { google_id: { in: [...seededGoogleIds, ...legacySeededGoogleIds] } } },
    select: { student_id: true },
  });
  const studentIds = students.map((student) => student.student_id);

  if (studentIds.length === 0) return;

  const analysisResults = await prisma.analysisResult.findMany({
    where: { student_id: { in: studentIds } },
    select: { result_id: true },
  });
  const resultIds = analysisResults.map((result) => result.result_id);

  const simulationSessions = await prisma.simulationSession.findMany({
    where: { student_id: { in: studentIds } },
    select: { simulation_id: true },
  });
  const simulationIds = simulationSessions.map((simulation) => simulation.simulation_id);

  await prisma.simulationCourse.deleteMany({ where: { simulation_id: { in: simulationIds } } });
  await prisma.simulationSession.deleteMany({ where: { student_id: { in: studentIds } } });
  await prisma.recommendation.deleteMany({ where: { student_id: { in: studentIds } } });
  await prisma.analysisResult.deleteMany({ where: { result_id: { in: resultIds } } });
  await prisma.transcriptSemesterSummary.deleteMany({ where: { student_id: { in: studentIds } } });
  await prisma.studentGrade.deleteMany({ where: { student_id: { in: studentIds } } });
  await prisma.transcriptUpload.deleteMany({ where: { student_id: { in: studentIds } } });
  await prisma.studentProgram.deleteMany({ where: { student_id: { in: studentIds } } });
}

async function upsertStudent({
  googleId,
  email,
  name,
  studentCode,
  admissionYear,
  programId,
  studyTrack,
}: {
  googleId: string;
  email: string;
  name: string;
  studentCode: string;
  admissionYear: number;
  programId: string;
  studyTrack: string;
}) {
  const user = await prisma.user.upsert({
    where: { google_id: googleId },
    update: { email, name, role: 'student' },
    create: {
      email,
      name,
      role: 'student',
      google_id: googleId,
    },
  });

  const student = await prisma.student.upsert({
    where: { student_code: studentCode },
    update: { user_id: user.user_id, admission_year: admissionYear },
    create: {
      user_id: user.user_id,
      student_code: studentCode,
      admission_year: admissionYear,
    },
  });

  await prisma.studentProgram.create({
    data: {
      student_id: student.student_id,
      program_id: programId,
      study_track: studyTrack,
      enrolled_at: new Date(`${admissionYear - 543}-06-01T00:00:00.000Z`),
    },
  });

  return student;
}

async function createTranscriptWithGrades({
  studentId,
  fileName,
  courseMap,
  rows,
}: {
  studentId: string;
  fileName: string;
  courseMap: Map<string, { course_id: string; credits: number }>;
  rows: GradeSeed[];
}) {
  const transcript = await prisma.transcriptUpload.create({
    data: {
      student_id: studentId,
      file_name: fileName,
      extracted_status: 'success',
    },
  });

  await prisma.studentGrade.createMany({
    data: rows.map((row) => {
      const course = courseMap.get(row.courseCode);
      if (!course) throw new Error(`Missing seeded course ${row.courseCode}`);

      return {
        transcript_id: transcript.transcript_id,
        student_id: studentId,
        course_id: course.course_id,
        academic_year: row.academicYear,
        semester: row.semester,
        grade: row.grade,
        credits_attempted: getAttemptedCredits(row.grade, course.credits),
        credits_earned: getEarnedCredits(row.grade, course.credits),
        is_confirmed: true,
      };
    }),
  });
}

async function seedProgram(seed: ProgramSeed) {
  const program = await upsertProgram(seed);
  const structureMap = new Map<string, { structure_id: string }>();
  const courseMap = new Map<string, { course_id: string; credits: number }>();
  const seededCourseCodes = [...new Set(seed.courses.map((course) => course.code))];

  await clearLegacySeedCurriculumData(program.program_id);
  await prisma.courseOffering.deleteMany({
    where: {
      program_id: program.program_id,
      course: { course_code: { notIn: seededCourseCodes } },
    },
  });
  await prisma.programCourse.deleteMany({
    where: {
      program_id: program.program_id,
      course: { course_code: { notIn: seededCourseCodes } },
    },
  });

  for (const structure of seed.structures) {
    structureMap.set(structure.key, await upsertStructure(program.program_id, structure));
  }

  for (const courseSeed of seed.courses) {
    const course = await upsertCourse(courseSeed);
    courseMap.set(courseSeed.code, course);

    const structure = structureMap.get(courseSeed.structureKey);
    if (!structure) throw new Error(`Missing structure ${courseSeed.structureKey} for ${courseSeed.code}`);

    for (const track of courseSeed.tracks || ['both']) {
      await ensureProgramCourse(program.program_id, structure.structure_id, course.course_id, courseSeed, track);
    }
  }

  for (const prerequisite of seed.prerequisites) {
    const course = courseMap.get(prerequisite.courseCode);
    const requiredCourse = courseMap.get(prerequisite.requiredCourseCode);
    if (!course || !requiredCourse) {
      throw new Error(`Missing prerequisite course ${prerequisite.courseCode} -> ${prerequisite.requiredCourseCode}`);
    }
    await ensurePrerequisite(course.course_id, requiredCourse.course_id, prerequisite.minimumGrade);
  }

  await prisma.studyPlanCourse.deleteMany({
    where: { studyPlan: { program_id: program.program_id } },
  });

  for (const plan of seed.plan) {
    const tracks = plan.tracks || TRACKS;
    const courseIds = plan.courseCodes.map((courseCode) => {
      const course = courseMap.get(courseCode);
      if (!course) throw new Error(`Missing planned course ${courseCode}`);
      return course.course_id;
    });

    for (const track of tracks) {
      await ensureStudyPlan(program.program_id, track, plan.yearLevel, plan.semester, courseIds);
    }
  }

  for (const plan of seed.plan) {
    const academicYear = 2565 + plan.yearLevel - 1;
    for (const courseCode of plan.courseCodes) {
      const course = courseMap.get(courseCode);
      if (!course) throw new Error(`Missing offered course ${courseCode}`);
      await ensureOffering(program.program_id, course.course_id, academicYear, plan.semester);
      await ensureOffering(program.program_id, course.course_id, academicYear + 4, plan.semester);
    }
  }

  for (const course of courseMap.values()) {
    for (let academicYear = 2565; academicYear <= 2572; academicYear += 1) {
      await ensureOffering(program.program_id, course.course_id, academicYear, 'summer');
    }
  }

  return { program, courseMap };
}

async function seedScenarios(cs65ProgramId: string, courseMap: Map<string, { course_id: string; credits: number }>) {
  const scenarios = [
    {
      googleId: 'demo-student-phase-2',
      email: 'demo.student@aps.local',
      name: 'Demo Student',
      studentCode: 'APS-DEMO-0001',
      fileName: 'seed-demo-normal.csv',
      studyTrack: 'research',
      rows: [
        { courseCode: 'SU101', academicYear: 2565, semester: '1', grade: 'B+' },
        { courseCode: 'SU201', academicYear: 2565, semester: '1', grade: 'B' },
        { courseCode: '511108', academicYear: 2565, semester: '1', grade: 'B' },
        { courseCode: '517121', academicYear: 2565, semester: '2', grade: 'B+' },
      ],
    },
    {
      googleId: 'seed-normal-student',
      email: 'seed.normal.student@aps.local',
      name: 'Seed Normal Student',
      studentCode: 'APS-NORMAL-0001',
      fileName: 'seed-normal-progress.csv',
      studyTrack: 'research',
      rows: [
        { courseCode: 'SU101', academicYear: 2565, semester: '1', grade: 'A' },
        { courseCode: 'SU201', academicYear: 2565, semester: '1', grade: 'B+' },
        { courseCode: 'SU301', academicYear: 2565, semester: '1', grade: 'B+' },
        { courseCode: '511100', academicYear: 2565, semester: '1', grade: 'S' },
        { courseCode: '511108', academicYear: 2565, semester: '1', grade: 'B' },
        { courseCode: '517101', academicYear: 2565, semester: '1', grade: 'A' },
        { courseCode: 'SU402', academicYear: 2565, semester: '2', grade: 'B+' },
        { courseCode: '511109', academicYear: 2565, semester: '2', grade: 'B' },
        { courseCode: '515104', academicYear: 2565, semester: '2', grade: 'B+' },
        { courseCode: '517121', academicYear: 2565, semester: '2', grade: 'A' },
        { courseCode: '517122', academicYear: 2566, semester: '1', grade: 'B+' },
        { courseCode: '517221', academicYear: 2566, semester: '1', grade: 'B' },
        { courseCode: '517222', academicYear: 2566, semester: '2', grade: 'B' },
        { courseCode: '517231', academicYear: 2566, semester: '2', grade: 'B+' },
      ],
    },
    {
      googleId: 'seed-f-grade-student',
      email: 'seed.fgrade.student@aps.local',
      name: 'Seed F Grade Student',
      studentCode: 'APS-FAIL-0002',
      fileName: 'seed-f-grade.csv',
      studyTrack: 'research',
      rows: [
        { courseCode: '511108', academicYear: 2565, semester: '1', grade: 'B' },
        { courseCode: '517121', academicYear: 2565, semester: '2', grade: 'F' },
        { courseCode: '517122', academicYear: 2566, semester: '1', grade: 'B' },
      ],
    },
    {
      googleId: 'seed-w-grade-student',
      email: 'seed.withdraw.student@aps.local',
      name: 'Seed W Grade Student',
      studentCode: 'APS-WITHDRAW-0003',
      fileName: 'seed-withdrawal.csv',
      studyTrack: 'research',
      rows: [
        { courseCode: 'SU101', academicYear: 2565, semester: '1', grade: 'B' },
        { courseCode: '517121', academicYear: 2565, semester: '2', grade: 'W' },
        { courseCode: '517122', academicYear: 2566, semester: '1', grade: 'W' },
      ],
    },
    {
      googleId: 'seed-repeated-student',
      email: 'seed.repeated.student@aps.local',
      name: 'Seed Repeated Student',
      studentCode: 'APS-REPEAT-0004',
      fileName: 'seed-repeated-course.csv',
      studyTrack: 'research',
      rows: [
        { courseCode: '517121', academicYear: 2565, semester: '2', grade: 'F' },
        { courseCode: '517121', academicYear: 2566, semester: 'summer', grade: 'B+' },
        { courseCode: '517122', academicYear: 2566, semester: '1', grade: 'C+' },
      ],
    },
    {
      googleId: 'seed-prerequisite-block-student',
      email: 'seed.prereq.block@student.aps.local',
      name: 'Seed Prerequisite Block Student',
      studentCode: 'APS-PREREQ-0005',
      fileName: 'seed-prerequisite-block.csv',
      studyTrack: 'research',
      rows: [
        { courseCode: '517121', academicYear: 2565, semester: '2', grade: 'F' },
        { courseCode: '517122', academicYear: 2566, semester: '1', grade: 'A' },
        { courseCode: '517221', academicYear: 2566, semester: '2', grade: 'B+' },
      ],
    },
    {
      googleId: 'seed-probation-student',
      email: 'seed.probation.student@aps.local',
      name: 'Seed Probation Student',
      studentCode: 'APS-PROBATION-0006',
      fileName: 'seed-probation-risk.csv',
      studyTrack: 'research',
      rows: [
        { courseCode: 'SU101', academicYear: 2565, semester: '1', grade: 'D' },
        { courseCode: 'SU201', academicYear: 2565, semester: '1', grade: 'D+' },
        { courseCode: '511108', academicYear: 2565, semester: '1', grade: 'F' },
        { courseCode: '517121', academicYear: 2565, semester: '2', grade: 'D' },
        { courseCode: '517122', academicYear: 2566, semester: '1', grade: 'F' },
      ],
    },
    {
      googleId: 'seed-credit-shortage-student',
      email: 'seed.credit.shortage@student.aps.local',
      name: 'Seed Credit Shortage Student',
      studentCode: 'APS-CREDIT-0007',
      fileName: 'seed-credit-shortage.csv',
      studyTrack: 'research',
      rows: [
        { courseCode: 'SU101', academicYear: 2565, semester: '1', grade: 'B' },
        { courseCode: 'SU201', academicYear: 2565, semester: '1', grade: 'B' },
      ],
    },
  ];

  for (const scenario of scenarios) {
    const student = await upsertStudent({
      googleId: scenario.googleId,
      email: scenario.email,
      name: scenario.name,
      studentCode: scenario.studentCode,
      admissionYear: 2565,
      programId: cs65ProgramId,
      studyTrack: scenario.studyTrack,
    });

    await createTranscriptWithGrades({
      studentId: student.student_id,
      fileName: scenario.fileName,
      courseMap,
      rows: scenario.rows,
    });
  }
}

async function main() {
  console.log('Starting APS realistic seed data...');

  await ensureGradeMapping('A', 4, true, true);
  await ensureGradeMapping('B+', 3.5, true, true);
  await ensureGradeMapping('B', 3, true, true);
  await ensureGradeMapping('C+', 2.5, true, true);
  await ensureGradeMapping('C', 2, true, true);
  await ensureGradeMapping('D+', 1.5, true, true);
  await ensureGradeMapping('D', 1, true, true);
  await ensureGradeMapping('F', 0, false, false);
  await ensureGradeMapping('W', 0, false, false);
  await ensureGradeMapping('S', 0, true, true);
  await ensureGradeMapping('U', 0, false, false);

  const cs65CatalogSeed = mergeCatalogIntoSeed(cs65Seed, 'CS2565.curriculum.json', csCatalogStructureMap);
  const it65CatalogSeed = mergeCatalogIntoSeed(it65Seed, 'IT2565.curriculum.json', itCatalogStructureMap, itCourseCodeAliases);

  const cs65 = await seedProgram(cs65CatalogSeed);
  await seedProgram(it65CatalogSeed);

  await clearSeededStudentAcademicData();
  await seedScenarios(cs65.program.program_id, cs65.courseMap);

  console.log('Seeded CS65/IT65 curriculum data, year 1-4 study plans, 8-year offerings, and test scenarios.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
