CREATE TABLE "RadiologyInvestigation" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "modality" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RadiologyInvestigation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RadiologyInvestigation_code_key" ON "RadiologyInvestigation"("code");
CREATE UNIQUE INDEX "RadiologyInvestigation_name_key" ON "RadiologyInvestigation"("name");
CREATE INDEX "RadiologyInvestigation_status_name_idx" ON "RadiologyInvestigation"("status", "name");

CREATE TABLE "LaboratoryTestDefinition" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "unit" TEXT,
  "referenceRange" TEXT,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Active',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LaboratoryTestDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LaboratoryTestDefinition_code_key" ON "LaboratoryTestDefinition"("code");
CREATE UNIQUE INDEX "LaboratoryTestDefinition_name_key" ON "LaboratoryTestDefinition"("name");
CREATE INDEX "LaboratoryTestDefinition_status_category_name_idx" ON "LaboratoryTestDefinition"("status", "category", "name");
