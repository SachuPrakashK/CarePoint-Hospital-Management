CREATE TABLE "LanguageTranslation" (
  "id" TEXT NOT NULL,
  "languageId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LanguageTranslation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LanguageTranslation_languageId_key_key"
ON "LanguageTranslation"("languageId", "key");
CREATE INDEX "LanguageTranslation_languageId_idx" ON "LanguageTranslation"("languageId");
ALTER TABLE "LanguageTranslation"
ADD CONSTRAINT "LanguageTranslation_languageId_fkey"
FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE CASCADE ON UPDATE CASCADE;
