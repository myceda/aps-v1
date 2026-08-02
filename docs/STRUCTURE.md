# APS v1 Source of Truth

เอกสารนี้เป็นแหล่งอ้างอิงหลักสำหรับพัฒนา `aps-v1` ให้ตรงกับเอกสารปริญญานิพนธ์ `final.docx` เรื่องระบบวิเคราะห์ข้อมูลเพื่อสนับสนุนการวางแผนการเรียนตามหลักสูตร กรณีศึกษา ภาควิชาคอมพิวเตอร์ มหาวิทยาลัยศิลปากร

สถานะปัจจุบัน: โปรเจกต์มี Next.js, Prisma, PostgreSQL, admin master-data screen, student dashboard prototype, transcript prototype และ analysis prototype แล้ว แต่ยังไม่ใช่ระบบ APS ที่ใช้งานจริงครบทุกฟังก์ชัน เพราะยังขาด authentication จริง, PDF extraction จริง, data model บางตารางไม่ตรง thesis, simulation ยังไม่บันทึก scenario และ UI ยังต้องออกแบบใหม่ให้เป็น product จริง

## Product Goal

APS v1 ต้องเป็นระบบช่วยนักศึกษาและผู้ดูแลระบบวางแผนการเรียนจากข้อมูลจริง ไม่ใช่ mockup หรือ dashboard สาธิต

เป้าหมายหลัก:

- นักศึกษาเข้าสู่ระบบด้วย Google OAuth แล้วเห็นข้อมูลของตัวเองเท่านั้น
- นักศึกษาอัปโหลด Transcript PDF, ตรวจทานข้อมูลที่สกัดได้, แก้ไขเองได้ และยืนยันก่อนบันทึก
- ระบบวิเคราะห์ผลการเรียนเทียบกับหลักสูตร CS65/IT65 ตามโครงสร้างหลักสูตรจริง
- ระบบคำนวณ GPAX, GPA รายเทอม, หน่วยกิตที่ผ่าน, หน่วยกิตที่ขาด, รายวิชาที่ยังไม่ผ่าน, รายวิชาที่ถอน และรายวิชาที่ติด prerequisite
- ระบบคาดการณ์แผนเรียนในอนาคตและเทอมที่คาดว่าจะจบจากรายวิชาคงเหลือ, prerequisite และ course offering จริง
- นักศึกษาทำ What-if Simulation เช่น add, drop, fail แล้วเห็นผลกระทบก่อนและหลัง ทั้ง GPAX, หน่วยกิต, prerequisite, course offering และ expected graduation term
- ผู้ดูแลระบบจัดการข้อมูลหลักสูตร รายวิชา หมวดวิชา prerequisite study plan course offering และ rule ผ่าน no-code workflow
- ผู้ดูแลระบบตรวจ readiness ก่อน publish ข้อมูลให้ฝั่งนักศึกษาใช้วิเคราะห์

## Requirement Source Freeze

เอกสาร requirement หลักที่ต้องใช้สำหรับ APS v1 คือ `C:\Users\MyLuna\thesis-doc-1_69\final.docx` เท่านั้น

หลักฐานจาก `final.docx` ที่ใช้ freeze requirement รอบนี้:

- บทที่ 1 ระบุเป้าหมายระบบ: เว็บแอปสำหรับสนับสนุนการวางแผนการเรียนของนักศึกษา โดยนำ Transcript PDF มาเปรียบเทียบกับหลักสูตร แผนการเรียน prerequisite และ course offering
- ขอบเขตผู้ใช้แบ่งเป็น 2 กลุ่ม: นักศึกษาและผู้ดูแลระบบ
- นักศึกษาต้อง login ด้วย Google OAuth, import Transcript PDF, ตรวจทาน/แก้ไขก่อนบันทึก, เห็นสถานะรายวิชา, roadmap, expected graduation term และ what-if impact
- ผู้ดูแลระบบต้องจัดการหลักสูตร รายวิชา หมวดวิชา แผนเรียน prerequisite rule และ course offering แบบไม่ต้องแก้ code
- Data Dictionary ในบทที่ 5 ระบุตารางหลักที่ schema ต้องรองรับ ได้แก่ User, Student, Admin, StudentProgram, Program, ProgramStructure, Course, ProgramCourse, Prerequisite, StudyPlan, StudyPlanCourse, GradeMapping, TranscriptUpload, StudentGrade, TranscriptSemesterSummary, CourseOffering, Rule, AnalysisResult, Recommendation, SimulationSession และ SimulationCourse

