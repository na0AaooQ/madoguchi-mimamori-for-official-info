import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { MANAGEMENT_UNITS } from '../../scripts/import/management-tsv/config.js';
import { validateSheetRows } from '../../scripts/import/management-tsv/sheet-validator.js';
import {
  decodeTsv,
  parseTsv,
  TsvSyntaxError
} from '../../scripts/import/management-tsv/tsv-parser.js';
import {
  convertCellValue,
  isCalendarDate
} from '../../scripts/import/management-tsv/value-converter.js';
import { encodeTsv, findHeader, fixtureRoot, readTsvRows } from '../helpers/management-tsv.js';

const organizationUnit = MANAGEMENT_UNITS.find(({ key }) => key === 'organizations');

function resultCodes(execution) {
  return execution.results.map(({ code }) => code);
}

function organizationRows() {
  return readTsvRows(fixtureRoot, organizationUnit.fileName);
}

test('parses BOM, LF, CRLF, quoted cells, and escaped quotes', () => {
  const source = decodeTsv(Buffer.from('\uFEFF"a""b"\tc\r\n1\t2\r\n'));
  assert.equal(source.startsWith('\uFEFF'), false);
  assert.deepEqual(
    parseTsv(source).map(({ cells }) => cells),
    [
      ['a"b', 'c'],
      ['1', '2']
    ]
  );
});

test('preserves quotes inside unquoted Google Sheets cells', () => {
  assert.deepEqual(parseTsv('["region-example"]\t["ja","en"]')[0].cells, [
    '["region-example"]',
    '["ja","en"]'
  ]);
});

test('rejects invalid UTF-8, an unclosed quote, invalid quoted content, and bare CR', async (t) => {
  const cases = [
    ['invalid UTF-8', () => decodeTsv(Buffer.from([0xff])), 'TSV-E002'],
    ['unclosed quote', () => parseTsv('"abc'), 'TSV-E003'],
    ['text after closing quote', () => parseTsv('"a"b\tc'), 'TSV-E004'],
    ['bare CR', () => parseTsv('a\rb'), 'TSV-E004']
  ];
  for (const [name, action, code] of cases) {
    await t.test(name, () =>
      assert.throws(action, (error) => error instanceof TsvSyntaxError && error.code === code)
    );
  }
});

test('accepts an exact header with zero or one leading management column and ignores empty rows', async () => {
  const rows = await organizationRows();
  const withLeadingColumn = validateSheetRows(organizationUnit, rows);
  assert.equal(withLeadingColumn.results.length, 0);
  assert.equal(withLeadingColumn.records.length, 1);

  const withoutLeadingColumn = structuredClone(rows);
  const header = findHeader(organizationUnit, withoutLeadingColumn);
  for (const row of withoutLeadingColumn.slice(header.index)) row.cells.shift();
  withoutLeadingColumn.push({ cells: [''], line: 99, cellStartLines: [99] });
  const execution = validateSheetRows(organizationUnit, withoutLeadingColumn);
  assert.equal(execution.results.length, 0);
  assert.equal(execution.records.length, 1);
});

test('detects header and column layout errors deterministically', async (t) => {
  const original = await organizationRows();
  const { index: headerIndex, offset } = findHeader(organizationUnit, original);
  const dataIndex = headerIndex + 1;
  const cases = [
    ['missing header', (rows) => (rows[headerIndex].cells[offset] = '番号'), 'TSV-E005'],
    ['multiple headers', (rows) => rows.push(structuredClone(rows[headerIndex])), 'TSV-E006'],
    ['two leading empty columns', (rows) => rows[headerIndex].cells.unshift(''), 'TSV-E007'],
    [
      'duplicate header',
      (rows) =>
        (rows[headerIndex].cells[offset + organizationUnit.headers.indexOf('publication_status')] =
          'organization_type'),
      'TSV-E008'
    ],
    ['missing header column', (rows) => rows[headerIndex].cells.splice(offset + 5, 1), 'TSV-E009'],
    ['extra header column', (rows) => rows[headerIndex].cells.push('unknown_column'), 'TSV-E010'],
    [
      'unknown header',
      (rows) => (rows[headerIndex].cells[offset + 5] = 'publication-state'),
      'TSV-E011'
    ],
    [
      'wrong header order',
      (rows) => {
        const left = offset + 2;
        const right = offset + 3;
        [rows[headerIndex].cells[left], rows[headerIndex].cells[right]] = [
          rows[headerIndex].cells[right],
          rows[headerIndex].cells[left]
        ];
      },
      'TSV-E012'
    ],
    ['management column value', (rows) => (rows[dataIndex].cells[0] = 'x'), 'TSV-E013'],
    ['short row', (rows) => rows[dataIndex].cells.pop(), 'TSV-E014'],
    ['long row', (rows) => rows[dataIndex].cells.push('extra'), 'TSV-E015']
  ];

  for (const [name, mutate, code] of cases) {
    await t.test(name, () => {
      const rows = structuredClone(original);
      mutate(rows);
      assert.ok(resultCodes(validateSheetRows(organizationUnit, rows)).includes(code));
    });
  }
});

