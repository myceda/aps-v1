'use client';

import { useEffect, useMemo, useState } from 'react';

const statusText = {
  normal: 'สถานะปกติ',
  probation: 'เสี่ยงพ้นสภาพ / probation',
};

const riskText = {
  normal: 'ความเสี่ยงต่ำ',
  probation: 'ต้องรีบวางแผนแก้ไข',
  low_graduation_risk: 'มีความเสี่ยงจบช้า',
};

const simulationActions = [
  { value: 'add', label: 'Add', helper: 'เพิ่มวิชาและเกรดจำลอง' },
  { value: 'drop', label: 'Drop', helper: 'ถอนวิชาออกจากผลปัจจุบัน' },
  { value: 'fail', label: 'Fail', helper: 'จำลองว่าวิชานี้ได้ F' },
];

const gradeOptions = ['A', 'B+', 'B', 'C+', 'C', 'D+', 'D'];

function numberText(value) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString('th-TH') : '-';
}

function collectCourseOptions(analysis) {
  const courseMap = new Map();

  for (const term of analysis?.roadmap?.terms || []) {
    for (const course of term.courses || []) {
      if (!course.course_id || courseMap.has(course.course_id)) continue;
      courseMap.set(course.course_id, {
        course_id: course.course_id,
        course_code: course.course_code,
        course_name_th: course.course_name_th,
        status: course.status,
      });
    }
  }

  for (const course of analysis?.degreeAudit?.missingRequiredCourses || []) {
    if (!course.course_id || courseMap.has(course.course_id)) continue;
    courseMap.set(course.course_id, {
      course_id: course.course_id,
      course_code: course.course_code,
      course_name_th: course.course_name_th,
      status: 'remaining',
    });
  }

  return Array.from(courseMap.values()).sort((a, b) => (
    String(a.course_code || '').localeCompare(String(b.course_code || ''))
  ));
}

function buildRecommendations(analysis) {
  if (!analysis) return [];

  const recommendations = [];
  const risk = analysis.risk || {};
  const missingCourses = analysis.degreeAudit?.missingRequiredCourses || [];
  const categories = analysis.credits?.categories || [];
  const weakestCategory = [...categories]
    .filter((category) => Number(category.remainingCredits) > 0)
    .sort((a, b) => Number(b.remainingCredits) - Number(a.remainingCredits))[0];

  if (risk.academicStatus === 'probation') {
    recommendations.push('ควรพบอาจารย์ที่ปรึกษาและจำลองเกรดเทอมถัดไปทันที เพราะ GPAX ต่ำกว่า 2.00');
  }

  if (weakestCategory) {
    recommendations.push(`ให้โฟกัสหมวด ${weakestCategory.category_name} ก่อน ยังขาด ${weakestCategory.remainingCredits} หน่วยกิต`);
  }

  if (missingCourses.length > 0) {
    recommendations.push(`ควรลงทะเบียนวิชาบังคับที่ยังไม่ผ่านก่อน โดยเริ่มจาก ${missingCourses.slice(0, 3).map((course) => course.course_code).join(', ')}`);
  }

  if ((analysis.prerequisiteGraph?.violations || []).length > 0) {
    recommendations.push('ตรวจเงื่อนไข prerequisite ก่อนจัดแผนเทอมถัดไป เพื่อไม่ให้แผนชนเงื่อนไขวิชาบังคับก่อน');
  }

  if (recommendations.length === 0) {
    recommendations.push('สถานะโดยรวมดี ให้รักษา pace หน่วยกิตและตรวจแผนเปิดสอนทุกเทอมก่อนลงทะเบียน');
  }

  return recommendations;
}

function MetricBlock({ label, value, helper, tone = 'default' }) {
  const toneClass = tone === 'danger'
    ? 'border-red-200 bg-red-50 text-red-950'
    : tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-950'
      : tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
        : 'border-slate-200 bg-white text-slate-950';

  return (
    <div className={`rounded-md border p-4 ${toneClass}`}>
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {helper && <p className="mt-1 text-sm text-slate-600">{helper}</p>}
    </div>
  );
}

