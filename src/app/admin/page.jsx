'use client';

import { useState, useEffect } from 'react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState(1);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  // ดึงข้อมูลหลักสูตรจาก API ด้วย JavaScript
  useEffect(() => {
    async function fetchPrograms() {
      try {
        const res = await fetch('/api/programs');
        const result = await res.json();
        if (result.success) {
          setPrograms(result.data);
        }
      } catch (err) {
        console.error('Error fetching programs:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchPrograms();
  }, []);

  const tabs = [
    { id: 1, name: '1. จัดการหลักสูตร (Programs)' },
    { id: 2, name: '2. จัดการรายวิชา (Courses)' },
    { id: 3, name: '3. วิชาบังคับก่อน (Prerequisites)' },
    { id: 4, name: '4. แผนการเรียนแนะนำ (Study Plans)' },
    { id: 5, name: '5. รายวิชาที่เปิดสอน (Offerings)' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      {/* Title Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">ระบบจัดการข้อมูลหลักสูตร (APS Admin)</h1>
        <p className="text-gray-600 mt-1">Phase 1: Database & Admin Master Data Setup</p>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-lg shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`py-4 px-6 font-medium text-sm border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Tab 1 Content: Shows Real DB Data */}
      <div className="bg-white p-6 rounded-b-lg shadow-sm border border-gray-100">
        {activeTab === 1 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              รายการหลักสูตรในฐานข้อมูล PostgreSQL (`aps-v1-db`)
            </h2>

            {loading ? (
              <p className="text-gray-500">กำลังเชื่อมต่อฐานข้อมูล...</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {programs.map((prog) => (
                  <div key={prog.program_id} className="p-5 border rounded-xl bg-white shadow-sm border-gray-200">
                    <span className="bg-blue-100 text-blue-800 text-xs px-2.5 py-1 rounded font-bold uppercase">
                      {prog.status}
                    </span>
                    <h3 className="text-xl font-bold text-gray-800 mt-3">
                      {prog.program_code} - {prog.program_name_th}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{prog.program_name_en}</p>
                    <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-sm text-gray-500">
                      <span>ปีหลักสูตร: {prog.curriculum_year}</span>
                      <span>หน่วยกิตรวม: {prog.total_credits} หน่วยกิต</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 2 && <p className="text-gray-600">2. คลังรายวิชา CS65 / IT65</p>}
        {activeTab === 3 && <p className="text-gray-600">3. เงื่อนไขรายวิชาบังคับก่อน (Prerequisite)</p>}
        {activeTab === 4 && <p className="text-gray-600">4. แผนการเรียนแนะนำรายเทอม</p>}
        {activeTab === 5 && <p className="text-gray-600">5. รายวิชาที่เปิดสอน</p>}
      </div>
    </div>
  );
}