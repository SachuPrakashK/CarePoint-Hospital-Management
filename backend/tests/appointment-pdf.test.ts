import { describe, expect, it } from 'vitest';
import { createTextPdf } from '../src/services/appointment.service.js';

describe('appointment invoice PDF', () => {
  it('creates additional A4 pages instead of truncating long invoices', () => {
    const pdf = createTextPdf(
      Array.from({ length: 110 }, (_, index) => `Invoice line ${index + 1}`),
    );
    const document = pdf.toString('ascii');

    expect(document.startsWith('%PDF-1.4')).toBe(true);
    expect(document).toContain('/Count 3');
    expect(document).toContain('(Invoice line 110)');
    expect(document).toContain('/MediaBox [0 0 595 842]');
  });
});
