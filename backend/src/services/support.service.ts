import { randomUUID } from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
const db = prisma as any;
const pagination = (q: any) => ({
  page: Math.max(1, Number(q.page ?? 1)),
  pageSize: Math.min(100, Math.max(1, Number(q.page_size ?? 10))),
});
export const supportService = {
  async articles(q: any) {
    const { page, pageSize } = pagination(q);
    const where = {
      status: 'PUBLISHED',
      ...(q.category ? { category: q.category } : {}),
      ...(q.search
        ? {
            OR: [
              { title: { contains: q.search, mode: 'insensitive' } },
              { content: { contains: q.search, mode: 'insensitive' } },
              { category: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await prisma.$transaction([
      db.helpArticle.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ category: 'asc' }, { title: 'asc' }],
      }),
      db.helpArticle.count({ where }),
    ]);
    return {
      data,
      pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) },
    };
  },
  contacts: () =>
    db.supportContactSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    }),
  updateContacts: (v: any) =>
    db.supportContactSettings.upsert({
      where: { id: 'default' },
      update: v,
      create: { id: 'default', ...v },
    }),
  allArticles: () => db.helpArticle.findMany({ orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }] }),
  createArticle: (v: any) => db.helpArticle.create({ data: v }),
  updateArticle: (id: string, v: any) => db.helpArticle.update({ where: { id }, data: v }),
  deleteArticle: (id: string) => db.helpArticle.delete({ where: { id } }),
  async tickets(q: any, userId: string, manage: boolean) {
    const { page, pageSize } = pagination(q);
    const access = manage ? {} : { requesterId: userId };
    const where = {
      ...access,
      ...(q.status ? { status: q.status } : {}),
      ...(q.priority ? { priority: q.priority } : {}),
      ...(q.search
        ? {
            OR: [
              { ticketNumber: { contains: q.search, mode: 'insensitive' } },
              { subject: { contains: q.search, mode: 'insensitive' } },
              { module: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const direction = q.sort_order === 'asc' ? 'asc' : 'desc';
    const sorts: Record<string, any> = {
      ticketNumber: { ticketNumber: direction },
      subject: { subject: direction },
      module: { module: direction },
      priority: { priority: direction },
      status: { status: direction },
      createdAt: { createdAt: direction },
      updatedAt: { updatedAt: direction },
    };
    const [data, total] = await prisma.$transaction([
      db.supportTicket.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [sorts[q.sort_by] ?? { createdAt: 'desc' }, { id: 'asc' }],
        include: { requester: { select: { firstName: true, lastName: true, email: true } } },
      }),
      db.supportTicket.count({ where }),
    ]);
    return {
      data,
      pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) },
    };
  },
  async ticket(id: string, userId: string, manage: boolean) {
    const ticket = await db.supportTicket.findFirst({
      where: { id, ...(manage ? {} : { requesterId: userId }) },
      include: {
        requester: { select: { firstName: true, lastName: true, email: true } },
        assignedTo: { select: { firstName: true, lastName: true, email: true } },
        history: {
          orderBy: { createdAt: 'asc' },
          include: { actor: { select: { firstName: true, lastName: true } } },
        },
      },
    });
    if (!ticket) throw new AppError(404, 'Support request not found.', 'NOT_FOUND');
    return ticket;
  },
  create: (userId: string, v: any) =>
    prisma.$transaction(async (tx: any) => {
      const ticket = await tx.supportTicket.create({
        data: {
          ...v,
          requesterId: userId,
          ticketNumber: `SUP-${new Date().getUTCFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        },
      });
      await tx.supportTicketStatusHistory.create({
        data: { ticketId: ticket.id, status: 'OPEN', changedBy: userId },
      });
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE',
          module: 'support',
          entityType: 'SupportTicket',
          entityId: ticket.id,
          metadata: {
            ticketNumber: ticket.ticketNumber,
            priority: ticket.priority,
            module: ticket.module,
          },
        },
      });
      return ticket;
    }),
  async update(id: string, v: any, actorId: string) {
    const ticket = await db.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new AppError(404, 'Support request not found.', 'NOT_FOUND');
    const allowed: Record<string, string[]> = {
      OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
      IN_PROGRESS: ['OPEN', 'RESOLVED', 'CLOSED'],
      RESOLVED: ['IN_PROGRESS', 'CLOSED'],
      CLOSED: [],
    };
    if (
      v.status &&
      v.status !== ticket.status &&
      !(allowed[ticket.status] ?? []).includes(v.status)
    )
      throw new AppError(409, 'Invalid support request status transition.', 'CONFLICT');
    return prisma.$transaction(async (tx: any) => {
      const updated = await tx.supportTicket.update({ where: { id }, data: v });
      if (v.status && v.status !== ticket.status)
        await tx.supportTicketStatusHistory.create({
          data: { ticketId: id, status: v.status, changedBy: actorId },
        });
      await tx.auditLog.create({
        data: {
          userId: actorId,
          action: 'UPDATE',
          module: 'support',
          entityType: 'SupportTicket',
          entityId: id,
          metadata: {
            previousStatus: ticket.status,
            status: updated.status,
            assignmentChanged: v.assignedToId !== undefined,
          },
        },
      });
      return updated;
    });
  },
};