## Functional Requirements Checklist

### FR-01: Login และแยกสิทธิ์ student/admin

Requirement จาก `final.docx`: นักศึกษาสามารถเข้าสู่ระบบด้วยบัญชี Google ผ่าน OAuth 2.0 และระบบต้องควบคุมสิทธิ์เพราะข้อมูลผลการเรียนเป็นข้อมูลส่วนบุคคล

Acceptance criteria:

- [ ] มี Google OAuth 2.0 sign-in/sign-out และ session ที่ระบุ `user_id`, `email`, `role`
- [ ] ระบบสร้าง/อ่าน `User`, `Student`, `Admin`, `StudentProgram` จากฐานข้อมูล ไม่ใช้ demo user ใน production path
- [ ] Student เห็นเฉพาะข้อมูลของตนเองทุก API
- [ ] Admin เข้าได้เฉพาะ admin workspace และ admin API
- [ ] Protected route redirect ผู้ใช้ที่ยังไม่ login หรือ role ไม่ถูกต้อง
- [ ] Error message เป็นภาษาไทยและไม่เปิดเผยข้อมูลภายในระบบ

### FR-02: รับข้อมูลผลการเรียนจาก Transcript PDF และให้ตรวจทานก่อนวิเคราะห์

Requirement จาก `final.docx`: ระบบต้องนำเข้าข้อมูลผลการเรียนจาก PDF โดยใช้ Python/PDF extraction/OCR และต้องมีขั้นตอนให้ผู้ใช้ตรวจทานและแก้ไขก่อนนำไปวิเคราะห์

Acceptance criteria:

- [ ] มี PDF extractor service ภายใต้ `services/pdf-extractor/` หรือ server workflow ที่เรียกใช้ได้จริง
- [ ] รองรับ text extraction และ OCR fallback สำหรับ PDF ที่เป็นภาพหรือ layout ต่างกัน
- [ ] API upload/preview ส่งคืน course rows พร้อม confidence/status เช่น `success` หรือ `needs_review`
- [ ] UI แสดง preview table ให้แก้ course code, academic year, semester, credits และ grade ได้
- [ ] Confirm save เท่านั้นที่สร้าง `TranscriptUpload` และ `StudentGrade`
- [ ] Validation block รหัสวิชาที่ไม่อยู่ในคลัง, semester ไม่ถูกต้อง, credits ไม่ตรงรายวิชา และ duplicate grade

### FR-03: เปรียบเทียบผลการเรียนกับโครงสร้างหลักสูตร

Requirement จาก `final.docx`: ระบบต้องเปรียบเทียบผลการเรียนกับโครงสร้างหลักสูตร แผนการเรียน รายวิชาบังคับก่อน และรายวิชาที่เปิดสอน

Acceptance criteria:

- [ ] Analysis เลือกหลักสูตรจาก `StudentProgram.program_id` และ `study_track`
- [ ] ใช้ `Program`, `ProgramStructure`, `ProgramCourse`, `Course` เป็น source of truth
- [ ] รองรับ CS65 และ IT65 โดยไม่ hard-code หลักสูตรเดียวใน UI/API
- [ ] ผลลัพธ์แยก required/elective/category ตาม schema
- [ ] API ส่งคืนผล degree audit ใน JSON shape มาตรฐาน `{ success, data, error }`
- [ ] Test ครอบคลุมนักศึกษาคนละหลักสูตรและคนละ study track

### FR-04: คำนวณ GPAX/GPA และหน่วยกิตที่ผ่าน/ยังขาดในแต่ละหมวด

Requirement จาก `final.docx`: ระบบต้องแสดงภาพรวมหน่วยกิตสะสม GPAX/GPA และสถานะความก้าวหน้าตามหลักสูตร

Acceptance criteria:

- [ ] คำนวณ GPAX และ GPA รายเทอมจาก `StudentGrade` และ `GradeMapping`
- [ ] คำนวณ `credits_attempted`, `credits_earned`, total required และ remaining credits
- [ ] แสดง credit progress ระดับรวมและระดับหมวดวิชา
- [ ] แยก grade ที่นับหน่วยกิต/ไม่นับหน่วยกิตได้ถูกต้อง เช่น F, W, repeated course
- [ ] บันทึกหรือส่งคืน `TranscriptSemesterSummary` หากต้องเก็บ summary ต่อเทอม
- [ ] Test ครอบคลุมเกรด A-F, W, repeated และกรณีหน่วยกิตไม่ครบหมวด

### FR-05: ระบุรายวิชาที่ยังไม่ได้เรียน ไม่ผ่าน ถอน และเรียนซ้ำ

Requirement จาก `final.docx`: นักศึกษาต้องเห็นรายวิชาที่เรียนผ่าน ไม่ผ่าน ถอน และยังไม่ได้ลงทะเบียนเรียน เพื่อใช้วางแผนลงทะเบียน

Acceptance criteria:

- [ ] Degree audit แยก `passed`, `failed`, `withdrawn`, `repeated`, `remaining`
- [ ] Remaining courses มาจาก `ProgramCourse` หลังหักรายวิชาที่ผ่านจริง
- [ ] Failed/withdrawn ไม่ถูกนับเป็น passed หรือ earned credits
- [ ] UI แสดงสถานะรายวิชาเป็นภาษาไทยและดูออกทันที
- [ ] API ไม่ส่งข้อมูลของนักศึกษาคนอื่นมาปะปน
- [ ] Test ครอบคลุม transcript ที่มี F, W, repeated และรายวิชายังไม่ลงทะเบียน

### FR-06: ตรวจ prerequisite และผลกระทบต่อรายวิชาต่อเนื่อง

Requirement จาก `final.docx`: ใช้แนวคิด directed graph เพื่อวิเคราะห์ prerequisite และรายวิชาต่อเนื่องที่ได้รับผลกระทบเมื่อนักศึกษายังไม่ผ่านรายวิชาต้นทาง

Acceptance criteria:

- [ ] สร้าง prerequisite graph จาก `Prerequisite.course_id -> required_course_id`
- [ ] ตรวจ minimum grade และ condition type เช่น required/alternative
- [ ] ระบุรายวิชาที่ติด prerequisite และ downstream affected courses
- [ ] UI อธิบายเหตุผลเป็นภาษาไทย เช่น ต้องผ่านวิชาใดก่อนจึงจะลงวิชานี้ได้
- [ ] What-if ใช้ prerequisite engine เดียวกัน ไม่แยก logic ซ้ำใน UI
- [ ] Test ครอบคลุม prerequisite chain, alternative condition และกรณี fail prerequisite

### FR-07: คาดการณ์แผนเรียนและ expected graduation term

Requirement จาก `final.docx`: ระบบต้องคาดการณ์แผนการเรียนรายภาคและภาคการศึกษาที่คาดว่าจะสำเร็จ โดยพิจารณารายวิชาคงเหลือ prerequisite course offering และ credit limit

Acceptance criteria:

- [ ] Roadmap planner ใช้ `StudyPlan`, `StudyPlanCourse`, `CourseOffering`, `Prerequisite`, `Rule`
- [ ] รองรับ semester `1`, `2`, `summer` ไม่จำกัดเฉพาะ summer
- [ ] คำนวณ expected graduation term จาก remaining courses และ constraints จริง
- [ ] Roadmap แสดง year 1 ถึง year 8 พร้อมสถานะรายวิชา
- [ ] Low graduation/probation risk ต้องเด่นใน dashboard ไม่ซ่อนในหน้ารอง
- [ ] Test ครอบคลุม course offering ขาด, prerequisite block, credit limit และจบล่าช้า

### FR-08: จำลองสถานการณ์ add/drop/fail แบบ What-if

Requirement จาก `final.docx`: นักศึกษาต้องจำลองถอนรายวิชา ไม่ผ่านรายวิชา หรือลงรายวิชาเพิ่มเติม และเห็นผลกระทบต่อ GPAX หน่วยกิต prerequisite และแผนเรียนแบบ before/after

Acceptance criteria:

