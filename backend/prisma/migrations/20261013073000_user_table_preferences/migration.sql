CREATE TABLE "UserTablePreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  "visibleColumnIds" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserTablePreference_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserTablePreference_userId_tableId_key" ON "UserTablePreference"("userId", "tableId");
CREATE INDEX "UserTablePreference_userId_idx" ON "UserTablePreference"("userId");
ALTER TABLE "UserTablePreference" ADD CONSTRAINT "UserTablePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
