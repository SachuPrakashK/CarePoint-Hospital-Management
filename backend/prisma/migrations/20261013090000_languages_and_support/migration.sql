CREATE TABLE "Language" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nativeName" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "translationCoverage" INTEGER NOT NULL DEFAULT 0,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Language_code_key" ON "Language"("code");
CREATE INDEX "Language_enabled_name_idx" ON "Language"("enabled", "name");

CREATE TABLE "UserLanguagePreference" (
  "userId" TEXT NOT NULL,
  "languageId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserLanguagePreference_pkey" PRIMARY KEY ("userId")
);
CREATE INDEX "UserLanguagePreference_languageId_idx" ON "UserLanguagePreference"("languageId");
ALTER TABLE "UserLanguagePreference" ADD CONSTRAINT "UserLanguagePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserLanguagePreference" ADD CONSTRAINT "UserLanguagePreference_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "HelpArticle" (
  "id" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "relatedModule" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HelpArticle_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HelpArticle_status_category_updatedAt_idx" ON "HelpArticle"("status", "category", "updatedAt");

CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL,
  "ticketNumber" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "assignedToId" TEXT,
  "subject" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "issueType" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "currentRoute" TEXT,
  "appVersion" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupportTicket_ticketNumber_key" ON "SupportTicket"("ticketNumber");
CREATE INDEX "SupportTicket_requesterId_createdAt_idx" ON "SupportTicket"("requesterId", "createdAt");
CREATE INDEX "SupportTicket_status_updatedAt_idx" ON "SupportTicket"("status", "updatedAt");
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SupportTicketStatusHistory" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "changedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicketStatusHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportTicketStatusHistory_ticketId_createdAt_idx" ON "SupportTicketStatusHistory"("ticketId", "createdAt");
ALTER TABLE "SupportTicketStatusHistory" ADD CONSTRAINT "SupportTicketStatusHistory_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportTicketStatusHistory" ADD CONSTRAINT "SupportTicketStatusHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SupportContactSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "email" TEXT NOT NULL DEFAULT '',
  "phone" TEXT NOT NULL DEFAULT '',
  "workingHours" TEXT NOT NULL DEFAULT '',
  "portalUrl" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportContactSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Language" ("id", "code", "name", "nativeName", "enabled", "translationCoverage", "isDefault", "updatedAt") VALUES
  (gen_random_uuid()::text, 'en', 'English', 'English', true, 100, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'hi', 'Hindi', 'हिन्दी', false, 10, false, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'ml', 'Malayalam', 'മലയാളം', false, 10, false, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'ta', 'Tamil', 'தமிழ்', false, 10, false, CURRENT_TIMESTAMP);

INSERT INTO "SupportContactSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP);

INSERT INTO "Permission" ("id", "code", "module", "action", "description") VALUES
  (gen_random_uuid()::text, 'support.view', 'support', 'view', 'View help and own support requests'),
  (gen_random_uuid()::text, 'support.ticket.create', 'support', 'ticket_create', 'Create support requests'),
  (gen_random_uuid()::text, 'support.ticket.manage', 'support', 'ticket_manage', 'Manage all support requests'),
  (gen_random_uuid()::text, 'support.article.manage', 'support', 'article_manage', 'Manage help articles')
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE p."code" IN ('support.view', 'support.ticket.create')
ON CONFLICT DO NOTHING;
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r."id", p."id" FROM "Role" r CROSS JOIN "Permission" p
WHERE r."code" = 'HOSPITAL_ADMIN' AND p."code" IN ('support.ticket.manage', 'support.article.manage')
ON CONFLICT DO NOTHING;
