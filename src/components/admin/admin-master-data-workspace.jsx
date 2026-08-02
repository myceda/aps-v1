'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminEntities } from '../../lib/admin-master-data.js';

const entityOrder = [
  'programs',
  'courses',
  'program-structures',
  'program-courses',
  'prerequisites',
  'study-plans',
  'course-offerings',
  'rules',
  'publish-readiness',
];

const entityLabels = {
  programs: 'Programs',
  courses: 'Courses',
  'program-structures': 'ProgramStructure',
  'program-courses': 'ProgramCourse',
  prerequisites: 'Prerequisites',
  'study-plans': 'StudyPlans',
  'course-offerings': 'CourseOfferings',
  rules: 'Rules',
  'publish-readiness': 'Publish checklist',
};

const emptyCounts = Object.fromEntries(entityOrder.map((key) => [key, 0]));

function createInitialForm(config) {
  return Object.fromEntries(
    config.fields.map((field) => {
      if (field.type === 'boolean') return [field.name, true];
      if (field.type === 'json') return [field.name, '{\n  "type": "custom"\n}'];
      if (field.options) return [field.name, field.options[0]];
      return [field.name, ''];
    }),
  );
}

function getRecordTitle(record, entityKey) {
  if (entityKey === 'programs') return `${record.program_code} ${record.program_name_th}`;
  if (entityKey === 'courses') return `${record.course_code} ${record.course_name_th}`;
  if (entityKey === 'program-structures') return `${record.program?.program_code || ''} ${record.category_name}`;
  if (entityKey === 'program-courses') return `${record.course?.course_code || ''} ${record.course?.course_name_th || ''}`;
  if (entityKey === 'prerequisites') return `${record.requiredCourse?.course_code || '-'} -> ${record.course?.course_code || '-'}`;
  if (entityKey === 'study-plans') return `${record.program?.program_code || ''} ปี ${record.year_level}/${record.semester}`;
  if (entityKey === 'course-offerings') return `${record.course?.course_code || ''} ${record.academic_year}/${record.semester}`;
  if (entityKey === 'rules') return `${record.rule_code} ${record.rule_name}`;
  return Object.values(record).filter(Boolean).slice(0, 2).join(' ');
}

function stringifyValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'ใช่' : 'ไม่ใช่';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getLookupLabel(row, field) {
  if (field.source === 'courses') return `${row.course_code} ${row.course_name_th || row.course_name_en || ''}`;
  if (field.source === 'programs') return `${row.program_code} ${row.program_name_th || row.program_name_en || ''}`;
  if (field.source === 'program-structures') return `${row.category_name} (${row.category_type || '-'})`;
  return row[field.labelField] || row[field.valueField];
}

function collectCounts(allData) {
  return entityOrder.reduce((counts, key) => {
    counts[key] = Array.isArray(allData[key]) ? allData[key].length : 0;
    return counts;
  }, { ...emptyCounts });
}

function buildReadinessItems(counts) {
  return [
    { label: 'มีหลักสูตรอย่างน้อย 1 รายการ', done: counts.programs > 0 },
    { label: 'มีคลังรายวิชาอย่างน้อย 1 รายการ', done: counts.courses > 0 },
    { label: 'กำหนดโครงสร้างหลักสูตรแล้ว', done: counts['program-structures'] > 0 },
    { label: 'ผูกรายวิชาเข้ากับหลักสูตรแล้ว', done: counts['program-courses'] > 0 },
    { label: 'มีเงื่อนไขวิชาบังคับก่อนให้ตรวจสอบ', done: counts.prerequisites > 0 },
    { label: 'มีแผนการเรียนแนะนำ', done: counts['study-plans'] > 0 },
    { label: 'มีข้อมูลรายวิชาที่เปิดสอน', done: counts['course-offerings'] > 0 },
    { label: 'มีกติกาการวิเคราะห์สำหรับระบบ', done: counts.rules > 0 },
  ];
}

