import { prisma } from '../config/prisma.js';
export const documentRepository = {
  create: (data: any) => prisma.document.create({ data }),
  find: (id: string) => prisma.document.findFirst({ where: { id, deletedAt: null } }),
  forPatient: (patientId: string) =>
    prisma.document.findMany({
      where: { patientId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    }),
  archive: (id: string) =>
    prisma.document.update({ where: { id }, data: { deletedAt: new Date() } }),
  list: (where: any, skip: number, take: number, orderBy: any) =>
    prisma.document.findMany({
      where: { ...where, deletedAt: null },
      include: { uploadedBy: { select: { firstName: true, lastName: true } } },
      orderBy,
      skip,
      take,
    }),
  count: (where: any) => prisma.document.count({ where: { ...where, deletedAt: null } }),
};
