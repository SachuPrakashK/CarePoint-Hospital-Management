ALTER TABLE "Invoice" ADD COLUMN "createdById" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "Invoice_idempotencyKey_key" ON "Invoice"("idempotencyKey");
