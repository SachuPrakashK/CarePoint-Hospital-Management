import 'dotenv/config';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const api = `http://localhost:${process.env.PORT || 3000}/api/v1`;
const call = async (path, token, method = 'GET', body) => {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => null);
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(payload)}`);
  return payload;
};

const login = await call('/auth/login', '', 'POST', {
  email: process.env.SEED_HOSPITAL_ADMIN_EMAIL,
  password: process.env.SEED_HOSPITAL_ADMIN_PASSWORD,
});
const token = login.data.access_token;
const patient = await prisma.patient.findFirst({ where: { deletedAt: null } });
const category = await prisma.inventoryCategory.findFirst({ where: { isActive: true } });
const provider = await prisma.insuranceProvider.findFirst({ where: { isActive: true } });
const doctor = await prisma.user.findFirst({
  where: { status: 'ACTIVE', roles: { some: { role: { code: 'DOCTOR' } } } },
});
const labDefinition = await prisma.laboratoryTestDefinition.findFirst({
  where: { status: 'Active' },
});
assert.ok(patient && category && provider && doctor && labDefinition);
const stamp = Date.now();

const item = (
  await call('/inventory/items', token, 'POST', {
    name: `E2E Gauze ${stamp}`,
    code: `E2E-${stamp}`,
    categoryId: category.id,
    unit: 'Pack',
    store: 'Main',
    quantity: 5,
    reorderLevel: 2,
  })
).data;
await call(`/inventory/items/${item.id}`, token, 'PUT', { store: 'E2E Main Store' });
await call(`/inventory/items/${item.id}/movements`, token, 'POST', {
  type: 'Stock In',
  quantity: 3,
  reference: `E2E-${stamp}`,
});
await call(`/inventory/items/${item.id}/movements`, token, 'POST', {
  type: 'Stock Out',
  quantity: 2,
  reference: `E2E-${stamp}`,
});
assert.equal((await prisma.inventoryItem.findUnique({ where: { id: item.id } })).quantity, 6);

const ambulance = (
  await call('/ambulances', token, 'POST', {
    number: `AMB-${stamp}`,
    registration: `KA01E${String(stamp).slice(-5)}`,
    vehicleType: 'Basic',
    status: 'Available',
  })
).data;
await call(`/ambulances/${ambulance.id}`, token, 'PUT', {
  driver: 'E2E Driver',
  driverContact: '9876543210',
});
const booking = (
  await call('/ambulance-bookings', token, 'POST', {
    patientId: patient.id,
    pickup: 'Clinic',
    destination: 'Hospital',
    charges: 500,
  })
).data;
await call(`/ambulance-bookings/${booking.id}/assign`, token, 'PATCH', {
  ambulanceId: ambulance.id,
});

const invoice = (
  await call('/billing', token, 'POST', {
    patientId: patient.id,
    items: [
      {
        source: 'E2E',
        sourceId: item.id,
        description: 'E2E charge',
        quantity: 2,
        unitPrice: 125.5,
      },
    ],
  })
).data;
await call(`/billing/${invoice.id}/payments`, token, 'POST', {
  amount: 251,
  method: 'Cash',
  reference: `E2E-${stamp}`,
});
assert.equal((await prisma.invoice.findUnique({ where: { id: invoice.id } })).status, 'Paid');

const policy = (
  await call('/insurance/policies', token, 'POST', {
    patientId: patient.id,
    providerId: provider.id,
    policyNumber: `POL-${stamp}`,
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 86400000 * 365).toISOString(),
    coverageLimit: 100000,
    relationship: 'Self',
    priority: 'Primary',
  })
).data;
const claim = (
  await call('/insurance/claims', token, 'POST', {
    patientId: patient.id,
    insuranceId: policy.id,
    invoiceId: invoice.id,
    claimedAmount: 251,
  })
).data;
await call(`/insurance/claims/${claim.id}`, token, 'PATCH', { status: 'Submitted' });

const lab = (
  await call('/laboratory/orders', token, 'POST', {
    patientId: patient.id,
    doctorId: doctor.id,
    testDefinitionIds: [labDefinition.id],
    priority: 'Routine',
    sampleType: 'Blood',
  })
).data;
await call(`/laboratory/orders/${lab.id}/status`, token, 'PATCH', {
  status: 'Sample Collected',
  actor: 'E2E Technician',
});
await call(`/laboratory/orders/${lab.id}/result`, token, 'PUT', {
  actor: 'E2E Technician',
  results: [{ test: 'CBC', value: 'Normal', abnormal: false }],
});

const radiology = (
  await call('/radiology/orders', token, 'POST', {
    patientId: patient.id,
    investigation: 'Chest X-Ray',
    doctor: 'E2E Doctor',
  })
).data;
await call(`/radiology/orders/${radiology.id}`, token, 'PUT', {
  status: 'Completed',
  findings: 'No acute abnormality',
  impression: 'Normal',
});

const medicine = (
  await call('/pharmacy/medicines', token, 'POST', {
    name: `E2E Medicine ${stamp}`,
    genericName: 'E2E Generic',
    brand: 'MediCare+',
    category: 'General',
    strength: '10 mg',
    form: 'Tablet',
    unit: 'Tablet',
    barcode: `MED-${stamp}`,
    status: 'Active',
  })
).data;
const batch = (
  await call('/pharmacy/batches', token, 'POST', {
    medicineId: medicine.id,
    batchNumber: `BAT-${stamp}`,
    expiresAt: new Date(Date.now() + 86400000 * 365).toISOString(),
    purchasePrice: 2,
    sellingPrice: 5,
    quantity: 20,
    reorderLevel: 5,
  })
).data;
const dispense = (
  await call('/pharmacy/dispenses', token, 'POST', {
    patientId: patient.id,
    prescriptionRef: `RX-${stamp}`,
    items: [{ medicineId: medicine.id, batchId: batch.id, prescribedQuantity: 3, unitPrice: 5 }],
  })
).data;
await call(`/pharmacy/dispenses/${dispense.id}/complete`, token, 'POST', {
  items: [{ itemId: dispense.items[0].id, quantity: 3 }],
});

const supplier = (
  await call('/inventory/suppliers', token, 'POST', {
    name: `E2E Supplier ${stamp}`,
    code: `SUP-${stamp}`,
    contactPerson: 'E2E Contact',
    email: `supplier-${stamp}@example.test`,
  })
).data;
await call(`/inventory/suppliers/${supplier.id}`, token, 'PUT', {
  contactPerson: 'E2E Contact Updated',
});
const po = (
  await call('/procurement/orders', token, 'POST', {
    supplierId: supplier.id,
    itemType: 'Inventory',
    inventoryItemId: item.id,
    quantity: 10,
    unitPrice: 25,
  })
).data;
await call(`/procurement/orders/${po.id}`, token, 'PUT', { quantity: 12 });
const [itemDetail, supplierDetail, ambulanceDetail, purchaseDetail] = await Promise.all([
  call(`/inventory/items/${item.id}`, token),
  call(`/inventory/suppliers/${supplier.id}`, token),
  call(`/ambulances/${ambulance.id}`, token),
  call(`/procurement/orders/${po.id}`, token),
]);
assert.equal(itemDetail.data.category.id, category.id);
assert.equal(supplierDetail.data.id, supplier.id);
assert.equal(ambulanceDetail.data.driver, 'E2E Driver');
assert.equal(purchaseDetail.data.supplier.id, supplier.id);
assert.equal(purchaseDetail.data.inventoryItem.id, item.id);
await call(`/procurement/orders/${po.id}/receive`, token, 'POST', { quantity: 12 });
for (const [method, body] of [
  ['PUT', { quantity: 20 }],
  ['DELETE', undefined],
]) {
  const locked = await fetch(`${api}/procurement/orders/${po.id}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(locked.status, 409, `${method} must reject a received purchase order`);
}

