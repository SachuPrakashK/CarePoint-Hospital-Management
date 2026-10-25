ALTER TABLE "Refund" ADD COLUMN "idempotencyKey" TEXT;

UPDATE "Refund"
SET "idempotencyKey" = 'legacy-' || "id";

ALTER TABLE "Refund" ALTER COLUMN "idempotencyKey" SET NOT NULL;

CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");
