import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '../../../../lib/auth/index.js';

export async function GET(request) {
  const user = await getCurrentUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ success: true, data: null });
  }

  return NextResponse.json({
    success: true,
    data: {
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      role: user.role,
      student: user.student
        ? {
          student_id: user.student.student_id,
          student_code: user.student.student_code,
          admission_year: user.student.admission_year,
        }
        : null,
      admin: user.admin ? { admin_id: user.admin.admin_id } : null,
    },
  });
}
