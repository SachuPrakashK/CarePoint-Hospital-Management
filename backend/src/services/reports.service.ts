import { prisma } from '../config/prisma.js';
import { calendarRangeBounds } from '../utils/date-time.js';
import { invoiceFinancials } from '../utils/invoice-financials.js';

type ReportQuery = { from?: string; to?: string; department_id?: string };

export const escapeCsvCell = (value: unknown) => {
  const text = value == null ? '' : String(value);
  const safe = /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const csvRow = (values: unknown[]) => values.map(escapeCsvCell).join(',');

export const buildReportsCsv = (
  report: Awaited<ReturnType<typeof reportsService.overview>>,
  query: ReportQuery,
) => {
  const selectedDepartment = query.department_id
    ? (report.filters.departments.find((item) => item.id === query.department_id)?.name ??
      'Unknown')
    : 'All departments';
  const rows: unknown[][] = [
    ['MediCare+ Reports & Analytics'],
    ['From', query.from ?? 'All dates'],
    ['To', query.to ?? 'All dates'],
    ['Department', selectedDepartment],
    [],
    ['Summary'],
    ['Metric', 'Value'],
    ['Total Patients', report.summary.total_patients],
    ['Total Appointments', report.summary.total_appointments],
    ['OPD Visits', report.summary.opd_visits],
    ['Active Admissions', report.summary.active_admissions],
    ['Bed Occupancy (%)', report.summary.bed_occupancy_rate],
    ['Completed Procedures', report.summary.completed_procedures],
  ];
  if (report.scope.finance_visible) {
    rows.push(
      ['Total Revenue (INR)', report.summary.total_revenue],
      ['Outstanding Payments (INR)', report.summary.outstanding_payments],
    );
  }
  rows.push([], ['Appointment Summary'], ['Status', 'Count']);
  for (const item of report.appointment_statuses) rows.push([item.status, item.count]);
  rows.push(
    [],
    ['Department Performance'],
    ['Department', 'Appointments', 'Admissions', 'Total Activity'],
  );
  for (const item of report.department_performance) {
    rows.push([item.department, item.appointments, item.admissions, item.total_visits]);
  }
  return `\uFEFF${rows.map(csvRow).join('\r\n')}\r\n`;
};

export const reportsService = {
  async overview(query: ReportQuery, canViewFinance: boolean) {
    const range = calendarRangeBounds(query.from, query.to);
    const department = query.department_id ? { departmentId: query.department_id } : {};
    const appointmentWhere = {
      ...(Object.keys(range).length ? { appointmentAt: range } : {}),
      ...department,
    };
    const admissionWhere = {
      ...(Object.keys(range).length ? { admittedAt: range } : {}),
      ...department,
    };
    const procedureWhere = { ...(Object.keys(range).length ? { scheduledAt: range } : {}) };
    const patientWhere = {
      deletedAt: null,
      ...(Object.keys(range).length ? { createdAt: range } : {}),
    };

    const [
      patients,
      appointments,
      opdVisits,
      activeAdmissions,
      beds,
      occupiedBeds,
      completedProcedures,
      appointmentStatuses,
      departmentAppointments,
      departmentAdmissions,
      departments,
      patientTrend,
      invoices,
    ] = await Promise.all([
      prisma.patient.count({ where: patientWhere }),
      prisma.appointment.count({ where: appointmentWhere }),
      prisma.opdQueueEntry.count({
        where: { ...(Object.keys(range).length ? { queueDate: range } : {}), ...department },
      }),
      prisma.admission.count({
        where: {
          ...admissionWhere,
          status: { in: ['ADMITTED', 'TRANSFERRED', 'DISCHARGE_PLANNED'] },
        },
      }),
      prisma.bed.count(),
      prisma.bed.count({ where: { status: 'OCCUPIED' } }),
      prisma.procedure.count({ where: { ...procedureWhere, status: 'Completed' } }),
      prisma.appointment.groupBy({ by: ['status'], where: appointmentWhere, _count: true }),
      prisma.appointment.groupBy({ by: ['departmentId'], where: appointmentWhere, _count: true }),
      prisma.admission.groupBy({ by: ['departmentId'], where: admissionWhere, _count: true }),
      prisma.department.findMany({
        where: { deletedAt: null, status: 'Active' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
        SELECT ("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata')::date AS date, COUNT(*)::bigint AS count
        FROM "Patient"
        WHERE "deletedAt" IS NULL
          AND (${range.gte ?? null}::timestamp IS NULL OR "createdAt" >= ${range.gte ?? null})
          AND (${range.lt ?? null}::timestamp IS NULL OR "createdAt" < ${range.lt ?? null})
        GROUP BY date ORDER BY date`,
      canViewFinance
        ? prisma.invoice.findMany({
            where: Object.keys(range).length ? { createdAt: range } : {},
            include: { items: true, payments: { include: { refunds: true } } },
          })
        : Promise.resolve([]),
    ]);

    const departmentNames = new Map(departments.map((item) => [item.id, item.name]));
    const appointmentCounts = new Map(
      departmentAppointments.map((item) => [item.departmentId, item._count]),
    );
    const admissionCounts = new Map(
      departmentAdmissions.map((item) => [item.departmentId, item._count]),
    );
    const departmentRows = departments
      .filter((item) => !query.department_id || item.id === query.department_id)
      .map((item) => ({
        id: item.id,
        department: item.name,
        appointments: appointmentCounts.get(item.id) ?? 0,
        admissions: admissionCounts.get(item.id) ?? 0,
        total_visits: (appointmentCounts.get(item.id) ?? 0) + (admissionCounts.get(item.id) ?? 0),
      }));

    let revenue: number | null = null;
    let outstanding: number | null = null;
    if (canViewFinance) {
      revenue = invoices.reduce(
        (sum, invoice) => sum + invoiceFinancials(invoice).netPaid.toNumber(),
        0,
      );
      outstanding = invoices.reduce(
        (sum, invoice) => sum + invoiceFinancials(invoice).balance.toNumber(),
        0,
      );
    }

    return {
      filters: { departments },
      summary: {
        total_patients: patients,
        total_appointments: appointments,
        opd_visits: opdVisits,
        active_admissions: activeAdmissions,
        bed_occupancy_rate: beds ? Math.round((occupiedBeds / beds) * 1000) / 10 : 0,
        completed_procedures: completedProcedures,
        total_revenue: revenue,
        outstanding_payments: outstanding,
      },
      patient_trends: patientTrend.map((item) => ({ date: item.date, count: Number(item.count) })),
      appointment_statuses: appointmentStatuses.map((item) => ({
        status: item.status,
        count: item._count,
      })),
      department_visits: departmentRows.map((item) => ({
        department: item.department,
        count: item.total_visits,
      })),
      department_performance: departmentRows,
      scope: { finance_visible: canViewFinance },
    };
  },
  async csv(query: ReportQuery, canViewFinance: boolean) {
    return buildReportsCsv(await this.overview(query, canViewFinance), query);
  },
};
