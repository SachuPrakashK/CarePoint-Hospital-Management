-- Remove legacy preconfigured languages without deleting translation assets.
-- Existing preferences are safely moved to the English fallback before configuration rows are removed.
UPDATE "UserLanguagePreference"
SET "languageId" = english."id", "updatedAt" = CURRENT_TIMESTAMP
FROM "Language" legacy, "Language" english
WHERE "UserLanguagePreference"."languageId" = legacy."id"
  AND legacy."code" IN ('hi', 'ml', 'ta')
  AND english."code" = 'en';

DELETE FROM "Language" WHERE "code" IN ('hi', 'ml', 'ta');

UPDATE "Language"
SET "enabled" = true, "isDefault" = true, "translationCoverage" = 100, "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'en';
