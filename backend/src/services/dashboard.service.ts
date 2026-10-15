import { prisma } from '../config/prisma.js';
import { calendarDayBounds } from '../utils/date-time.js';

export const dashboardService = {
  async summary() {
    const { start, end } = calendarDayBounds();
    const [patients, appointmentsToday, admissions, availableBeds, pendingLabs, pendingRadiology, medicineBatches, inventoryItems, payments, openClaims, availableAmbulances] = await Promise.all([
      prisma.patient.count({ where: { deletedAt: null } }),
      prisma.appointment.count({ where: { appointmentAt: { gte: start, lt: end } } }),
      prisma.admission.count({
        where: { status: { in: ['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PLANNED'] } },
      }),
      prisma.bed.count({ where: { status: 'AVAILABLE' } }),
      prisma.labOrder.count({ where: { status: { notIn: ['Completed','Cancelled'] } } }),
      prisma.radiologyOrder.count({ where: { status: { notIn: ['Completed','Cancelled'] } } }),
      prisma.medicineBatch.findMany({ select: { quantity: true, reorderLevel: true } }),
      prisma.inventoryItem.findMany({ where: { isActive: true, deletedAt: null }, select: { quantity: true, reorderLevel: true } }),
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.insuranceClaim.count({ where: { status: { notIn: ['Settled','Rejected','Cancelled'] } } }),
      prisma.ambulance.count({ where: { isActive: true, status: 'Available' } }),
    ]);
    return {
      total_patients: patients,
      appointments_today: appointmentsToday,
      current_admissions: admissions,
      available_beds: availableBeds,
      pending_laboratory: pendingLabs,
      pending_radiology: pendingRadiology,
      low_stock_items: medicineBatches.filter((x)=>x.quantity<=x.reorderLevel).length + inventoryItems.filter((x)=>x.quantity<=x.reorderLevel).length,
      revenue_received: Number(payments._sum.amount ?? 0),
      open_insurance_claims: openClaims,
      available_ambulances: availableAmbulances,
    };
  },
  async appointmentStatus() {
    const groups = await prisma.appointment.groupBy({ by: ['status'], _count: true });
    return groups.map((item) => ({ status: item.status, count: item._count }));
  },
  async patientTrends(days = 30) {
    const { start: since } = calendarDayBounds(); since.setUTCDate(since.getUTCDate() - Math.min(days, 365) + 1);
    const rows = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`SELECT ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date AS date, COUNT(*)::bigint AS count FROM "Patient" WHERE "createdAt" >= ${since} AND "deletedAt" IS NULL GROUP BY ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date ORDER BY date`;
    return rows.map((row) => ({ date: row.date, count: Number(row.count) }));
  },
  async appointmentsByDepartment() {
    const groups = await prisma.appointment.groupBy({ by: ['departmentId'], _count: true });
    const departments = await prisma.department.findMany({
      where: { id: { in: groups.map((x) => x.departmentId) } },
      select: { id: true, name: true },
    });
    const names = new Map(departments.map((x) => [x.id, x.name]));
    return groups.map((item) => ({
      department: names.get(item.departmentId) ?? 'Unknown',
      count: item._count,
    }));
  },
  async recentAppointments() {
    const rows = await prisma.appointment.findMany({
      orderBy: { appointmentAt: 'desc' },
      take: 10,
      include: {
        patient: { select: { firstName: true, lastName: true } },
        doctor: { select: { firstName: true, lastName: true } },
        department: { select: { name: true } },
      },
    });
    return rows.map((item) => ({
      id: item.id,
      number: item.number,
      appointment_at: item.appointmentAt,
      status: item.status,
      patient_name: `${item.patient.firstName} ${item.patient.lastName}`,
      doctor_name: `${item.doctor.firstName} ${item.doctor.lastName}`,
      department_name: item.department.name,
    }));
  },
};
