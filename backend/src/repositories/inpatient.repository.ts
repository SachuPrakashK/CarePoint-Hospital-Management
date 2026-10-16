import { prisma } from '../config/prisma.js';
export const inpatientRepository = {
  listAdmissions: async (query: any) => {
    const page = Number(query.page),
      pageSize = Number(query.page_size);
    const search = query.search?.trim();
    const direction=query.sort_order==='asc'?'asc':'desc';
    const sorts:any={admittedAt:{admittedAt:direction},number:{number:direction},patient:{patient:{firstName:direction}},department:{department:{name:direction}},doctor:{attendingDoctor:{firstName:direction}},status:{status:direction}};
    const where: any = {
      ...(query.department_id ? { departmentId: query.department_id } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { number: { contains: search, mode: 'insensitive' } },
              { patientId: { equals: search } },
              {
                patient: {
                  is: {
                    OR: [
                      { firstName: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                      { mrn: { contains: search, mode: 'insensitive' } },
                      { phone: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
              {
                attendingDoctor: {
                  is: {
                    OR: [
                      { firstName: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
              { department: { is: { name: { contains: search, mode: 'insensitive' } } } },
              {
                allocations: {
                  some: {
                    bed: {
                      is: {
                        OR: [
                          { name: { contains: search, mode: 'insensitive' } },
                          {
                            room: {
                              is: {
                                OR: [
                                  { name: { contains: search, mode: 'insensitive' } },
                                  { ward: { contains: search, mode: 'insensitive' } },
                                  {
                                    wardModel: {
                                      is: { name: { contains: search, mode: 'insensitive' } },
                                    },
                                  },
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
    const [data, total] = await prisma.$transaction([
      prisma.admission.findMany({
        where,
        include: {
          patient: true,
          department: true,
          attendingDoctor: true,
          allocations: { include: { bed: { include: { room: { include: { wardModel: true } } } } }, orderBy: { startedAt: 'asc' } },
          discharge: true,
        },
        orderBy: [sorts[query.sort_by]??{admittedAt:'desc'},{id:'asc'}],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.admission.count({ where }),
    ]);
    return {
      data,
      pagination: { page, page_size: pageSize, total, total_pages: Math.ceil(total / pageSize) },
    };
  },
  admission: (id: string) =>
    prisma.admission.findUnique({
      where: { id },
      include: {
        patient: true,
        department: true,
        attendingDoctor: true,
        allocations: { include: { bed: { include: { room: { include: { wardModel: true } } } } }, orderBy: { startedAt: 'asc' } },
        discharge: true,
      },
    }),
  wards: () => prisma.ward.findMany({ include: { rooms: { include: { beds: true } } } }),
  rooms: () => prisma.room.findMany({ include: { beds: true, wardModel: true } }),
  beds: () =>
    prisma.bed.findMany({
      include: {
        room: { include: { wardModel: true } },
        allocations: { where: { endedAt: null }, include: { admission: { select: { patientId: true } } }, take: 1 },
      },
    }),
  availableBeds: () =>
    prisma.bed.findMany({
      where: { status: 'AVAILABLE' },
      include: { room: { include: { wardModel: true } } },
    }),
};