test('detects cell, No, and ID errors', async (t) => {
  const original = await organizationRows();
  const { index: headerIndex, offset } = findHeader(organizationUnit, original);
  const dataIndex = headerIndex + 1;
  const noIndex = offset;
  const idIndex = offset + organizationUnit.headers.indexOf(organizationUnit.idColumn);
  const summaryIndex = offset + organizationUnit.headers.indexOf('summary_ja');
  const cases = [
    ['cell tab', (rows) => (rows[dataIndex].cells[summaryIndex] = 'a\tb'), 'TSV-E016'],
    ['cell newline', (rows) => (rows[dataIndex].cells[summaryIndex] = 'a\nb'), 'TSV-E016'],
    ['none sentinel', (rows) => (rows[dataIndex].cells[summaryIndex] = 'なし'), 'TSV-E017'],
    ['empty No', (rows) => (rows[dataIndex].cells[noIndex] = ''), 'TSV-E018'],
    ['zero No', (rows) => (rows[dataIndex].cells[noIndex] = '0'), 'TSV-E019'],
    ['negative No', (rows) => (rows[dataIndex].cells[noIndex] = '-1'), 'TSV-E019'],
    ['decimal No', (rows) => (rows[dataIndex].cells[noIndex] = '1.0'), 'TSV-E019'],
    [
      'duplicate No',
      (rows) => {
        const duplicate = structuredClone(rows[dataIndex]);
        duplicate.line = 5;
        duplicate.cells[idIndex] = 'org-example-second';
        rows.push(duplicate);
      },
      'TSV-E020'
    ],
    ['empty ID', (rows) => (rows[dataIndex].cells[idIndex] = ''), 'TSV-E021'],
    [
      'duplicate ID',
      (rows) => {
        const duplicate = structuredClone(rows[dataIndex]);
        duplicate.line = 5;
        duplicate.cells[noIndex] = '2';
        rows.push(duplicate);
      },
      'TSV-E022'
    ]
  ];
  for (const [name, mutate, code] of cases) {
    await t.test(name, () => {
      const rows = structuredClone(original);
      mutate(rows);
      assert.ok(resultCodes(validateSheetRows(organizationUnit, rows)).includes(code));
    });
  }
});

test('encodes quoted tabs and newlines so the sheet validator can reject decoded cell content', () => {
  const encoded = encodeTsv([{ cells: ['a\tb', 'c\nd'], line: 1 }]);
  assert.deepEqual(parseTsv(encoded)[0].cells, ['a\tb', 'c\nd']);
});

test('converts supported scalar and array types without normalizing strings', async (t) => {
  const valid = [
    ['array', 'region_ids', '["a","b"]', ['a', 'b']],
    ['boolean true', 'show_in_official_source_list', 'true', true],
    ['boolean false', 'show_in_official_source_list', 'false', false],
    ['integer', 'display_order', '2', 2],
    ['integer decimal zero', 'display_order', '2.0', 2],
    ['date', 'checked_on', '2026-08-04', '2026-08-04'],
    ['leading-zero string', 'official_code', '00123', '00123'],
    ['untrimmed string', 'summary_ja', '  text  ', '  text  ']
  ];
  for (const [name, column, input, expected] of valid) {
    await t.test(name, () =>
      assert.deepEqual(convertCellValue(column, input), { value: expected })
    );
  }
});

test('rejects invalid arrays, booleans, integers, and dates', async (t) => {
  const cases = [
    ['array syntax', 'region_ids', '[', 'TSV-E030'],
    ['not array', 'region_ids', '"a"', 'TSV-E031'],
    ['non-string array item', 'region_ids', '[1]', 'TSV-E032'],
    ['empty array item', 'region_ids', '[""]', 'TSV-E033'],
    ['duplicate array item', 'region_ids', '["a","a"]', 'TSV-E034'],
    ['uppercase boolean', 'show_in_official_source_list', 'TRUE', 'TSV-E035'],
    ['numeric boolean', 'show_in_official_source_list', '1', 'TSV-E035'],
    ['decimal integer', 'display_order', '1.5', 'TSV-E036'],
    ['NaN integer', 'display_order', 'NaN', 'TSV-E036'],
    ['Infinity integer', 'display_order', 'Infinity', 'TSV-E036'],
    ['exponent integer', 'display_order', '1e3', 'TSV-E036'],
    ['unsafe integer', 'display_order', '9007199254740992', 'TSV-E037'],
    ['date format', 'checked_on', '2026-8-4', 'TSV-E038'],
    ['impossible date', 'checked_on', '2026-02-30', 'TSV-E038']
  ];
  for (const [name, column, input, code] of cases) {
    await t.test(name, () => assert.equal(convertCellValue(column, input).error.code, code));
  }
});

test('validates leap days and rejects non-calendar dates', () => {
  assert.equal(isCalendarDate('2024-02-29'), true);
  assert.equal(isCalendarDate('2026-02-29'), false);
  assert.equal(isCalendarDate('0000-01-01'), false);
});

test('the committed organization fixture is valid UTF-8 TSV', async () => {
  const source = decodeTsv(await readFile(path.join(fixtureRoot, organizationUnit.fileName)));
  assert.equal(validateSheetRows(organizationUnit, parseTsv(source)).results.length, 0);
});
