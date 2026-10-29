import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const patterns = [
  '\u00c3\u00a2',
  '\u00c3\u201a',
  '\u00c3\u0192',
  '\u00ef\u00bf\u00bd',
  '\ufffd',
  '\u00e2\u20ac',
  '\u00e2\u2020',
  '\u00e2\u201a',
  '\u00e2\u2013',
  '\u00c2\u00b7',
  '\u00c3\u2014',
];
const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;

try {
  const columns = await prisma.$queryRaw`
    SELECT table_name AS "tableName", column_name AS "columnName"
    FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type IN ('text', 'character varying')
    ORDER BY table_name, ordinal_position
  `;
  const parameters = patterns.map((value) => `%${value}%`);
  const query = columns
    .map(({ tableName, columnName }) => {
      const column = quoteIdentifier(columnName);
      const predicates = patterns.map((_, index) => `${column} LIKE $${index + 1}`);
      return `SELECT '${tableName.replaceAll("'", "''")}' AS "tableName", '${columnName.replaceAll("'", "''")}' AS "columnName", COUNT(*)::int AS count FROM ${quoteIdentifier(tableName)} WHERE ${predicates.join(' OR ')}`;
    })
    .join(' UNION ALL ');
  const findings = (await prisma.$queryRawUnsafe(query, ...parameters)).filter(
    ({ count }) => count > 0,
  );
  if (findings.length) {
    console.error('Potential mojibake exists in database text columns:');
    for (const finding of findings)
      console.error(`- ${finding.tableName}.${finding.columnName}: ${finding.count} row(s)`);
    process.exitCode = 1;
  } else {
    console.log(`Database UTF-8 audit passed: ${columns.length} text columns checked.`);
  }
} finally {
  await prisma.$disconnect();
}