- [ ] API รับ action `add`, `drop`, `fail` พร้อมรายวิชาและ simulated grade
- [ ] Simulation ใช้ analysis engine เดียวกับผลจริงเพื่อเปรียบเทียบ base vs scenario
- [ ] บันทึก `SimulationSession` พร้อม `result_id`, `scenario_name`, `scenario_input`, `scenario_result`
- [ ] บันทึก `SimulationCourse` สำหรับรายวิชาใน scenario
- [ ] UI แสดง before/after GPAX, credits, prerequisite impact และ expected graduation term
- [ ] Test ครอบคลุม add/drop/fail ที่เปลี่ยน GPAX, remaining credits และ graduation term

### FR-09: Admin จัดการหลักสูตร รายวิชา หมวดวิชา หน่วยกิต

Requirement จาก `final.docx`: ผู้ดูแลระบบต้องเพิ่ม แก้ไข ค้นหา และลบข้อมูลหลักสูตร รายวิชา โครงสร้างหน่วยกิต และเกณฑ์หลักสูตรผ่าน no-code UI

Acceptance criteria:

- [ ] Admin CRUD รองรับ `Program`, `ProgramStructure`, `Course`, `ProgramCourse`
- [ ] Validation ป้องกันข้อมูลซ้ำ ความสัมพันธ์ผิด และ required field ว่าง
- [ ] UI เป็น form/table/workflow ไม่ให้ admin ต้องแก้ JSON หรือ seed file
- [ ] Admin API มี role guard
- [ ] การแก้ master data ไม่ทำให้ analysis ใช้ข้อมูล draft ที่ยังไม่พร้อม publish
- [ ] Test ครอบคลุม create/update/delete, duplicate code และ invalid relation

### FR-10: Admin จัดการ prerequisite, study plan, course offering, rule และ readiness

Requirement จาก `final.docx`: ผู้ดูแลระบบต้องจัดการ prerequisite แผนการเรียน เกณฑ์วิเคราะห์ และรายวิชาที่เปิดสอนทุกปี/ทุกภาค พร้อมตรวจ readiness ก่อน publish

Acceptance criteria:

- [ ] Admin CRUD รองรับ `Prerequisite`, `StudyPlan`, `StudyPlanCourse`, `CourseOffering`, `Rule`
- [ ] `Rule` schema มี `program_id`, `rule_type`, `rule_name`, `rule_value`, `description`, `is_active`
- [ ] Course offering ครอบคลุมภาคต้น ภาคปลาย และฤดูร้อน
- [ ] Readiness check ตรวจหลักสูตรมี structure, course, prerequisite, study plan, offering และ active rule ครบ
- [ ] UI แสดง checklist readiness ก่อน publish
- [ ] Test ครอบคลุม readiness pass/fail และ offering ที่ขาดในบางเทอม

## Requirement Traceability Matrix

