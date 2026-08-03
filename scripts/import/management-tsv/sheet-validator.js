import { createImportResult, shortenValue } from './result.js';

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function exactHeaderOffset(cells, expected) {
  if (arraysEqual(cells, expected)) return 0;
  if (cells[0] === '' && arraysEqual(cells.slice(1), expected)) return 1;
  return undefined;
}

function result(unit, input) {
  return createImportResult({
    file: unit.fileName,
    suggestedAction: 'TSVを修正して再出力してください。',
    ...input
  });
}

function analyzeHeaderMismatch(unit, row) {
  const results = [];
  let leadingEmptyColumns = 0;
  while (row.cells[leadingEmptyColumns] === '') leadingEmptyColumns += 1;
  if (leadingEmptyColumns > 1) {
    results.push(
      result(unit, {
        code: 'TSV-E007',
        line: row.line,
        column: `列${leadingEmptyColumns}`,
        columnIndex: leadingEmptyColumns,
        message: 'ヘッダー先頭に2列以上の空列があります。',
        suggestedAction: '先頭の管理用空列を0列または1列にしてください。'
      })
    );
  }

  const offset = leadingEmptyColumns === 1 ? 1 : 0;
  const actual = row.cells.slice(offset);
  const seen = new Set();
  for (let index = 0; index < actual.length; index += 1) {
    if (seen.has(actual[index])) {
      results.push(
        result(unit, {
          code: 'TSV-E008',
          line: row.line,
          column: actual[index] || `列${index + offset + 1}`,
          columnIndex: index + offset + 1,
          message: `ヘッダー '${shortenValue(actual[index])}' が重複しています。`,
          suggestedAction: '重複列を削除し、指定されたヘッダー順へ戻してください。'
        })
      );
    }
    seen.add(actual[index]);
  }

  if (actual.length < unit.headers.length) {
    const missing = unit.headers.filter((header) => !actual.includes(header));
    results.push(
      result(unit, {
        code: 'TSV-E009',
        line: row.line,
        column: missing[0] ?? `列${actual.length + offset + 1}`,
        columnIndex: actual.length + offset + 1,
        message: `ヘッダー列が不足しています${missing.length > 0 ? `: ${missing.join('、')}` : '。'}`,
        suggestedAction: 'Googleスプレッドシートの対象シートから全列をTSV出力してください。'
      })
    );
  } else if (actual.length > unit.headers.length) {
    results.push(
      result(unit, {
        code: 'TSV-E010',
        line: row.line,
        column: actual[unit.headers.length] || `列${unit.headers.length + offset + 1}`,
        columnIndex: unit.headers.length + offset + 1,
        message: '想定外の余分なヘッダー列があります。',
        suggestedAction: '指定されたヘッダー以外の列を削除してください。'
      })
    );
  }

  const comparisonLength = Math.min(actual.length, unit.headers.length);
  for (let index = 0; index < comparisonLength; index += 1) {
    if (actual[index] === unit.headers[index]) continue;
    const knownElsewhere = unit.headers.includes(actual[index]);
    results.push(
      result(unit, {
        code: knownElsewhere ? 'TSV-E012' : 'TSV-E011',
        line: row.line,
        column: actual[index] || `列${index + offset + 1}`,
        columnIndex: index + offset + 1,
        message: knownElsewhere
          ? `ヘッダー順が不正です。期待値 '${unit.headers[index]}' に対して '${shortenValue(actual[index])}' があります。`
          : `未知または表記違いのヘッダー '${shortenValue(actual[index])}' があります。`,
        suggestedAction: `列名と順序を指定仕様へ戻してください。期待値: ${unit.headers[index]}`
      })
    );
    break;
  }
  return results;
}

function isCompletelyEmptyRow(row) {
  return row.cells.every((cell) => cell === '');
}

