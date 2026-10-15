ALTER TABLE "User"
ADD COLUMN "employeeCode" TEXT,
ADD COLUMN "gender" TEXT,
ADD COLUMN "dateOfBirth" TIMESTAMP(3),
ADD COLUMN "address" TEXT,
ADD COLUMN "medicalRegistration" TEXT,
ADD COLUMN "specializationId" TEXT,
ADD COLUMN "qualification" TEXT,
ADD COLUMN "yearsOfExperience" INTEGER,
ADD COLUMN "consultationFee" DECIMAL(10,2),
ADD COLUMN "designation" TEXT,
ADD COLUMN "joiningDate" TIMESTAMP(3),
ADD COLUMN "employmentType" TEXT;

CREATE UNIQUE INDEX "User_employeeCode_key" ON "User"("employeeCode");
CREATE UNIQUE INDEX "User_medicalRegistration_key" ON "User"("medicalRegistration");
CREATE INDEX "User_specializationId_status_idx" ON "User"("specializationId", "status");
CREATE INDEX "User_employeeCode_idx" ON "User"("employeeCode");

ALTER TABLE "User" ADD CONSTRAINT "User_specializationId_fkey"
FOREIGN KEY ("specializationId") REFERENCES "Specialization"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
