-- Patient records remain untouched. Only obsolete authentication-role assignments are cleaned up.
UPDATE "User"
SET "status" = 'INACTIVE'
WHERE EXISTS (
  SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r."id" = ur."roleId"
  WHERE ur."userId" = "User"."id" AND r."code" IN ('SUPER_ADMIN', 'ADMIN', 'PATIENT')
)
AND NOT EXISTS (
  SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r."id" = ur."roleId"
  WHERE ur."userId" = "User"."id" AND r."code" NOT IN ('SUPER_ADMIN', 'ADMIN', 'PATIENT')
);

DELETE FROM "UserRole" WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "code" IN ('SUPER_ADMIN', 'ADMIN', 'PATIENT'));
DELETE FROM "RolePermission" WHERE "roleId" IN (SELECT "id" FROM "Role" WHERE "code" IN ('SUPER_ADMIN', 'ADMIN', 'PATIENT'));
DELETE FROM "Role" WHERE "code" IN ('SUPER_ADMIN', 'ADMIN', 'PATIENT');