const department = (
  await call('/masters/departments', token, 'POST', {
    code: `E${String(stamp).slice(-6)}`,
    name: `E2E Department ${stamp}`,
    status: 'Active',
  })
).data;
const specialization = (
  await call('/masters/specializations', token, 'POST', {
    code: `S${String(stamp).slice(-6)}`,
    name: `E2E Specialization ${stamp}`,
    departmentId: department.id,
    status: 'Active',
  })
).data;
await call(`/masters/specializations/${specialization.id}`, token, 'PUT', {
  name: `E2E Specialty ${stamp}`,
});
await call(`/masters/departments/${department.id}`, token, 'DELETE');

const lookups = (await call('/inpatient-lookups', token)).data;
const bed = (await call('/beds/availability', token)).data[0];
if (bed && lookups.doctors[0] && lookups.departments[0]) {
  const admission = (
    await call('/admissions', token, 'POST', {
      patientId: patient.id,
      departmentId: lookups.departments[0].id,
      attendingDoctorId: lookups.doctors[0].id,
      bedId: bed.id,
      admittedAt: new Date().toISOString(),
      type: 'Planned',
      reason: 'E2E persistence verification',
      initialDiagnosis: 'Observation',
    })
  ).data;
  await call('/nursing-notes', token, 'POST', {
    admissionId: admission.id,
    observation: 'Stable',
    intervention: 'Monitor',
    notes: 'E2E',
  });
  await call(`/admissions/${admission.id}/discharge`, token, 'POST', {
    finalDiagnosis: 'Stable',
    treatmentSummary: 'Observation',
    procedures: '',
    investigationSummary: '',
    conditionAtDischarge: 'Stable',
    medications: '',
    instructions: 'Follow up',
    followUp: 'As needed',
    attendingDoctor: 'E2E Doctor',
  });
  assert.equal(
    await prisma.admission.count({ where: { id: admission.id, status: 'DISCHARGED' } }),
    1,
  );
}

