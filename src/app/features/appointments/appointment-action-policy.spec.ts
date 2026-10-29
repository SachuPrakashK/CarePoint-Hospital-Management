import {
  canAccessAppointmentInvoice,
  canShowAppointmentReschedule,
  isAppointmentRescheduleDisabled,
} from './appointment-action-policy';

describe('appointment action policy', () => {
  it.each([
    ['Paid', 'invoice-1', true],
    ['Paid', null, false],
    ['Pending', 'invoice-1', false],
    ['Partially Paid', 'invoice-1', false],
    ['Refunded', 'invoice-1', false],
    ['Not Billed', null, false],
  ] as const)(
    'allows invoice actions only for a paid linked invoice',
    (paymentStatus, invoiceId, expected) => {
      expect(canAccessAppointmentInvoice({ paymentStatus, invoiceId, status: 'CONFIRMED' })).toBe(
        expected,
      );
    },
  );

  it('keeps completed Reschedule visible but disabled', () => {
    const appointment = {
      paymentStatus: 'Paid' as const,
      invoiceId: 'invoice-1',
      status: 'COMPLETED',
    };
    expect(canShowAppointmentReschedule(appointment)).toBe(true);
    expect(isAppointmentRescheduleDisabled(appointment)).toBe(true);
  });

  it('preserves existing rescheduling eligibility', () => {
    expect(
      canShowAppointmentReschedule({
        paymentStatus: 'Pending',
        invoiceId: null,
        status: 'CONFIRMED',
      }),
    ).toBe(true);
    expect(
      canShowAppointmentReschedule({
        paymentStatus: 'Pending',
        invoiceId: null,
        status: 'CANCELLED',
      }),
    ).toBe(false);
  });
});
