-- DropIndex
DROP INDEX "Rule_rule_code_key";

-- AlterTable
ALTER TABLE "Rule" DROP COLUMN "condition",
DROP COLUMN "rule_code",
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "program_id" UUID NOT NULL,
ADD COLUMN     "rule_type" TEXT NOT NULL,
ADD COLUMN     "rule_value" JSONB NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "SimulationSession" ADD COLUMN     "result_id" UUID NOT NULL,
ADD COLUMN     "scenario_input" JSONB NOT NULL,
ADD COLUMN     "scenario_name" TEXT NOT NULL,
ADD COLUMN     "scenario_result" JSONB NOT NULL;

-- CreateTable
CREATE TABLE "GradeMapping" (
    "grade_mapping_id" UUID NOT NULL,
    "course_id" UUID,
    "grade" TEXT NOT NULL,
    "grade_point" DECIMAL(3,2) NOT NULL,
    "is_passing" BOOLEAN NOT NULL,
    "is_credit_earned" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeMapping_pkey" PRIMARY KEY ("grade_mapping_id")
);

-- CreateTable
CREATE TABLE "TranscriptSemesterSummary" (
    "summary_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "academic_year" INTEGER NOT NULL,
    "semester" TEXT NOT NULL,
    "semester_credits" INTEGER NOT NULL,
    "cumulative_credits" INTEGER NOT NULL,
    "semester_grade_points" DECIMAL(5,2) NOT NULL,
    "cumulative_grade_points" DECIMAL(6,2) NOT NULL,
    "gpa" DECIMAL(3,2) NOT NULL,
    "gpax" DECIMAL(3,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscriptSemesterSummary_pkey" PRIMARY KEY ("summary_id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "recommendation_id" UUID NOT NULL,
    "result_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "recommendation_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "is_dismissed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("recommendation_id")
);

-- CreateIndex
CREATE INDEX "GradeMapping_grade_idx" ON "GradeMapping"("grade");

-- CreateIndex
CREATE UNIQUE INDEX "GradeMapping_course_id_grade_key" ON "GradeMapping"("course_id", "grade");

-- CreateIndex
CREATE INDEX "TranscriptSemesterSummary_academic_year_semester_idx" ON "TranscriptSemesterSummary"("academic_year", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptSemesterSummary_student_id_academic_year_semester_key" ON "TranscriptSemesterSummary"("student_id", "academic_year", "semester");

-- CreateIndex
CREATE INDEX "Recommendation_result_id_idx" ON "Recommendation"("result_id");

-- CreateIndex
CREATE INDEX "Recommendation_student_id_priority_idx" ON "Recommendation"("student_id", "priority");

-- CreateIndex
CREATE INDEX "AnalysisResult_student_id_analyzed_at_idx" ON "AnalysisResult"("student_id", "analyzed_at");

-- CreateIndex
CREATE INDEX "AnalysisResult_program_id_idx" ON "AnalysisResult"("program_id");

-- CreateIndex
CREATE INDEX "CourseOffering_academic_year_semester_idx" ON "CourseOffering"("academic_year", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOffering_program_id_course_id_academic_year_semester_key" ON "CourseOffering"("program_id", "course_id", "academic_year", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "Prerequisite_course_id_required_course_id_condition_type_key" ON "Prerequisite"("course_id", "required_course_id", "condition_type");

-- CreateIndex
CREATE INDEX "ProgramCourse_structure_id_idx" ON "ProgramCourse"("structure_id");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramCourse_program_id_course_id_study_track_key" ON "ProgramCourse"("program_id", "course_id", "study_track");

-- CreateIndex
CREATE INDEX "Rule_program_id_is_active_idx" ON "Rule"("program_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "Rule_program_id_rule_type_rule_name_key" ON "Rule"("program_id", "rule_type", "rule_name");

-- CreateIndex
CREATE UNIQUE INDEX "SimulationCourse_simulation_id_course_id_action_type_key" ON "SimulationCourse"("simulation_id", "course_id", "action_type");

-- CreateIndex
CREATE INDEX "SimulationSession_result_id_idx" ON "SimulationSession"("result_id");

-- CreateIndex
CREATE INDEX "SimulationSession_student_id_created_at_idx" ON "SimulationSession"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "StudentGrade_transcript_id_idx" ON "StudentGrade"("transcript_id");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGrade_student_id_course_id_academic_year_semester_key" ON "StudentGrade"("student_id", "course_id", "academic_year", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProgram_student_id_program_id_study_track_key" ON "StudentProgram"("student_id", "program_id", "study_track");

-- CreateIndex
CREATE UNIQUE INDEX "StudyPlan_program_id_study_track_year_level_semester_key" ON "StudyPlan"("program_id", "study_track", "year_level", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "StudyPlanCourse_study_plan_id_course_id_key" ON "StudyPlanCourse"("study_plan_id", "course_id");

-- AddForeignKey
ALTER TABLE "GradeMapping" ADD CONSTRAINT "GradeMapping_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "Course"("course_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptSemesterSummary" ADD CONSTRAINT "TranscriptSemesterSummary_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "AnalysisResult"("result_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationSession" ADD CONSTRAINT "SimulationSession_result_id_fkey" FOREIGN KEY ("result_id") REFERENCES "AnalysisResult"("result_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulationSession" ADD CONSTRAINT "SimulationSession_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rule" ADD CONSTRAINT "Rule_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "Program"("program_id") ON DELETE RESTRICT ON UPDATE CASCADE;
