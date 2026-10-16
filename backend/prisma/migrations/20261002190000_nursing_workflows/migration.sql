ALTER TABLE "NursingNote"
ADD CONSTRAINT "NursingNote_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "NursingNote_admissionId_recordedAt_idx" ON "NursingNote"("admissionId", "recordedAt");
CREATE INDEX "NursingNote_nurseId_recordedAt_idx" ON "NursingNote"("nurseId", "recordedAt");

ALTER TABLE "MedicationAdministration" ADD COLUMN "prescriptionItemId" TEXT;
ALTER TABLE "MedicationAdministration"
ADD CONSTRAINT "MedicationAdministration_administeredById_fkey" FOREIGN KEY ("administeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MedicationAdministration"
ADD CONSTRAINT "MedicationAdministration_prescriptionItemId_fkey" FOREIGN KEY ("prescriptionItemId") REFERENCES "PrescriptionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "MedicationAdministration_prescriptionItemId_idx" ON "MedicationAdministration"("prescriptionItemId");
CREATE UNIQUE INDEX "MedicationAdministration_prescriptionItemId_admissionId_scheduledAt_key" ON "MedicationAdministration"("prescriptionItemId", "admissionId", "scheduledAt");

CREATE TABLE "NurseAssignment" (
  "id" TEXT NOT NULL,
  "admissionId" TEXT NOT NULL,
  "nurseId" TEXT NOT NULL,
  "shift" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "assignedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NurseAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NurseAssignment_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "NurseAssignment_nurseId_fkey" FOREIGN KEY ("nurseId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "NurseAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "NurseAssignment_nurseId_endedAt_idx" ON "NurseAssignment"("nurseId", "endedAt");
CREATE INDEX "NurseAssignment_admissionId_endedAt_idx" ON "NurseAssignment"("admissionId", "endedAt");
CREATE UNIQUE INDEX "NurseAssignment_admissionId_nurseId_shift_startedAt_key" ON "NurseAssignment"("admissionId", "nurseId", "shift", "startedAt");

CREATE TABLE "ShiftHandover" (
  "id" TEXT NOT NULL,
  "admissionId" TEXT NOT NULL,
  "fromShift" TEXT NOT NULL,
  "toShift" TEXT NOT NULL,
  "handedOverById" TEXT NOT NULL,
  "handedOverToId" TEXT,
  "clinicalSummary" TEXT NOT NULL,
  "currentCondition" TEXT NOT NULL,
  "importantObservations" TEXT NOT NULL DEFAULT '',
  "pendingTasks" TEXT NOT NULL DEFAULT '',
  "medicationNotes" TEXT NOT NULL DEFAULT '',
  "investigationsPending" TEXT NOT NULL DEFAULT '',
  "specialInstructions" TEXT NOT NULL DEFAULT '',
  "riskAlerts" TEXT NOT NULL DEFAULT '',
  "additionalNotes" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acknowledgedById" TEXT,
  "acknowledgedAt" TIMESTAMP(3),
  CONSTRAINT "ShiftHandover_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShiftHandover_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShiftHandover_handedOverById_fkey" FOREIGN KEY ("handedOverById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ShiftHandover_handedOverToId_fkey" FOREIGN KEY ("handedOverToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ShiftHandover_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ShiftHandover_admissionId_createdAt_idx" ON "ShiftHandover"("admissionId", "createdAt");
CREATE INDEX "ShiftHandover_handedOverToId_status_createdAt_idx" ON "ShiftHandover"("handedOverToId", "status", "createdAt");
