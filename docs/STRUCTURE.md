# โครงสร้างโปรเจกต์ APS v1

> เอกสารนี้อธิบายโครงสร้างเป้าหมายแบบ **Hybrid** (แยก feature + shared)
> ภาษา: **JavaScript** (.jsx / .js)
> สถานะ: วางโครงแล้ว — **ยังไม่ย้ายโค้ดเดิม**

---

## หลักการจัดโครงสร้าง

| โฟลเดอร์ | หน้าที่ | กฎสำคัญ |
|----------|---------|---------|
| `src/app/` | **Route เท่านั้น** — หน้ thin page, ไม่ใส่ logic ยาว | 1 route = 1 `page.jsx` |
| `src/components/` | **UI ที่มองเห็นได้** — แยก admin / student / shared | ไม่เรียก DB โดยตรง |
| `src/lib/` | **Logic + DB + คำนวณ** — prisma, analysis engine | ไม่มี JSX |
| `src/hooks/` | **Client-side state** — fetch, form, tab | ขึ้นต้น `use` |
| `src/constants/` | ค่าคงที่ — routes, enums, labels | ไม่มี logic |
| `services/` | **Service ภายนอก** — Python PDF extractor | แยก repo/runtime |
| `prisma/` | Schema, migration, seed | ไม่ใส่ business logic |

---

## โครงสร้างโฟลเดอร์

```
aps-v1/
├── docs/
│   └── STRUCTURE.md              ← เอกสารนี้
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│
├── services/
│   └── pdf-extractor/            ← Python FastAPI (อนาคต)
│       ├── main.py
│       ├── extractor/
│       └── requirements.txt
│
└── src/
    ├── app/                      ← ROUTES (thin pages)
    │   ├── layout.jsx
    │   ├── page.jsx
    │   ├── globals.css
    │   │
    │   ├── admin/                ← FR-09, FR-10
    │   │   ├── page.jsx
    │   │   ├── programs/
    │   │   ├── courses/
    │   │   ├── prerequisites/
    │   │   ├── study-plans/
    │   │   └── offerings/
    │   │
    │   ├── student/              ← FR-02 ถึง FR-08
    │   │   ├── dashboard/
    │   │   ├── roadmap/
    │   │   ├── simulation/
    │   │   └── transcript-tools/
    │   │
    │   └── api/                  ← Backend API Routes
    │       ├── programs/
    │       ├── courses/
    │       ├── prerequisites/
    │       ├── study-plans/
    │       ├── offerings/
    │       ├── transcript/
    │       ├── analysis/
    │       └── auth/
    │
    ├── components/
    │   ├── ui/                   ← Shared UI (Button, Card, Table, Modal, Tabs)
    │   ├── layout/               ← Header, Sidebar, PageHeader, AuthGuard
    │   ├── admin/                ← ProgramList, CourseForm, PrerequisiteEditor...
    │   └── student/              ← DashboardStats, RoadmapGrid, WhatIfPanel...
    │
    ├── lib/
    │   ├── prisma.js             ← Prisma singleton (ใช้ร่วมทุก API)
    │   ├── api-response.js       ← { success, data, error } helper
    │   └── analysis/             ← Analysis Engine
    │       ├── degree-audit.js
    │       ├── credit-calculator.js
    │       ├── gpax-calculator.js
    │       ├── prerequisite-graph.js
    │       ├── roadmap-planner.js
    │       └── risk-analyzer.js
    │
    ├── hooks/
    │   ├── use-programs.js
    │   ├── use-courses.js
    │   └── use-transcript.js
    │
    └── constants/
        ├── routes.js             ← path constants
        └── enums.js              ← role, grade, semester, study_track
```

---

## วิธีหาไฟล์ — Cheat Sheet

| ต้องการแก้... | ไปที่... |
|---------------|----------|
| หน้า Admin จัดการหลักสูตร | `src/app/admin/programs/page.jsx` + `src/components/admin/` |
| ปุ่ม/ตาราง/Modal ใช้ซ้ำ | `src/components/ui/` |
| API ดึงข้อมูลหลักสูตร | `src/app/api/programs/route.js` |
| คำนวณ GPAX / วิเคราะห์หลักสูตร | `src/lib/analysis/` |
| เชื่อมต่อ PostgreSQL | `src/lib/prisma.js` |
| สกัด PDF | `services/pdf-extractor/` |
| Schema ฐานข้อมูล | `prisma/schema.prisma` |

