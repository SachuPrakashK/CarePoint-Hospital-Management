import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
import { invoiceFinancials } from '../utils/invoice-financials.js';
import { notificationService } from './notification.service.js';
const db = prisma as any;
const page = (query: any) => ({
  page: Math.max(1, Number(query.page ?? 1)),
  pageSize: Math.min(100, Math.max(1, Number(query.page_size ?? 10))),
});
const paged = async (
  model: any,
  query: any,
  where: any,
  include?: any,
  orderBy: any = { createdAt: 'desc' },
) => {
  const { page: current, pageSize } = page(query);
  const [data, total] = await prisma.$transaction([
    model.findMany({ where, include, skip: (current - 1) * pageSize, take: pageSize, orderBy }),
    model.count({ where }),
  ]);
  return {
    data,
    pagination: {
      page: current,
      page_size: pageSize,
      total,
      total_pages: Math.ceil(total / pageSize),
    },
  };
};
const missing = (name: string) => new AppError(404, `${name} was not found.`, 'NOT_FOUND');
const sensitiveAuditKey = /password|token|secret|authorization|cookie|session/i;
export const sanitizeAuditMetadata = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeAuditMetadata);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        sensitiveAuditKey.test(key) ? '[REDACTED]' : sanitizeAuditMetadata(item),
      ]),
    );
  return value;
};
const code = (prefix: string) => `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
const PHARMACY_EXPIRY_SOON_DAYS = 90;
export const phase23Service = {
  inventory: {
    list: (q: any) => {
      const direction = q.sort_order === 'desc' ? 'desc' : 'asc';
      const sorts: Record<string, any> = {
        code: { code: direction },
        name: { name: direction },
        category: { category: { name: direction } },
        quantity: { quantity: direction },
        reorderLevel: { reorderLevel: direction },
        unit: { unit: direction },
      };
      return paged(
        db.inventoryItem,
        q,
        {
          deletedAt: null,
          ...(q.search
            ? {
                OR: [
                  { name: { contains: q.search, mode: 'insensitive' } },
                  { code: { contains: q.search, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(q.category_id ? { categoryId: q.category_id } : {}),
        },
        { category: true, supplier: true },
        [sorts[q.sort_by] ?? { createdAt: 'desc' }, { id: 'asc' }],
      );
    },
    get: async (id: string) =>
      db.inventoryItem
        .findUnique({
          where: { id },
          include: {
            category: true,
            supplier: true,
            movements: { orderBy: { createdAt: 'desc' } },
          },
        })
        .then((x: any) => x ?? Promise.reject(missing('Inventory item'))),
    create: (v: any) => db.inventoryItem.create({ data: { ...v, code: v.code || code('INV') } }),
    update: (id: string, v: any) => db.inventoryItem.update({ where: { id }, data: v }),
    remove: (id: string) =>
      db.inventoryItem.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } }),
    move: async (id: string, v: any, actorId: string) => {
      const updated = await prisma.$transaction(async (tx: any) => {
        const item = await tx.inventoryItem.findUnique({ where: { id } });
        if (!item) throw missing('Inventory item');
        const delta = v.type === 'Stock In' ? v.quantity : -v.quantity;
        const balance = item.quantity + delta;
        if (balance < 0) throw new AppError(409, 'Insufficient stock.', 'INSUFFICIENT_STOCK');
        const changed = await tx.inventoryItem.update({
          where: { id },
          data: { quantity: balance },
        });
        await tx.inventoryMovement.create({
          data: {
            itemId: id,
            type: v.type,
            quantity: v.quantity,
            balance,
            reference: v.reference,
            notes: v.notes,
            actorId,
          },
        });
        return changed;
      });
      if (updated.quantity <= updated.reorderLevel)
        await notificationService.notifyRoles(['HOSPITAL_ADMIN'], {
          type: 'INVENTORY_LOW_STOCK',
          title: 'Low inventory stock',
          message: `${updated.name} is at or below its reorder level.`,
          relatedEntityType: 'InventoryItem',
          relatedEntityId: updated.id,
        });
      return updated;
    },
    categories: () =>
      db.inventoryCategory.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    createCategory: (v: any) => db.inventoryCategory.create({ data: v }),
    updateCategory: (id: string, v: any) => db.inventoryCategory.update({ where: { id }, data: v }),
    removeCategory: (id: string) =>
      db.inventoryCategory.update({ where: { id }, data: { isActive: false } }),
    suppliers: (q: any = {}) => {
      const direction = q.sort_order === 'desc' ? 'desc' : 'asc';
      const sorts: Record<string, any> = {
        name: { name: direction },
        contactPerson: { contactPerson: direction },
        phone: { phone: direction },
        email: { email: direction },
        taxNumber: { taxNumber: direction },
      };
      return paged(
        db.supplier,
        q,
        {
          isActive: true,
          ...(q.search
            ? {
                OR: [
                  { name: { contains: q.search, mode: 'insensitive' } },
                  { contactPerson: { contains: q.search, mode: 'insensitive' } },
                  { phone: { contains: q.search, mode: 'insensitive' } },
                  { email: { contains: q.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        undefined,
        [sorts[q.sort_by] ?? { name: 'asc' }, { id: 'asc' }],
      );
    },
    getSupplier: async (id: string) =>
      db.supplier
        .findUnique({
          where: { id },
          include: {
            items: { where: { deletedAt: null }, select: { id: true, code: true, name: true } },
            purchaseOrders: {
              orderBy: { requestedAt: 'desc' },
              take: 10,
              include: { inventoryItem: true, medicine: true },
            },
          },
        })
        .then((value: any) => value ?? Promise.reject(missing('Supplier'))),
    createSupplier: (v: any) => db.supplier.create({ data: v }),
    updateSupplier: (id: string, v: any) => db.supplier.update({ where: { id }, data: v }),
    removeSupplier: (id: string) =>
      db.supplier.update({ where: { id }, data: { isActive: false } }),
  },
  ambulance: {
    list: (q: any) => {
      const direction = q.sort_order === 'desc' ? 'desc' : 'asc';
      const sorts: Record<string, any> = {
        number: { number: direction },
        registration: { registration: direction },
        driver: { driver: direction },
        driverContact: { driverContact: direction },
        status: { status: direction },
      };
      return paged(
        db.ambulance,
        q,
        {
          isActive: true,
          ...(q.search
            ? {
                OR: [
                  { number: { contains: q.search, mode: 'insensitive' } },
                  { registration: { contains: q.search, mode: 'insensitive' } },
                  { vehicleType: { contains: q.search, mode: 'insensitive' } },
                  { driver: { contains: q.search, mode: 'insensitive' } },
                  { driverContact: { contains: q.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        undefined,
        [sorts[q.sort_by] ?? { createdAt: 'desc' }, { id: 'asc' }],
      );
    },
    create: (v: any) => db.ambulance.create({ data: v }),
    get: async (id: string) =>
      db.ambulance
        .findUnique({
          where: { id },
          include: {
            bookings: {
              orderBy: { requestedAt: 'desc' },
              take: 10,
              include: { patient: true },
            },
          },
        })
        .then((value: any) => value ?? Promise.reject(missing('Ambulance'))),
    update: (id: string, v: any) => db.ambulance.update({ where: { id }, data: v }),
    remove: (id: string) => db.ambulance.update({ where: { id }, data: { isActive: false } }),
    bookings: (q: any) => {
      const direction = q.sort_order === 'desc' ? 'desc' : 'asc';
      const sorts: Record<string, any> = {
        number: { number: direction },
        patient: { patient: { firstName: direction } },
        ambulance: { ambulance: { number: direction } },
        pickup: { pickup: direction },
        destination: { destination: direction },
        scheduledAt: { scheduledAt: direction },
        status: { status: direction },
        charges: { charges: direction },
      };
      return paged(
        db.ambulanceBooking,
        q,
        {
          ...(q.patient_id ? { patientId: q.patient_id } : {}),
          ...(q.search
            ? {
                OR: [
                  { number: { contains: q.search, mode: 'insensitive' } },
                  {
                    patient: {
                      is: {
                        OR: [
                          { firstName: { contains: q.search, mode: 'insensitive' } },
                          { lastName: { contains: q.search, mode: 'insensitive' } },
                        ],
                      },
                    },
                  },
                ],
              }
            : {}),
        },
        { patient: true, ambulance: true },
        [sorts[q.sort_by] ?? { createdAt: 'desc' }, { id: 'asc' }],
      );
    },
    book: async (v: any) => {
      const result = await db.ambulanceBooking.create({
        data: { ...v, number: code('AMB') },
        include: { patient: true, ambulance: true },
      });
      await notificationService.notifyRoles(['HOSPITAL_ADMIN', 'RECEPTIONIST'], {
        type: 'AMBULANCE_REQUEST',
        title: 'Ambulance request',
        message: `Ambulance request ${result.number} was created.`,
        relatedEntityType: 'AmbulanceBooking',
        relatedEntityId: result.id,
      });
      return result;
    },
    assign: (id: string, ambulanceId: string) =>
      prisma.$transaction(async (tx: any) => {
        const active = await tx.ambulanceBooking.findFirst({
          where: { ambulanceId, status: { in: ['Assigned', 'On Trip'] }, NOT: { id } },
        });
        if (active)
          throw new AppError(409, 'Ambulance already has an active assignment.', 'CONFLICT');
        const vehicle = await tx.ambulance.findFirst({
          where: { id: ambulanceId, status: 'Available', isActive: true },
        });
        if (!vehicle) throw new AppError(409, 'Ambulance is unavailable.', 'CONFLICT');
        await tx.ambulance.update({ where: { id: ambulanceId }, data: { status: 'Assigned' } });
        return tx.ambulanceBooking.update({
          where: { id },
          data: { ambulanceId, status: 'Assigned' },
        });
      }),
  },
  billing: {
    list: async (q: any) => {
      const direction = q.sort_order === 'desc' ? 'desc' : 'asc';
      const sorts: Record<string, any> = {
        number: { number: direction },
        patient: { patient: { firstName: direction } },
        createdAt: { createdAt: direction },
        status: { status: direction },
      };
      const result = await paged(
        db.invoice,
        q,
        {
          ...(q.patient_id ? { patientId: q.patient_id } : {}),
          ...(q.status ? { status: q.status } : {}),
          ...(q.search
            ? {
                OR: [
                  { number: { contains: q.search, mode: 'insensitive' } },
                  { status: { contains: q.search, mode: 'insensitive' } },
                  {
                    patient: {
                      is: {
                        OR: [
                          { firstName: { contains: q.search, mode: 'insensitive' } },
                          { lastName: { contains: q.search, mode: 'insensitive' } },
                        ],
                      },
                    },
                  },
                ],
              }
            : {}),
        },
        { patient: true, items: true, payments: { include: { refunds: true } } },
        [sorts[q.sort_by] ?? { createdAt: 'desc' }, { id: 'asc' }],
      );
      const creatorIds: string[] = result.data
        .map((invoice: any) => invoice.createdById)
        .filter((id: unknown): id is string => typeof id === 'string');
      const creators = await prisma.user.findMany({
        where: { id: { in: Array.from(new Set<string>(creatorIds)) } },
        select: { id: true, firstName: true, lastName: true },
      });
      const creatorNames = new Map(
        creators.map((creator) => [creator.id, `${creator.firstName} ${creator.lastName}`.trim()]),
      );
      return {
        ...result,
        data: result.data.map((invoice: any) => {
          const financials = invoiceFinancials(invoice);
          return {
            ...invoice,
            total: financials.total,
            paidAmount: financials.netPaid,
            balance: financials.balance,
            createdBy: invoice.createdById ? (creatorNames.get(invoice.createdById) ?? null) : null,
          };
        }),
      };
    },
    payments: async (q: any) => {
      const direction = q.sort_order === 'desc' ? 'desc' : 'asc';
      const sorts: Record<string, any> = {
        receiptNumber: { receiptNumber: direction },
        invoice: { invoice: { number: direction } },
        createdAt: { createdAt: direction },
        amount: { amount: direction },
        method: { method: direction },
        reference: { reference: direction },
      };
      const where = {
        ...(q.method ? { method: q.method } : {}),
        ...(q.search
          ? {
              OR: [
                { receiptNumber: { contains: q.search, mode: 'insensitive' } },
                { method: { contains: q.search, mode: 'insensitive' } },
                { reference: { contains: q.search, mode: 'insensitive' } },
                { invoice: { is: { number: { contains: q.search, mode: 'insensitive' } } } },
                {
                  invoice: {
                    is: {
                      patient: {
                        is: {
                          OR: [
                            { firstName: { contains: q.search, mode: 'insensitive' } },
                            { lastName: { contains: q.search, mode: 'insensitive' } },
                            { mrn: { contains: q.search, mode: 'insensitive' } },
                          ],
                        },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      };
      const result = await paged(
        db.payment,
        q,
        where,
        { invoice: { include: { patient: true } }, refunds: true },
        [sorts[q.sort_by] ?? { createdAt: 'desc' }, { id: 'asc' }],
      );
      const actorIds: string[] = result.data.map((item: any) => String(item.actorId));
      const actors = await prisma.user.findMany({
        where: { id: { in: Array.from(new Set<string>(actorIds)) } },
        select: { id: true, firstName: true, lastName: true },
      });
      const names = new Map(
        actors.map((actor) => [actor.id, `${actor.firstName} ${actor.lastName}`.trim()]),
      );
      return {
        ...result,
        data: result.data.map((item: any) => {
          const approvedRefunds = item.refunds
            .filter((refund: any) => refund.status === 'Approved')
            .reduce(
              (sum: Prisma.Decimal, refund: any) => sum.plus(refund.amount),
              new Prisma.Decimal(0),
            );
          return {
            ...item,
            recordedBy: names.get(item.actorId) ?? null,
            status: approvedRefunds.eq(item.amount)
              ? 'Refunded'
              : approvedRefunds.gt(0)
                ? 'Partially Refunded'
                : 'Settled',
          };
        }),
      };
    },
    get: (id: string) =>
      db.invoice.findUnique({
        where: { id },
        include: { patient: true, items: true, payments: { include: { refunds: true } } },
      }),
    create: (v: any, actorId: string, idempotencyKey: string) =>
      prisma.$transaction(async (tx: any) => {
        const previous = await tx.invoice.findUnique({
          where: { idempotencyKey },
          include: { patient: true, items: true, payments: true },
        });
        if (previous) {
          const sameItems =
            previous.items.length === v.items.length &&
            previous.items.every((item: any, index: number) => {
              const requested = v.items[index];
              return (
                item.source === requested.source &&
                item.sourceId === requested.sourceId &&
                item.description === requested.description &&
                item.quantity.eq(new Prisma.Decimal(requested.quantity)) &&
                item.unitPrice.eq(new Prisma.Decimal(requested.unitPrice))
              );
            });
          if (previous.patientId !== v.patientId || !sameItems)
            throw new AppError(
              409,
              'The idempotency key was already used for a different invoice.',
              'IDEMPOTENCY_KEY_REUSED',
            );
          return previous;
        }
        const patient = await tx.patient.findFirst({
          where: { id: v.patientId, deletedAt: null },
          select: { id: true },
        });
        if (!patient) throw missing('Patient');
        const invoice = await tx.invoice.create({
          data: {
            number: code('INV'),
            patientId: v.patientId,
            createdById: actorId,
            idempotencyKey,
            status: 'Pending',
            items: {
              create: v.items.map((i: any) => ({
                source: i.source,
                sourceId: i.sourceId,
                description: i.description,
                quantity: new Prisma.Decimal(i.quantity),
                unitPrice: new Prisma.Decimal(i.unitPrice),
              })),
            },
          },
          include: { patient: true, items: true, payments: true },
        });
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: 'INVOICE_CREATE',
            module: 'billing',
            entityType: 'Invoice',
            entityId: invoice.id,
            metadata: { itemCount: v.items.length },
          },
        });
        return invoice;
      }),
    update: (id: string, v: any, actorId: string) =>
      prisma.$transaction(async (tx: any) => {
        const current = await tx.invoice.findUnique({ where: { id }, include: { payments: true } });
        if (!current) throw missing('Invoice');
        if (current.status === 'Cancelled')
          throw new AppError(409, 'A cancelled invoice cannot be edited.', 'CONFLICT');
        if (current.payments.length)
          throw new AppError(
            409,
            'An invoice with payments cannot have its charge items replaced.',
            'CONFLICT',
          );
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
        const invoice = await tx.invoice.update({
          where: { id },
          data: {
            patientId: v.patientId,
            items: {
              create: v.items.map((i: any) => ({
                source: i.source,
                sourceId: i.sourceId,
                description: i.description,
                quantity: new Prisma.Decimal(i.quantity),
                unitPrice: new Prisma.Decimal(i.unitPrice),
              })),
            },
          },
          include: { patient: true, items: true, payments: true },
        });
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: 'INVOICE_UPDATE',
            module: 'billing',
            entityType: 'Invoice',
            entityId: id,
            metadata: { itemCount: v.items.length },
          },
        });
        return invoice;
      }),
    cancel: (id: string, actorId: string) =>
      prisma.$transaction(async (tx: any) => {
        const current = await tx.invoice.findUnique({ where: { id }, include: { payments: true } });
        if (!current) throw missing('Invoice');
        if (current.status === 'Cancelled') return current;
        if (current.payments.length)
          throw new AppError(409, 'A paid invoice cannot be cancelled.', 'CONFLICT');
        const invoice = await tx.invoice.update({ where: { id }, data: { status: 'Cancelled' } });
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: 'INVOICE_CANCEL',
            module: 'billing',
            entityType: 'Invoice',
            entityId: id,
          },
        });
        return invoice;
      }),
    payment: async (id: string, v: any, actorId: string, idempotencyKey: string) => {
      const outcome = await prisma.$transaction(
        async (tx: any) => {
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
          const previous = await tx.payment.findUnique({ where: { idempotencyKey } });
          if (previous) {
            const sameRequest =
              previous.invoiceId === id &&
              previous.amount.eq(new Prisma.Decimal(v.amount)) &&
              previous.method === v.method &&
              (previous.reference ?? '') === (v.reference ?? '');
            if (!sameRequest)
              throw new AppError(
                409,
                'The idempotency key was already used for a different payment.',
                'IDEMPOTENCY_KEY_REUSED',
              );
            return { payment: previous, created: false };
          }
          const invoice = await tx.invoice.findUnique({
            where: { id },
            include: { items: true, payments: { include: { refunds: true } } },
          });
          if (!invoice) throw missing('Invoice');
          if (invoice.status === 'Cancelled')
            throw new AppError(409, 'A cancelled invoice cannot receive payments.', 'CONFLICT');
          const financials = invoiceFinancials(invoice);
          const amount = new Prisma.Decimal(v.amount);
          if (amount.lte(0) || amount.gt(financials.balance))
            throw new AppError(422, 'Payment exceeds the outstanding balance.', 'VALIDATION_ERROR');
          const result = await tx.payment.create({
            data: {
              receiptNumber: code('RCT'),
              invoiceId: id,
              amount,
              method: v.method,
              reference: v.reference,
              actorId,
              idempotencyKey,
            },
          });
          await tx.invoice.update({
            where: { id },
            data: {
              status: financials.netPaid.plus(amount).eq(financials.total)
                ? 'Paid'
                : 'Partially Paid',
            },
          });
          await tx.auditLog.create({
            data: {
              userId: actorId,
              action: 'PAYMENT',
              module: 'billing',
              entityType: 'Payment',
              entityId: result.id,
              metadata: { invoiceId: id, amount: amount.toString() },
            },
          });
          return { payment: result, created: true };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      if (outcome.created)
        await notificationService.notifyRoles(['HOSPITAL_ADMIN', 'BILLING_STAFF'], {
          type: 'PAYMENT_RECEIVED',
          title: 'Payment received',
          message: `Receipt ${outcome.payment.receiptNumber} was recorded.`,
          relatedEntityType: 'Invoice',
          relatedEntityId: id,
        });
      return outcome.payment;
    },
    refunds: async (q: any) => {
      const direction = q.sort_order === 'desc' ? 'desc' : 'asc';
      const sorts: Record<string, any> = {
        createdAt: { createdAt: direction },
        payment: { payment: { receiptNumber: direction } },
        amount: { amount: direction },
        reason: { reason: direction },
        status: { status: direction },
      };
      const where = {
        ...(q.status ? { status: q.status } : {}),
        ...(q.search
          ? {
              OR: [
                { reason: { contains: q.search, mode: 'insensitive' } },
                { status: { contains: q.search, mode: 'insensitive' } },
                { payment: { is: { receiptNumber: { contains: q.search, mode: 'insensitive' } } } },
                {
                  payment: {
                    is: {
                      invoice: {
                        is: {
                          OR: [
                            { number: { contains: q.search, mode: 'insensitive' } },
                            {
                              patient: {
                                is: {
                                  OR: [
                                    { firstName: { contains: q.search, mode: 'insensitive' } },
                                    { lastName: { contains: q.search, mode: 'insensitive' } },
                                    { mrn: { contains: q.search, mode: 'insensitive' } },
                                  ],
                                },
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      };
      const result = await paged(
        db.refund,
        q,
        where,
        { payment: { include: { invoice: { include: { patient: true } } } } },
        [sorts[q.sort_by] ?? { createdAt: 'desc' }, { id: 'asc' }],
      );
      const userIds = [
        ...new Set(
          result.data.flatMap((item: any) =>
            [item.requestedById, item.approvedById].filter(Boolean),
          ),
        ),
      ] as string[];
      const actors = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true },
      });
      const names = new Map(
        actors.map((actor) => [actor.id, `${actor.firstName} ${actor.lastName}`.trim()]),
      );
      return {
        ...result,
        data: result.data.map((item: any) => ({
          ...item,
          requestedBy: names.get(item.requestedById) ?? null,
          approvedBy: item.approvedById ? (names.get(item.approvedById) ?? null) : null,
        })),
      };
    },
    requestRefund: (paymentId: string, v: any, actorId: string) =>
      prisma.$transaction(async (tx: any) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${paymentId}))`;
        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: { refunds: true },
        });
        if (!payment) throw missing('Payment');
        const refunded = payment.refunds
          .filter((x: any) => x.status !== 'Rejected')
          .reduce((s: any, x: any) => s.plus(x.amount), new Prisma.Decimal(0));
        const amount = new Prisma.Decimal(v.amount);
        if (amount.lte(0) || refunded.plus(amount).gt(payment.amount))
          throw new AppError(
            422,
            'Refund exceeds the refundable payment amount.',
            'VALIDATION_ERROR',
          );
        const result = await tx.refund.create({
          data: {
            paymentId,
            amount,
            reason: v.reason,
            status: 'Requested',
            requestedById: actorId,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: 'REFUND_REQUEST',
            module: 'billing',
            entityType: 'Refund',
            entityId: result.id,
            metadata: { paymentId, amount: amount.toString() },
          },
        });
        return result;
      }),
    approveRefund: (id: string, status: 'Approved' | 'Rejected', actorId: string) =>
      prisma.$transaction(async (tx: any) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`;
        const refund = await tx.refund.findUnique({ where: { id }, include: { payment: true } });
        if (!refund) throw missing('Refund');
        if (refund.status !== 'Requested')
          throw new AppError(409, 'This refund request is already resolved.', 'CONFLICT');
        const result = await tx.refund.update({
          where: { id },
          data: { status, approvedById: actorId },
        });
        if (status === 'Approved') {
          const invoice = await tx.invoice.findUnique({
            where: { id: refund.payment.invoiceId },
            include: { items: true, payments: { include: { refunds: true } } },
          });
          if (!invoice) throw missing('Invoice');
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { status: invoiceFinancials(invoice).status },
          });
        }
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: status === 'Approved' ? 'REFUND_APPROVE' : 'REFUND_REJECT',
            module: 'billing',
            entityType: 'Refund',
            entityId: id,
          },
        });
        return result;
      }),
  },
  insurance: {
    providers: (q: any) => {
      const direction = q.sort_order === 'desc' ? 'desc' : 'asc';
      const sorts: Record<string, any> = {
        name: { name: direction },
        code: { code: direction },
        contact: { contact: direction },
        address: { address: direction },
      };
      return paged(
        db.insuranceProvider,
        q,
        {
          isActive: true,
          ...(q.search ? { name: { contains: q.search, mode: 'insensitive' } } : {}),
        },
        undefined,
        [sorts[q.sort_by] ?? { name: 'asc' }, { id: 'asc' }],
      );
    },
    createProvider: (v: any) => db.insuranceProvider.create({ data: v }),
    updateProvider: (id: string, v: any) => db.insuranceProvider.update({ where: { id }, data: v }),
    removeProvider: (id: string) =>
      db.insuranceProvider.update({ where: { id }, data: { isActive: false } }),
    policies: (q: any) => {
      const direction = q.sort_order === 'desc' ? 'desc' : 'asc';
      const sorts: Record<string, any> = {
        patient: { patient: { firstName: direction } },
        provider: { provider: { name: direction } },
        policyNumber: { policyNumber: direction },
        memberNumber: { memberNumber: direction },
        coverageLimit: { coverageLimit: direction },
        startsAt: { startsAt: direction },
        priority: { priority: direction },
      };
      return paged(
        db.patientInsurance,
        q,
        {
          ...(q.patient_id ? { patientId: q.patient_id } : {}),
          ...(q.search
            ? {
                OR: [
                  { policyNumber: { contains: q.search, mode: 'insensitive' } },
                  { memberNumber: { contains: q.search, mode: 'insensitive' } },
                  {
                    patient: {
                      is: {
                        OR: [
                          { firstName: { contains: q.search, mode: 'insensitive' } },
                          { lastName: { contains: q.search, mode: 'insensitive' } },
                        ],
                      },
                    },
                  },
                  { provider: { is: { name: { contains: q.search, mode: 'insensitive' } } } },
                ],
              }
            : {}),
        },
        { patient: true, provider: true },
        [sorts[q.sort_by] ?? { createdAt: 'desc' }, { id: 'asc' }],
      );
    },
    createPolicy: async (v: any) => {
      if (new Date(v.endsAt) < new Date(v.startsAt))
        throw new AppError(
          422,
          'Policy end date must be on or after its start date.',
          'VALIDATION_ERROR',
        );
      return db.patientInsurance.create({
        data: {
          ...v,
          startsAt: new Date(v.startsAt),
          endsAt: new Date(v.endsAt),
          coverageLimit: new Prisma.Decimal(v.coverageLimit),
        },
      });
    },
    updatePolicy: async (id: string, v: any) => {
      const current = await db.patientInsurance.findUnique({ where: { id } });
      if (!current) throw missing('Insurance policy');
      const startsAt = v.startsAt ? new Date(v.startsAt) : current.startsAt;
      const endsAt = v.endsAt ? new Date(v.endsAt) : current.endsAt;
      if (endsAt < startsAt)
        throw new AppError(
          422,
          'Policy end date must be on or after its start date.',
          'VALIDATION_ERROR',
        );
      return db.patientInsurance.update({
        where: { id },
        data: {
          ...v,
          ...(v.startsAt ? { startsAt: new Date(v.startsAt) } : {}),
          ...(v.endsAt ? { endsAt: new Date(v.endsAt) } : {}),
          ...(v.coverageLimit != null
            ? { coverageLimit: new Prisma.Decimal(v.coverageLimit) }
            : {}),
        },
      });
    },
    deactivatePolicy: (id: string) =>
      db.patientInsurance.update({ where: { id }, data: { isActive: false } }),
    claims: (q: any) => {
      const direction = q.sort_order === 'desc' ? 'desc' : 'asc';
      const sorts: Record<string, any> = {
        number: { number: direction },
        patient: { patient: { firstName: direction } },
        invoice: { invoice: { number: direction } },
        claimedAmount: { claimedAmount: direction },
        approvedAmount: { approvedAmount: direction },
        patientResponsibility: { patientResponsibility: direction },
        status: { status: direction },
      };
      return paged(
        db.insuranceClaim,
        q,
        {
          ...(q.patient_id ? { patientId: q.patient_id } : {}),
          ...(q.search
            ? {
                OR: [
                  { number: { contains: q.search, mode: 'insensitive' } },
                  { status: { contains: q.search, mode: 'insensitive' } },
                  {
                    patient: {
                      is: {
                        OR: [
                          { firstName: { contains: q.search, mode: 'insensitive' } },
                          { lastName: { contains: q.search, mode: 'insensitive' } },
                        ],
                      },
                    },
                  },
                  { invoice: { is: { number: { contains: q.search, mode: 'insensitive' } } } },
                ],
              }
            : {}),
        },
        { patient: true, insurance: { include: { provider: true } }, invoice: true },
        [sorts[q.sort_by] ?? { createdAt: 'desc' }, { id: 'asc' }],
      );
    },
    createClaim: (v: any, actorId: string) =>
      prisma.$transaction(async (tx: any) => {
        const policy = await tx.patientInsurance.findFirst({
          where: { id: v.insuranceId, patientId: v.patientId, isActive: true },
        });
        const invoice = await tx.invoice.findFirst({
          where: { id: v.invoiceId, patientId: v.patientId, status: { not: 'Cancelled' } },
          include: { items: true },
        });
        if (!policy || !invoice)
          throw new AppError(
            422,
            'Policy, patient and invoice must belong to the same valid claim context.',
            'VALIDATION_ERROR',
          );
        const now = new Date();
        if (policy.startsAt > now || policy.endsAt < now)
          throw new AppError(
            422,
            'The selected policy is not currently valid.',
            'VALIDATION_ERROR',
          );
        const total = invoice.items.reduce(
          (s: any, i: any) => s.plus(i.quantity.mul(i.unitPrice)),
          new Prisma.Decimal(0),
        );
        const amount = new Prisma.Decimal(v.claimedAmount);
        if (amount.gt(total) || amount.gt(policy.coverageLimit))
          throw new AppError(
            422,
            'Claim amount exceeds the invoice total or policy coverage limit.',
            'VALIDATION_ERROR',
          );
        const result = await tx.insuranceClaim.create({
          data: { ...v, number: code('CLM'), claimedAmount: amount },
        });
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: 'CREATE',
            module: 'insurance',
            entityType: 'InsuranceClaim',
            entityId: result.id,
          },
        });
        return result;
      }),
    updateClaim: async (id: string, v: any, actorId: string) => {
      const claim = await db.insuranceClaim.findUnique({ where: { id } });
      if (!claim) throw missing('Insurance claim');
      const allowed: Record<string, string[]> = {
        Draft: ['Submitted', 'Cancelled'],
        Submitted: ['Under Review', 'Cancelled'],
        'Under Review': ['Approved', 'Rejected'],
        Approved: ['Settled'],
        Rejected: [],
        Settled: [],
        Cancelled: [],
      };
      if (v.status && !(allowed[claim.status] ?? []).includes(v.status))
        throw new AppError(409, 'Invalid insurance claim status transition.', 'CONFLICT');
      const approvedAmount =
        v.approvedAmount == null ? undefined : new Prisma.Decimal(v.approvedAmount);
      if (approvedAmount?.gt(claim.claimedAmount))
        throw new AppError(
          422,
          'Approved amount cannot exceed the claimed amount.',
          'VALIDATION_ERROR',
        );
      const result = await db.insuranceClaim.update({
        where: { id },
        data: {
          ...v,
          approvedAmount,
          ...(v.status === 'Submitted' ? { submittedAt: new Date() } : {}),
          ...(v.status === 'Settled' ? { settledAt: new Date() } : {}),
        },
      });
      await db.auditLog.create({
        data: {
          userId: actorId,
          action: 'STATUS_CHANGE',
          module: 'insurance',
          entityType: 'InsuranceClaim',
          entityId: id,
          metadata: { status: v.status ?? claim.status },
        },
      });
      if (v.status)
        await notificationService.notifyRoles(['HOSPITAL_ADMIN', 'BILLING_STAFF'], {
          type: 'INSURANCE_CLAIM_STATUS',
          title: 'Insurance claim updated',
          message: `Claim ${result.number} is now ${v.status}.`,
          relatedEntityType: 'InsuranceClaim',
          relatedEntityId: id,
        });
      return result;
    },
  },
  laboratory: {
    list: (q: any) => {
      const direction = q.sort_order === 'asc' ? 'asc' : 'desc';
      const sorts: Record<string, any> = {
        createdAt: { createdAt: direction },
        number: { number: direction },
        patient: { patient: { firstName: direction } },
        doctor: { doctor: direction },
        priority: { priority: direction },
        sampleType: { sampleType: direction },
        status: { status: direction },
      };
      return paged(
        db.labOrder,
        q,
        {
          ...(q.patient_id ? { patientId: q.patient_id } : {}),
          ...(q.doctor_id ? { doctorId: q.doctor_id } : {}),
          ...(q.test_definition_id
            ? { orderTests: { some: { testDefinitionId: q.test_definition_id } } }
            : {}),
          ...(q.status ? { status: q.status } : {}),
          ...(q.priority ? { priority: q.priority } : {}),
          ...(q.date_from || q.date_to
            ? {
                createdAt: {
                  ...(q.date_from ? { gte: new Date(`${q.date_from}T00:00:00+05:30`) } : {}),
                  ...(q.date_to ? { lte: new Date(`${q.date_to}T23:59:59.999+05:30`) } : {}),
                },
              }
            : {}),
          ...(q.search
            ? {
                OR: [
                  { number: { contains: q.search, mode: 'insensitive' } },
                  { doctor: { contains: q.search, mode: 'insensitive' } },
                  {
                    orderTests: {
                      some: {
                        testDefinition: { name: { contains: q.search, mode: 'insensitive' } },
                      },
                    },
                  },
                  {
                    patient: {
                      is: {
                        OR: [
                          { firstName: { contains: q.search, mode: 'insensitive' } },
                          { lastName: { contains: q.search, mode: 'insensitive' } },
                          { mrn: { contains: q.search, mode: 'insensitive' } },
                        ],
                      },
                    },
                  },
                ],
              }
            : {}),
        },
        {
          patient: true,
          orderingDoctor: true,
          orderTests: { include: { testDefinition: true } },
          results: true,
        },
        [sorts[q.sort_by] ?? { createdAt: 'desc' }, { id: 'asc' }],
      );
    },
    get: async (id: string) => {
      const item = await db.labOrder.findUnique({
        where: { id },
        include: {
          patient: true,
          orderingDoctor: true,
          orderTests: { include: { testDefinition: true } },
          results: { orderBy: { enteredAt: 'desc' } },
        },
      });
      if (!item) throw missing('Laboratory order');
      return item;
    },
    create: async (v: any) => {
      const [patient, doctor, definitions] = await Promise.all([
        db.patient.findFirst({ where: { id: v.patientId, deletedAt: null } }),
        db.user.findFirst({
          where: {
            id: v.doctorId,
            deletedAt: null,
            status: 'ACTIVE',
            roles: { some: { role: { code: 'DOCTOR' } } },
          },
        }),
        db.laboratoryTestDefinition.findMany({
          where: { id: { in: v.testDefinitionIds }, status: 'Active' },
          select: { id: true, name: true },
        }),
      ]);
      if (!patient) throw missing('Patient');
      if (!doctor)
        throw new AppError(422, 'Select a valid active ordering doctor.', 'VALIDATION_ERROR');
      if (definitions.length !== new Set(v.testDefinitionIds).size)
        throw new AppError(
          422,
          'One or more laboratory tests are invalid or inactive.',
          'VALIDATION_ERROR',
        );
      return db.labOrder.create({
        data: {
          number: code('LAB'),
          patientId: v.patientId,
          doctorId: doctor.id,
          doctor: `${doctor.firstName} ${doctor.lastName}`,
          tests: definitions.map((x: any) => x.name),
          priority: v.priority,
          clinicalNotes: v.clinicalNotes,
          sampleType: v.sampleType,
          orderTests: { create: definitions.map((x: any) => ({ testDefinitionId: x.id })) },
        },
        include: {
          patient: true,
          orderingDoctor: true,
          orderTests: { include: { testDefinition: true } },
          results: true,
        },
      });
    },
    update: async (id: string, v: any) => {
      const current = await db.labOrder.findUnique({ where: { id } });
      if (!current) throw missing('Laboratory order');
      if (current.status !== 'Ordered')
        throw new AppError(409, 'Only ordered laboratory requests can be edited.', 'CONFLICT');
      if (v.patientId) {
        const patient = await db.patient.findFirst({ where: { id: v.patientId, deletedAt: null } });
        if (!patient) throw missing('Patient');
      }
      const doctor = v.doctorId
        ? await db.user.findFirst({
            where: {
              id: v.doctorId,
              deletedAt: null,
              status: 'ACTIVE',
              roles: { some: { role: { code: 'DOCTOR' } } },
            },
          })
        : null;
      if (v.doctorId && !doctor)
        throw new AppError(422, 'Select a valid active ordering doctor.', 'VALIDATION_ERROR');
      const definitions = v.testDefinitionIds
        ? await db.laboratoryTestDefinition.findMany({
            where: { id: { in: v.testDefinitionIds }, status: 'Active' },
            select: { id: true, name: true },
          })
        : null;
      if (definitions && definitions.length !== new Set(v.testDefinitionIds).size)
        throw new AppError(
          422,
          'One or more laboratory tests are invalid or inactive.',
          'VALIDATION_ERROR',
        );
      return prisma.$transaction(async (tx: any) => {
        if (definitions) {
          await tx.labOrderTest.deleteMany({ where: { orderId: id } });
        }
        return tx.labOrder.update({
          where: { id },
          data: {
            ...(v.patientId ? { patientId: v.patientId } : {}),
            ...(doctor
              ? { doctorId: doctor.id, doctor: `${doctor.firstName} ${doctor.lastName}` }
              : {}),
            ...(definitions
              ? {
                  tests: definitions.map((x: any) => x.name),
                  orderTests: { create: definitions.map((x: any) => ({ testDefinitionId: x.id })) },
                }
              : {}),
            ...(v.priority ? { priority: v.priority } : {}),
            ...(v.sampleType ? { sampleType: v.sampleType } : {}),
            ...(v.clinicalNotes !== undefined ? { clinicalNotes: v.clinicalNotes } : {}),
            version: { increment: 1 },
          },
          include: {
            patient: true,
            orderingDoctor: true,
            orderTests: { include: { testDefinition: true } },
            results: true,
          },
        });
      });
    },
    transition: async (id: string, v: any) => {
      const result = await prisma.$transaction(async (tx: any) => {
        const order = await tx.labOrder.findUnique({ where: { id } });
        if (!order) throw missing('Lab order');
        const flow = [
          'Ordered',
          'Sample Collected',
          'Processing',
          'Result Entered',
          'Verified',
          'Completed',
        ];
        if (v.status !== 'Cancelled' && flow.indexOf(v.status) !== flow.indexOf(order.status) + 1)
          throw new AppError(409, 'Invalid laboratory status transition.', 'CONFLICT');
        if (v.status === 'Verified')
          await tx.labResult.updateMany({
            where: { orderId: id, verifiedAt: null },
            data: { verifiedAt: new Date(), verifiedBy: v.actor },
          });
        return tx.labOrder.update({
          where: { id },
          data: {
            status: v.status,
            version: { increment: 1 },
            ...(v.status === 'Sample Collected'
              ? { collectedAt: new Date(), collectedBy: v.actor }
              : {}),
          },
        });
      });
      if (['Verified', 'Completed'].includes(v.status))
        await notificationService.notifyRoles(['HOSPITAL_ADMIN', 'DOCTOR', 'LAB_TECHNICIAN'], {
          type: 'LAB_RESULT_READY',
          title: 'Lab result ready',
          message: `Laboratory order ${result.number} is ${v.status}.`,
          relatedEntityType: 'LabOrder',
          relatedEntityId: id,
        });
      return result;
    },
    result: (id: string, v: any) =>
      prisma.$transaction(async (tx: any) => {
        const order = await tx.labOrder.findUnique({ where: { id } });
        if (!order || !['Sample Collected', 'Processing'].includes(order.status))
          throw new AppError(409, 'Results cannot be entered in the current state.', 'CONFLICT');
        await tx.labResult.createMany({
          data: v.results.map((r: any) => ({ ...r, orderId: id, enteredBy: v.actor })),
        });
        return tx.labOrder.update({
          where: { id },
          data: { status: 'Result Entered', version: { increment: 1 } },
          include: { results: true },
        });
      }),
  },
  radiology: {
    list: (q: any) => {
      const direction = q.sort_order === 'asc' ? 'asc' : 'desc';
      const sorts: Record<string, any> = {
        createdAt: { createdAt: direction },
        number: { number: direction },
        patient: { patient: { firstName: direction } },
        investigation: { investigation: direction },
        doctor: { doctor: direction },
        scheduledAt: { scheduledAt: direction },
        status: { status: direction },
      };
      return paged(
        db.radiologyOrder,
        q,
        {
          ...(q.patient_id ? { patientId: q.patient_id } : {}),
          ...(q.status ? { status: q.status } : {}),
          ...(q.investigation ? { investigation: q.investigation } : {}),
          ...(q.search
            ? {
                OR: [
                  { number: { contains: q.search, mode: 'insensitive' } },
                  { investigation: { contains: q.search, mode: 'insensitive' } },
                  { doctor: { contains: q.search, mode: 'insensitive' } },
                  {
                    patient: {
                      is: {
                        OR: [
                          { firstName: { contains: q.search, mode: 'insensitive' } },
                          { lastName: { contains: q.search, mode: 'insensitive' } },
                          { mrn: { contains: q.search, mode: 'insensitive' } },
                        ],
                      },
                    },
                  },
                ],
              }
            : {}),
        },
        { patient: true },
        [sorts[q.sort_by] ?? { createdAt: 'desc' }, { id: 'asc' }],
      );
    },
    get: (id: string) =>
      db.radiologyOrder.findUnique({ where: { id }, include: { patient: true } }),
    create: (v: any) =>
      db.radiologyOrder.create({
        data: {
          ...v,
          number: code('RAD'),
          scheduledAt: v.scheduledAt ? new Date(v.scheduledAt) : null,
        },
        include: { patient: true },
      }),
    update: async (id: string, v: any) => {
      const current = await db.radiologyOrder.findUnique({ where: { id } });
      if (!current) throw new AppError(404, 'Radiology order not found.', 'NOT_FOUND');
      if (['Verified', 'Completed', 'Cancelled'].includes(current.status))
        throw new AppError(
          409,
          'This radiology order is clinically locked and cannot be edited.',
          'CONFLICT',
        );
      const result = await db.radiologyOrder.update({
        where: { id },
        data: { ...v, ...(v.scheduledAt ? { scheduledAt: new Date(v.scheduledAt) } : {}) },
      });
      if (['Verified', 'Completed'].includes(v.status))
        await notificationService.notifyRoles(
          ['HOSPITAL_ADMIN', 'DOCTOR', 'RADIOLOGY_TECHNICIAN'],
          {
            type: 'RADIOLOGY_RESULT_READY',
            title: 'Radiology report ready',
            message: `Radiology order ${result.number} is ${v.status}.`,
            relatedEntityType: 'RadiologyOrder',
            relatedEntityId: id,
          },
        );
      return result;
    },
    cancel: async (id: string) => {
      const current = await db.radiologyOrder.findUnique({ where: { id } });
      if (!current) throw new AppError(404, 'Radiology order not found.', 'NOT_FOUND');
      if (['Verified', 'Completed', 'Cancelled'].includes(current.status))
        throw new AppError(409, 'This radiology order can no longer be deleted.', 'CONFLICT');
      return db.radiologyOrder.update({ where: { id }, data: { status: 'Cancelled' } });
    },
  },
  pharmacy: {
    medicines: (q: any) =>
      paged(
        db.medicine,
        q,
        {
          ...(q.search
            ? {
                OR: [
                  { name: { contains: q.search, mode: 'insensitive' } },
                  { genericName: { contains: q.search, mode: 'insensitive' } },
                  { brand: { contains: q.search, mode: 'insensitive' } },
                ],
              }
            : {}),
          ...(q.status ? { status: q.status } : {}),
        },
        { batches: true },
      ),
    medicine: (id: string) =>
      db.medicine.findUnique({
        where: { id },
        include: { batches: { include: { transactions: { orderBy: { createdAt: 'desc' } } } } },
      }),
    createMedicine: (v: any) => db.medicine.create({ data: v }),
    updateMedicine: (id: string, v: any) => db.medicine.update({ where: { id }, data: v }),
    deactivateMedicine: (id: string) =>
      db.medicine.update({ where: { id }, data: { status: 'Inactive' } }),
    batches: async (q: any) => {
      const now = new Date();
      const soon = new Date(now.getTime() + PHARMACY_EXPIRY_SOON_DAYS * 86_400_000);
      const where = {
        ...(q.medicine_id ? { medicineId: q.medicine_id } : {}),
        ...(q.search
          ? {
              OR: [
                { batchNumber: { contains: q.search, mode: 'insensitive' } },
                { medicine: { name: { contains: q.search, mode: 'insensitive' } } },
                { medicine: { genericName: { contains: q.search, mode: 'insensitive' } } },
                { medicine: { brand: { contains: q.search, mode: 'insensitive' } } },
                { medicine: { barcode: { contains: q.search, mode: 'insensitive' } } },
              ],
            }
          : {}),
        ...(q.category ? { medicine: { category: q.category } } : {}),
        ...(q.low_stock === 'true'
          ? { quantity: { lte: prisma.medicineBatch.fields.reorderLevel } }
          : {}),
        ...(q.expiry === 'expired'
          ? { expiresAt: { lt: now } }
          : q.expiry === 'expiring_soon'
            ? { expiresAt: { gte: now, lte: soon } }
            : q.expiry === 'valid'
              ? { expiresAt: { gt: soon } }
              : {}),
      };
      const direction = q.sort_order === 'desc' ? 'desc' : 'asc';
      const sortMap: Record<string, any> = {
        medicine: { medicine: { name: direction } },
        batchNumber: { batchNumber: direction },
        expiresAt: { expiresAt: direction },
        purchasePrice: { purchasePrice: direction },
        sellingPrice: { sellingPrice: direction },
        quantity: { quantity: direction },
        reorderLevel: { reorderLevel: direction },
      };
      const result = await paged(db.medicineBatch, q, where, { medicine: true }, [
        sortMap[q.sort_by] ?? { expiresAt: 'asc' },
        { id: 'asc' },
      ]);
      const [baseTotal, lowStockTotal, expiringTotal, categories] = await prisma.$transaction([
        db.medicineBatch.count(),
        db.medicineBatch.count({
          where: { quantity: { lte: prisma.medicineBatch.fields.reorderLevel } },
        }),
        db.medicineBatch.count({ where: { expiresAt: { gte: now, lte: soon } } }),
        db.medicine.findMany({
          where: { batches: { some: {} } },
          distinct: ['category'],
          select: { category: true },
          orderBy: { category: 'asc' },
        }),
      ]);
      return {
        ...result,
        data: result.data.map((item: any) => ({
          ...item,
          expiryStatus:
            item.expiresAt < now ? 'Expired' : item.expiresAt <= soon ? 'Expiring Soon' : 'Valid',
          lowStock: item.quantity <= item.reorderLevel,
        })),
        meta: {
          base_total: baseTotal,
          low_stock_total: lowStockTotal,
          expiring_total: expiringTotal,
          categories: categories.map((item: any) => item.category),
          expiry_soon_days: PHARMACY_EXPIRY_SOON_DAYS,
        },
      };
    },
    createBatch: async (v: any, actorId: string) => {
      const expiresAt = new Date(v.expiresAt);
      if (expiresAt <= new Date())
        throw new AppError(422, 'Expiry date must be in the future.', 'VALIDATION_ERROR');
      return prisma.$transaction(async (tx: any) => {
        const medicine = await tx.medicine.findUnique({ where: { id: v.medicineId } });
        if (!medicine || medicine.status !== 'Active')
          throw new AppError(422, 'Select an active medicine.', 'VALIDATION_ERROR');
        const batch = await tx.medicineBatch.create({
          data: {
            ...v,
            expiresAt,
            purchasePrice: new Prisma.Decimal(v.purchasePrice),
            sellingPrice: new Prisma.Decimal(v.sellingPrice),
          },
          include: { medicine: true },
        });
        const receiptNumber = code('RCV');
        await tx.stockTransaction.create({
          data: {
            batchId: batch.id,
            type: 'Stock Receipt',
            quantity: batch.quantity,
            referenceType: 'StockReceipt',
            referenceId: receiptNumber,
            actorId,
          },
        });
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: 'CREATE',
            module: 'pharmacy',
            entityType: 'MedicineBatch',
            entityId: batch.id,
            metadata: { receiptNumber, quantity: batch.quantity },
          },
        });
        return batch;
      });
    },
    updateBatch: async (id: string, v: any, actorId: string) =>
      prisma.$transaction(async (tx: any) => {
        const current = await tx.medicineBatch.findUnique({ where: { id } });
        if (!current) throw missing('Medicine batch');
        const expiresAt = v.expiresAt ? new Date(v.expiresAt) : current.expiresAt;
        if (expiresAt <= new Date())
          throw new AppError(422, 'Expiry date must be in the future.', 'VALIDATION_ERROR');
        const updated = await tx.medicineBatch.update({
          where: { id },
          data: {
            ...v,
            ...(v.expiresAt ? { expiresAt } : {}),
            ...(v.purchasePrice != null
              ? { purchasePrice: new Prisma.Decimal(v.purchasePrice) }
              : {}),
            ...(v.sellingPrice != null ? { sellingPrice: new Prisma.Decimal(v.sellingPrice) } : {}),
            version: { increment: 1 },
          },
          include: { medicine: true },
        });
        const delta = updated.quantity - current.quantity;
        if (delta)
          await tx.stockTransaction.create({
            data: {
              batchId: id,
              type: 'Adjustment',
              quantity: delta,
              referenceType: 'MedicineBatch',
              referenceId: id,
              actorId,
            },
          });
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: 'UPDATE',
            module: 'pharmacy',
            entityType: 'MedicineBatch',
            entityId: id,
            metadata: { quantityDelta: delta },
          },
        });
        return updated;
      }),
    ledger: async (q: any) => {
      const result = await paged(
        db.stockTransaction,
        q,
        { ...(q.batch_id ? { batchId: q.batch_id } : {}) },
        { batch: { include: { medicine: true } } },
      );
      const actorIds = [...new Set(result.data.map((item: any) => item.actorId))] as string[];
      const dispenseIds = result.data
        .filter((item: any) => item.referenceType === 'PharmacyDispense')
        .map((item: any) => item.referenceId);
      const [actors, dispenses] = await prisma.$transaction([
        db.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
        }),
        db.pharmacyDispense.findMany({
          where: { id: { in: dispenseIds } },
          select: { id: true, number: true },
        }),
      ]);
      const actorMap = new Map(
        actors.map((item: any) => [item.id, `${item.firstName} ${item.lastName}`.trim()]),
      );
      const referenceMap = new Map(dispenses.map((item: any) => [item.id, item.number]));
      return {
        ...result,
        data: result.data.map((item: any) => ({
          id: item.id,
          type: item.type,
          quantity: item.quantity,
          createdAt: item.createdAt,
          medicine: { id: item.batch.medicine.id, name: item.batch.medicine.name },
          batch: { id: item.batch.id, batchNumber: item.batch.batchNumber },
          reference: referenceMap.get(item.referenceId) ?? item.referenceId,
          createdBy: { id: item.actorId, displayName: actorMap.get(item.actorId) ?? 'System user' },
        })),
      };
    },
    dispenses: (q: any) =>
      paged(
        db.pharmacyDispense,
        q,
        {
          ...(q.patient_id ? { patientId: q.patient_id } : {}),
          ...(q.status ? { status: q.status } : {}),
        },
        { patient: true, items: { include: { medicine: true, batch: true } }, invoice: true },
      ),
    createDispense: (v: any) =>
      db.pharmacyDispense.create({
        data: {
          number: code('DSP'),
          patientId: v.patientId,
          prescriptionRef: v.prescriptionRef,
          items: {
            create: v.items.map((i: any) => ({ ...i, unitPrice: new Prisma.Decimal(i.unitPrice) })),
          },
        },
        include: { patient: true, items: true },
      }),
    dispense: async (id: string, v: any, actorId: string) => {
      const result = await prisma.$transaction(async (tx: any) => {
        const request = await tx.pharmacyDispense.findUnique({
          where: { id },
          include: { items: true, patient: true },
        });
        if (
          !request ||
          !['Pending Review', 'Reviewed', 'Partially Dispensed'].includes(request.status)
        )
          throw new AppError(409, 'This prescription is not available for dispensing.', 'CONFLICT');
        const selections = new Map(v.items.map((i: any) => [i.itemId, i.quantity]));
        if (![...selections.values()].some((quantity: any) => Number(quantity) > 0))
          throw new AppError(
            422,
            'At least one medicine quantity must be dispensed.',
            'VALIDATION_ERROR',
          );
        if (
          [...selections.keys()].some(
            (itemId) => !request.items.some((item: any) => item.id === itemId),
          )
        )
          throw new AppError(
            422,
            'A selected dispense item does not belong to this prescription.',
            'VALIDATION_ERROR',
          );
        for (const item of request.items.filter((candidate: any) => selections.has(candidate.id))) {
          const quantity = Number(selections.get(item.id) ?? 0);
          if (quantity < 0 || quantity > item.prescribedQuantity - item.dispensedQuantity)
            throw new AppError(
              422,
              'Dispensed quantity exceeds the outstanding prescription quantity.',
              'VALIDATION_ERROR',
            );
          const batch = await tx.medicineBatch.findUnique({ where: { id: item.batchId } });
          if (!batch || batch.medicineId !== item.medicineId || batch.expiresAt <= new Date())
            throw new AppError(
              409,
              'Expired or invalid medicine batch cannot be dispensed.',
              'CONFLICT',
            );
          if (batch.quantity < quantity)
            throw new AppError(
              409,
              'Insufficient valid stock for dispensing.',
              'INSUFFICIENT_STOCK',
            );
          if (quantity) {
            await tx.medicineBatch.update({
              where: { id: batch.id },
              data: { quantity: { decrement: quantity }, version: { increment: 1 } },
            });
            await tx.stockTransaction.create({
              data: {
                batchId: batch.id,
                type: 'Dispense',
                quantity: -quantity,
                referenceType: 'PharmacyDispense',
                referenceId: id,
                actorId,
              },
            });
            await tx.pharmacyDispenseItem.update({
              where: { id: item.id },
              data: { dispensedQuantity: { increment: quantity } },
            });
          }
        }
        const refreshed = await tx.pharmacyDispense.findUnique({
          where: { id },
          include: { items: true },
        });
        const completed = refreshed.items.every(
          (i: any) => i.dispensedQuantity === i.prescribedQuantity,
        );
        const invoiceItems = request.items
          .filter((i: any) => Number(selections.get(i.id) ?? 0) > 0)
          .map((i: any) => ({
            source: 'Pharmacy',
            sourceId: `${id}:${i.id}:${i.dispensedQuantity}`,
            description: 'Medicine dispense',
            quantity: new Prisma.Decimal(Number(selections.get(i.id))),
            unitPrice: i.unitPrice,
          }));
        const invoice = request.invoiceId
          ? await tx.invoice.update({
              where: { id: request.invoiceId },
              data: { items: { create: invoiceItems } },
              include: { items: true },
            })
          : await tx.invoice.create({
              data: {
                number: code('INV'),
                patientId: request.patientId,
                status: 'Pending',
                items: { create: invoiceItems },
              },
              include: { items: true },
            });
        await tx.auditLog.create({
          data: {
            userId: actorId,
            action: 'DISPENSE',
            module: 'pharmacy',
            entityType: 'PharmacyDispense',
            entityId: id,
            metadata: { invoiceId: invoice.id },
          },
        });
        return tx.pharmacyDispense.update({
          where: { id },
          data: {
            status: completed ? 'Dispensed' : 'Partially Dispensed',
            pharmacistId: actorId,
            dispensedAt: new Date(),
            invoiceId: invoice.id,
          },
          include: {
            patient: true,
            items: { include: { medicine: true, batch: true } },
            invoice: true,
          },
        });
      });
      await notificationService.notifyRoles(['HOSPITAL_ADMIN', 'PHARMACIST'], {
        type: 'PHARMACY_DISPENSED',
        title: 'Prescription dispensed',
        message: `Dispense ${result.number} was completed.`,
        relatedEntityType: 'PharmacyDispense',
        relatedEntityId: result.id,
      });
      return result;
    },
  },
  procurement: {
    list: (q: any) => {
      const direction = q.sort_order === 'desc' ? 'desc' : 'asc';
      const sorts: Record<string, any> = {
        number: { number: direction },
        supplier: { supplier: { name: direction } },
        item: { inventoryItem: { name: direction } },
        quantity: { quantity: direction },
        receivedQuantity: { receivedQuantity: direction },
        unitPrice: { unitPrice: direction },
        status: { status: direction },
      };
      return paged(
        db.purchaseOrder,
        q,
        {
          ...(q.status ? { status: q.status } : {}),
          ...(q.search
            ? {
                OR: [
                  { number: { contains: q.search, mode: 'insensitive' } },
                  { supplier: { is: { name: { contains: q.search, mode: 'insensitive' } } } },
                  { inventoryItem: { is: { name: { contains: q.search, mode: 'insensitive' } } } },
                  { medicine: { is: { name: { contains: q.search, mode: 'insensitive' } } } },
                ],
              }
            : {}),
        },
        { supplier: true, inventoryItem: true, medicine: true },
        [sorts[q.sort_by] ?? { requestedAt: 'desc' }, { id: 'asc' }],
      );
    },
    get: async (id: string) =>
      db.purchaseOrder
        .findUnique({
          where: { id },
          include: { supplier: true, inventoryItem: true, medicine: true },
        })
        .then((value: any) => value ?? Promise.reject(missing('Purchase order'))),
    create: (v: any) => {
      if (
        (v.itemType === 'Medicine') === !v.medicineId ||
        (v.itemType === 'Inventory') === !v.inventoryItemId
      )
        throw new AppError(
          422,
          'Select the matching medicine or inventory item.',
          'VALIDATION_ERROR',
        );
      return db.purchaseOrder.create({
        data: { ...v, number: code('PO'), unitPrice: new Prisma.Decimal(v.unitPrice) },
        include: { supplier: true, inventoryItem: true, medicine: true },
      });
    },
    update: async (id: string, v: any) => {
      const current = await db.purchaseOrder.findUnique({ where: { id } });
      if (!current) throw missing('Purchase order');
      if (current.status !== 'Ordered' || current.receivedQuantity > 0)
        throw new AppError(409, 'Only unreceived ordered requests can be edited.', 'CONFLICT');
      return db.purchaseOrder.update({
        where: { id },
        data: {
          ...v,
          ...(v.unitPrice != null ? { unitPrice: new Prisma.Decimal(v.unitPrice) } : {}),
        },
        include: { supplier: true, inventoryItem: true, medicine: true },
      });
    },
    cancel: async (id: string) => {
      const current = await db.purchaseOrder.findUnique({ where: { id } });
      if (!current) throw missing('Purchase order');
      if (!['Ordered', 'Partially Received'].includes(current.status))
        throw new AppError(409, 'This purchase order can no longer be cancelled.', 'CONFLICT');
      return db.purchaseOrder.update({ where: { id }, data: { status: 'Cancelled' } });
    },
    receive: (id: string, v: any, actorId: string) =>
      prisma.$transaction(async (tx: any) => {
        const po = await tx.purchaseOrder.findUnique({ where: { id } });
        if (!po || !['Ordered', 'Partially Received'].includes(po.status))
          throw new AppError(
            409,
            'Purchase order cannot be received in its current state.',
            'CONFLICT',
          );
        if (v.quantity <= 0 || po.receivedQuantity + v.quantity > po.quantity)
          throw new AppError(
            422,
            'Received quantity exceeds the outstanding order quantity.',
            'VALIDATION_ERROR',
          );
        if (po.itemType === 'Medicine') {
          if (!v.batchId)
            throw new AppError(422, 'A medicine batch is required.', 'VALIDATION_ERROR');
          const batch = await tx.medicineBatch.findFirst({
            where: { id: v.batchId, medicineId: po.medicineId },
          });
          if (!batch) throw missing('Medicine batch');
          await tx.medicineBatch.update({
            where: { id: batch.id },
            data: { quantity: { increment: v.quantity }, version: { increment: 1 } },
          });
          await tx.stockTransaction.create({
            data: {
              batchId: batch.id,
              type: 'Receipt',
              quantity: v.quantity,
              referenceType: 'PurchaseOrder',
              referenceId: id,
              actorId,
            },
          });
        } else {
          const item = await tx.inventoryItem.findUnique({ where: { id: po.inventoryItemId } });
          if (!item) throw missing('Inventory item');
          const balance = item.quantity + v.quantity;
          await tx.inventoryItem.update({ where: { id: item.id }, data: { quantity: balance } });
          await tx.inventoryMovement.create({
            data: {
              itemId: item.id,
              type: 'Stock In',
              quantity: v.quantity,
              balance,
              reference: po.number,
              notes: 'Purchase order receipt',
              actorId,
            },
          });
        }
        const received = po.receivedQuantity + v.quantity;
        return tx.purchaseOrder.update({
          where: { id },
          data: {
            receivedQuantity: received,
            status: received === po.quantity ? 'Received' : 'Partially Received',
          },
          include: { supplier: true, inventoryItem: true, medicine: true },
        });
      }),
  },
  audit: async (q: any) => {
    const direction = q.sort_order === 'asc' ? 'asc' : 'desc';
    const sorts: Record<string, any> = {
      createdAt: { createdAt: direction },
      user: { user: { firstName: direction } },
      action: { action: direction },
      module: { module: direction },
      entityType: { entityType: direction },
    };
    const result = await paged(
      db.auditLog,
      q,
      {
        ...(q.module ? { module: q.module } : {}),
        ...(q.action ? { action: q.action } : {}),
        ...(q.user_id ? { userId: q.user_id } : {}),
        ...(q.entity_type ? { entityType: q.entity_type } : {}),
        ...(q.created_from || q.created_to
          ? {
              createdAt: {
                ...(q.created_from ? { gte: new Date(`${q.created_from}T00:00:00.000Z`) } : {}),
                ...(q.created_to ? { lte: new Date(`${q.created_to}T23:59:59.999Z`) } : {}),
              },
            }
          : {}),
        ...(q.search
          ? {
              OR: [
                { action: { contains: q.search, mode: 'insensitive' } },
                { module: { contains: q.search, mode: 'insensitive' } },
                { entityType: { contains: q.search, mode: 'insensitive' } },
                { entityId: { contains: q.search, mode: 'insensitive' } },
                {
                  user: {
                    is: {
                      OR: [
                        { firstName: { contains: q.search, mode: 'insensitive' } },
                        { lastName: { contains: q.search, mode: 'insensitive' } },
                        { email: { contains: q.search, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              ],
            }
          : {}),
      },
      { user: true },
      [sorts[q.sort_by] ?? { createdAt: 'desc' }, { id: 'asc' }],
    );
    return {
      ...result,
      data: result.data.map((item: any) => ({
        ...item,
        metadata: sanitizeAuditMetadata(item.metadata),
      })),
    };
  },
  auditDetail: async (id: string) => {
    const item = await db.auditLog.findUnique({ where: { id }, include: { user: true } });
    if (!item) throw missing('Audit log');
    return { ...item, metadata: sanitizeAuditMetadata(item.metadata) };
  },
  auditOptions: async () => {
    const [modules, actions, entityTypes, actors] = await prisma.$transaction([
      db.auditLog.findMany({
        distinct: ['module'],
        select: { module: true },
        orderBy: { module: 'asc' },
      }),
      db.auditLog.findMany({
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' },
      }),
      db.auditLog.findMany({
        distinct: ['entityType'],
        select: { entityType: true },
        orderBy: { entityType: 'asc' },
      }),
      db.auditLog.findMany({
        where: { userId: { not: null } },
        distinct: ['userId'],
        select: {
          userId: true,
          user: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: { userId: 'asc' },
      }),
    ]);
    return {
      modules: modules.map((item: any) => item.module),
      actions: actions.map((item: any) => item.action),
      entityTypes: entityTypes.map((item: any) => item.entityType),
      actors: actors.map((item: any) => ({
        id: item.userId,
        name: item.user
          ? `${item.user.firstName} ${item.user.lastName}`.trim()
          : 'Unavailable user',
        email: item.user?.email ?? null,
      })),
    };
  },
  masters: {
    departments: (q: any) => {
      const direction = q.sort_order === 'desc' ? 'desc' : 'asc';
      const sorts: Record<string, any> = {
        name: { name: direction },
        code: { code: direction },
        status: { status: direction },
      };
      return paged(
        db.department,
        q,
        {
          deletedAt: null,
          ...(q.search
            ? {
                OR: [
                  { name: { contains: q.search, mode: 'insensitive' } },
                  { code: { contains: q.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        { _count: { select: { appointments: true, admissions: true, specializations: true } } },
        [sorts[q.sort_by] ?? { name: 'asc' }, { id: 'asc' }],
      );
    },
    department: (id: string) =>
      db.department.findUnique({ where: { id }, include: { specializations: true } }),
    createDepartment: (v: any) => db.department.create({ data: v }),
    updateDepartment: (id: string, v: any) => db.department.update({ where: { id }, data: v }),
    deactivateDepartment: (id: string) =>
      db.department.update({ where: { id }, data: { status: 'Inactive' } }),
    specializations: (q: any) => {
      const direction = q.sort_order === 'desc' ? 'desc' : 'asc';
      const sorts: Record<string, any> = {
        name: { name: direction },
        code: { code: direction },
        department: { department: { name: direction } },
        status: { status: direction },
      };
      return paged(
        db.specialization,
        q,
        {
          deletedAt: null,
          ...(q.department_id ? { departmentId: q.department_id } : {}),
          ...(q.search
            ? {
                OR: [
                  { name: { contains: q.search, mode: 'insensitive' } },
                  { code: { contains: q.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        { department: true },
        [sorts[q.sort_by] ?? { name: 'asc' }, { id: 'asc' }],
      );
    },
    specialization: (id: string) =>
      db.specialization.findUnique({ where: { id }, include: { department: true } }),
    createSpecialization: (v: any) => db.specialization.create({ data: v }),
    updateSpecialization: (id: string, v: any) =>
      db.specialization.update({ where: { id }, data: v }),
    deactivateSpecialization: (id: string) =>
      db.specialization.update({ where: { id }, data: { status: 'Inactive' } }),
    radiologyInvestigations: (q: any) => {
      const direction = q.sort_order === 'desc' ? 'desc' : 'asc';
      const sorts: Record<string, any> = {
        name: { name: direction },
        code: { code: direction },
        modality: { modality: direction },
        status: { status: direction },
      };
      return paged(
        db.radiologyInvestigation,
        q,
        {
          ...(q.status ? { status: q.status } : {}),
          ...(q.modality ? { modality: q.modality } : {}),
          ...(q.search
            ? {
                OR: [
                  { name: { contains: q.search, mode: 'insensitive' } },
                  { code: { contains: q.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        undefined,
        [sorts[q.sort_by] ?? { name: 'asc' }, { id: 'asc' }],
      );
    },
    radiologyInvestigation: (id: string) => db.radiologyInvestigation.findUnique({ where: { id } }),
    createRadiologyInvestigation: (v: any) => db.radiologyInvestigation.create({ data: v }),
    updateRadiologyInvestigation: (id: string, v: any) =>
      db.radiologyInvestigation.update({ where: { id }, data: v }),
    deactivateRadiologyInvestigation: (id: string) =>
      db.radiologyInvestigation.update({ where: { id }, data: { status: 'Inactive' } }),
    laboratoryTests: (q: any) => {
      const direction = q.sort_order === 'desc' ? 'desc' : 'asc';
      const sorts: Record<string, any> = {
        name: { name: direction },
        code: { code: direction },
        category: { category: direction },
        unit: { unit: direction },
        status: { status: direction },
      };
      return paged(
        db.laboratoryTestDefinition,
        q,
        {
          ...(q.status ? { status: q.status } : {}),
          ...(q.category ? { category: q.category } : {}),
          ...(q.search
            ? {
                OR: [
                  { name: { contains: q.search, mode: 'insensitive' } },
                  { code: { contains: q.search, mode: 'insensitive' } },
                  { category: { contains: q.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        },
        undefined,
        [sorts[q.sort_by] ?? { name: 'asc' }, { id: 'asc' }],
      );
    },
    laboratoryTest: (id: string) => db.laboratoryTestDefinition.findUnique({ where: { id } }),
    createLaboratoryTest: (v: any) => db.laboratoryTestDefinition.create({ data: v }),
    updateLaboratoryTest: (id: string, v: any) =>
      db.laboratoryTestDefinition.update({ where: { id }, data: v }),
    deleteLaboratoryTest: async (id: string) => {
      const item = await db.laboratoryTestDefinition.findUnique({ where: { id } });
      if (!item) throw missing('Laboratory test definition');
      const referenced = await db.labOrderTest.count({ where: { testDefinitionId: id } });
      return referenced
        ? db.laboratoryTestDefinition.update({ where: { id }, data: { status: 'Inactive' } })
        : db.laboratoryTestDefinition.delete({ where: { id } });
    },
  },
};