| FR | final.docx requirement | Schema/Data | API/Service | UI files | Verification/Test |
| --- | --- | --- | --- | --- | --- |
| FR-01 | นักศึกษา login ด้วย Google OAuth และระบบควบคุมสิทธิ์ข้อมูลส่วนบุคคล | `prisma/schema.prisma`: `User`, `Student`, `Admin`, `StudentProgram` | `src/app/api/auth/*` (ต้องเพิ่ม), `src/lib/auth/*` (ต้องเพิ่ม), role guards ในทุก protected API | `src/app/page.jsx`, `src/app/student/page.jsx`, `src/app/admin/page.jsx`, `src/components/layout/*` (ต้องเพิ่ม) | Unit/integration: current user resolution, student cannot access other student, admin-only API rejects student; manual: login/logout/role redirect |
| FR-02 | นำเข้า Transcript PDF, สกัดข้อมูล, ให้ตรวจทาน/แก้ไขก่อนวิเคราะห์ | `TranscriptUpload`, `StudentGrade`, `Course`, optional extraction metadata | `services/pdf-extractor/*` (ต้องเพิ่ม), `src/app/api/student/transcript/route.js`, `src/lib/transcript/*` หรือ `src/lib/student-transcript.js` | `src/app/student/transcript-tools/page.jsx`, `src/components/student/transcript-tools-workspace.jsx` | Extractor fixture tests, validation tests for course/semester/credit/duplicate, manual upload-preview-edit-confirm |
| FR-03 | เปรียบเทียบผลการเรียนกับโครงสร้างหลักสูตรและ track | `Program`, `ProgramStructure`, `Course`, `ProgramCourse`, `StudentProgram` | `src/app/api/student/analysis/route.js`, `src/lib/analysis/degree-audit.js`, `src/lib/analysis/index.js` | `src/app/student/dashboard/page.jsx`, `src/components/student/student-dashboard-workspace.jsx` | Analysis tests for CS65/IT65, research/cooperative track, required/elective/category matching |
| FR-04 | คำนวณ GPAX/GPA หน่วยกิตผ่านและหน่วยกิตคงเหลือ | `StudentGrade`, `GradeMapping` (ต้องเพิ่ม/ยืนยัน), `TranscriptSemesterSummary` (ต้องเพิ่มถ้าเก็บ summary), `AnalysisResult` | `src/lib/analysis/gpax-calculator.js`, `src/lib/analysis/credit-calculator.js`, `src/app/api/student/analysis/route.js` | `src/components/student/student-dashboard-workspace.jsx` | Unit tests for grade point, GPA per term, GPAX, F/W/repeated, category remaining credits |
| FR-05 | แสดงรายวิชาที่ผ่าน ไม่ผ่าน ถอน เรียนซ้ำ และยังไม่ได้ลงทะเบียน | `StudentGrade`, `Course`, `ProgramCourse`, `ProgramStructure` | `src/lib/analysis/degree-audit.js`, `src/app/api/student/analysis/route.js` | `src/components/student/student-dashboard-workspace.jsx` | Degree audit tests for passed/failed/withdrawn/repeated/remaining; manual dashboard review |
| FR-06 | วิเคราะห์ prerequisite ด้วย graph และรายวิชาต่อเนื่องที่กระทบ | `Prerequisite`, `Course`, `StudentGrade`, `ProgramCourse` | `src/lib/analysis/prerequisite-graph.js`, `src/app/api/student/analysis/route.js`, reused by simulation | Dashboard/roadmap/prerequisite impact area in `src/components/student/student-dashboard-workspace.jsx` | Graph tests for chain, alternative, minimum grade, downstream affected courses |
| FR-07 | คาดการณ์แผนเรียนและ expected graduation term จาก remaining course, prerequisite, offering, credit limit | `StudyPlan`, `StudyPlanCourse`, `CourseOffering`, `Prerequisite`, `Rule`, `AnalysisResult` | `src/lib/analysis/roadmap-planner.js`, `src/lib/analysis/risk-analyzer.js`, `src/app/api/student/analysis/route.js` | Roadmap in `src/components/student/student-dashboard-workspace.jsx` | Planner tests for semester 1/2/summer, missing offering, credit limit, delayed graduation; visual desktop/mobile review |
| FR-08 | What-if add/drop/fail พร้อม before/after impact | `SimulationSession`, `SimulationCourse`, `AnalysisResult`, `StudentGrade`, `CourseOffering` | `src/app/api/student/simulation/route.js`, `src/lib/analysis/what-if-simulator.js`, future `src/lib/simulation/*` | What-if panel in `src/components/student/student-dashboard-workspace.jsx` | Simulation tests for persisted scenario, GPAX/credits/prerequisite/graduation-term impact; manual before/after comparison |
| FR-09 | Admin no-code CRUD หลักสูตร รายวิชา หมวดวิชา หน่วยกิต | `Program`, `ProgramStructure`, `Course`, `ProgramCourse` | `src/app/api/admin/master-data/route.js`, `src/lib/admin-master-data.js` | `src/app/admin/page.jsx`, `src/components/admin/admin-master-data-workspace.jsx` | CRUD tests for validation, duplicate, invalid FK, role guard; manual admin form/table workflow |
| FR-10 | Admin no-code CRUD prerequisite/study plan/offering/rule และ readiness ก่อน publish | `Prerequisite`, `StudyPlan`, `StudyPlanCourse`, `CourseOffering`, `Rule` | `src/app/api/admin/master-data/route.js`, `src/app/api/admin/readiness/route.js` (ต้องเพิ่ม), `src/lib/admin/*` | `src/components/admin/admin-master-data-workspace.jsx` readiness checklist/publish workflow | Readiness tests for missing structure/course/offering/rule, all-term offering coverage, role guard; manual publish checklist |

## Non-Functional Requirements

