const SEVERITY_ORDER = new Map([
  ['error', 0],
  ['warning', 1],
  ['info', 2]
]);

function requireText(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
}

export function createImportResult({
  severity = 'error',
  code,
  file,
  line,
  column,
  columnIndex,
  message,
  suggestedAction
}) {
  if (!SEVERITY_ORDER.has(severity)) throw new TypeError(`unknown severity: ${severity}`);
  for (const [value, name] of [
    [code, 'code'],
    [file, 'file'],
    [message, 'message'],
    [suggestedAction, 'suggestedAction']
  ]) {
    requireText(value, name);
  }
  if (line !== undefined && (!Number.isInteger(line) || line < 1)) {
    throw new TypeError('line must be a positive integer');
  }
  if (columnIndex !== undefined && (!Number.isInteger(columnIndex) || columnIndex < 1)) {
    throw new TypeError('columnIndex must be a positive integer');
  }
  if (column !== undefined) requireText(column, 'column');

  return Object.freeze({
    severity,
    code,
    file,
    ...(line === undefined ? {} : { line }),
    ...(column === undefined ? {} : { column }),
    ...(columnIndex === undefined ? {} : { columnIndex }),
    message,
    suggestedAction
  });
}

function compareText(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function sortImportResults(results) {
  return [...results].sort((left, right) => {
    const severityDifference =
      SEVERITY_ORDER.get(left.severity) - SEVERITY_ORDER.get(right.severity);
    if (severityDifference !== 0) return severityDifference;
    const fileDifference = compareText(left.file, right.file);
    if (fileDifference !== 0) return fileDifference;
    const lineDifference = (left.line ?? 0) - (right.line ?? 0);
    if (lineDifference !== 0) return lineDifference;
    const columnDifference = (left.columnIndex ?? 0) - (right.columnIndex ?? 0);
    if (columnDifference !== 0) return columnDifference;
    const codeDifference = compareText(left.code, right.code);
    if (codeDifference !== 0) return codeDifference;
    return compareText(left.message, right.message);
  });
}

export function hasImportErrors(results) {
  return results.some(({ severity }) => severity === 'error');
}

export function formatImportResults(results) {
  const lines = sortImportResults(results).map((result) => {
    const label = `${result.severity[0].toUpperCase()}${result.severity.slice(1)}`;
    const location = [result.file, result.line, result.column].filter(Boolean).join(':');
    return `${label} ${result.code} ${location} - ${result.message} 修正方法: ${result.suggestedAction}`;
  });
  const summary = { error: 0, warning: 0, info: 0 };
  for (const { severity } of results) summary[severity] += 1;
  lines.push(
    `Summary: Error ${summary.error}, Warning ${summary.warning}, Info ${summary.info}, Total ${results.length}`
  );
  return lines.join('\n');
}

export function shortenValue(value, maximumLength = 80) {
  if (value.length <= maximumLength) return value;
  return `${value.slice(0, maximumLength - 1)}…`;
}
