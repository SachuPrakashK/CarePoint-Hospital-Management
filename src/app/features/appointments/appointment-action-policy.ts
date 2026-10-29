import { ApiAppointment } from './appointment-api.service';

type AppointmentActionState = Pick<ApiAppointment, 'invoiceId' | 'paymentStatus' | 'status'>;

export const canAccessAppointmentInvoice = (appointment: AppointmentActionState) =>
  appointment.paymentStatus === 'Paid' && Boolean(appointment.invoiceId);

export const canShowAppointmentReschedule = (appointment: AppointmentActionState) =>
  ['SCHEDULED', 'CONFIRMED', 'COMPLETED'].includes(appointment.status);

export const isAppointmentRescheduleDisabled = (appointment: AppointmentActionState) =>
  appointment.status === 'COMPLETED';
