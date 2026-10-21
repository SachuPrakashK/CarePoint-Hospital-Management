ALTER TABLE "Payment" ADD COLUMN "idempotencyKey" TEXT;

UPDATE "Payment"
SET "idempotencyKey" = 'legacy-' || "id";

ALTER TABLE "Payment" ALTER COLUMN "idempotencyKey" SET NOT NULL;

CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
