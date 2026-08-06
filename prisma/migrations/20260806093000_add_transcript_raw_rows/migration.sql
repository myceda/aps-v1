-- CreateTable
CREATE TABLE "TranscriptRawRow" (
    "raw_row_id" UUID NOT NULL,
    "transcript_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "course_id" UUID,
    "grade_id" UUID,
    "row_index" INTEGER NOT NULL,
    "raw_course_code" TEXT NOT NULL,
    "raw_course_name" TEXT,
    "raw_academic_year" TEXT,
    "raw_semester" TEXT,
    "raw_credits" TEXT,
    "raw_grade" TEXT,
    "normalized_code" TEXT,
    "normalized_year" INTEGER,
    "normalized_semester" TEXT,
    "normalized_credits" INTEGER,
    "normalized_grade" TEXT,
    "confidence" DECIMAL(4,3),
    "extraction_status" TEXT NOT NULL,
    "validation_status" TEXT NOT NULL,
    "issues" JSONB NOT NULL,
    "source_text" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranscriptRawRow_pkey" PRIMARY KEY ("raw_row_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptRawRow_grade_id_key" ON "TranscriptRawRow"("grade_id");

-- CreateIndex
CREATE UNIQUE INDEX "TranscriptRawRow_transcript_id_row_index_key" ON "TranscriptRawRow"("transcript_id", "row_index");

-- CreateIndex
CREATE INDEX "TranscriptRawRow_student_id_created_at_idx" ON "TranscriptRawRow"("student_id", "created_at");

-- CreateIndex
CREATE INDEX "TranscriptRawRow_transcript_id_idx" ON "TranscriptRawRow"("transcript_id");

-- CreateIndex
CREATE INDEX "TranscriptRawRow_course_id_idx" ON "TranscriptRawRow"("course_id");

-- AddForeignKey
ALTER TABLE "TranscriptRawRow" ADD CONSTRAINT "TranscriptRawRow_transcript_id_fkey" FOREIGN KEY ("transcript_id") REFERENCES "TranscriptUpload"("transcript_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptRawRow" ADD CONSTRAINT "TranscriptRawRow_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "Student"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptRawRow" ADD CONSTRAINT "TranscriptRawRow_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "Course"("course_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptRawRow" ADD CONSTRAINT "TranscriptRawRow_grade_id_fkey" FOREIGN KEY ("grade_id") REFERENCES "StudentGrade"("grade_id") ON DELETE SET NULL ON UPDATE CASCADE;
