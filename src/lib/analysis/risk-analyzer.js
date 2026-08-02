export function analyzeAcademicRisk({ gpax, credits, degreeAudit, prerequisiteGraph }) {
  const academicStatus = gpax.gpax > 0 && gpax.gpax < 2 ? 'probation' : 'normal';
  const hasLowCreditProgress = credits.requiredCredits > 0 && credits.completionPercent < 50;
  const hasMissingRequiredCourses = degreeAudit.missingRequiredCourses.length > 0;
  const hasPrerequisiteIssues = prerequisiteGraph.violations.length > 0;

  const riskFactors = [];
  if (academicStatus === 'probation') riskFactors.push('GPAX ต่ำกว่า 2.00');
  if (hasLowCreditProgress) riskFactors.push('หน่วยกิตสะสมยังต่ำกว่า 50% ของหลักสูตร');
  if (hasMissingRequiredCourses) riskFactors.push('ยังมีรายวิชาบังคับที่ไม่ผ่าน');
  if (hasPrerequisiteIssues) riskFactors.push('มีรายวิชาที่เรียนโดยเงื่อนไขวิชาบังคับก่อนยังไม่ครบ');

  let graduationRisk = 'normal';
  if (academicStatus === 'probation') {
    graduationRisk = 'probation';
  } else if (hasLowCreditProgress || hasMissingRequiredCourses || hasPrerequisiteIssues) {
    graduationRisk = 'low_graduation_risk';
  }

  return {
    academicStatus,
    graduationRisk,
    riskFactors,
    summary: riskFactors.length > 0
      ? riskFactors.join(', ')
      : 'สถานะปัจจุบันไม่พบความเสี่ยงสำคัญจากข้อมูลที่มี',
  };
}
