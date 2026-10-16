CREATE UNIQUE INDEX "BedAllocation_one_active_per_bed"
ON "BedAllocation" ("bedId") WHERE "endedAt" IS NULL;

CREATE UNIQUE INDEX "BedAllocation_one_active_per_admission"
ON "BedAllocation" ("admissionId") WHERE "endedAt" IS NULL;
