import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1');
const scanRoots = ['src', 'backend/src', 'backend/prisma', 'tests', 'backend/tests', 'public'];
const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.prisma',
  '.scss',
  '.sql',
  '.ts',
]);
const suspicious = [
  ['double-encoded UTF-8', '\u00c3\u00a2'],
  ['double-encoded C2 marker', '\u00c3\u201a'],
  ['double-encoded C3 marker', '\u00c3\u0192'],
  ['replacement-character mojibake', '\u00ef\u00bf\u00bd'],
  ['replacement character', '\ufffd'],
  ['misdecoded ellipsis', '\u00e2\u20ac\u00a6'],
  ['misdecoded apostrophe', '\u00e2\u20ac\u2122'],
  ['misdecoded quote/dash prefix', '\u00e2\u20ac'],
  ['misdecoded arrow', '\u00e2\u2020'],
  ['misdecoded currency symbol', '\u00e2\u201a'],
  ['misdecoded geometric symbol', '\u00e2\u2013'],
  ['misdecoded middle dot', '\u00c2\u00b7'],
  ['misdecoded multiplication sign', '\u00c3\u2014'],
];

const findings = [];
const scan = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await scan(path);
      continue;
    }
    if (!textExtensions.has(extname(path))) continue;
    const source = await readFile(path, 'utf8');
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const [label, value] of suspicious)
        if (line.includes(value))
          findings.push(`${relative(root, path)}:${index + 1}: ${label}`);
    });
  }
};

for (const directory of scanRoots) await scan(join(root, directory));

if (findings.length) {
  console.error('Potential mojibake detected:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log('UTF-8 text audit passed: no known mojibake patterns detected.');
}
