import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermissions } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { phase23Service as service } from '../services/phase23.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/app-error.js';
const shell = (body: z.ZodType = z.object({}).passthrough()) =>
  z.object({ body, query: z.object({}).passthrough(), params: z.object({}).passthrough() });
const id = z.object({
  body: z.object({}).passthrough().optional(),
  query: z.object({}).passthrough().optional(),
  params: z.object({ id: z.uuid() }),
});
export const auditQuery = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(120).optional(),
    module: z.string().trim().max(80).optional(),
    action: z.string().trim().max(80).optional(),
    user_id: z.uuid().optional(),
    entity_type: z.string().trim().max(100).optional(),
    created_from: z.iso.date().optional(),
    created_to: z.iso.date().optional(),
    sort_by: z.enum(['createdAt', 'user', 'action', 'module', 'entityType']).optional(),
    sort_order: z.enum(['asc', 'desc']).optional(),
  })
  .refine(
    (query) => !query.created_from || !query.created_to || query.created_from <= query.created_to,
    {
      message: 'From date must be on or before To date.',
      path: ['created_to'],
    },
  );
const auditRequest = z.object({
  body: z.object({}).passthrough().optional(),
  params: z.object({}).passthrough(),
  query: auditQuery,
});
const send = (fn: (q: any) => any, status = 200) =>
  asyncHandler(async (q, r) => r.status(status).json(await fn(q)));
