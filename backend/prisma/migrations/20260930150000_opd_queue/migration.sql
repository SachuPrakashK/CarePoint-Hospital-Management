CREATE TYPE "OpdQueueStatus" AS ENUM ('WAITING', 'CALLED', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED');

CREATE TABLE "OpdQueueEntry" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "queueDate" TIMESTAMP(3) NOT NULL,
  "tokenNumber" INTEGER NOT NULL,
  "token" TEXT NOT NULL,
  "status" "OpdQueueStatus" NOT NULL DEFAULT 'WAITING',
  "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "calledAt" TIMESTAMP(3),
  "consultationAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OpdQueueEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OpdQueueEntry_appointmentId_key" ON "OpdQueueEntry"("appointmentId");
CREATE UNIQUE INDEX "OpdQueueEntry_queueDate_departmentId_tokenNumber_key" ON "OpdQueueEntry"("queueDate", "departmentId", "tokenNumber");
CREATE INDEX "OpdQueueEntry_queueDate_status_idx" ON "OpdQueueEntry"("queueDate", "status");
CREATE INDEX "OpdQueueEntry_departmentId_doctorId_queueDate_idx" ON "OpdQueueEntry"("departmentId", "doctorId", "queueDate");
CREATE INDEX "OpdQueueEntry_patientId_checkedInAt_idx" ON "OpdQueueEntry"("patientId", "checkedInAt");
ALTER TABLE "OpdQueueEntry" ADD CONSTRAINT "OpdQueueEntry_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OpdQueueEntry" ADD CONSTRAINT "OpdQueueEntry_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OpdQueueEntry" ADD CONSTRAINT "OpdQueueEntry_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OpdQueueEntry" ADD CONSTRAINT "OpdQueueEntry_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