export default function AdminMasterDataWorkspace() {
  const [activeKey, setActiveKey] = useState('programs');
  const [records, setRecords] = useState([]);
  const [lookups, setLookups] = useState({});
  const [allData, setAllData] = useState({});
  const [formData, setFormData] = useState(createInitialForm(adminEntities.programs));
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const activeConfig = adminEntities[activeKey];
  const counts = useMemo(() => collectCounts(allData), [allData]);
  const readinessItems = useMemo(() => buildReadinessItems(counts), [counts]);
  const readinessPercent = Math.round((readinessItems.filter((item) => item.done).length / readinessItems.length) * 100);

  const loadEntity = useCallback(async (entityKey = activeKey) => {
    if (entityKey === 'publish-readiness') return;
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`/api/admin/master-data?entity=${entityKey}`, { cache: 'no-store' });
      const result = await response.json();

      if (!result.success) {
        setMessage(result.error || 'โหลดข้อมูลไม่สำเร็จ');
        return;
      }

      setRecords(result.data);
      setLookups(result.lookups || {});
      setAllData(result.lookups || {});
    } catch (error) {
      setMessage(error.message || 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [activeKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadEntity(activeKey);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeKey, loadEntity]);

  function changeStep(nextKey) {
    setActiveKey(nextKey);
    setEditingId(null);
    setMessage('');

    if (adminEntities[nextKey]) {
      setFormData(createInitialForm(adminEntities[nextKey]));
    }
  }

  function updateField(name, value) {
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');

    const method = editingId ? 'PUT' : 'POST';
    const payload = editingId ? { ...formData, [activeConfig.idField]: editingId } : formData;

    try {
      const response = await fetch(`/api/admin/master-data?entity=${activeKey}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!result.success) {
        setMessage(result.errors?.join(', ') || result.error || 'บันทึกไม่สำเร็จ');
        return;
      }

      setMessage(editingId ? 'แก้ไขข้อมูลเรียบร้อย' : 'เพิ่มข้อมูลเรียบร้อย');
      setEditingId(null);
      setFormData(createInitialForm(activeConfig));
      await loadEntity(activeKey);
    } catch (error) {
      setMessage(error.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(record) {
    const nextForm = {};
    for (const field of activeConfig.fields) {
      const value = record[field.name];
      nextForm[field.name] = field.type === 'json' ? JSON.stringify(value || {}, null, 2) : value ?? '';
    }
    setEditingId(record[activeConfig.idField]);
    setFormData(nextForm);
    setMessage('กำลังแก้ไขรายการที่เลือก');
  }

  async function handleDelete(record) {
    const id = record[activeConfig.idField];
    const confirmed = window.confirm(`ยืนยันลบ ${getRecordTitle(record, activeKey)} หรือไม่`);
    if (!confirmed) return;

    setSaving(true);
    setMessage('');

    try {
      const response = await fetch(`/api/admin/master-data?entity=${activeKey}&id=${id}`, { method: 'DELETE' });
      const result = await response.json();

      if (!result.success) {
        setMessage(result.error || 'ลบไม่สำเร็จ');
        return;
      }

      setMessage('ลบข้อมูลเรียบร้อย');
      await loadEntity(activeKey);
    } catch (error) {
      setMessage(error.message || 'ลบไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setFormData(createInitialForm(activeConfig));
    setMessage('');
  }

  function renderField(field) {
    const baseClass = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100';

    if (field.type === 'textarea' || field.type === 'json') {
      return (
        <textarea
          className={`${baseClass} min-h-24 resize-y`}
          value={formData[field.name] ?? ''}
          required={field.required}
          onChange={(event) => updateField(field.name, event.target.value)}
        />
      );
    }

    if (field.type === 'select') {
      return (
        <select
          className={baseClass}
          value={formData[field.name] ?? field.options[0]}
          required={field.required}
          onChange={(event) => updateField(field.name, event.target.value)}
        >
          {field.options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      );
    }

    if (field.type === 'relation') {
      const options = lookups[field.source] || [];
      return (
        <select
          className={baseClass}
          value={formData[field.name] ?? ''}
          required={field.required}
          onChange={(event) => updateField(field.name, event.target.value)}
        >
          <option value="">เลือกรายการ</option>
          {options.map((option) => (
            <option key={option[field.valueField]} value={option[field.valueField]}>
              {getLookupLabel(option, field)}
            </option>
          ))}
        </select>
      );
    }

    if (field.type === 'boolean') {
      return (
        <label className="inline-flex min-h-10 items-center gap-3 rounded-md border border-slate-300 px-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={Boolean(formData[field.name])}
            onChange={(event) => updateField(field.name, event.target.checked)}
          />
          เปิดใช้งาน
        </label>
      );
    }

    return (
      <input
        className={baseClass}
        type={field.type}
        value={formData[field.name] ?? ''}
        required={field.required}
        min={field.type === 'number' ? 0 : undefined}
        onChange={(event) => updateField(field.name, event.target.value)}
      />
    );
  }

  function renderReadiness() {
    return (
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-md border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Publish readiness checklist</h2>
              <p className="mt-1 text-sm text-slate-600">ตรวจความพร้อมข้อมูลก่อนปล่อยให้ฝั่งนักศึกษาและ advisor ใช้งาน</p>
            </div>
            <span className="rounded-md bg-emerald-100 px-3 py-2 text-sm font-bold text-emerald-800">{readinessPercent}% พร้อม</span>
          </div>

          <div className="mt-6 grid gap-3">
            {readinessItems.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 rounded-md border border-slate-200 px-4 py-3">
                <span className="text-sm font-medium text-slate-800">{item.label}</span>
                <span className={`rounded-md px-2 py-1 text-xs font-bold ${item.done ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {item.done ? 'ผ่าน' : 'ต้องเติม'}
                </span>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-md border border-slate-200 bg-slate-950 p-5 text-white">
          <h3 className="text-base font-bold">สรุปจำนวนข้อมูล</h3>
          <div className="mt-4 grid gap-3">
            {entityOrder.filter((key) => adminEntities[key]).map((key) => (
              <div key={key} className="flex items-center justify-between border-b border-white/10 pb-2 text-sm">
                <span className="text-slate-300">{entityLabels[key]}</span>
                <span className="font-bold">{counts[key] || 0}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2 border-b border-slate-200 pb-5">
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Phase 1: Admin Master Data</p>
          <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">ระบบจัดการข้อมูลหลักสูตรแบบไม่เขียนโค้ด</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            เพิ่ม แก้ไข ลบ และตรวจความพร้อมของข้อมูล Programs, Courses, ProgramStructure, ProgramCourse,
            Prerequisites, StudyPlans, CourseOfferings และ Rules จากหน้าจอเดียว
          </p>
        </header>

        <nav className="grid gap-2 md:grid-cols-3 xl:grid-cols-9" aria-label="Admin master data steps">
          {entityOrder.map((key, index) => (
            <button
              key={key}
              type="button"
              onClick={() => changeStep(key)}
              className={`min-h-20 rounded-md border px-3 py-3 text-left transition ${
                activeKey === key
                  ? 'border-emerald-700 bg-emerald-700 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'
              }`}
            >
              <span className="block text-xs font-bold opacity-80">Step {index + 1}</span>
              <span className="mt-1 block text-sm font-bold leading-snug">{entityLabels[key]}</span>
              {adminEntities[key] && (
                <span className="mt-2 inline-flex rounded-md bg-black/10 px-2 py-1 text-xs font-semibold">
                  {counts[key] || 0} รายการ
                </span>
              )}
            </button>
          ))}
        </nav>

        {activeKey === 'publish-readiness' ? (
          renderReadiness()
        ) : (
          <section className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
            <form onSubmit={handleSubmit} className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    {editingId ? 'แก้ไข' : 'เพิ่ม'}{activeConfig.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">ฟอร์มแบบ no-code สำหรับผู้ดูแลระบบ</p>
                </div>
                {editingId && (
                  <button type="button" onClick={cancelEdit} className="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700">
                    ยกเลิก
                  </button>
                )}
              </div>

              <div className="mt-5 grid gap-4">
                {activeConfig.fields.map((field) => (
                  <label key={field.name} className="grid gap-2">
                    <span className="text-sm font-bold text-slate-700">
                      {field.label}
                      {field.required && <span className="text-rose-600"> *</span>}
                    </span>
                    {renderField(field)}
                  </label>
                ))}
              </div>

              {message && (
                <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="mt-5 w-full rounded-md bg-emerald-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {saving ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มข้อมูล'}
              </button>
            </form>

            <div className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-950">รายการ{activeConfig.title}</h2>
                  <p className="mt-1 text-sm text-slate-600">{records.length} รายการในฐานข้อมูล</p>
                </div>
                <button
                  type="button"
                  onClick={() => loadEntity(activeKey)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 hover:border-emerald-500"
                >
                  โหลดใหม่
                </button>
              </div>

              {loading ? (
                <p className="mt-8 text-sm text-slate-500">กำลังโหลดข้อมูล...</p>
              ) : records.length === 0 ? (
                <div className="mt-8 rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  ยังไม่มีข้อมูลในขั้นตอนนี้
                </div>
              ) : (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                        <th className="px-3 py-3">รายการ</th>
                        {activeConfig.fields.slice(0, 4).map((field) => (
                          <th key={field.name} className="px-3 py-3">{field.label}</th>
                        ))}
                        <th className="px-3 py-3 text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => (
                        <tr key={record[activeConfig.idField]} className="border-b border-slate-100 align-top">
                          <td className="max-w-64 px-3 py-3 font-bold text-slate-900">{getRecordTitle(record, activeKey)}</td>
                          {activeConfig.fields.slice(0, 4).map((field) => (
                            <td key={field.name} className="max-w-56 px-3 py-3 text-slate-600">
                              {stringifyValue(record[field.name])}
                            </td>
                          ))}
                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => handleEdit(record)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">
                                แก้ไข
                              </button>
                              <button type="button" onClick={() => handleDelete(record)} className="rounded-md border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">
                                ลบ
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