export const phase23Routes = Router();
phase23Routes.use(authenticate);
const sortKeysByPath: Record<string, readonly string[]> = {
  '/inventory/items': ['code', 'name', 'category', 'quantity', 'reorderLevel', 'unit'],
  '/inventory/suppliers': ['name', 'contactPerson', 'phone', 'email', 'taxNumber'],
  '/ambulances': ['number', 'registration', 'driver', 'driverContact', 'status'],
  '/ambulance-bookings': [
    'number',
    'patient',
    'ambulance',
    'pickup',
    'destination',
    'scheduledAt',
    'status',
    'charges',
  ],
  '/billing': ['number', 'patient', 'createdAt', 'status'],
  '/billing-payments': ['receiptNumber', 'invoice', 'paidAt', 'amount', 'method', 'reference'],
  '/billing/refunds': ['createdAt', 'payment', 'amount', 'reason', 'status'],
  '/insurance/providers': ['name', 'code', 'contact', 'address'],
  '/insurance/policies': [
    'patient',
    'provider',
    'policyNumber',
    'memberNumber',
    'coverageLimit',
    'startsAt',
    'priority',
  ],
  '/insurance/claims': [
    'number',
    'patient',
    'invoice',
    'claimedAmount',
    'approvedAmount',
    'patientResponsibility',
    'status',
  ],
  '/procurement/orders': [
    'number',
    'supplier',
    'item',
    'quantity',
    'receivedQuantity',
    'unitPrice',
    'status',
  ],
  '/audit': ['createdAt', 'user', 'action', 'module', 'entityType'],
  '/masters/departments': ['name', 'code', 'status'],
  '/masters/specializations': ['name', 'code', 'department', 'status'],
  '/masters/radiology-investigations': ['name', 'code', 'modality', 'status'],
  '/masters/laboratory-tests': ['name', 'code', 'category', 'unit', 'status'],
};
phase23Routes.use((req, _res, next) => {
  if (req.method !== 'GET') return next();
  const allowed = sortKeysByPath[req.path];
  const field = typeof req.query.sort_by === 'string' ? req.query.sort_by : '';
  const direction = typeof req.query.sort_order === 'string' ? req.query.sort_order : '';
  if (field && allowed && !allowed.includes(field))
    return next(new AppError(422, 'Unsupported sort field.', 'VALIDATION_ERROR'));
  if (direction && !['asc', 'desc'].includes(direction))
    return next(new AppError(422, 'Unsupported sort direction.', 'VALIDATION_ERROR'));
  next();
});
const item = z.object({
  code: z.string().max(40).optional(),
  name: z.string().trim().min(2).max(120),
  categoryId: z.uuid(),
  supplierId: z.uuid().optional().nullable(),
  unit: z.string().min(1).max(30),
  store: z.string().min(1).max(80),
  quantity: z.number().int().nonnegative().default(0),
  reorderLevel: z.number().int().nonnegative(),
  expiresAt: z.iso.datetime().optional().nullable(),
});
export const inventoryItemUpdateSchema = item.partial().extend({
  quantity: z.number().int().nonnegative().optional(),
});
phase23Routes.get(
  '/inventory/items',
  requirePermissions('inventory.view'),
  send(async (q) => service.inventory.list(q.query)),
);
phase23Routes.post(
  '/inventory/items',
  requirePermissions('inventory.create'),
  validate(shell(item)),
  send(async (q) => ({ data: await service.inventory.create(q.body) }), 201),
);
phase23Routes.get(
  '/inventory/items/:id',
  requirePermissions('inventory.view'),
  validate(id),
  send(async (q) => ({ data: await service.inventory.get(q.params.id) })),
);
phase23Routes.put(
  '/inventory/items/:id',
  requirePermissions('inventory.edit'),
  validate(
    z.object({
      body: inventoryItemUpdateSchema,
      query: z.object({}).passthrough(),
      params: z.object({ id: z.uuid() }),
    }),
  ),
  send(async (q) => ({ data: await service.inventory.update(q.params.id, q.body) })),
);
phase23Routes.delete(
  '/inventory/items/:id',
  requirePermissions('inventory.delete'),
  validate(id),
  send(async (q) => ({ data: await service.inventory.remove(q.params.id) })),
);
phase23Routes.post(
  '/inventory/items/:id/movements',
  requirePermissions('inventory.stock'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: z.object({
        type: z.enum(['Stock In', 'Stock Out']),
        quantity: z.number().int().positive(),
        reference: z.string().max(100).optional(),
        notes: z.string().max(500).optional(),
      }),
    }),
  ),
  send(
    async (q) => ({ data: await service.inventory.move(q.params.id, q.body, q.auth!.userId) }),
    201,
  ),
);
phase23Routes.get(
  '/inventory/categories',
  requirePermissions('inventory.view'),
  send(async () => ({ data: await service.inventory.categories() })),
);
phase23Routes.post(
  '/inventory/categories',
  requirePermissions('inventory.create'),
  validate(shell(z.object({ name: z.string().min(2), code: z.string().min(2) }))),
  send(async (q) => ({ data: await service.inventory.createCategory(q.body) }), 201),
);
phase23Routes.put(
  '/inventory/categories/:id',
  requirePermissions('inventory.edit'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: z.object({
        name: z.string().min(2).optional(),
        code: z.string().min(2).optional(),
        isActive: z.boolean().optional(),
      }),
    }),
  ),
  send(async (q) => ({ data: await service.inventory.updateCategory(q.params.id, q.body) })),
);
phase23Routes.delete(
  '/inventory/categories/:id',
  requirePermissions('inventory.delete'),
  validate(id),
  send(async (q) => ({ data: await service.inventory.removeCategory(q.params.id) })),
);
phase23Routes.get(
  '/inventory/suppliers',
  requirePermissions('inventory.view'),
  send(async (q) => service.inventory.suppliers(q.query)),
);
phase23Routes.post(
  '/inventory/suppliers',
  requirePermissions('inventory.create'),
  validate(
    shell(
      z.object({
        name: z.string().min(2),
        code: z.string().min(2),
        contactPerson: z.string().optional(),
        phone: z.string().optional(),
        email: z.email().optional(),
        address: z.string().optional(),
        taxNumber: z.string().optional(),
      }),
    ),
  ),
  send(async (q) => ({ data: await service.inventory.createSupplier(q.body) }), 201),
);
phase23Routes.get(
  '/inventory/suppliers/:id',
  requirePermissions('inventory.view'),
  validate(id),
  send(async (q) => ({ data: await service.inventory.getSupplier(q.params.id) })),
);
phase23Routes.put(
  '/inventory/suppliers/:id',
  requirePermissions('inventory.edit'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: z.object({
        name: z.string().min(2).optional(),
        code: z.string().min(2).optional(),
        contactPerson: z.string().optional(),
        phone: z.string().optional(),
        email: z.email().optional(),
        address: z.string().optional(),
        taxNumber: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
    }),
  ),
  send(async (q) => ({ data: await service.inventory.updateSupplier(q.params.id, q.body) })),
);
phase23Routes.delete(
  '/inventory/suppliers/:id',
  requirePermissions('inventory.delete'),
  validate(id),
  send(async (q) => ({ data: await service.inventory.removeSupplier(q.params.id) })),
);
const ambulance = z.object({
  number: z.string().min(2),
  registration: z.string().min(4),
  vehicleType: z.string().min(2),
  driver: z.string().optional(),
  driverContact: z.string().optional(),
  status: z
    .enum(['Available', 'Assigned', 'On Trip', 'Maintenance', 'Out of Service'])
    .default('Available'),
});
phase23Routes.get(
  '/ambulances',
  requirePermissions('ambulance.view'),
  send(async (q) => service.ambulance.list(q.query)),
);
phase23Routes.post(
  '/ambulances',
  requirePermissions('ambulance.create'),
  validate(shell(ambulance)),
  send(async (q) => ({ data: await service.ambulance.create(q.body) }), 201),
);
phase23Routes.get(
  '/ambulances/:id',
  requirePermissions('ambulance.view'),
  validate(id),
  send(async (q) => ({ data: await service.ambulance.get(q.params.id) })),
);
phase23Routes.put(
  '/ambulances/:id',
  requirePermissions('ambulance.edit'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: ambulance.partial(),
    }),
  ),
  send(async (q) => ({ data: await service.ambulance.update(q.params.id, q.body) })),
);
phase23Routes.delete(
  '/ambulances/:id',
  requirePermissions('ambulance.delete'),
  validate(id),
  send(async (q) => ({ data: await service.ambulance.remove(q.params.id) })),
);
phase23Routes.get(
  '/ambulance-bookings',
  requirePermissions('ambulance.view'),
  send(async (q) => service.ambulance.bookings(q.query)),
);
phase23Routes.post(
  '/ambulance-bookings',
  requirePermissions('ambulance.create'),
  validate(
    shell(
      z.object({
        patientId: z.uuid(),
        ambulanceId: z.uuid().optional(),
        pickup: z.string().min(2),
        destination: z.string().min(2),
        charges: z.number().nonnegative().default(0),
      }),
    ),
  ),
  send(async (q) => ({ data: await service.ambulance.book(q.body) }), 201),
);
phase23Routes.patch(
  '/ambulance-bookings/:id/assign',
  requirePermissions('ambulance.edit'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: z.object({ ambulanceId: z.uuid() }),
    }),
  ),
  send(async (q) => ({ data: await service.ambulance.assign(q.params.id, q.body.ambulanceId) })),
);
phase23Routes.get(
  '/billing',
  requirePermissions('billing.view'),
  send(async (q) => service.billing.list(q.query)),
);
phase23Routes.get(
  '/billing/refunds',
  requirePermissions('billing.view'),
  send(async (q) => service.billing.refunds(q.query)),
);
phase23Routes.get(
  '/billing-payments',
  requirePermissions('billing.view'),
  send(async (q) => service.billing.payments(q.query)),
);
phase23Routes.get(
  '/billing/:id',
  requirePermissions('billing.view'),
  validate(id),
  send(async (q) => ({ data: await service.billing.get(q.params.id) })),
);
phase23Routes.post(
  '/billing',
  requirePermissions('billing.create'),
  validate(
    shell(
      z.object({
        patientId: z.uuid(),
        items: z
          .array(
            z.object({
              source: z.string(),
              sourceId: z.string(),
              description: z.string(),
              quantity: z.number().positive(),
              unitPrice: z.number().nonnegative(),
            }),
          )
          .min(1),
      }),
    ),
  ),
  send(async (q) => ({ data: await service.billing.create(q.body) }), 201),
);
phase23Routes.post(
  '/billing/:id/payments',
  requirePermissions('billing.payment'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: z.object({
        amount: z.number().positive(),
        method: z.string().min(1),
        reference: z.string().optional(),
      }),
    }),
  ),
  send(async (q) => {
    const idempotencyKey = z.uuid().safeParse(q.get('idempotency-key'));
    if (!idempotencyKey.success)
      throw new AppError(
        422,
        'A valid Idempotency-Key header is required.',
        'IDEMPOTENCY_KEY_REQUIRED',
      );
    return {
      data: await service.billing.payment(q.params.id, q.body, q.auth!.userId, idempotencyKey.data),
    };
  }, 201),
);
phase23Routes.put(
  '/billing/:id',
  requirePermissions('billing.create'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: z.object({
        patientId: z.uuid(),
        items: z
          .array(
            z.object({
              source: z.string(),
              sourceId: z.string(),
              description: z.string(),
              quantity: z.number().positive(),
              unitPrice: z.number().nonnegative(),
            }),
          )
          .min(1),
      }),
    }),
  ),
  send(async (q) => ({ data: await service.billing.update(q.params.id, q.body) })),
);
phase23Routes.delete(
  '/billing/:id',
  requirePermissions('billing.create'),
  validate(id),
  send(async (q) => ({ data: await service.billing.cancel(q.params.id) })),
);
phase23Routes.post(
  '/billing/payments/:id/refunds',
  requirePermissions('billing.refund'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: z.object({ amount: z.number().positive(), reason: z.string().trim().min(3).max(500) }),
    }),
  ),
  send(
    async (q) => ({
      data: await service.billing.requestRefund(q.params.id, q.body, q.auth!.userId),
    }),
    201,
  ),
);
phase23Routes.patch(
  '/billing/refunds/:id',
  requirePermissions('billing.refund'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: z.object({ status: z.enum(['Approved', 'Rejected']) }),
    }),
  ),
  send(async (q) => ({
    data: await service.billing.approveRefund(q.params.id, q.body.status, q.auth!.userId),
  })),
);
phase23Routes.get(
  '/insurance/providers',
  requirePermissions('insurance.view'),
  send(async (q) => service.insurance.providers(q.query)),
);
phase23Routes.post(
  '/insurance/providers',
  requirePermissions('insurance.create'),
  validate(
    shell(
      z.object({
        name: z.string().min(2),
        code: z.string().min(2),
        contact: z.string().optional(),
        address: z.string().optional(),
      }),
    ),
  ),
  send(async (q) => ({ data: await service.insurance.createProvider(q.body) }), 201),
);
phase23Routes.put(
  '/insurance/providers/:id',
  requirePermissions('insurance.edit'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: z.object({
        name: z.string().min(2).optional(),
        code: z.string().min(2).optional(),
        contact: z.string().optional(),
        address: z.string().optional(),
        isActive: z.boolean().optional(),
      }),
    }),
  ),
  send(async (q) => ({ data: await service.insurance.updateProvider(q.params.id, q.body) })),
);
phase23Routes.delete(
  '/insurance/providers/:id',
  requirePermissions('insurance.edit'),
  validate(id),
  send(async (q) => ({ data: await service.insurance.removeProvider(q.params.id) })),
);
phase23Routes.get(
  '/insurance/policies',
  requirePermissions('insurance.view'),
  send(async (q) => service.insurance.policies(q.query)),
);
phase23Routes.post(
  '/insurance/policies',
  requirePermissions('insurance.create'),
  validate(
    shell(
      z.object({
        patientId: z.uuid(),
        providerId: z.uuid(),
        policyNumber: z.string().min(2),
        memberNumber: z.string().optional(),
        startsAt: z.iso.datetime(),
        endsAt: z.iso.datetime(),
        coverageLimit: z.number().nonnegative(),
        relationship: z.string(),
        priority: z.enum(['Primary', 'Secondary']),
      }),
    ),
  ),
  send(async (q) => ({ data: await service.insurance.createPolicy(q.body) }), 201),
);
phase23Routes.put(
  '/insurance/policies/:id',
  requirePermissions('insurance.edit'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: z.object({
        patientId: z.uuid().optional(),
        providerId: z.uuid().optional(),
        policyNumber: z.string().min(2).optional(),
        memberNumber: z.string().optional(),
        startsAt: z.iso.datetime().optional(),
        endsAt: z.iso.datetime().optional(),
        coverageLimit: z.number().nonnegative().optional(),
        relationship: z.string().optional(),
        priority: z.enum(['Primary', 'Secondary']).optional(),
      }),
    }),
  ),
  send(async (q) => ({ data: await service.insurance.updatePolicy(q.params.id, q.body) })),
);
phase23Routes.delete(
  '/insurance/policies/:id',
  requirePermissions('insurance.edit'),
  validate(id),
  send(async (q) => ({ data: await service.insurance.deactivatePolicy(q.params.id) })),
);
phase23Routes.get(
  '/insurance/claims',
  requirePermissions('insurance.view'),
  send(async (q) => service.insurance.claims(q.query)),
);
phase23Routes.post(
  '/insurance/claims',
  requirePermissions('insurance.create'),
  validate(
    shell(
      z.object({
        patientId: z.uuid(),
        insuranceId: z.uuid(),
        invoiceId: z.uuid(),
        claimedAmount: z.number().positive(),
      }),
    ),
  ),
  send(async (q) => ({ data: await service.insurance.createClaim(q.body, q.auth!.userId) }), 201),
);
phase23Routes.patch(
  '/insurance/claims/:id',
  requirePermissions('insurance.edit'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: z.object({
        status: z
          .enum(['Submitted', 'Under Review', 'Approved', 'Rejected', 'Settled', 'Cancelled'])
          .optional(),
        approvedAmount: z.number().nonnegative().optional(),
        rejectedAmount: z.number().nonnegative().optional(),
        patientResponsibility: z.number().nonnegative().optional(),
      }),
    }),
  ),
  send(async (q) => ({
    data: await service.insurance.updateClaim(q.params.id, q.body, q.auth!.userId),
  })),
);
const order = z.object({
  patientId: z.uuid(),
  doctorId: z.uuid(),
  testDefinitionIds: z.array(z.uuid()).min(1),
  priority: z.enum(['Routine', 'Urgent', 'STAT']),
  clinicalNotes: z.string().optional(),
  sampleType: z.string().min(1),
});
const diagnosticList = (sortKeys: [string, ...string[]]) =>
  z.object({
    params: z.object({}).passthrough(),
    body: z.unknown(),
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      page_size: z.coerce.number().int().min(1).max(100).default(10),
      search: z.string().trim().max(100).optional(),
      status: z.string().trim().max(50).optional(),
      priority: z.string().trim().max(20).optional(),
      patient_id: z.uuid().optional(),
      doctor_id: z.uuid().optional(),
      test_definition_id: z.uuid().optional(),
      date_from: z.iso.date().optional(),
      date_to: z.iso.date().optional(),
      investigation: z.string().trim().max(150).optional(),
      sort_by: z.enum(sortKeys).default(sortKeys[0]),
      sort_order: z.enum(['asc', 'desc']).default('desc'),
    }),
  });
