import { ARRAY_COLUMNS, BOOLEAN_COLUMNS, DATE_COLUMNS, INTEGER_COLUMNS } from './config.js';

function error(code, message, suggestedAction) {
  return { error: { code, message, suggestedAction } };
}

export function isCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function parseStringArray(value) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    return error(
      'TSV-E030',
      '文字列配列のJSON構文が不正です。',
      '例 ["region-example-prefecture"] のようなJSON配列へ修正してください。'
    );
  }
  if (!Array.isArray(parsed)) {
    return error(
      'TSV-E031',
      '値がJSON配列ではありません。',
      '文字列だけを要素に持つJSON配列へ修正してください。'
    );
  }
  if (parsed.some((item) => typeof item !== 'string')) {
    return error(
      'TSV-E032',
      '配列に文字列以外の要素があります。',
      '数値、null、object、配列を除き、すべて文字列にしてください。'
    );
  }
  if (parsed.some((item) => item === '')) {
    return error('TSV-E033', '配列に空文字列があります。', '空文字列の要素を削除してください。');
  }
  if (new Set(parsed).size !== parsed.length) {
    return error('TSV-E034', '配列に重複要素があります。', '重複する要素を1件にしてください。');
  }
  return { value: parsed };
}

function parseBoolean(value) {
  if (value === 'true') return { value: true };
  if (value === 'false') return { value: false };
  return error(
    'TSV-E035',
    '真偽値は小文字のtrueまたはfalseだけを使用できます。',
    '値をtrueまたはfalseへ修正してください。'
  );
}

function parseInteger(value) {
  if (!/^-?(?:0|[1-9]\d*)(?:\.0+)?$/.test(value)) {
    return error(
      'TSV-E036',
      '整数として安全に変換できない値です。',
      '整数表記、または小数部分が0だけの表記へ修正してください。'
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    return error(
      'TSV-E037',
      'JavaScriptの安全整数範囲外です。',
      '安全整数範囲内の値へ修正してください。'
    );
  }
  return { value: parsed };
}

export function convertCellValue(column, value) {
  if (ARRAY_COLUMNS.has(column)) return parseStringArray(value);
  if (BOOLEAN_COLUMNS.has(column)) return parseBoolean(value);
  if (INTEGER_COLUMNS.has(column)) return parseInteger(value);
  if (DATE_COLUMNS.has(column) && !isCalendarDate(value)) {
    return error(
      'TSV-E038',
      '日付がYYYY-MM-DD形式の実在する暦日ではありません。',
      '例 2026-08-04 のように実在する日付へ修正してください。'
    );
  }
  return { value };
}
