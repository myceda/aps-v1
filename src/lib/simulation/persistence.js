function toJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildAnalysisData({ student, program, analysis }) {
  return {
    student_id: student.student_id,
    program_id: program.program_id,
    total_credits_earned: Number(analysis.credits?.earnedCredits || 0),
    total_credits_required: Number(analysis.credits?.requiredCredits || program.total_credits || 0),
    academic_status: String(analysis.risk?.academicStatus || 'unclassified'),
    expected_graduation_term: String(analysis.roadmap?.expectedGraduationTerm?.key || 'unavailable'),
    result_summary: toJsonValue(analysis),
  };
}

function buildSessionData({ resultId, student, scenarioName, actions, simulation }) {
  return {
    result_id: resultId,
    student_id: student.student_id,
    scenario_name: scenarioName,
    scenario_input: toJsonValue({ actions }),
    scenario_result: toJsonValue(simulation),
    simulationCourses: {
      create: simulation.appliedActions.map((action) => ({
        course_id: action.course_id,
        simulated_grade: action.simulated_grade,
        action_type: action.action_type,
      })),
    },
  };
}

export async function persistSimulation({
  db,
  student,
  program,
  scenarioName,
  actions,
  simulation,
}) {
  return db.$transaction(async (tx) => {
    const analysisResult = await tx.analysisResult.create({
      data: buildAnalysisData({
        student,
        program,
        analysis: simulation.before,
      }),
      select: { result_id: true },
    });

    return tx.simulationSession.create({
      data: buildSessionData({
        resultId: analysisResult.result_id,
        student,
        scenarioName,
        actions,
        simulation,
      }),
      include: {
        simulationCourses: {
          include: { course: true },
          orderBy: { created_at: 'asc' },
        },
      },
    });
  });
}
