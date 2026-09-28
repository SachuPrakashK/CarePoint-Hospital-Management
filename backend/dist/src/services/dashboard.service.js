import { prisma } from '../config/prisma.js';
export const dashboardService = {
    async summary() {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        const [patients, appointmentsToday, admissions, availableBeds] = await Promise.all([
            prisma.patient.count({ where: { deletedAt: null } }),
            prisma.appointment.count({ where: { appointmentAt: { gte: start, lt: end } } }),
            prisma.admission.count({ where: { status: { in: ['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PLANNED'] } } }),
            prisma.bed.count({ where: { status: 'AVAILABLE' } }),
        ]);
        return { total_patients: patients, appointments_today: appointmentsToday, current_admissions: admissions, available_beds: availableBeds };
    },
    async appointmentStatus() {
        const groups = await prisma.appointment.groupBy({ by: ['status'], _count: true });
        return groups.map((item) => ({ status: item.status, count: item._count }));
    },
    async appointmentsByDepartment() {
        const groups = await prisma.appointment.groupBy({ by: ['departmentId'], _count: true });
        const departments = await prisma.department.findMany({ where: { id: { in: groups.map((x) => x.departmentId) } }, select: { id: true, name: true } });
        const names = new Map(departments.map((x) => [x.id, x.name]));
        return groups.map((item) => ({ department: names.get(item.departmentId) ?? 'Unknown', count: item._count }));
    },
    async patientTrends(days = 30) {
        const since = new Date();
        since.setUTCHours(0, 0, 0, 0);
        since.setUTCDate(since.getUTCDate() - Math.min(days, 365) + 1);
        const rows = await prisma.$queryRaw `SELECT DATE("createdAt") AS date, COUNT(*)::bigint AS count FROM "Patient" WHERE "createdAt" >= ${since} AND "deletedAt" IS NULL GROUP BY DATE("createdAt") ORDER BY date`;
        return rows.map((row) => ({ date: row.date, count: Number(row.count) }));
    },
};
