import { Prisma } from '@prisma/client';

type RefundAmount = { amount: Prisma.Decimal | number | string; status: string };
type PaymentAmount = {
  amount: Prisma.Decimal | number | string;
  refunds?: RefundAmount[];
};
type InvoiceAmounts = {
  items: Array<{
    quantity: Prisma.Decimal | number | string;
    unitPrice: Prisma.Decimal | number | string;
  }>;
  payments: PaymentAmount[];
};

const decimal = (value: Prisma.Decimal | number | string) => new Prisma.Decimal(value);

export const invoiceFinancials = (invoice: InvoiceAmounts) => {
  const total = invoice.items.reduce(
    (sum, item) => sum.plus(decimal(item.quantity).mul(decimal(item.unitPrice))),
    new Prisma.Decimal(0),
  );
  const grossPaid = invoice.payments.reduce(
    (sum, payment) => sum.plus(decimal(payment.amount)),
    new Prisma.Decimal(0),
  );
  const approvedRefunds = invoice.payments.reduce(
    (sum, payment) =>
      sum.plus(
        (payment.refunds ?? [])
          .filter((refund) => refund.status === 'Approved')
          .reduce(
            (refundTotal, refund) => refundTotal.plus(decimal(refund.amount)),
            new Prisma.Decimal(0),
          ),
      ),
    new Prisma.Decimal(0),
  );
  const netPaid = Prisma.Decimal.max(0, grossPaid.minus(approvedRefunds));
  const balance = Prisma.Decimal.max(0, total.minus(netPaid));
  const status =
    netPaid.gte(total) && total.gt(0)
      ? 'Paid'
      : approvedRefunds.gt(0) && netPaid.eq(0)
        ? 'Refunded'
        : netPaid.gt(0)
          ? 'Partially Paid'
          : 'Pending';
  return { total, grossPaid, approvedRefunds, netPaid, balance, status };
};
