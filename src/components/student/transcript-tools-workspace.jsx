'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  allowedGrades,
  allowedSemesters,
  createEmptyTranscriptRow,
  createPreviewRowsFromFile,
  validateTranscriptRows,
} from '../../lib/student-transcript.js';

const fieldClass = 'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100';

function SummaryMetric({ label, value, tone = 'default' }) {
  const toneClass = tone === 'warning'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : 'border-slate-200 bg-white text-slate-900';

  return (
    <div className={`rounded-md border px-4 py-3 ${toneClass}`}>
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function TranscriptToolsWorkspace() {
  const [fileInfo, setFileInfo] = useState(null);
  const [rows, setRows] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [saveSummary, setSaveSummary] = useState(null);

  useEffect(() => {
    async function loadCourses() {
      try {
        const response = await fetch('/api/student/transcript', { cache: 'no-store' });
        const result = await response.json();
        if (result.success) {
          setCourses(result.data.courses || []);
        } else {
          setMessage(result.error || 'โหลดคลังรายวิชาไม่สำเร็จ');
        }
      } catch (error) {
        setMessage(error.message || 'โหลดคลังรายวิชาไม่สำเร็จ');
      } finally {
        setLoadingCourses(false);
      }
    }

    loadCourses();
  }, []);

  const validation = useMemo(() => validateTranscriptRows(rows, courses), [rows, courses]);
  const canSave = rows.length > 0 && validation.summary.issueRows === 0 && !saving;

  function handleFileChange(event) {
    const file = event.target.files?.[0];
    setMessage('');
    setSaveSummary(null);

    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setMessage('กรุณาอัปโหลดไฟล์ PDF เท่านั้น');
      setFileInfo(null);
      setRows([]);
      return;
    }

    setFileInfo({
      name: file.name,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      lastModified: new Date(file.lastModified).toLocaleDateString('th-TH'),
    });
    setRows(createPreviewRowsFromFile(file));
  }

  function updateRow(index, field, value) {
    setRows((currentRows) => currentRows.map((row, rowIndex) => (
      rowIndex === index ? { ...row, [field]: value } : row
    )));
    setSaveSummary(null);
  }

  function addRow() {
    setRows((currentRows) => [...currentRows, createEmptyTranscriptRow()]);
    setSaveSummary(null);
  }

  function removeRow(index) {
    setRows((currentRows) => currentRows.filter((_row, rowIndex) => rowIndex !== index));
    setSaveSummary(null);
  }

  async function saveTranscript() {
    setSaving(true);
    setMessage('');
    setSaveSummary(null);

    try {
      const response = await fetch('/api/student/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: fileInfo?.name || 'manual-transcript.pdf',
          rows,
        }),
      });
      const result = await response.json();

      if (!result.success) {
        setMessage(result.error || 'บันทึกไม่สำเร็จ');
        return;
      }

      setSaveSummary(result.data);
      setMessage('บันทึก transcript เรียบร้อยแล้ว');
    } catch (error) {
      setMessage(error.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-2 border-b border-slate-200 pb-5">
          <p className="text-sm font-bold uppercase tracking-wide text-indigo-700">Phase 2: Student Transcript</p>
          <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">เครื่องมืออัปโหลดและตรวจ transcript</h1>
          <p className="max-w-3xl text-sm text-slate-600">
            อัปโหลด PDF เพื่อสร้างตารางตรวจทาน แก้ข้อมูลให้ถูกต้อง แล้วบันทึกเกรดที่ยืนยันแล้วเข้าสู่ระบบ APS
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <SummaryMetric label="รายการทั้งหมด" value={validation.summary.totalRows} />
          <SummaryMetric label="พร้อมบันทึก" value={validation.summary.validRows} tone="success" />
          <SummaryMetric label="ต้องแก้ไข" value={validation.summary.issueRows} tone={validation.summary.issueRows > 0 ? 'warning' : 'default'} />
          <SummaryMetric label="หน่วยกิตผ่าน" value={validation.summary.earnedCredits} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">1. อัปโหลด PDF</h2>
            <p className="mt-1 text-sm text-slate-600">
              ระบบจะสร้าง preview เบื้องต้นให้ก่อน ต้องตรวจและแก้ไขเองก่อนบันทึกทุกครั้ง
            </p>

            <label className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-indigo-200 bg-indigo-50 px-4 py-6 text-center transition hover:border-indigo-400">
              <span className="text-sm font-bold text-indigo-800">เลือกไฟล์ transcript PDF</span>
              <span className="mt-1 text-xs text-indigo-700">รองรับเฉพาะ .pdf ใน Phase 2</span>
              <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={handleFileChange} />
            </label>

            {fileInfo && (
              <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-bold text-slate-900">{fileInfo.name}</p>
                <p className="mt-1 text-slate-600">{fileInfo.sizeKb} KB · แก้ไขล่าสุด {fileInfo.lastModified}</p>
                <p className="mt-3 rounded-md bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-900">
                  Extraction ตอนนี้เป็นข้อมูลตั้งต้นสำหรับตรวจทาน ยังไม่ใช่ OCR/PDF parser เต็มรูปแบบ
                </p>
              </div>
            )}

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={addRow}
                className="rounded-md border border-slate-300 px-4 py-3 text-sm font-bold text-slate-800 transition hover:border-indigo-500"
              >
                เพิ่มแถวเอง
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={saveTranscript}
                className="rounded-md bg-indigo-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {saving ? 'กำลังบันทึก...' : 'บันทึก transcript'}
              </button>
            </div>

            {loadingCourses && <p className="mt-4 text-sm text-slate-500">กำลังโหลดคลังรายวิชา...</p>}
            {message && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {message}
              </div>
            )}
            {saveSummary && (
              <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
                <p className="font-bold">สรุปหลังบันทึก</p>
                <p className="mt-1">บันทึก {saveSummary.savedRows} รายการ · ผ่าน {saveSummary.earnedCredits}/{saveSummary.totalCredits} หน่วยกิต</p>
                <a
                  href="/student/dashboard"
                  className="mt-3 inline-flex rounded-md bg-emerald-700 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-800"
                >
                  ไปหน้า Dashboard นักศึกษา
                </a>
              </div>
            )}
          </aside>

          <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">2. Preview table ก่อนบันทึก</h2>
                <p className="mt-1 text-sm text-slate-600">
                  ตรวจ course code, semester, credits และเกรดซ้ำในตารางนี้
                </p>
              </div>
              <span className="rounded-md bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">
                คลังวิชา {courses.length} รายการ
              </span>
            </div>

            {rows.length === 0 ? (
              <div className="mt-8 rounded-md border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                ยังไม่มีข้อมูล transcript ให้เริ่มจากอัปโหลด PDF หรือเพิ่มแถวเอง
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[920px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                      <th className="px-3 py-3">รหัสวิชา</th>
                      <th className="px-3 py-3">ชื่อวิชา</th>
                      <th className="px-3 py-3">ปี</th>
                      <th className="px-3 py-3">เทอม</th>
                      <th className="px-3 py-3">หน่วยกิต</th>
                      <th className="px-3 py-3">เกรด</th>
                      <th className="px-3 py-3">Validation</th>
                      <th className="px-3 py-3 text-right">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.rows.map((row, index) => (
                      <tr key={`${index}-${row.course_code}`} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-3">
                          <input className={fieldClass} value={rows[index].course_code} onChange={(event) => updateRow(index, 'course_code', event.target.value)} />
                        </td>
                        <td className="px-3 py-3">
                          <input className={fieldClass} value={rows[index].course_name} onChange={(event) => updateRow(index, 'course_name', event.target.value)} />
                        </td>
                        <td className="px-3 py-3">
                          <input className={fieldClass} type="number" value={rows[index].academic_year} onChange={(event) => updateRow(index, 'academic_year', event.target.value)} />
                        </td>
                        <td className="px-3 py-3">
                          <select className={fieldClass} value={rows[index].semester} onChange={(event) => updateRow(index, 'semester', event.target.value)}>
                            {allowedSemesters.map((semester) => (
                              <option key={semester} value={semester}>{semester}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <input className={fieldClass} type="number" min="0" value={rows[index].credits} onChange={(event) => updateRow(index, 'credits', event.target.value)} />
                        </td>
                        <td className="px-3 py-3">
                          <select className={fieldClass} value={rows[index].grade} onChange={(event) => updateRow(index, 'grade', event.target.value)}>
                            <option value="">เลือก</option>
                            {allowedGrades.map((grade) => (
                              <option key={grade} value={grade}>{grade}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          {row.issues.length === 0 ? (
                            <span className="inline-flex rounded-md bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800">ผ่าน</span>
                          ) : (
                            <div className="grid gap-1">
                              {row.issues.map((issue) => (
                                <span key={issue} className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                                  {issue}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => removeRow(index)}
                            className="rounded-md border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700"
                          >
                            ลบ
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