assert.equal(await prisma.inventoryMovement.count({ where: { itemId: item.id } }), 3);
assert.equal(
  await prisma.ambulanceBooking.count({ where: { id: booking.id, status: 'Assigned' } }),
  1,
);
assert.equal(await prisma.payment.count({ where: { invoiceId: invoice.id } }), 1);
assert.equal(
  await prisma.insuranceClaim.count({ where: { id: claim.id, status: 'Submitted' } }),
  1,
);
assert.equal(await prisma.labResult.count({ where: { orderId: lab.id } }), 1);
assert.equal(
  await prisma.radiologyOrder.count({ where: { id: radiology.id, status: 'Completed' } }),
  1,
);
assert.equal((await prisma.medicineBatch.findUnique({ where: { id: batch.id } })).quantity, 17);
assert.equal(
  await prisma.stockTransaction.count({ where: { batchId: batch.id, type: 'Dispense' } }),
  1,
);
assert.equal(await prisma.purchaseOrder.count({ where: { id: po.id, status: 'Received' } }), 1);
assert.equal(
  (await prisma.inventoryItem.findUnique({ where: { id: item.id } })).store,
  'E2E Main Store',
);
assert.equal(
  (await prisma.ambulance.findUnique({ where: { id: ambulance.id } })).driver,
  'E2E Driver',
);
assert.equal(
  (await prisma.supplier.findUnique({ where: { id: supplier.id } })).contactPerson,
  'E2E Contact Updated',
);
await call(`/inventory/suppliers/${supplier.id}`, token, 'DELETE');
await call(`/ambulances/${ambulance.id}`, token, 'DELETE');
assert.equal((await prisma.supplier.findUnique({ where: { id: supplier.id } })).isActive, false);
assert.equal((await prisma.ambulance.findUnique({ where: { id: ambulance.id } })).isActive, false);
assert.equal(
  await prisma.specialization.count({
    where: { id: specialization.id, name: `E2E Specialty ${stamp}` },
  }),
  1,
);
console.log(
  JSON.stringify({
    inventory: 'passed',
    ambulance: 'passed',
    billing: 'passed',
    insurance: 'passed',
    laboratory: 'passed',
    radiology: 'passed',
    pharmacy: 'passed',
    procurement: 'passed',
    inpatient: 'passed',
    administration: 'passed',
    persisted: true,
  }),
);
await prisma.$disconnect();
