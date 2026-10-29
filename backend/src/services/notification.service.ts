import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/app-error.js';
export const notificationService = {
  async list(userId: string, page: number, pageSize: number) {
    const where = { userId };
    const [data, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
    ]);
    return {
      data,
      pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) },
    };
  },
  unreadCount: (userId: string) => prisma.notification.count({ where: { userId, isRead: false } }),
  async read(userId: string, id: string) {
    const found = await prisma.notification.findFirst({ where: { id, userId } });
    if (!found) throw new AppError(404, 'Notification was not found.', 'NOT_FOUND');
    return prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: found.readAt ?? new Date() },
    });
  },
  async readAll(userId: string) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  },
  async notifyRoles(
    roleCodes: string[],
    data: {
      type: string;
      title: string;
      message: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
    },
  ) {
    const settings = await prisma.notificationSettings.upsert({
      where: { id: 'default' },
      update: {},
      create: { id: 'default' },
    });
    const enabled: Record<string, boolean> = {
      APPOINTMENT_CREATED: settings.appointmentCreated,
      APPOINTMENT_CANCELLED: settings.appointmentCancelled,
      LAB_RESULT_READY: settings.laboratoryResultVerified,
      RADIOLOGY_RESULT_READY: settings.radiologyResultVerified,
      LOW_INVENTORY: settings.lowInventory,
      PAYMENT_RECEIVED: settings.paymentReceived,
    };
    if (data.type in enabled && !enabled[data.type]) return;
    const users = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        roles: { some: { role: { code: { in: roleCodes } } } },
      },
      select: { id: true },
    });
    if (users.length)
      await prisma.notification.createMany({
        data: users.map(({ id }) => ({ userId: id, ...data })),
      });
  },
};
