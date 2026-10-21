import { describe, expect, it } from 'vitest';
import { invoiceFinancials } from '../src/utils/invoice-financials.js';

const invoice = (payments: any[] = []) => ({
  items: [{ quantity: 2, unitPrice: 125.5 }],
  payments,
});

describe('invoice financials', () => {
  it('calculates unpaid, partial and paid balances', () => {
    expect(invoiceFinancials(invoice()).status).toBe('Pending');
    expect(invoiceFinancials(invoice([{ amount: 100 }])).balance.toNumber()).toBe(151);
    expect(invoiceFinancials(invoice([{ amount: 100 }])).status).toBe('Partially Paid');
    expect(invoiceFinancials(invoice([{ amount: 251 }])).status).toBe('Paid');
  });

  it('only applies approved refunds', () => {
    const pending = invoiceFinancials(
      invoice([{ amount: 251, refunds: [{ amount: 50, status: 'Requested' }] }]),
    );
    expect(pending.netPaid.toNumber()).toBe(251);
    expect(pending.status).toBe('Paid');

    const approved = invoiceFinancials(
      invoice([{ amount: 251, refunds: [{ amount: 50, status: 'Approved' }] }]),
    );
    expect(approved.netPaid.toNumber()).toBe(201);
    expect(approved.balance.toNumber()).toBe(50);
    expect(approved.status).toBe('Partially Paid');
  });

  it('marks a fully reversed payment as refunded', () => {
    const result = invoiceFinancials(
      invoice([{ amount: 251, refunds: [{ amount: 251, status: 'Approved' }] }]),
    );
    expect(result.netPaid.toNumber()).toBe(0);
    expect(result.balance.toNumber()).toBe(251);
    expect(result.status).toBe('Refunded');
  });
});
