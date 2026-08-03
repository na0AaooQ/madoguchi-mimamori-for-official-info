import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { MANAGEMENT_UNITS } from '../../scripts/import/management-tsv/config.js';
import { decodeTsv, parseTsv } from '../../scripts/import/management-tsv/tsv-parser.js';
import { DATA_LAYOUT } from '../../scripts/validation/data-layout.js';

export const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
export const fixtureRoot = path.join(repoRoot, 'tests/fixtures/management-tsv/valid');

export function encodeTsv(rows, { lineEnding = '\n' } = {}) {
  const encodeCell = (value) =>
    /[\t\r\n"]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return `${rows.map(({ cells }) => cells.map(encodeCell).join('\t')).join(lineEnding)}${lineEnding}`;
}

export async function readTsvRows(directory, fileName) {
  return parseTsv(decodeTsv(await readFile(path.join(directory, fileName))));
}

export function findHeader(unit, rows) {
  const index = rows.findIndex(
    ({ cells }) => cells.includes('No') && cells.includes(unit.idColumn)
  );
  const offset = rows[index].cells[0] === '' ? 1 : 0;
  return { index, offset };
}

export async function mutateTsvCell(directory, fileName, column, value, dataRow = 0) {
  const unit = MANAGEMENT_UNITS.find((entry) => entry.fileName === fileName);
  const rows = await readTsvRows(directory, fileName);
  const header = findHeader(unit, rows);
  const rowIndex = rows
    .map((row, index) => ({ row, index }))
    .filter(
      ({ row, index }) => index > header.index && !(row.cells.length === 1 && row.cells[0] === '')
    )[dataRow].index;
  rows[rowIndex].cells[unit.headers.indexOf(column) + header.offset] = value;
  await writeFile(path.join(directory, fileName), encodeTsv(rows));
}

export async function createFixtureCopy(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'madoguchi-tsv-fixture-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await cp(fixtureRoot, root, { recursive: true });
  return root;
}

export async function createRepositoryCopy(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'madoguchi-tsv-repo-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await Promise.all([
    cp(path.join(repoRoot, 'data'), path.join(root, 'data'), { recursive: true }),
    cp(path.join(repoRoot, 'schemas'), path.join(root, 'schemas'), { recursive: true }),
    cp(fixtureRoot, path.join(root, 'imports/management'), { recursive: true })
  ]);
  return root;
}

export async function dataDigest(root) {
  const hash = createHash('sha256');
  for (const { dataPath } of [...DATA_LAYOUT].sort((left, right) =>
    left.dataPath.localeCompare(right.dataPath, 'en')
  )) {
    hash.update(dataPath);
    hash.update(await readFile(path.join(root, dataPath)));
  }
  return hash.digest('hex');
}

export async function dataFileSources(root) {
  return new Map(
    await Promise.all(
      DATA_LAYOUT.map(async ({ dataPath }) => [
        dataPath,
        await readFile(path.join(root, dataPath), 'utf8')
      ])
    )
  );
}

export async function findTransientFiles(directory) {
  const found = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(entryPath);
      else if (entry.name.includes('.tmp-') || entry.name.includes('.backup-'))
        found.push(entryPath);
    }
  }
  await visit(directory);
  return found.sort();
}