| ด้าน | ข้อกำหนด |
| --- | --- |
| ความถูกต้อง | Analysis ต้องอ้างอิงข้อมูลหลักสูตรและ rule จากฐานข้อมูล ไม่ hard-code logic สำคัญไว้ใน UI |
| ความเข้าใจง่าย | UI และข้อความต้องเป็นภาษาไทยก่อน ใช้ศัพท์เทคนิคเท่าที่จำเป็น |
| ความยืดหยุ่น | รองรับหลายหลักสูตรและหลาย study track โดยไม่ต้องแก้โค้ด |
| ความปลอดภัย | Student เห็นเฉพาะข้อมูลตัวเอง Admin จัดการ master data ได้ตามสิทธิ์ |
| ความสามารถในการตรวจทาน | Transcript ที่สกัดได้ต้องมีสถานะ needs_review/success และต้องให้ผู้ใช้ยืนยันก่อนวิเคราะห์ |
| ความเหมาะสมต่อการวางแผน | ผลลัพธ์ต้องช่วยตัดสินใจลงทะเบียนจริง เช่น วิชาที่ควรลงก่อน ความเสี่ยง และเทอมจบที่เปลี่ยนไป |

## Target Architecture

```text
aps-v1/
  prisma/
    schema.prisma                 Database schema that must match thesis data dictionary
    seed.ts                       Realistic CS65/IT65 seed data and test scenarios
    migrations/                   Database migration history

  services/
    pdf-extractor/                PDF/OCR extraction service for transcript files
      main.py                     HTTP entrypoint or CLI wrapper
      extractor/                  Parser, OCR fallback, normalization, confidence scoring
      tests/                      Transcript fixture tests

  src/
    app/
      page.jsx                    Role-aware entry, not a permanent demo landing page
      admin/page.jsx              Admin workspace route
      student/page.jsx            Student redirect/overview route
      student/dashboard/page.jsx  Student dashboard route
      student/transcript-tools/page.jsx
      api/
        auth/                     Google OAuth/session callbacks
        admin/master-data/        Admin CRUD API for curriculum data
        student/transcript/       Upload, preview, validate, confirm transcript
        student/analysis/         Degree audit and risk analysis for current user
        student/simulation/       What-if simulation create/read
        programs/                 Public/authorized program lookup if still needed

    components/
      layout/                     App shell, navigation, role-aware guards
      admin/                      No-code curriculum management UI
      student/                    Dashboard, roadmap, transcript, simulation UI
      ui/                         Reusable primitive controls only

    lib/
      prisma.js                   Shared Prisma singleton
      auth/                       Session, role, current user/student/admin helpers
      transcript/                 Normalization, validation, import workflow
      admin/                      Master-data validation and publish readiness
      analysis/                   Core analysis engine, no JSX
      simulation/                 Scenario persistence and comparison helpers
      constants/                  Enums and Thai labels
```

## Database Source of Truth

`prisma/schema.prisma` ต้องสะท้อน Data Dictionary ใน `final.docx` ก่อนเริ่มแก้ฟีเจอร์อื่น เพราะ analysis และ UI ทั้งหมดต้องพึ่ง schema นี้

### Required Models

กลุ่มผู้ใช้:

- `User`: `user_id`, `email`, `name`, `role`, `google_id`, timestamps
- `Student`: `student_id`, `user_id`, `student_code`, `admission_year`, timestamps
- `Admin`: `admin_id`, `user_id`, `created_at`
- `StudentProgram`: `student_program_id`, `student_id`, `program_id`, `study_track`, `enrolled_at`, `created_at`

กลุ่มหลักสูตร:

- `Program`: `program_id`, `program_code`, `program_name_th`, `program_name_en`, `curriculum_year`, `total_credits`, `status`, timestamps
- `ProgramStructure`: `structure_id`, `program_id`, `category_name`, `required_credits`, `category_type`, `description`, `created_at`
- `Course`: `course_id`, `course_code`, `course_name_th`, `course_name_en`, `credits`, `is_credit_counted`, `description`, timestamps
- `ProgramCourse`: `program_course_id`, `program_id`, `course_id`, `structure_id`, `course_type`, `study_track`, `created_at`

กลุ่มแผนและเงื่อนไข:

