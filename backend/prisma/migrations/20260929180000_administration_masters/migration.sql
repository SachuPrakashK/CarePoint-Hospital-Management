CREATE TABLE "Specialization" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "Specialization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Specialization_code_key" ON "Specialization"("code");
CREATE UNIQUE INDEX "Specialization_name_key" ON "Specialization"("name");
CREATE INDEX "Specialization_departmentId_status_idx" ON "Specialization"("departmentId", "status");
ALTER TABLE "Specialization" ADD CONSTRAINT "Specialization_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
