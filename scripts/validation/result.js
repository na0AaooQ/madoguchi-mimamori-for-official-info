const SEVERITIES = Object.freeze(['error', 'warning', 'info']);
const SEVERITY_ORDER = new Map(SEVERITIES.map((severity, index) => [severity, index]));
const REQUIRED_STRING_FIELDS = ['code', 'file', 'message'];
const OPTIONAL_STRING_FIELDS = ['item_id', 'field', 'suggested_action'];

function assertNonEmptyString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
}

export function createResult(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('validation result must be an object');
  }

  if (!SEVERITY_ORDER.has(input.severity)) {
    throw new TypeError(`severity must be one of: ${SEVERITIES.join(', ')}`);
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    assertNonEmptyString(input[field], field);
  }

  const result = {
    severity: input.severity,
    code: input.code,
    file: input.file,
    message: input.message
  };

  for (const field of OPTIONAL_STRING_FIELDS) {
    if (input[field] !== undefined) {
      assertNonEmptyString(input[field], field);
      result[field] = input[field];
    }
  }

  return Object.freeze(result);
}

function compareText(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function sortResults(results) {
  return [...results].sort((left, right) => {
    const severityDifference =
      SEVERITY_ORDER.get(left.severity) - SEVERITY_ORDER.get(right.severity);
    if (severityDifference !== 0) return severityDifference;

    for (const field of ['file', 'item_id', 'code', 'field', 'message']) {
      const difference = compareText(left[field] ?? '', right[field] ?? '');
      if (difference !== 0) return difference;
    }

    return 0;
  });
}

export function summarizeResults(results) {
  const summary = { error: 0, warning: 0, info: 0, total: 0 };
  for (const result of results) {
    if (!SEVERITY_ORDER.has(result.severity)) {
      throw new TypeError(`unknown severity: ${result.severity}`);
    }
    summary[result.severity] += 1;
    summary.total += 1;
  }
  return summary;
}

export function hasErrors(results) {
  return results.some(({ severity }) => severity === 'error');
}

export function exitCodeForResults(results) {
  return hasErrors(results) ? 1 : 0;
}

export function formatResults(results) {
  const sorted = sortResults(results);
  const lines = sorted.map((result) => {
    const label = `${result.severity[0].toUpperCase()}${result.severity.slice(1)}`;
    const location = [result.file, result.item_id, result.field].filter(Boolean).join(':');
    return `${label} ${result.code} ${location} - ${result.message}`;
  });
  const summary = summarizeResults(sorted);
  lines.push(
    `Summary: Error ${summary.error}, Warning ${summary.warning}, Info ${summary.info}, Total ${summary.total}`
  );
  return lines.join('\n');
}
