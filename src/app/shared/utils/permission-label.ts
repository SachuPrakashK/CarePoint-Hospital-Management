const ACRONYMS: Record<string, string> = {
  api: 'API',
  emr: 'EMR',
  id: 'ID',
  opd: 'OPD',
  ot: 'OT',
};

/** Formats permission metadata for display without changing its persisted code. */
export function formatPermissionLabel(value: string): string {
  return value
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => ACRONYMS[word] ?? word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
