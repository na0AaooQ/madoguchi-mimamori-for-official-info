import { fileURLToPath } from 'node:url';

import * as prettier from 'prettier';

import { SCHEMA_VERSION } from './config.js';
import { createImportResult } from './result.js';
import { convertCellValue } from './value-converter.js';

const JSON_FORMAT_PATH = fileURLToPath(new URL('../../../management-data.json', import.meta.url));
const prettierOptions = prettier.resolveConfig(JSON_FORMAT_PATH);

function outputTarget(column) {
  if (column.endsWith('_ja')) return { scope: 'ja', property: column.slice(0, -3) };
  if (column.endsWith('_en')) return { scope: 'en', property: column.slice(0, -3) };
  return { scope: 'core', property: column };
}

export function convertRecords(unit, records) {
  const items = { core: [], ja: [], en: [] };
  const results = [];
  const locations = { core: [], ja: [], en: [] };

  for (const record of records) {
    const id = record.values[unit.idColumn];
    const output = { core: { id }, ja: { id }, en: { id } };
    let rowHasError = false;

    for (let index = 0; index < unit.headers.length; index += 1) {
      const column = unit.headers[index];
      if (column === 'No' || column === unit.idColumn || unit.omittedColumns.includes(column)) {
        continue;
      }
      const rawValue = record.values[column];
      if (rawValue === '') continue;
      const converted = convertCellValue(column, rawValue);
      if (converted.error) {
        results.push(
          createImportResult({
            severity: 'error',
            code: converted.error.code,
            file: unit.fileName,
            line: record.line,
            column,
            columnIndex: index + record.headerOffset + 1,
            message: converted.error.message,
            suggestedAction: converted.error.suggestedAction
          })
        );
        rowHasError = true;
        continue;
      }
      const { scope, property } = outputTarget(column);
      output[scope][property] = converted.value;
    }

    if (rowHasError) continue;
    for (const scope of ['core', 'ja', 'en']) {
      items[scope].push(output[scope]);
      locations[scope].push({
        id,
        line: record.line,
        no: record.no,
        headerOffset: record.headerOffset
      });
    }
  }
  return { items, results, locations };
}

export function createEnvelope(items, dataUpdatedOn) {
  return {
    schema_version: SCHEMA_VERSION,
    data_updated_on: dataUpdatedOn,
    items
  };
}

export async function serializeJson(value) {
  return prettier.format(`${JSON.stringify(value, null, 2)}\n`, {
    ...(await prettierOptions),
    filepath: JSON_FORMAT_PATH,
    parser: 'json'
  });
}
