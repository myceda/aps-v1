import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// ตั้งค่า connection pool และ adapter สำหรับ Prisma v7
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting Data Seeding for aps-v1-db...');

  // 1. นำเข้าข้อมูลหลักสูตร CS65 และ IT65
  const cs65 = await prisma.program.upsert({
    where: { program_code: 'CS65' },
    update: {},
    create: {
      program_code: 'CS65',
      program_name_th: 'วิทยาศาสตรบัณฑิต สาขาวิชาวิทยาการคอมพิวเตอร์',
      program_name_en: 'Bachelor of Science in Computer Science',
      curriculum_year: 2565,
      total_credits: 128,
      status: 'active',
    },
  });

  const it65 = await prisma.program.upsert({
    where: { program_code: 'IT65' },
    update: {},
    create: {
      program_code: 'IT65',
      program_name_th: 'วิทยาศาสตรบัณฑิต สาขาวิชาเทคโนโลยีสารสนเทศ',
      program_name_en: 'Bachelor of Science in Information Technology',
      curriculum_year: 2565,
      total_credits: 128,
      status: 'active',
    },
  });

  // 2. ตัวอย่างสร้างรายวิชาพื้นฐาน
  const c1 = await prisma.course.upsert({
    where: { course_code: '517101' },
    update: {},
    create: {
      course_code: '517101',
      course_name_th: 'การโปรแกรมคอมพิวเตอร์ 1',
      course_name_en: 'Computer Programming I',
      credits: 3,
    },
  });

  const c2 = await prisma.course.upsert({
    where: { course_code: '517102' },
    update: {},
    create: {
      course_code: '517102',
      course_name_th: 'การโปรแกรมคอมพิวเตอร์ 2',
      course_name_en: 'Computer Programming II',
      credits: 3,
    },
  });

  // 3. กำหนดเงื่อนไข Prerequisite (517101 ต้องผ่านก่อนเรียน 517102)
  await prisma.prerequisite.create({
    data: {
      course_id: c2.course_id,
      required_course_id: c1.course_id,
      condition_type: 'required',
      minimum_grade: 'D',
    },
  });

  console.log('✅ Seeding Complete: CS65 & IT65 created!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });