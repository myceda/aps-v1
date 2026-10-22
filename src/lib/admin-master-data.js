export const adminEntities = {
  programs: {
    title: 'หลักสูตร',
    model: 'program',
    idField: 'program_id',
    orderBy: [{ curriculum_year: 'desc' }, { program_code: 'asc' }],
    include: {
      _count: {
        select: {
          structures: true,
          programCourses: true,
          studyPlans: true,
          courseOfferings: true,
        },
      },
    },
    fields: [
      { name: 'program_code', label: 'รหัสหลักสูตร', type: 'text', required: true },
      { name: 'program_name_th', label: 'ชื่อหลักสูตรภาษาไทย', type: 'text', required: true },
      { name: 'program_name_en', label: 'ชื่อหลักสูตรภาษาอังกฤษ', type: 'text', required: true },
      { name: 'curriculum_year', label: 'ปีหลักสูตร', type: 'number', required: true },
      { name: 'total_credits', label: 'หน่วยกิตรวม', type: 'number', required: true },
      { name: 'status', label: 'สถานะ', type: 'select', required: true, options: ['active', 'inactive'] },
    ],
  },
  courses: {
    title: 'รายวิชา',
    model: 'course',
    idField: 'course_id',
    orderBy: [{ course_code: 'asc' }],
    fields: [
      { name: 'course_code', label: 'รหัสวิชา', type: 'text', required: true },
      { name: 'course_name_th', label: 'ชื่อวิชาภาษาไทย', type: 'text', required: true },
      { name: 'course_name_en', label: 'ชื่อวิชาภาษาอังกฤษ', type: 'text', required: true },
      { name: 'credits', label: 'หน่วยกิต', type: 'number', required: true },
      { name: 'is_credit_counted', label: 'นับหน่วยกิต', type: 'boolean', defaultValue: true },
      { name: 'description', label: 'คำอธิบายรายวิชา', type: 'textarea' },
    ],
  },
  'program-structures': {
    title: 'โครงสร้างหลักสูตร',
    model: 'programStructure',
    idField: 'structure_id',
    orderBy: [{ category_type: 'asc' }, { category_name: 'asc' }],
    include: { program: true, _count: { select: { programCourses: true } } },
    fields: [
      { name: 'program_id', label: 'หลักสูตร', type: 'relation', source: 'programs', valueField: 'program_id', labelField: 'program_code', required: true },
      { name: 'category_name', label: 'ชื่อหมวด', type: 'text', required: true },
      { name: 'required_credits', label: 'หน่วยกิตที่ต้องผ่าน', type: 'number', required: true },
      { name: 'category_type', label: 'ประเภทหมวด', type: 'select', required: true, options: ['general', 'specific', 'free'] },
      { name: 'description', label: 'รายละเอียด', type: 'textarea' },
    ],
  },
  'program-courses': {
    title: 'รายวิชาในหลักสูตร',
    model: 'programCourse',
    idField: 'program_course_id',
    orderBy: [{ created_at: 'desc' }],
    include: { program: true, course: true, structure: true },
    fields: [
      { name: 'program_id', label: 'หลักสูตร', type: 'relation', source: 'programs', valueField: 'program_id', labelField: 'program_code', required: true },
      { name: 'course_id', label: 'รายวิชา', type: 'relation', source: 'courses', valueField: 'course_id', labelField: 'course_code', required: true },
      { name: 'structure_id', label: 'หมวดโครงสร้าง', type: 'relation', source: 'program-structures', valueField: 'structure_id', labelField: 'category_name', required: true },
      { name: 'course_type', label: 'ประเภทรายวิชา', type: 'select', required: true, options: ['required', 'elective'] },
      { name: 'study_track', label: 'แผนการเรียน', type: 'select', required: true, options: ['research', 'cooperative', 'both'] },
    ],
  },
  prerequisites: {
    title: 'วิชาบังคับก่อน',
    model: 'prerequisite',
    idField: 'prerequisite_id',
    orderBy: [{ created_at: 'desc' }],
    include: { course: true, requiredCourse: true },
    fields: [
      { name: 'course_id', label: 'วิชาปลายทาง', type: 'relation', source: 'courses', valueField: 'course_id', labelField: 'course_code', required: true },
      { name: 'required_course_id', label: 'วิชาที่ต้องผ่านก่อน', type: 'relation', source: 'courses', valueField: 'course_id', labelField: 'course_code', required: true },
      { name: 'condition_type', label: 'ประเภทเงื่อนไข', type: 'select', required: true, options: ['required', 'alternative'] },
      { name: 'minimum_grade', label: 'เกรดขั้นต่ำ', type: 'select', required: true, options: ['D', 'D+', 'C', 'C+', 'B'] },
      { name: 'description', label: 'หมายเหตุ', type: 'textarea' },
    ],
  },
  'study-plans': {
    title: 'แผนการเรียนแนะนำ',
    model: 'studyPlan',
    idField: 'study_plan_id',
    orderBy: [{ year_level: 'asc' }, { semester: 'asc' }],
    include: { program: true, studyPlanCourses: { include: { course: true }, orderBy: { recommended_order: 'asc' } } },
    fields: [
      { name: 'program_id', label: 'หลักสูตร', type: 'relation', source: 'programs', valueField: 'program_id', labelField: 'program_code', required: true },
      { name: 'study_track', label: 'แผนการเรียน', type: 'select', required: true, options: ['research', 'cooperative'] },
      { name: 'year_level', label: 'ชั้นปี', type: 'number', required: true },
      { name: 'semester', label: 'ภาคการศึกษา', type: 'select', required: true, options: ['1', '2', 'summer'] },
    ],
  },
  'course-offerings': {
    title: 'รายวิชาที่เปิดสอน',
    model: 'courseOffering',
    idField: 'offering_id',
    orderBy: [{ academic_year: 'desc' }, { semester: 'asc' }],
    include: { program: true, course: true },
    fields: [
      { name: 'program_id', label: 'หลักสูตร', type: 'relation', source: 'programs', valueField: 'program_id', labelField: 'program_code', required: true },
      { name: 'course_id', label: 'รายวิชา', type: 'relation', source: 'courses', valueField: 'course_id', labelField: 'course_code', required: true },
      { name: 'academic_year', label: 'ปีการศึกษา', type: 'number', required: true },
      { name: 'semester', label: 'ภาคการศึกษา', type: 'select', required: true, options: ['1', '2', 'summer'] },
      { name: 'status', label: 'สถานะ', type: 'select', required: true, options: ['planned', 'confirmed'] },
    ],
  },
  rules: {
    title: 'กติกาการวิเคราะห์',
    model: 'rule',
    idField: 'rule_id',
    orderBy: [{ rule_type: 'asc' }, { rule_name: 'asc' }],
    include: { program: true },
    fields: [
      { name: 'program_id', label: 'หลักสูตร', type: 'relation', source: 'programs', valueField: 'program_id', labelField: 'program_code', required: true },
      { name: 'rule_type', label: 'ประเภทกติกา', type: 'text', required: true },
      { name: 'rule_name', label: 'ชื่อกติกา', type: 'text', required: true },
      { name: 'rule_value', label: 'ค่ากติกา (JSON)', type: 'json', required: true },
      { name: 'description', label: 'คำอธิบาย', type: 'textarea' },
      { name: 'is_active', label: 'เปิดใช้งาน', type: 'boolean', defaultValue: true },
    ],
  },
};

export function getAdminEntity(entityKey) {
  return adminEntities[entityKey] || null;
}

export function getAdminEntityKeys() {
  return Object.keys(adminEntities);
}

export function buildRecordPayload(config, rawPayload) {
  const data = {};
  const errors = [];

  for (const field of config.fields) {
    const rawValue = rawPayload[field.name];
    const isEmpty = rawValue === undefined || rawValue === null || rawValue === '';

    if (field.required && isEmpty) {
      errors.push(`${field.label} จำเป็นต้องกรอก`);
      continue;
    }

    if (isEmpty) {
      if (field.type === 'boolean' && field.defaultValue !== undefined) {
        data[field.name] = field.defaultValue;
      }
      continue;
    }

    if (field.type === 'number') {
      const value = Number(rawValue);
      if (!Number.isInteger(value) || value < 0) {
        errors.push(`${field.label} ต้องเป็นตัวเลขจำนวนเต็มตั้งแต่ 0 ขึ้นไป`);
      } else {
        data[field.name] = value;
      }
      continue;
    }

    if (field.type === 'boolean') {
      if (typeof rawValue === 'boolean') {
        data[field.name] = rawValue;
      } else if (rawValue === 'true' || rawValue === 'false') {
        data[field.name] = rawValue === 'true';
      } else {
        errors.push(`${field.label} ต้องเป็นค่า true หรือ false`);
      }
      continue;
    }

    if (field.type === 'json') {
      try {
        const value = typeof rawValue === 'string' ? JSON.parse(rawValue) : rawValue;
        if (value === null) {
          errors.push(`${field.label} ต้องเป็น JSON ที่ไม่ใช่ null`);
        } else {
          data[field.name] = value;
        }
      } catch {
        errors.push(`${field.label} ต้องเป็น JSON ที่ถูกต้อง`);
      }
      continue;
    }

    if (field.options && !field.options.includes(rawValue)) {
      errors.push(`${field.label} ไม่อยู่ในตัวเลือกที่กำหนด`);
      continue;
    }

    data[field.name] = String(rawValue).trim();
  }

  return { data, errors };
}

export function serializeRecord(record) {
  return JSON.parse(
    JSON.stringify(record, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)),
  );
}
