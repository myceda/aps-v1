import Link from 'next/link';
import { getCurrentUser } from '../lib/auth/index.js';

const entryCards = [
  {
    title: 'นักศึกษา',
    description: 'ดูสถานะการเรียน หน่วยกิต ความเสี่ยง และแผนเรียนที่เหลือ',
    href: '/student/dashboard',
    action: 'เปิด Dashboard',
    accent: 'border-l-emerald-500',
  },
  {
    title: 'อัปโหลด Transcript',
    description: 'ตรวจและบันทึกผลการเรียนเพื่อใช้วิเคราะห์แผนสำเร็จการศึกษา',
    href: '/student/transcript-tools',
    action: 'จัดการ Transcript',
    accent: 'border-l-sky-500',
  },
  {
    title: 'ผู้ดูแลระบบ',
    description: 'จัดการหลักสูตร รายวิชา แผนการเรียน prerequisite และข้อมูลเปิดสอน',
    href: '/admin',
    action: 'เปิด Admin',
    accent: 'border-l-slate-700',
  },
];

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-950">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
          <span className="font-semibold text-slate-700">
            {user ? `${user.name} (${user.role})` : 'ยังไม่ได้เข้าสู่ระบบ'}
          </span>
          {user ? (
            <form action="/api/auth/logout" method="post">
              <button className="rounded-md border border-slate-300 px-3 py-2 font-bold text-slate-700 hover:border-rose-300 hover:text-rose-700" type="submit">
                ออกจากระบบ
              </button>
            </form>
          ) : (
            <a className="rounded-md bg-emerald-700 px-3 py-2 font-bold text-white hover:bg-emerald-800" href="/api/auth/google">
              เข้าสู่ระบบด้วย Google
            </a>
          )}
        </div>

        <div className="mb-8 max-w-3xl">
          <p className="mb-3 text-sm font-semibold uppercase text-emerald-700">
            Academic Planning System
          </p>
          <h1 className="text-3xl font-bold leading-tight text-slate-950 sm:text-4xl">
            ระบบช่วยวางแผนการเรียน APS
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-700">
            เลือกพื้นที่ทำงานเพื่อทดสอบ flow หลักของระบบ ทั้งฝั่งนักศึกษา การบันทึก transcript
            และการจัดการข้อมูลหลักสูตรโดยผู้ดูแล
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {entryCards.map((card) => (
            <Link
              className={`flex min-h-56 flex-col justify-between border border-slate-200 border-l-4 ${card.accent} bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2`}
              href={card.href}
              key={card.href}
            >
              <span>
                <span className="block text-xl font-bold text-slate-950">{card.title}</span>
                <span className="mt-3 block text-sm leading-6 text-slate-600">{card.description}</span>
              </span>
              <span className="mt-6 inline-flex items-center text-sm font-semibold text-emerald-700">
                {card.action}
                <span aria-hidden="true" className="ml-2">-&gt;</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