export function validateSheetRows(unit, rows) {
  const exactHeaders = rows
    .map((row, index) => ({ row, index, offset: exactHeaderOffset(row.cells, unit.headers) }))
    .filter(({ offset }) => offset !== undefined);

  if (exactHeaders.length > 1) {
    return {
      records: [],
      results: [
        result(unit, {
          code: 'TSV-E006',
          line: exactHeaders[1].row.line,
          column: 'No',
          columnIndex: exactHeaders[1].offset + 1,
          message: '想定ヘッダーと一致する行が複数あります。',
          suggestedAction: '説明行またはデータ行に重複したヘッダーがないようにしてください。'
        })
      ]
    };
  }

  if (exactHeaders.length === 0) {
    const headerLikeRows = rows.filter(
      ({ cells }) => cells.includes('No') && cells.includes(unit.idColumn)
    );
    if (headerLikeRows.length === 1) {
      return { records: [], results: analyzeHeaderMismatch(unit, headerLikeRows[0]) };
    }
    return {
      records: [],
      results: [
        result(unit, {
          code: headerLikeRows.length > 1 ? 'TSV-E006' : 'TSV-E005',
          line: headerLikeRows[0]?.line,
          column: 'No',
          columnIndex: 1,
          message:
            headerLikeRows.length > 1
              ? 'ヘッダー候補が複数あります。'
              : '想定ヘッダーと一致する行がありません。',
          suggestedAction:
            'No、対象ID列、すべての指定列を正しい順序と表記で1行だけ配置してください。'
        })
      ]
    };
  }

  const [{ index: headerIndex, offset }] = exactHeaders;
  const results = [];
  const records = [];
  const seenNumbers = new Map();
  const seenIds = new Map();

  for (const row of rows.slice(headerIndex + 1)) {
    if (isCompletelyEmptyRow(row)) continue;
    const expectedCellCount = unit.headers.length + offset;
    if (row.cells.length !== expectedCellCount) {
      results.push(
        result(unit, {
          code: row.cells.length < expectedCellCount ? 'TSV-E014' : 'TSV-E015',
          line: row.line,
          column: `列${Math.min(row.cells.length + 1, expectedCellCount)}`,
          columnIndex: Math.min(row.cells.length + 1, expectedCellCount),
          message:
            row.cells.length < expectedCellCount
              ? `データ行の列数が不足しています（期待 ${expectedCellCount}、実際 ${row.cells.length}）。`
              : `データ行の列数が超過しています（期待 ${expectedCellCount}、実際 ${row.cells.length}）。`,
          suggestedAction: '欠落または余分なセルを修正し、ヘッダーと同じ列数にしてください。'
        })
      );
      continue;
    }
    if (offset === 1 && row.cells[0] !== '') {
      results.push(
        result(unit, {
          code: 'TSV-E013',
          line: row.line,
          column: '管理用空列',
          columnIndex: 1,
          message: '先頭の管理用空列に値があります。',
          suggestedAction: 'A列の値を削除し、空欄にしてください。'
        })
      );
      continue;
    }

    const cells = row.cells.slice(offset);
    let rowHasError = false;
    for (let index = 0; index < cells.length; index += 1) {
      const value = cells[index];
      const column = unit.headers[index];
      if (/\t|\r|\n/.test(value)) {
        results.push(
          result(unit, {
            code: 'TSV-E016',
            line: row.line,
            column,
            columnIndex: index + offset + 1,
            message: '変換後のセル内にタブまたは改行があります。',
            suggestedAction: '第一版ではセル内タブ・改行を削除してから再出力してください。'
          })
        );
        rowHasError = true;
      }
      if (value === 'なし') {
        results.push(
          result(unit, {
            code: 'TSV-E017',
            line: row.line,
            column,
            columnIndex: index + offset + 1,
            message: '完全一致する文字列「なし」は使用できません。',
            suggestedAction: '任意項目なら空欄にし、値が必要なら実際の値を入力してください。'
          })
        );
        rowHasError = true;
      }
    }

    const values = Object.fromEntries(unit.headers.map((header, index) => [header, cells[index]]));
    const numberValue = values.No;
    let number;
    if (numberValue === '') {
      results.push(
        result(unit, {
          code: 'TSV-E018',
          line: row.line,
          column: 'No',
          columnIndex: offset + 1,
          message: 'Noが空欄です。',
          suggestedAction: '1以上の重複しない整数を入力してください。'
        })
      );
      rowHasError = true;
    } else if (!/^[1-9]\d*$/.test(numberValue) || !Number.isSafeInteger(Number(numberValue))) {
      results.push(
        result(unit, {
          code: 'TSV-E019',
          line: row.line,
          column: 'No',
          columnIndex: offset + 1,
          message: 'Noは1以上の安全な整数である必要があります。',
          suggestedAction: '小数、負数、0、記号を使わず、1以上の整数へ修正してください。'
        })
      );
      rowHasError = true;
    } else {
      number = Number(numberValue);
      if (seenNumbers.has(number)) {
        results.push(
          result(unit, {
            code: 'TSV-E020',
            line: row.line,
            column: 'No',
            columnIndex: offset + 1,
            message: `No ${number} が重複しています（最初の行: ${seenNumbers.get(number)}）。`,
            suggestedAction: 'Noを管理単位内で重複しない値へ修正してください。'
          })
        );
        rowHasError = true;
      } else {
        seenNumbers.set(number, row.line);
      }
    }

    const id = values[unit.idColumn];
    const idIndex = unit.headers.indexOf(unit.idColumn) + offset + 1;
    if (id === '') {
      results.push(
        result(unit, {
          code: 'TSV-E021',
          line: row.line,
          column: unit.idColumn,
          columnIndex: idIndex,
          message: 'IDが空欄です。',
          suggestedAction: '既存Schemaに合う不変IDを入力してください。'
        })
      );
      rowHasError = true;
    } else if (seenIds.has(id)) {
      results.push(
        result(unit, {
          code: 'TSV-E022',
          line: row.line,
          column: unit.idColumn,
          columnIndex: idIndex,
          message: `ID '${shortenValue(id)}' が重複しています（最初の行: ${seenIds.get(id)}）。`,
          suggestedAction: 'IDを管理単位内で重複しない値へ修正してください。'
        })
      );
      rowHasError = true;
    } else {
      seenIds.set(id, row.line);
    }

    if (!rowHasError) records.push({ no: number, line: row.line, headerOffset: offset, values });
  }

  records.sort((left, right) => left.no - right.no);
  return { records, results };
}