function RiskPanel({ analysis }) {
  const risk = analysis.risk || {};
  const isProbation = risk.academicStatus === 'probation';
  const isWarning = risk.graduationRisk !== 'normal';
  const panelClass = isProbation
    ? 'border-red-300 bg-red-50 text-red-950'
    : isWarning
      ? 'border-amber-300 bg-amber-50 text-amber-950'
      : 'border-emerald-300 bg-emerald-50 text-emerald-950';

  return (
    <section className={`rounded-md border p-5 ${panelClass}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase">Phase 4: Student Experience</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
            {statusText[risk.academicStatus] || 'กำลังประเมินสถานะ'}
          </h1>
          <p className="mt-2 max-w-3xl text-sm">
            {riskText[risk.graduationRisk] || risk.summary || 'ตรวจสถานะการเรียนจาก transcript ล่าสุด'}
          </p>
        </div>
        <div className="grid min-w-56 gap-2 rounded-md bg-white/70 p-4 text-sm">
          <span className="font-bold">สัญญาณความเสี่ยง</span>
          <span>{risk.summary || 'ไม่พบความเสี่ยงสำคัญจากข้อมูลที่มี'}</span>
        </div>
      </div>
    </section>
  );
}

function MissingCoursesPanel({ courses }) {
  const visibleCourses = courses.slice(0, 8);

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">วิชาบังคับที่ยังไม่ผ่าน</h2>
          <p className="mt-1 text-sm text-slate-600">เรียงเป็นรายการสั้น ๆ เพื่อเลือกลงในเทอมถัดไปได้ง่าย</p>
        </div>
        <span className="rounded-md bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
          เหลือ {courses.length} วิชา
        </span>
      </div>

      {visibleCourses.length === 0 ? (
        <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          ไม่พบวิชาบังคับค้างจากข้อมูลล่าสุด
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {visibleCourses.map((course) => (
            <article key={course.course_id || course.course_code} className="rounded-md border border-slate-200 p-4">
              <p className="text-sm font-bold text-slate-950">{course.course_code}</p>
              <p className="mt-1 text-sm text-slate-700">{course.course_name_th || 'ยังไม่มีชื่อวิชา'}</p>
              <p className="mt-3 text-xs font-semibold text-slate-500">{course.credits} หน่วยกิต · {course.category_name || 'ไม่ระบุหมวด'}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function RecommendationPanel({ recommendations }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-bold text-slate-950">คำแนะนำถัดไป</h2>
      <div className="mt-4 grid gap-3">
        {recommendations.map((item, index) => (
          <div key={item} className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-700 text-xs font-bold text-white">
              {index + 1}
            </span>
            <p>{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChangeMetric({ label, metric, suffix = '' }) {
  const delta = Number(metric?.delta || 0);
  const toneClass = delta > 0
    ? 'text-amber-700'
    : delta < 0
      ? 'text-emerald-700'
      : 'text-slate-500';

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-700">
        ก่อน {numberText(metric?.before)}{suffix} → หลัง {numberText(metric?.after)}{suffix}
      </p>
      <p className={`mt-1 text-xs font-bold ${toneClass}`}>
        เปลี่ยน {delta > 0 ? '+' : ''}{numberText(delta)}{suffix}
      </p>
    </div>
  );
}

function WhatIfSimulationPanel({ analysis }) {
  const courseOptions = useMemo(() => collectCourseOptions(analysis), [analysis]);
  const [actionType, setActionType] = useState('add');
  const [courseId, setCourseId] = useState('');
  const [simulatedGrade, setSimulatedGrade] = useState('A');
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const selectedCourseId = courseId || courseOptions[0]?.course_id || '';

  async function runSimulation() {
    if (!selectedCourseId) {
      setError('กรุณาเลือกรายวิชาก่อนจำลอง');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/student/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: analysis.program?.program_id,
          study_track: analysis.studyTrack,
          actions: [{
            action_type: actionType,
            course_id: selectedCourseId,
            simulated_grade: actionType === 'add' ? simulatedGrade : undefined,
          }],
        }),
      });
      const result = await response.json();

      if (!result.success) {
        setError(result.error || 'จำลองแผนไม่สำเร็จ');
        return;
      }

      setSimulation(result.data);
    } catch (simulationError) {
      setError(simulationError.message || 'จำลองแผนไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  const comparison = simulation?.comparison;
  const prerequisiteImpact = simulation?.prerequisiteImpact;
  const offeringImpact = simulation?.offeringImpact;

  return (
    <section className="rounded-md border border-indigo-200 bg-white p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-indigo-700">Phase 5: What-if Simulation</p>
          <h2 className="mt-2 text-lg font-bold text-slate-950">จำลอง add / drop / fail ก่อนตัดสินใจลงทะเบียน</h2>
          <p className="mt-1 text-sm text-slate-600">
            เปรียบเทียบ GPAX หน่วยกิต เทอมจบ และผลกระทบ prerequisite/offering จากข้อมูลปัจจุบัน
          </p>
        </div>
        <button
          type="button"
          onClick={runSimulation}
          disabled={loading || courseOptions.length === 0}
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-indigo-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? 'กำลังจำลอง...' : 'คำนวณผลกระทบ'}
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="grid gap-4">
          <div>
            <p className="text-sm font-bold text-slate-800">Action</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {simulationActions.map((action) => (
                <button
                  key={action.value}
                  type="button"
                  onClick={() => setActionType(action.value)}
                  className={`rounded-md border p-3 text-left text-sm ${
                    actionType === action.value
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-950'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <span className="block font-bold">{action.label}</span>
                  <span className="mt-1 block text-xs">{action.helper}</span>
                </button>
              ))}
            </div>
          </div>

          <label className="grid gap-2 text-sm font-bold text-slate-800">
            รายวิชา
            <select
              value={selectedCourseId}
              onChange={(event) => setCourseId(event.target.value)}
              className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
            >
              {courseOptions.map((course) => (
                <option key={course.course_id} value={course.course_id}>
                  {course.course_code} - {course.course_name_th || 'ไม่ระบุชื่อวิชา'}
                </option>
              ))}
            </select>
          </label>

          {actionType === 'add' && (
            <label className="grid gap-2 text-sm font-bold text-slate-800">
              เกรดจำลอง
              <select
                value={simulatedGrade}
                onChange={(event) => setSimulatedGrade(event.target.value)}
                className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900"
              >
                {gradeOptions.map((grade) => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </label>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-900">
              {error}
            </div>
          )}
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
          {!comparison ? (
            <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white p-4 text-center text-sm font-semibold text-slate-500">
              เลือก scenario แล้วกดคำนวณ เพื่อดูผลก่อน/หลังและจุดที่กระทบ
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <ChangeMetric label="GPAX" metric={comparison.gpax} />
                <ChangeMetric label="หน่วยกิตผ่านแล้ว" metric={comparison.earnedCredits} suffix=" หน่วยกิต" />
                <ChangeMetric label="หน่วยกิตคงเหลือ" metric={comparison.remainingCredits} suffix=" หน่วยกิต" />
                <ChangeMetric label="วิชาบังคับคงเหลือ" metric={comparison.missingRequiredCourses} suffix=" วิชา" />
              </div>

              <div className="rounded-md border border-slate-200 bg-white p-3">
                <p className="text-xs font-bold uppercase text-slate-500">เทอมจบคาดการณ์</p>
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  ก่อน {comparison.graduationTerm?.before?.label || '-'} → หลัง {comparison.graduationTerm?.after?.label || '-'}
                </p>
                <p className={`mt-1 text-xs font-bold ${comparison.graduationTerm?.changed ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {comparison.graduationTerm?.changed ? 'เทอมจบเปลี่ยนจาก scenario นี้' : 'เทอมจบยังไม่เปลี่ยน'}
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <p className="text-sm font-bold text-slate-950">Prerequisite ที่กระทบ</p>
                  {prerequisiteImpact?.affectedEdges?.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {prerequisiteImpact.affectedEdges.slice(0, 4).map((edge) => (
                        <p key={edge.prerequisite_id} className="text-xs font-semibold text-slate-700">
                          {edge.required_course_code} → {edge.course_code}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs font-semibold text-emerald-700">ยังไม่พบ prerequisite ที่ถูกกระทบโดยตรง</p>
                  )}
                </div>

                <div className="rounded-md border border-slate-200 bg-white p-3">
                  <p className="text-sm font-bold text-slate-950">Offering ที่กระทบ</p>
                  {offeringImpact?.affectedOfferings?.length > 0 ? (
                    <div className="mt-3 grid gap-2">
                      {offeringImpact.affectedOfferings.slice(0, 4).map((offering) => (
                        <p key={offering.offering_id} className="text-xs font-semibold text-slate-700">
                          {offering.course_code} ปี {offering.academic_year} เทอม {offering.semester} ({offering.status})
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs font-semibold text-amber-700">ยังไม่พบ offering ของวิชานี้ในข้อมูลปัจจุบัน</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function RoadmapGrid({ roadmap }) {
  const terms = roadmap?.terms || [];

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Roadmap รายเทอมถึงปี 8</h2>
          <p className="mt-1 text-sm text-slate-600">
            สีเขียวคือผ่านแล้ว สีขาวคือยังต้องวางแผนเรียน และปี 5-8 เป็นพื้นที่แผนสำรอง
          </p>
        </div>
        <span className="rounded-md bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-800">
          {roadmap?.remainingCourseCount || 0} รายการยังต้องจัดแผน
        </span>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {terms.map((term) => (
          <article key={term.key} className="min-h-44 rounded-md border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-950">{term.label}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">{term.status}</p>
              </div>
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                {term.totalCredits} หน่วยกิต
              </span>
            </div>

            {term.courses.length === 0 ? (
              <div className="mt-4 rounded-md border border-dashed border-slate-200 p-3 text-xs text-slate-500">
                ยังไม่มีวิชาที่ต้องจัดในเทอมนี้
              </div>
            ) : (
              <div className="mt-4 grid gap-2">
                {term.courses.slice(0, 4).map((course) => (
                  <div
                    key={`${term.key}-${course.course_code}`}
                    className={`rounded-md border px-3 py-2 text-xs ${
                      course.status === 'passed'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 bg-slate-50 text-slate-800'
                    }`}
                  >
                    <p className="font-bold">{course.course_code}</p>
                    <p className="mt-1 line-clamp-2">{course.course_name_th || 'ยังไม่มีชื่อวิชา'}</p>
                  </div>
                ))}
                {term.courses.length > 4 && (
                  <p className="text-xs font-semibold text-slate-500">+ อีก {term.courses.length - 4} วิชา</p>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

export default function StudentDashboardWorkspace() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAnalysis() {
      try {
        const response = await fetch('/api/student/analysis', { cache: 'no-store' });
        const result = await response.json();

        if (!result.success) {
          setError(result.error || 'โหลดข้อมูล dashboard ไม่สำเร็จ');
          return;
        }

        setAnalysis(result.data);
      } catch (loadError) {
        setError(loadError.message || 'โหลดข้อมูล dashboard ไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    }

    loadAnalysis();
  }, []);

  const recommendations = useMemo(() => buildRecommendations(analysis), [analysis]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-7xl rounded-md border border-slate-200 bg-white p-6 text-sm text-slate-600">
          กำลังโหลด dashboard นักศึกษา...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
        <div className="mx-auto max-w-3xl rounded-md border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-xl font-bold text-amber-950">ยังไม่มีข้อมูล transcript สำหรับ dashboard</h1>
          <p className="mt-2 text-sm text-amber-900">{error}</p>
          <a href="/student/transcript-tools" className="mt-5 inline-flex rounded-md bg-amber-700 px-4 py-3 text-sm font-bold text-white">
            ไปอัปโหลด transcript
          </a>
        </div>
      </main>
    );
  }

  const missingCourses = analysis.degreeAudit?.missingRequiredCourses || [];
  const riskTone = analysis.risk?.academicStatus === 'probation'
    ? 'danger'
    : analysis.risk?.graduationRisk !== 'normal'
      ? 'warning'
      : 'success';

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <RiskPanel analysis={analysis} />

        <section className="grid gap-4 md:grid-cols-4">
          <MetricBlock label="GPAX" value={analysis.gpax?.gpax?.toFixed?.(2) || '-'} helper={`${numberText(analysis.gpax?.totalCredits)} หน่วยกิตคำนวณ`} tone={riskTone} />
          <MetricBlock label="หน่วยกิตผ่านแล้ว" value={`${numberText(analysis.credits?.earnedCredits)} / ${numberText(analysis.credits?.requiredCredits)}`} helper={`คืบหน้า ${numberText(analysis.credits?.completionPercent)}%`} tone="success" />
          <MetricBlock label="หน่วยกิตคงเหลือ" value={numberText(analysis.credits?.remainingCredits)} helper="จากโครงสร้างหลักสูตรล่าสุด" tone={analysis.credits?.remainingCredits > 0 ? 'warning' : 'success'} />
          <MetricBlock label="วิชาบังคับคงเหลือ" value={missingCourses.length} helper={`track: ${analysis.studyTrack || 'both'}`} tone={missingCourses.length > 0 ? 'warning' : 'success'} />
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
          <MissingCoursesPanel courses={missingCourses} />
          <RecommendationPanel recommendations={recommendations} />
        </section>

        <WhatIfSimulationPanel analysis={analysis} />

        <RoadmapGrid roadmap={analysis.roadmap} />
      </div>
    </main>
  );
}
