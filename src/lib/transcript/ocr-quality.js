const minimumOcrRowsForAutoReview = 20;
const minimumCompleteOcrRowsForAutoReview = 15;

function hasCompleteCoreFields(row) {
  return Boolean(
    row.course_code
    && row.academic_year
    && row.semester
    && row.credits !== ''
    && row.grade,
  );
}

export function applyTranscriptExtractionQualityGate(extraction, rows) {
  if (extraction?.method !== 'ocr') {
    return { extraction, rows };
  }

  const completeRows = rows.filter(hasCompleteCoreFields).length;
  const shouldRequireManualEntry = rows.length < minimumOcrRowsForAutoReview
    || completeRows < minimumCompleteOcrRowsForAutoReview;

  if (!shouldRequireManualEntry) {
    return {
      extraction: {
        ...extraction,
        quality: {
          parsedRows: rows.length,
          completeRows,
          decision: 'auto_review',
        },
      },
      rows,
    };
  }

  return {
    extraction: {
      ...extraction,
      status: 'needs_manual_entry',
      quality: {
        parsedRows: rows.length,
        completeRows,
        decision: 'manual_entry_required',
      },
      warnings: [
        ...(extraction.warnings || []),
        'OCR อ่านข้อมูลได้ไม่ครบพอสำหรับสร้างตารางอัตโนมัติ โปรดกรอกหรือเพิ่มแถวเองจาก transcript',
      ],
    },
    rows: [],
  };
}
