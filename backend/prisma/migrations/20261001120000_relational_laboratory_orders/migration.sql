ALTER TABLE "LabOrder" ADD COLUMN "doctorId" TEXT;

CREATE TABLE "LabOrderTest" (
    "orderId" TEXT NOT NULL,
    "testDefinitionId" TEXT NOT NULL,
    CONSTRAINT "LabOrderTest_pkey" PRIMARY KEY ("orderId", "testDefinitionId")
);

CREATE INDEX "LabOrder_doctorId_createdAt_idx" ON "LabOrder"("doctorId", "createdAt");
CREATE INDEX "LabOrderTest_testDefinitionId_idx" ON "LabOrderTest"("testDefinitionId");

ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_doctorId_fkey"
  FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LabOrderTest" ADD CONSTRAINT "LabOrderTest_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "LabOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LabOrderTest" ADD CONSTRAINT "LabOrderTest_testDefinitionId_fkey"
  FOREIGN KEY ("testDefinitionId") REFERENCES "LaboratoryTestDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve existing clinical history while linking rows that can be matched safely.
UPDATE "LabOrder" o
SET "doctorId" = u.id
FROM "User" u
WHERE lower(trim(o.doctor)) = lower(trim(u."firstName" || ' ' || u."lastName"));

INSERT INTO "LabOrderTest" ("orderId", "testDefinitionId")
SELECT DISTINCT o.id, t.id
FROM "LabOrder" o
JOIN "LaboratoryTestDefinition" t ON t.name = ANY(o.tests)
ON CONFLICT DO NOTHING;
