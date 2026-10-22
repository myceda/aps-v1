# APS v1 Post-Midway Source of Truth

เอกสารนี้เป็นแหล่งอ้างอิงหลักสำหรับพัฒนา `aps-v1` ให้ตรงกับเอกสารปริญญานิพนธ์ `final.docx` เรื่องระบบวิเคราะห์ข้อมูลเพื่อสนับสนุนการวางแผนการเรียนตามหลักสูตร กรณีศึกษา ภาควิชาคอมพิวเตอร์ มหาวิทยาลัยศิลปากร

เอกสารนี้ freeze ขอบเขตหลัง Midway ณ วันที่ 16 สิงหาคม 2569 และมีลำดับความสำคัญเหนือข้อความเดิมหรือแผนเดิมที่ขัดกันใน repository ส่วนสถานะ implementation ต้องตรวจจาก code, test และ Git diff แยกต่างหาก ห้ามสรุปว่า requirement ที่ระบุในเอกสารนี้ทำเสร็จแล้วโดยอัตโนมัติ

## Post-Midway Requirement Freeze

### 1. Demo scope: CS2565 เท่านั้น

- Demo รองรับเฉพาะหลักสูตรวิทยาการคอมพิวเตอร์ หลักสูตรปรับปรุง พ.ศ. 2565 โดยใช้ชื่อ canonical ว่า `CS2565`
- `IT2565`, หลักสูตรปีอื่น และการสลับหลักสูตรอยู่นอกขอบเขต acceptance ของ demo รอบนี้
- Student API ต้องหา student และหลักสูตรจาก session ผ่าน `requireStudent()` และ `StudentProgram` เท่านั้น ห้ามรับ `student_id`, program หรือ study track ที่ client เลือกเอง
- ถ้า `StudentProgram` ไม่ได้ผูกกับ `CS2565` ให้หยุดวิเคราะห์และคืนข้อความภาษาไทยที่เข้าใจได้ ห้าม fallback ไปหลักสูตรอื่น
- Schema จะคงโครงสร้างที่รองรับหลายหลักสูตรไว้ได้เพื่ออนาคต แต่ UI, seed fixture, analysis และ test ที่ใช้ตัดสิน demo ต้องใช้ `CS2565` เท่านั้น

### 2. นิยามสถานภาพปกติ โปรสูง และโปรต่ำ

คำว่า “โปรสูง/โปรต่ำ” เป็น label ภายใน APS เพื่อสื่อระดับความเสี่ยง ไม่ใช่ชื่อสถานภาพทางการของมหาวิทยาลัย ระบบต้องแสดง GPAX และเหตุผลประกอบเสมอ ห้ามแสดง label อย่างเดียว

| สถานะใน APS | เกณฑ์ GPAX | การแสดงผล |
| --- | ---: | --- |
| ปกติ | `GPAX >= 2.00` | แสดงสถานะปกติ |
| โปรสูง | `1.80 <= GPAX < 2.00` | แสดงคำเตือนรอพินิจระดับสูงและคำแนะนำให้ปรึกษาอาจารย์ที่ปรึกษา |
| โปรต่ำ | `1.50 <= GPAX < 1.80` | แสดงคำเตือนรอพินิจระดับวิกฤตอย่างเด่นชัด |
| เข้าข่ายพ้นสภาพ | `GPAX < 1.50` | ห้ามเรียกว่าโปรต่ำ; แสดงว่า “เข้าข่ายพ้นสภาพ โปรดตรวจสอบกับงานทะเบียน” |
| ยังจำแนกไม่ได้ | ไม่มีวิชาที่นำมาคำนวณ GPAX | แสดงข้อมูลไม่เพียงพอ ห้ามตีความเป็นสถานะปกติ |

กติกาประกอบ:

- การจำแนกสถานภาพใช้ผลจาก confirmed transcript และทำเมื่อสิ้นภาคการศึกษาปกติ; summer ไม่สร้างการจำแนกสถานภาพรอบใหม่
- นักศึกษาภาคการศึกษาแรกยังไม่ถูกจำแนกจนสิ้นภาคการศึกษาที่สองนับแต่เริ่มศึกษา
- ระบบต้องเตือนเงื่อนไขเสี่ยงพ้นสภาพเพิ่มเติมเมื่อ GPAX ต่ำกว่า `1.80` ต่อเนื่อง 2 ภาคปกติ หรือ GPAX ต่ำกว่า `2.00` ต่อเนื่อง 4 ภาคปกติ
- APS เป็นระบบช่วยวางแผน ไม่ใช่คำสั่งทางทะเบียน สถานภาพจริงต้องยืนยันกับมหาวิทยาลัย

แหล่งเกณฑ์ทางการ: [ข้อบังคับมหาวิทยาลัยศิลปากร ว่าด้วยการศึกษาระดับปริญญาบัณฑิต พ.ศ. 2560](https://lawapp.su.ac.th/uploads/1-CST60-8-18_2007091526.pdf) ข้อ 15 และข้อ 22

### 3. Current term และ credit limit

- Current term สำหรับ demo นี้ตรึงเป็นปีการศึกษา `2569` ภาคการศึกษา `1` หรือ `2569/1` เพื่อให้ผลเดโมทำซ้ำได้ และห้ามคำนวณจากวันที่ของเครื่อง
- ลำดับเทอมมาตรฐานคือ `1 -> 2 -> summer -> ปีถัดไป/1`
- Transcript term ที่อยู่ก่อน current term เป็นประวัติผลการเรียน ส่วน current term และเทอมหลังจากนั้นเป็นพื้นที่วางแผน
- Credit limit ภาคปกติ (`1`, `2`) คือสูงสุด `22` หน่วยกิตต่อเทอม และ summer คือสูงสุด `9` หน่วยกิตต่อเทอม
- Demo ไม่รองรับคำร้องขอลงทะเบียนต่ำกว่า/เกินเกณฑ์เป็นกรณีพิเศษ Planner และ What-if ต้องไม่สร้างแผนเกินเพดานดังกล่าว
- รายวิชา `0` หน่วยกิตไม่ใช้โควตาหน่วยกิต แต่ยังต้องผ่าน prerequisite และ offering rule ตามปกติ

แหล่งเกณฑ์ทางการ: ข้อบังคับฉบับเดียวกัน ข้อ 30 กำหนดภาคปกติไม่เกิน 22 หน่วยกิตและ summer ไม่เกิน 9 หน่วยกิต

### 4. สูตรคำนวณ expected graduation term

ให้ `t0 = 2569/1`, `T` เป็นเทอมเรียงตาม `1 -> 2 -> summer`, `C_t` เป็นชุดวิชาที่ planner วางในเทอม `t` และ `PassedConfirmed` เป็นวิชาที่ผ่านจาก confirmed transcript เท่านั้น

```text
ProjectedPassed(t) = PassedConfirmed union C_t0 union ... union C_t

ExpectedGraduationTerm = min t in T ที่เงื่อนไขต่อไปนี้เป็นจริงทั้งหมด
1. หน่วยกิตรวมและหน่วยกิตทุกหมวดของ CS2565 ครบ
2. วิชาบังคับและเงื่อนไขของ study track ครบ
3. prerequisite ของทุกวิชาที่วางในแผนผ่านก่อนเทอมนั้น
4. ทุกวิชามี offering ที่ใช้งานได้ตามกติกา planned/confirmed
5. หน่วยกิตรวมของแต่ละเทอมไม่เกิน credit limit
6. GPAX ที่ยืนยันล่าสุดไม่น้อยกว่า 2.00 สำหรับการระบุว่า “พร้อมจบ”
```

- การ forecast สมมติว่าวิชาที่วางแผนในอนาคตจะผ่าน แต่ต้องแสดงสมมติฐานนี้ใน UI
- ถ้าครบด้านโครงสร้างหลักสูตรแต่ GPAX ยังต่ำกว่า `2.00` ให้แสดงเทอมที่หน่วยกิตคาดว่าจะครบ พร้อมสถานะ “ยังไม่พร้อมจบเพราะ GPAX” แทนการรับรองว่าจะจบ
- ถ้าหาเทอมที่ครบไม่ได้ภายใน 8 ปีนับจากปีที่เข้าศึกษา ให้คืน `null` พร้อมข้อความ “ยังประเมินไม่ได้หรือเกินกรอบ 8 ปี” ห้ามบังคับยัดวิชาลงเทอมสุดท้าย
- What-if ต้องใช้สูตรเดียวกันทั้ง before/after เพื่อให้ผลต่างของ expected graduation term เปรียบเทียบกันได้

### 5. กติกา CourseOffering: planned และ confirmed

| สถานะ | ความหมาย | ใช้ในระบบ |
| --- | --- | --- |
| `confirmed` | ยืนยันว่าเปิดสอนในปี/เทอมนั้น | ใช้วาง roadmap, คำนวณ expected graduation term และ What-if ได้ |
| `planned` | มีแผนจะเปิดแต่ยังไม่ยืนยัน | ใช้ forecast ในเทอมหลัง current term ได้ แต่ต้องติดป้าย “ยังไม่ยืนยัน” และทำให้ผล expected graduation term เป็น `tentative` |

- Current term ใช้เฉพาะ `confirmed`; `planned` ใน current term แสดงข้อมูลได้แต่ห้ามนับว่าเลือกลงได้
- หากมีทั้ง `planned` และ `confirmed` ของวิชา/ปี/เทอมเดียวกัน ให้ `confirmed` มีผลเหนือกว่า
- หากไม่มี offering row ห้ามวางวิชาในเทอมนั้น และต้องเลื่อนไปหาเทอมถัดไป
- ผลลัพธ์ต้องบอก `confidence = confirmed | tentative | unavailable` และระบุวิชาที่ทำให้ผลเป็น tentative หรือ unavailable
- Admin เท่านั้นที่เปลี่ยน offering status ได้ และการเปลี่ยนต้องทำให้ analysis/What-if รอบถัดไปคำนวณใหม่

### 6. ขอบเขตข้อมูลที่แก้ไขได้

| ผู้ใช้/ระบบ | แก้ไขได้ | แก้ไขไม่ได้ |
| --- | --- | --- |
| Student | แถว transcript ของตนเองในขั้น review ก่อน confirm: course code, academic year, semester, credits, grade; input ของ What-if และชื่อ scenario | `student_id`, program, study track, GPAX/หน่วยกิต/สถานะ/expected term ที่ระบบคำนวณ, master data และ offering |
| Admin | Master data ของ `CS2565`: course, program structure, program course, prerequisite, study plan, course offering และ rule ผ่าน admin UI | Transcript/grade ของนักศึกษาและผล analysis โดยตรง |
| System | สร้างค่าคำนวณและบันทึกผลจาก source data ที่ผ่าน validation | แก้ source data เพื่อทำให้ผลลัพธ์ผ่าน |

- หลัง student กด confirm แล้ว confirmed grade เป็นข้อมูลสำหรับวิเคราะห์และแก้ตรง ๆ ไม่ได้ หากข้อมูลผิดให้ upload/review/confirm ฉบับใหม่โดยเก็บ audit trail ของฉบับเดิม
- ทุก write API ต้องตรวจ session/role, ownership, allow-list field, type/range และ referential integrity ฝั่ง server
- ห้ามให้ client ส่งค่าคำนวณสำเร็จรูป เช่น GPAX, credits earned, academic status หรือ expected graduation term มาบันทึกแทนการคำนวณ server-side

### 7. Demo acceptance criteria

Demo ถือว่าผ่านเมื่อทำรายการต่อไปนี้ได้ครบด้วยข้อมูล `CS2565` และผลลัพธ์ทำซ้ำได้:

- [ ] Login เป็น student แล้วทุก student API ใช้ identity จาก session และไม่สามารถอ่าน/แก้ข้อมูลของนักศึกษาคนอื่น
- [ ] Upload transcript จริง ได้ preview/review แก้เฉพาะ field ที่อนุญาต และ confirm ก่อนสร้าง effective grades
- [ ] Analysis ใช้เฉพาะ `CS2565` และปฏิเสธ student ที่ไม่มี `StudentProgram` ของ `CS2565`
- [ ] แสดง passed, failed, withdrawn, repeated, pending และ remaining ได้ถูกต้องโดยไม่นับหน่วยกิตหรือ GPAX ซ้ำ
- [ ] แสดงสถานะปกติ/โปรสูง/โปรต่ำ/เข้าข่ายพ้นสภาพตาม threshold และกติกาภาคการศึกษาที่ freeze ไว้
- [ ] Roadmap เริ่มที่ `2569/1`, ครบเทอม `1`, `2`, `summer`, ไม่เกิน 22/22/9 หน่วยกิต และไม่เกินกรอบ 8 ปี
- [ ] Roadmap เคารพ prerequisite และ CourseOffering; `planned` ถูกติดป้าย tentative และไม่ถูกใช้ใน current term
- [ ] Expected graduation term ใช้สูตรเดียวกับเอกสารนี้ และคืน unavailable อย่างซื่อสัตย์เมื่อข้อมูลไม่พอหรือเกิน 8 ปี
- [ ] What-if add/drop/fail แสดง before/after ของ GPAX, หน่วยกิต, prerequisite, offering confidence และ expected graduation term โดยไม่แก้ confirmed transcript
- [ ] Admin แก้ master data ของ `CS2565` และเปลี่ยน planned/confirmed ผ่าน UI ได้ โดย student แก้ไม่ได้
- [ ] เส้นทางเดโมหลักไม่มี mock student/program, ไม่มี client-selected identity และแสดง error ภาษาไทยโดยไม่เปิดเผยข้อมูลภายใน
- [ ] `npm run lint`, relevant automated tests และ manual demo checklist ผ่าน พร้อมตรวจ Git diff ว่าไม่มี secret หรือการแก้ไฟล์นอก scope

## Product Goal

APS v1 ต้องเป็นระบบช่วยนักศึกษาและผู้ดูแลระบบวางแผนการเรียนจากข้อมูลจริง ไม่ใช่ mockup หรือ dashboard สาธิต

เป้าหมายหลัก:

- นักศึกษาเข้าสู่ระบบด้วย Google OAuth แล้วเห็นข้อมูลของตัวเองเท่านั้น
- นักศึกษาอัปโหลด Transcript PDF, ตรวจทานข้อมูลที่สกัดได้, แก้ไขเองได้ และยืนยันก่อนบันทึก
- ระบบวิเคราะห์ผลการเรียนเทียบกับหลักสูตร `CS2565` ตามโครงสร้างหลักสูตรจริง
- ระบบคำนวณ GPAX, GPA รายเทอม, หน่วยกิตที่ผ่าน, หน่วยกิตที่ขาด, รายวิชาที่ยังไม่ผ่าน, รายวิชาที่ถอน และรายวิชาที่ติด prerequisite
- ระบบคาดการณ์แผนเรียนในอนาคตและเทอมที่คาดว่าจะจบจากรายวิชาคงเหลือ, prerequisite และ course offering จริง
- นักศึกษาทำ What-if Simulation เช่น add, drop, fail แล้วเห็นผลกระทบก่อนและหลัง ทั้ง GPAX, หน่วยกิต, prerequisite, course offering และ expected graduation term
- ผู้ดูแลระบบจัดการข้อมูลหลักสูตร รายวิชา หมวดวิชา prerequisite study plan course offering และ rule ผ่าน no-code workflow
- ผู้ดูแลระบบตรวจ readiness ก่อน publish ข้อมูลให้ฝั่งนักศึกษาใช้วิเคราะห์

## Requirement Source Freeze

เอกสาร requirement พื้นฐานของ APS v1 คือ `C:\Users\MyLuna\thesis-doc-1_69\final.docx` และส่วน Post-Midway Requirement Freeze ด้านบนเป็นข้อกำหนดล่าสุดที่ใช้ตัดสิน demo หากข้อความขัดกันให้ยึดส่วน Post-Midway

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
- [ ] รองรับเฉพาะ `CS2565` ใน demo และปฏิเสธหลักสูตรอื่นอย่างชัดเจน
- [ ] ผลลัพธ์แยก required/elective/category ตาม schema
- [ ] API ส่งคืนผล degree audit ใน JSON shape มาตรฐาน `{ success, data, error }`
- [ ] Test ครอบคลุมนักศึกษา `CS2565` ทั้ง research/cooperative track และกรณี student ไม่ได้ผูก `CS2565`

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
| FR-03 | เปรียบเทียบผลการเรียนกับโครงสร้างหลักสูตรและ track | `Program`, `ProgramStructure`, `Course`, `ProgramCourse`, `StudentProgram` | `src/app/api/student/analysis/route.js`, `src/lib/analysis/degree-audit.js`, `src/lib/analysis/index.js` | `src/app/student/dashboard/page.jsx`, `src/components/student/student-dashboard-workspace.jsx` | Analysis tests for CS2565, research/cooperative track, required/elective/category matching และ reject non-CS2565 |
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
| ความยืดหยุ่น | Demo รองรับ `CS2565` เท่านั้นและรองรับ research/cooperative track; schema คงความสามารถขยายหลักสูตรในอนาคตได้ |
| ความปลอดภัย | Student เห็นเฉพาะข้อมูลตัวเอง Admin จัดการ master data ได้ตามสิทธิ์ |
| ความสามารถในการตรวจทาน | Transcript ที่สกัดได้ต้องมีสถานะ needs_review/success และต้องให้ผู้ใช้ยืนยันก่อนวิเคราะห์ |
| ความเหมาะสมต่อการวางแผน | ผลลัพธ์ต้องช่วยตัดสินใจลงทะเบียนจริง เช่น วิชาที่ควรลงก่อน ความเสี่ยง และเทอมจบที่เปลี่ยนไป |

## Target Architecture

```text
aps-v1/
  prisma/
    schema.prisma                 Database schema that must match thesis data dictionary
    seed.ts                       Realistic CS2565 seed data and test scenarios
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
- Demo ต้องใช้ `CS2565` จาก `StudentProgram`; ห้ามรับ program ที่ client เลือกเองหรือ fallback ไปหลักสูตรอื่น
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

รายการนี้คือ delta ที่ตรวจพบระหว่าง requirement freeze กับ implementation ปัจจุบัน ไม่ใช่ผล audit ครบระบบ:

- Seed และ catalog ยังมี IT2565; เส้นทาง demo ต้องจำกัดและทดสอบ `CS2565` ให้ชัด
- Risk analyzer ปัจจุบันแยกเพียง normal/probation และยังไม่รองรับโปรสูง โปรต่ำ เข้าข่ายพ้นสภาพ รวมถึงเงื่อนไขต่อเนื่องหลายภาค
- Roadmap ปัจจุบันเริ่มจากปี 1, ใช้เงื่อนไขจัดวิชาแบบประมาณ 15 หน่วยกิต และยังไม่ใช้ current term `2569/1` กับเพดาน 22/22/9 ตาม freeze นี้
- Roadmap/expected graduation term ยังไม่บังคับ CourseOffering `planned`/`confirmed`, confidence และกรณี unavailable ตามกติกาใหม่
- ต้องเพิ่ม automated test และ manual demo evidence สำหรับ acceptance checklist ในส่วน Post-Midway
- ห้ามสรุป gap อื่นจากรายการนี้โดยไม่ตรวจ code, database และ browser flow ปัจจุบันอีกครั้ง

## Implementation Order

Work must be done in small verified slices

1. Approve this Post-Midway source of truth
2. Enforce `CS2565` scope from session-derived `StudentProgram` and add reject tests for non-CS2565
3. Implement academic status thresholds and consecutive-term warnings with focused unit tests
4. Implement current term `2569/1`, term ordering and credit limits 22/22/9 in one planner slice
5. Add CourseOffering planned/confirmed/unavailable behavior and confidence output
6. Replace expected graduation term logic with the frozen formula and 8-year boundary
7. Make What-if reuse the same planner/formula without mutating confirmed transcript
8. Align student/admin UI labels and editable fields with the frozen rules
9. Run automated checks, browser/manual demo checklist and review Git diff before declaring demo acceptance

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