- `Prerequisite`: `prerequisite_id`, `course_id`, `required_course_id`, `condition_type`, `minimum_grade`, `description`, timestamps
- `StudyPlan`: `study_plan_id`, `program_id`, `study_track`, `year_level`, `semester`, timestamps
- `StudyPlanCourse`: `study_plan_course_id`, `study_plan_id`, `course_id`, `recommended_order`, `created_at`
- `CourseOffering`: `offering_id`, `program_id`, `course_id`, `academic_year`, `semester`, `status`, timestamps
- `Rule`: must include `program_id`, `rule_type`, `rule_name`, `rule_value`, `description`, `is_active`, timestamps

กลุ่ม transcript และ analysis:

- `TranscriptUpload`: `transcript_id`, `student_id`, `file_name`, `extracted_status`, `uploaded_at`, `created_at`
- `StudentGrade`: `grade_id`, `transcript_id`, `student_id`, `course_id`, `academic_year`, `semester`, `grade`, `credits_attempted`, `credits_earned`, `is_confirmed`, timestamps
- `GradeMapping`: grade-to-point and pass/fail mapping if rules must be configurable
- `TranscriptSemesterSummary`: GPA/credit summary per student per term if storing derived transcript summaries
- `AnalysisResult`: `result_id`, `student_id`, `program_id`, `total_credits_earned`, `total_credits_required`, `academic_status`, `expected_graduation_term`, `result_summary`, `analyzed_at`, timestamps
- `Recommendation`: stored proactive recommendations if results need audit history

กลุ่ม simulation:

- `SimulationSession`: must include `simulation_id`, `result_id`, `student_id`, `scenario_name`, `scenario_input`, `scenario_result`, `created_at`
- `SimulationCourse`: `simulation_course_id`, `simulation_id`, `course_id`, `simulated_grade`, `action_type`, `created_at`

## Main User Flows

### Student Flow

1. Student logs in with Google OAuth
2. System resolves `User -> Student -> StudentProgram`
3. If no confirmed transcript exists, show transcript upload as the primary action
4. Student uploads Transcript PDF
5. PDF extractor returns extracted rows with confidence/status
6. Student reviews rows, fixes course code/year/semester/credits/grade, then confirms
7. System saves `TranscriptUpload` and confirmed `StudentGrade`
8. System runs analysis and stores/returns `AnalysisResult`
9. Dashboard shows GPAX, GPA latest term, credits, academic status, risk, remaining courses, prerequisite impact, and expected graduation term
10. Roadmap shows term-by-term plan up to year 8
11. Student runs What-if scenarios and sees before/after comparison

### Admin Flow

1. Admin logs in with Google OAuth
2. System verifies role `admin`
3. Admin manages Program and ProgramStructure
4. Admin manages Course and ProgramCourse
5. Admin manages Prerequisite
6. Admin manages StudyPlan and StudyPlanCourse
7. Admin manages CourseOffering for every relevant academic term, not summer only
8. Admin manages Rule without editing code
9. Admin runs publish readiness checks
10. Only ready/active curriculum data should be used by student analysis

## Analysis Engine Contract

Analysis code must live under `src/lib/analysis/` or related server-only libraries. UI components must only render returned results

Required modules:

- `gpax-calculator.js`: GPA/GPAX, grade points, counted grades
- `credit-calculator.js`: earned/remaining credits by total and category
- `degree-audit.js`: passed/missing/failed/withdrawn/repeated courses by program and study track
- `prerequisite-graph.js`: graph nodes/edges, prerequisite violations, affected downstream courses
- `roadmap-planner.js`: future term planning from remaining courses, prerequisite and course offering
- `risk-analyzer.js`: academic status, probation risk, low graduation risk, warning reasons
- `what-if-simulator.js`: scenario application and before/after comparison

Rules:

- Do not hard-code a single student such as demo users in production API routes
- Do not calculate from UI state when server data is required
- Do not assume only CS65; use the student's selected program
- Do not assume only summer offerings; use semester `1`, `2`, and `summer`
- Do not hide probation/low graduation risk in secondary pages

## API Contract

All API routes must return JSON in this shape:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

On validation errors:

```json
{
  "success": false,
  "error": "ข้อความภาษาไทยที่ผู้ใช้เข้าใจได้",
  "errors": []
}
```

Required API groups:

