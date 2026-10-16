CREATE TABLE "PharmacyDispense" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "prescriptionRef" TEXT NOT NULL,
  "pharmacistId" TEXT,
  "invoiceId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Pending Review',
  "dispensedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PharmacyDispense_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PharmacyDispenseItem" (
  "id" TEXT NOT NULL,
  "dispenseId" TEXT NOT NULL,
  "medicineId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "prescribedQuantity" INTEGER NOT NULL,
  "dispensedQuantity" INTEGER NOT NULL DEFAULT 0,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "PharmacyDispenseItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PharmacyDispense_number_key" ON "PharmacyDispense"("number");
CREATE UNIQUE INDEX "PharmacyDispense_invoiceId_key" ON "PharmacyDispense"("invoiceId");
CREATE INDEX "PharmacyDispense_patientId_status_idx" ON "PharmacyDispense"("patientId", "status");
CREATE INDEX "PharmacyDispenseItem_dispenseId_idx" ON "PharmacyDispenseItem"("dispenseId");
CREATE INDEX "PharmacyDispenseItem_batchId_idx" ON "PharmacyDispenseItem"("batchId");
ALTER TABLE "PharmacyDispense" ADD CONSTRAINT "PharmacyDispense_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PharmacyDispense" ADD CONSTRAINT "PharmacyDispense_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PharmacyDispenseItem" ADD CONSTRAINT "PharmacyDispenseItem_dispenseId_fkey" FOREIGN KEY ("dispenseId") REFERENCES "PharmacyDispense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PharmacyDispenseItem" ADD CONSTRAINT "PharmacyDispenseItem_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PharmacyDispenseItem" ADD CONSTRAINT "PharmacyDispenseItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MedicineBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
