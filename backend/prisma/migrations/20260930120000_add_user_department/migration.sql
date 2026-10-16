ALTER TABLE "User" ADD COLUMN "departmentId" TEXT;

CREATE INDEX "User_departmentId_status_idx" ON "User"("departmentId", "status");

ALTER TABLE "User"
ADD CONSTRAINT "User_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