---

## กฎการแยก Component

### 1. `src/app/**/page.jsx` — Thin Page
```jsx
// ✅ ถูก — แค่ compose components
import { ProgramList } from '@/components/admin/program-list';
export default function ProgramsPage() {
  return <ProgramList />;
}

// ❌ ผิด — logic + UI + fetch รวมใน page
export default function ProgramsPage() {
  const [data, setData] = useState([]);
  useEffect(() => { fetch(...).then(...) }, []);
  return <div>{/* 100 บรรทัด */}</div>;
}
```

### 2. `src/components/admin/` — Admin UI เฉพาะ
- `program-list.jsx`, `program-form.jsx`
- `course-table.jsx`, `course-form.jsx`
- `prerequisite-editor.jsx`
- `study-plan-builder.jsx`
- `offering-calendar.jsx`
- `admin-tabs.jsx`, `publish-checklist.jsx`

### 3. `src/components/student/` — Student UI เฉพาะ
- `dashboard-stats.jsx`, `credit-summary.jsx`
- `roadmap-grid.jsx`, `course-status-card.jsx`
- `transcript-preview-table.jsx`
- `what-if-panel.jsx`, `simulation-result.jsx`

### 4. `src/components/ui/` — ใช้ร่วมทั้งระบบ
- `button.jsx`, `card.jsx`, `table.jsx`
- `modal.jsx`, `tabs.jsx`, `badge.jsx`
- `loading-spinner.jsx`, `empty-state.jsx`

### 5. `src/components/layout/` — โครงหน้า
- `app-header.jsx`, `admin-sidebar.jsx`
- `student-navbar.jsx`, `page-header.jsx`

---

## การตั้งชื่อไฟล์

| ประเภท | รูปแบบ | ตัวอย่าง |
|--------|--------|----------|
| Component | `kebab-case.jsx` | `program-list.jsx` |
| Hook | `use-*.js` | `use-programs.js` |
| Lib/Util | `kebab-case.js` | `degree-audit.js` |
| API Route | `route.js` | `src/app/api/programs/route.js` |
| Constant | `kebab-case.js` | `routes.js` |

---

## Import Path (แนะนำตั้งใน jsconfig.json)

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

ใช้ import แบบนี้:
```js
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/prisma';
import { ROUTES } from '@/constants/routes';
```

---

## สถานะปัจจุบัน vs เป้าหมาย

| ไฟล์เดิม | สถานะ | ย้ายไป (เมื่อพร้อม) |
|----------|--------|---------------------|
| `src/app/admin/page.jsx` | ยังอยู่เดิม (logic รวม) | แยกเป็น `components/admin/*` + thin page |
| `src/app/api/programs/route.js` | ยังอยู่เดิม | ใช้ `@/lib/prisma.js` แทน duplicate client |
| `src/app/page.jsx` | redirect `/admin` | คงไว้หรือเปลี่ยนเป็น landing |

---

## ขั้นตอนถัดไป (ต้องถามก่อนทุกครั้ง)

1. **ย้าย Admin page** — แยก tabs, program list เป็น components
2. **สร้าง `lib/prisma.js`** — ลบ duplicate Prisma client ใน API routes
3. **ตั้ง `jsconfig.json`** — alias `@/`
4. **สร้าง UI components พื้นฐาน** — Button, Card, Tabs
5. **แยก Admin เป็น sub-routes** — `/admin/programs`, `/admin/courses` ...

---

## คำตอบ: ต้องเป็น Component ใช่ไหม?

**ใช่ — แต่ไม่ใช่แค่ component**

```
Component  = ส่วนที่มองเห็น (UI)
lib/       = ส่วนคิด (logic, คำนวณ, DB)
app/       = ส่วนเส้นทาง (route บางๆ)
hooks/     = ส่วนจัด state ฝั่ง client
api/       = ส่วน backend
```

Component ช่วยให้ **หา UI ง่าย** แต่ถ้าใส่ logic ทั้งหมดใน component ก็จะเละเหมือนเดิม
Hybrid แยก **UI (components)** กับ **Logic (lib)** ออกจากกันชัดเจน