- `api/auth/*`: login callback, logout/session handling, current user resolution
- `api/admin/master-data`: CRUD for admin master data with role guard
- `api/admin/readiness`: curriculum publish readiness checks
- `api/student/transcript`: upload, preview, validate, confirm
- `api/student/analysis`: analysis for current logged-in student
- `api/student/simulation`: create and read What-if scenarios for current logged-in student

## UI Direction

UI ต้องดูเป็นระบบใช้งานจริง ไม่ใช่ AI demo หรือ phase mockup

Student UI:

- First screen must be state-aware
- New student: show upload transcript as the first step
- Student with transcript: show status dashboard first
- Low probation/probation risk must be prominent
- Roadmap must be visual, term-by-term, and support year 1 to year 8
- What-if must compare before/after clearly and show graduation-term impact
- Copy should be Thai-first and concise

Admin UI:

- Must be no-code and workflow-driven
- Use forms, steppers, checklist, tables, and relationship selectors
- Show data readiness before publish
- Avoid forcing admins to edit JSON unless the rule editor has labels and safe controls

Design rules:

- No phase labels such as "Phase 4" in production UI
- Avoid generic white cards everywhere without hierarchy
- Avoid mockup copy, placeholder English, and demo language
- Tables must be readable, dense enough for admin work, and responsive
- Important states must use clear visual hierarchy, not only text color

## Current Known Gaps

These gaps must be closed before calling the system complete:

- Authentication and role guards are missing
- Student APIs still depend on demo users
- Transcript PDF extraction is not real yet
- Seed data is still a small test dataset, not full CS65/IT65 curriculum data
- `Rule` schema does not match thesis data dictionary
- `SimulationSession` schema does not match thesis data dictionary
- `GradeMapping`, `TranscriptSemesterSummary`, and `Recommendation` are missing or only implemented as frontend-derived data
- Roadmap planning does not yet fully use CourseOffering and prerequisite constraints
- What-if simulation does not persist complete scenario history
- UI needs product-level redesign

## Implementation Order

Work must be done in small verified slices

1. Rewrite/approve this source of truth
2. Align `prisma/schema.prisma` with thesis data dictionary
3. Create a migration plan and preserve existing useful data
4. Replace demo seed with realistic CS65/IT65 seed data and test scenarios
5. Add authentication/session/role guards
6. Replace demo student API logic with current-user logic
7. Build real transcript extraction path and manual correction workflow
8. Strengthen analysis engine with rules, offerings, prerequisites and full status categories
9. Persist `AnalysisResult`, `SimulationSession`, and recommendations
10. Redesign student dashboard, transcript workflow, roadmap and What-if UI
11. Redesign admin no-code workflow and readiness checks
12. Add standard test suites for normal, failed, withdrawn, prerequisite violation, credit shortage and probation scenarios

## Verification Checklist

Before considering APS v1 complete:

- `npm run lint` passes
- `npm run build` passes
- Database migration applies cleanly
- Seed loads real curriculum/test data
- Student cannot access another student's data
- Admin-only APIs reject student users
- Transcript PDF upload produces reviewable rows
- Manual correction blocks invalid course codes, invalid semester, wrong credits and duplicate grades
- Dashboard shows correct GPAX/GPA/credits/status
- Probation and low graduation risk are visible immediately
- Roadmap respects prerequisite and offering constraints
- What-if add/drop/fail changes results correctly and persists scenario history
- Admin readiness check blocks incomplete curriculum data
- UI has been visually reviewed on desktop and mobile

## Files To Fix Next

After this document is approved, the next files should be handled in this order:

1. `prisma/schema.prisma`
2. `prisma/seed.ts`
3. `src/lib/prisma.js` and auth helpers under `src/lib/auth/`
4. `src/app/api/student/transcript/route.js`
5. `src/lib/student-transcript.js` or new `src/lib/transcript/*`
6. `src/app/api/student/analysis/route.js`
7. `src/app/api/student/simulation/route.js`
8. `src/lib/analysis/*`
9. `src/components/student/*`
10. `src/components/admin/*`
11. `src/app/globals.css`

## Rule For Future AI/Cursor Work

Do not generate broad new folders or mock UI before checking this file. If a proposed change conflicts with this source of truth, update the requirement discussion first, then change code only after approval.
