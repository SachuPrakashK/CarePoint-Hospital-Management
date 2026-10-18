ALTER TABLE "HospitalSettings"
  ALTER COLUMN "hospitalName" SET DEFAULT 'MediCare+',
  ALTER COLUMN "hospitalCode" SET DEFAULT 'MEDICARE';

ALTER TABLE "ApplicationSettings"
  ALTER COLUMN "applicationName" SET DEFAULT 'MediCare+';

UPDATE "HospitalSettings"
SET "hospitalName" = 'MediCare+', "hospitalCode" = 'MEDICARE'
WHERE "hospitalName" = 'CarePoint Hospital' AND "hospitalCode" = 'CAREPOINT';

UPDATE "ApplicationSettings"
SET "applicationName" = 'MediCare+'
WHERE "applicationName" = 'CarePoint Hospital Management';