phase23Routes.get(
  '/laboratory/orders',
  requirePermissions('laboratory.view'),
  validate(
    diagnosticList([
      'createdAt',
      'number',
      'patient',
      'doctor',
      'priority',
      'sampleType',
      'status',
    ]),
  ),
  send(async (q) => service.laboratory.list(q.query)),
);
phase23Routes.get(
  '/laboratory/orders/:id',
  requirePermissions('laboratory.view'),
  validate(id),
  send(async (q) => ({ data: await service.laboratory.get(q.params.id) })),
);
phase23Routes.post(
  '/laboratory/orders',
  requirePermissions('laboratory.create'),
  validate(shell(order)),
  send(async (q) => ({ data: await service.laboratory.create(q.body) }), 201),
);
phase23Routes.put(
  '/laboratory/orders/:id',
  requirePermissions('laboratory.edit'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: order.partial(),
    }),
  ),
  send(async (q) => ({ data: await service.laboratory.update(q.params.id, q.body) })),
);
phase23Routes.patch(
  '/laboratory/orders/:id/status',
  requirePermissions('laboratory.result'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: z.object({
        status: z.enum(['Sample Collected', 'Processing', 'Verified', 'Completed', 'Cancelled']),
        actor: z.string().min(1),
      }),
    }),
  ),
  send(async (q) => ({ data: await service.laboratory.transition(q.params.id, q.body) })),
);
phase23Routes.put(
  '/laboratory/orders/:id/result',
  requirePermissions('laboratory.result'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: z.object({
        actor: z.string().min(1),
        results: z
          .array(
            z.object({
              test: z.string(),
              value: z.string(),
              unit: z.string().optional(),
              referenceRange: z.string().optional(),
              abnormal: z.boolean().default(false),
              notes: z.string().optional(),
            }),
          )
          .min(1),
      }),
    }),
  ),
  send(async (q) => ({ data: await service.laboratory.result(q.params.id, q.body) })),
);
phase23Routes.get(
  '/radiology/orders',
  requirePermissions('radiology.view'),
  validate(
    diagnosticList([
      'createdAt',
      'number',
      'patient',
      'investigation',
      'doctor',
      'scheduledAt',
      'status',
    ]),
  ),
  send(async (q) => service.radiology.list(q.query)),
);
phase23Routes.post(
  '/radiology/orders',
  requirePermissions('radiology.create'),
  validate(
    shell(
      z.object({
        patientId: z.uuid(),
        investigation: z.string().min(2),
        doctor: z.string().min(2),
        scheduledAt: z.iso.datetime().optional(),
        status: z.string().optional(),
      }),
    ),
  ),
  send(async (q) => ({ data: await service.radiology.create(q.body) }), 201),
);
phase23Routes.put(
  '/radiology/orders/:id',
  requirePermissions('radiology.report'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: z.object({
        patientId: z.uuid().optional(),
        investigation: z.string().min(2).optional(),
        doctor: z.string().min(2).optional(),
        scheduledAt: z.iso.datetime().optional(),
        findings: z.string().optional(),
        impression: z.string().optional(),
        reportedBy: z.string().optional(),
        verifiedBy: z.string().optional(),
        status: z
          .enum([
            'Ordered',
            'Scheduled',
            'Performed',
            'Reporting',
            'Verified',
            'Completed',
            'Cancelled',
          ])
          .optional(),
      }),
    }),
  ),
  send(async (q) => ({ data: await service.radiology.update(q.params.id, q.body) })),
);
phase23Routes.get(
  '/radiology/orders/:id',
  requirePermissions('radiology.view'),
  validate(id),
  send(async (q) => ({ data: await service.radiology.get(q.params.id) })),
);
phase23Routes.delete(
  '/radiology/orders/:id',
  requirePermissions('radiology.report'),
  validate(id),
  send(async (q) => ({ data: await service.radiology.cancel(q.params.id) })),
);
const medicine = z.object({
  name: z.string().trim().min(2).max(120),
  genericName: z.string().trim().min(2).max(120),
  brand: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  strength: z.string().trim().min(1).max(40),
  form: z.string().trim().min(1).max(40),
  unit: z.string().trim().min(1).max(40),
  barcode: z.string().max(80).optional().nullable(),
  status: z.enum(['Active', 'Inactive']).default('Active'),
});
phase23Routes.get(
  '/pharmacy/medicines',
  requirePermissions('pharmacy.view'),
  send(async (q) => service.pharmacy.medicines(q.query)),
);
phase23Routes.post(
  '/pharmacy/medicines',
  requirePermissions('pharmacy.manage'),
  validate(shell(medicine)),
  send(async (q) => ({ data: await service.pharmacy.createMedicine(q.body) }), 201),
);
phase23Routes.get(
  '/pharmacy/medicines/:id',
  requirePermissions('pharmacy.view'),
  validate(id),
  send(async (q) => ({ data: await service.pharmacy.medicine(q.params.id) })),
);
phase23Routes.put(
  '/pharmacy/medicines/:id',
  requirePermissions('pharmacy.manage'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: medicine.partial(),
    }),
  ),
  send(async (q) => ({ data: await service.pharmacy.updateMedicine(q.params.id, q.body) })),
);
phase23Routes.delete(
  '/pharmacy/medicines/:id',
  requirePermissions('pharmacy.manage'),
  validate(id),
  send(async (q) => ({ data: await service.pharmacy.deactivateMedicine(q.params.id) })),
);
const batch = z.object({
  medicineId: z.uuid(),
  batchNumber: z.string().trim().min(1).max(80),
  expiresAt: z.iso.datetime(),
  purchasePrice: z.number().nonnegative(),
  sellingPrice: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  reorderLevel: z.number().int().nonnegative(),
});
const batchList = z.object({
  params: z.object({}).passthrough(),
  body: z.unknown(),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(100).optional(),
    category: z.string().trim().max(100).optional(),
    low_stock: z.enum(['true']).optional(),
    expiry: z.enum(['expired', 'expiring_soon', 'valid']).optional(),
    medicine_id: z.uuid().optional(),
    sort_by: z
      .enum([
        'medicine',
        'batchNumber',
        'expiresAt',
        'purchasePrice',
        'sellingPrice',
        'quantity',
        'reorderLevel',
      ])
      .default('expiresAt'),
    sort_order: z.enum(['asc', 'desc']).default('asc'),
  }),
});
phase23Routes.get(
  '/pharmacy/batches',
  requirePermissions('pharmacy.view'),
  validate(batchList),
  send(async (q) => service.pharmacy.batches(q.query)),
);
phase23Routes.post(
  '/pharmacy/batches',
  requirePermissions('pharmacy.manage'),
  validate(shell(batch)),
  send(async (q) => ({ data: await service.pharmacy.createBatch(q.body, q.auth!.userId) }), 201),
);
phase23Routes.put(
  '/pharmacy/batches/:id',
  requirePermissions('pharmacy.manage'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: batch.partial().extend({ quantity: z.number().int().nonnegative().optional() }),
    }),
  ),
  send(async (q) => ({
    data: await service.pharmacy.updateBatch(q.params.id, q.body, q.auth!.userId),
  })),
);
phase23Routes.get(
  '/pharmacy/stock-movements',
  requirePermissions('pharmacy.view'),
  send(async (q) => service.pharmacy.ledger(q.query)),
);
phase23Routes.get(
  '/pharmacy/dispenses',
  requirePermissions('pharmacy.view'),
  send(async (q) => service.pharmacy.dispenses(q.query)),
);
phase23Routes.post(
  '/pharmacy/dispenses',
  requirePermissions('pharmacy.dispense'),
  validate(
    shell(
      z.object({
        patientId: z.uuid(),
        prescriptionRef: z.string().min(1),
        items: z
          .array(
            z.object({
              medicineId: z.uuid(),
              batchId: z.uuid(),
              prescribedQuantity: z.number().int().positive(),
              unitPrice: z.number().nonnegative(),
            }),
          )
          .min(1),
      }),
    ),
  ),
  send(async (q) => ({ data: await service.pharmacy.createDispense(q.body) }), 201),
);
phase23Routes.post(
  '/pharmacy/dispenses/:id/complete',
  requirePermissions('pharmacy.dispense'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: z.object({
        items: z
          .array(z.object({ itemId: z.uuid(), quantity: z.number().int().positive() }))
          .min(1),
      }),
    }),
  ),
  send(async (q) => ({
    data: await service.pharmacy.dispense(q.params.id, q.body, q.auth!.userId),
  })),
);
const purchaseOrder = z.object({
  supplierId: z.uuid(),
  itemType: z.enum(['Medicine', 'Inventory']),
  medicineId: z.uuid().optional().nullable(),
  inventoryItemId: z.uuid().optional().nullable(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});
phase23Routes.get(
  '/procurement/orders',
  requirePermissions('inventory.view'),
  send(async (q) => service.procurement.list(q.query)),
);
phase23Routes.post(
  '/procurement/orders',
  requirePermissions('inventory.create'),
  validate(shell(purchaseOrder)),
  send(async (q) => ({ data: await service.procurement.create(q.body) }), 201),
);
phase23Routes.get(
  '/procurement/orders/:id',
  requirePermissions('inventory.view'),
  validate(id),
  send(async (q) => ({ data: await service.procurement.get(q.params.id) })),
);
phase23Routes.put(
  '/procurement/orders/:id',
  requirePermissions('inventory.edit'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: purchaseOrder.partial(),
    }),
  ),
  send(async (q) => ({ data: await service.procurement.update(q.params.id, q.body) })),
);
phase23Routes.delete(
  '/procurement/orders/:id',
  requirePermissions('inventory.delete'),
  validate(id),
  send(async (q) => ({ data: await service.procurement.cancel(q.params.id) })),
);
phase23Routes.post(
  '/procurement/orders/:id/receive',
  requirePermissions('inventory.stock'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: z.object({ quantity: z.number().int().positive(), batchId: z.uuid().optional() }),
    }),
  ),
  send(async (q) => ({
    data: await service.procurement.receive(q.params.id, q.body, q.auth!.userId),
  })),
);
phase23Routes.get(
  '/audit',
  requirePermissions('audit.view'),
  validate(auditRequest),
  send(async (q) => service.audit(q.query)),
);
phase23Routes.get(
  '/audit/options',
  requirePermissions('audit.view'),
  send(async () => ({ data: await service.auditOptions() })),
);
phase23Routes.get(
  '/audit/:id',
  requirePermissions('audit.view'),
  validate(id),
  send(async (q) => ({ data: await service.auditDetail(q.params.id) })),
);
const master = z.object({
  code: z.string().trim().min(2).max(30),
  name: z.string().trim().min(2).max(100),
  status: z.enum(['Active', 'Inactive']).default('Active'),
});
phase23Routes.get(
  '/masters/departments',
  requirePermissions('departments.view'),
  send(async (q) => service.masters.departments(q.query)),
);
phase23Routes.get(
  '/masters/departments/:id',
  requirePermissions('departments.view'),
  validate(id),
  send(async (q) => ({ data: await service.masters.department(q.params.id) })),
);
phase23Routes.post(
  '/masters/departments',
  requirePermissions('laboratory.manage_tests'),
  validate(shell(master)),
  send(async (q) => ({ data: await service.masters.createDepartment(q.body) }), 201),
);
phase23Routes.put(
  '/masters/departments/:id',
  requirePermissions('laboratory.manage_tests'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: master.partial(),
    }),
  ),
  send(async (q) => ({ data: await service.masters.updateDepartment(q.params.id, q.body) })),
);
phase23Routes.delete(
  '/masters/departments/:id',
  requirePermissions('laboratory.manage_tests'),
  validate(id),
  send(async (q) => ({ data: await service.masters.deactivateDepartment(q.params.id) })),
);
const specialization = master.extend({ departmentId: z.uuid() });
phase23Routes.get(
  '/masters/specializations',
  requirePermissions('departments.view'),
  send(async (q) => service.masters.specializations(q.query)),
);
phase23Routes.get(
  '/masters/specializations/:id',
  requirePermissions('departments.view'),
  validate(id),
  send(async (q) => ({ data: await service.masters.specialization(q.params.id) })),
);
phase23Routes.post(
  '/masters/specializations',
  requirePermissions('departments.manage'),
  validate(shell(specialization)),
  send(async (q) => ({ data: await service.masters.createSpecialization(q.body) }), 201),
);
phase23Routes.put(
  '/masters/specializations/:id',
  requirePermissions('departments.manage'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: specialization.partial(),
    }),
  ),
  send(async (q) => ({ data: await service.masters.updateSpecialization(q.params.id, q.body) })),
);
phase23Routes.delete(
  '/masters/specializations/:id',
  requirePermissions('departments.manage'),
  validate(id),
  send(async (q) => ({ data: await service.masters.deactivateSpecialization(q.params.id) })),
);
const radiologyMaster = master.extend({
  modality: z.string().trim().min(2).max(50),
  description: z.string().trim().max(500).optional(),
});
phase23Routes.get(
  '/masters/radiology-investigations',
  requirePermissions('radiology.view'),
  send(async (q) => service.masters.radiologyInvestigations(q.query)),
);
phase23Routes.get(
  '/masters/radiology-investigations/:id',
  requirePermissions('radiology.view'),
  validate(id),
  send(async (q) => ({ data: await service.masters.radiologyInvestigation(q.params.id) })),
);
phase23Routes.post(
  '/masters/radiology-investigations',
  requirePermissions('departments.manage'),
  validate(shell(radiologyMaster)),
  send(async (q) => ({ data: await service.masters.createRadiologyInvestigation(q.body) }), 201),
);
phase23Routes.put(
  '/masters/radiology-investigations/:id',
  requirePermissions('departments.manage'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: radiologyMaster.partial(),
    }),
  ),
  send(async (q) => ({
    data: await service.masters.updateRadiologyInvestigation(q.params.id, q.body),
  })),
);
phase23Routes.delete(
  '/masters/radiology-investigations/:id',
  requirePermissions('departments.manage'),
  validate(id),
  send(async (q) => ({
    data: await service.masters.deactivateRadiologyInvestigation(q.params.id),
  })),
);
const labMaster = master.extend({
  category: z.string().trim().min(2).max(80),
  unit: z.string().trim().max(30).optional(),
  referenceRange: z.string().trim().max(100).optional(),
  description: z.string().trim().max(500).optional(),
});
phase23Routes.get(
  '/masters/laboratory-tests',
  requirePermissions('laboratory.view'),
  send(async (q) => service.masters.laboratoryTests(q.query)),
);
phase23Routes.get(
  '/masters/laboratory-tests/:id',
  requirePermissions('laboratory.view'),
  validate(id),
  send(async (q) => ({ data: await service.masters.laboratoryTest(q.params.id) })),
);
phase23Routes.post(
  '/masters/laboratory-tests',
  requirePermissions('departments.manage'),
  validate(shell(labMaster)),
  send(async (q) => ({ data: await service.masters.createLaboratoryTest(q.body) }), 201),
);
phase23Routes.put(
  '/masters/laboratory-tests/:id',
  requirePermissions('departments.manage'),
  validate(
    z.object({
      params: z.object({ id: z.uuid() }),
      query: z.object({}).passthrough(),
      body: labMaster.partial(),
    }),
  ),
  send(async (q) => ({ data: await service.masters.updateLaboratoryTest(q.params.id, q.body) })),
);
phase23Routes.delete(
  '/masters/laboratory-tests/:id',
  requirePermissions('departments.manage'),
  validate(id),
  send(async (q) => ({ data: await service.masters.deleteLaboratoryTest(q.params.id) })),
);
