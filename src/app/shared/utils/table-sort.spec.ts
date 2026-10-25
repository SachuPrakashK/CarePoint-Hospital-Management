import { sortTableRows } from './table-sort';
describe('sortTableRows', () => {
  const rows = [
    { id: 'b', name: 'Beta', amount: 2, date: '2026-01-02' },
    { id: 'a', name: 'alpha', amount: 10, date: '2025-12-31' },
    { id: 'c', name: null, amount: 2, date: '2026-01-01' },
  ];
  it('sorts text, numbers and dates while placing nulls last', () => {
    expect(
      sortTableRows(rows, { field: 'name', direction: 'asc' }, { name: (x) => x.name }).map(
        (x) => x.id,
      ),
    ).toEqual(['a', 'b', 'c']);
    expect(
      sortTableRows(rows, { field: 'amount', direction: 'desc' }, { amount: (x) => x.amount }).map(
        (x) => x.id,
      ),
    ).toEqual(['a', 'b', 'c']);
    expect(
      sortTableRows(
        rows,
        { field: 'date', direction: 'asc' },
        { date: (x) => new Date(x.date).getTime() },
      ).map((x) => x.id),
    ).toEqual(['a', 'c', 'b']);
  });
  it('preserves input order for equal values and neutral sorting', () => {
    expect(
      sortTableRows(rows, { field: 'amount', direction: 'asc' }, { amount: (x) => x.amount }).map(
        (x) => x.id,
      ),
    ).toEqual(['b', 'c', 'a']);
    expect(sortTableRows(rows, null, {})).toEqual(rows);
  });
});
