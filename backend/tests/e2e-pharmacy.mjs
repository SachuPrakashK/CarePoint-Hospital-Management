import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const base = `http://localhost:${process.env.PORT || 3000}/api/v1`;
let medicineId = '';
const call = async (path, token, init = {}) => { const response = await fetch(`${base}${path}`, { ...init, headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) } }); return { response, body: await response.json() }; };

try {
  const login = await fetch(`${base}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: process.env.SEED_HOSPITAL_ADMIN_EMAIL, password: process.env.SEED_HOSPITAL_ADMIN_PASSWORD }) });
  const session = await login.json(); assert.equal(login.status, 200); const token = session.data.access_token;
  const unauthorized = await call('/pharmacy/batches', ''); assert.equal(unauthorized.response.status, 401);
  const marker = `E2E Pharmacy ${randomUUID().slice(0, 8)}`; const category = `E2E Category ${randomUUID().slice(0, 6)}`;
  const medicine = await call('/pharmacy/medicines', token, { method: 'POST', body: JSON.stringify({ name: marker, genericName: 'E2E Generic', brand: 'E2E Brand', category, strength: '500 mg', form: 'Tablet', unit: 'Tablet', barcode: null, status: 'Active' }) });
  assert.equal(medicine.response.status, 201); medicineId = medicine.body.data.id;
  const expiresSoon = new Date(Date.now() + 30 * 86_400_000).toISOString(); const expiresLater = new Date(Date.now() + 200 * 86_400_000).toISOString();
  const receipt = async (batchNumber, expiresAt, quantity, reorderLevel) => call('/pharmacy/batches', token, { method: 'POST', body: JSON.stringify({ medicineId, batchNumber, expiresAt, purchasePrice: 10, sellingPrice: 12, quantity, reorderLevel }) });
  const first = await receipt(`LOW-${randomUUID().slice(0, 6)}`, expiresSoon, 5, 5); assert.equal(first.response.status, 201);
  const second = await receipt(`OK-${randomUUID().slice(0, 6)}`, expiresLater, 20, 5); assert.equal(second.response.status, 201);
  const combined = await call(`/pharmacy/batches?page=1&page_size=10&search=${encodeURIComponent(marker)}&category=${encodeURIComponent(category)}&low_stock=true&expiry=expiring_soon`, token);
  assert.equal(combined.response.status, 200); assert.equal(combined.body.data.length, 1); assert.equal(combined.body.data[0].id, first.body.data.id); assert.equal(combined.body.data[0].expiryStatus, 'Expiring Soon'); assert.equal(combined.body.data[0].lowStock, true);
  assert.ok(combined.body.meta.categories.includes(category)); assert.ok(combined.body.meta.base_total >= 2); assert.equal(combined.body.meta.expiry_soon_days, 90);
  const paged = await call(`/pharmacy/batches?page=1&page_size=1&search=${encodeURIComponent(marker)}`, token); assert.equal(paged.body.data.length, 1); assert.ok(paged.body.pagination.total >= 2); assert.ok(paged.body.pagination.total_pages >= 2);
  const ledger = await call(`/pharmacy/stock-movements?page_size=100&batch_id=${first.body.data.id}`, token); assert.equal(ledger.response.status, 200); assert.equal(ledger.body.data.length, 1); assert.equal(ledger.body.data[0].medicine.name, marker); assert.equal(ledger.body.data[0].batch.batchNumber, first.body.data.batchNumber); assert.match(ledger.body.data[0].reference, /^RCV-/); assert.ok(ledger.body.data[0].createdBy.displayName);
  const transactionsBefore = await prisma.stockTransaction.count({ where: { batch: { medicineId } } });
  const duplicate = await receipt(first.body.data.batchNumber, expiresSoon, 5, 5); assert.equal(duplicate.response.status, 409);
  const transactionsAfter = await prisma.stockTransaction.count({ where: { batch: { medicineId } } }); assert.equal(transactionsAfter, transactionsBefore);
  const invalid = await receipt(`OLD-${randomUUID().slice(0, 6)}`, new Date(Date.now() - 86_400_000).toISOString(), 2, 1); assert.equal(invalid.response.status, 422);
  const auditCount = await prisma.auditLog.count({ where: { module: 'pharmacy', entityId: { in: [first.body.data.id, second.body.data.id] } } }); assert.equal(auditCount, 2);
  console.log(JSON.stringify({ search: 'passed', filters: 'passed', lowStock: 'passed', expiry: 'passed', pagination: 'passed', ledgerRelations: 'passed', receiptTransaction: 'passed', rollback: 'passed', validation: 'passed', rbac: 'passed', audit: 'passed' }));
} finally {
  if (medicineId) { const batches = await prisma.medicineBatch.findMany({ where: { medicineId }, select: { id: true } }); const ids = batches.map((item) => item.id); await prisma.auditLog.deleteMany({ where: { module: 'pharmacy', entityId: { in: ids } } }); await prisma.stockTransaction.deleteMany({ where: { batchId: { in: ids } } }); await prisma.medicineBatch.deleteMany({ where: { medicineId } }); await prisma.medicine.deleteMany({ where: { id: medicineId } }); }
  await prisma.$disconnect();
}
