import { isCalendarDate } from './value-converter.js';

export class ImportUsageError extends Error {
  constructor(code, message, suggestedAction) {
    super(message);
    this.name = 'ImportUsageError';
    this.code = code;
    this.suggestedAction = suggestedAction;
  }
}

function usageError(code, message, suggestedAction) {
  throw new ImportUsageError(code, message, suggestedAction);
}

export function parseArguments(args) {
  const values = new Map();
  const flags = new Set();

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--check' || argument === '--write') {
      if (flags.has(argument)) {
        usageError(
          'CLI-E003',
          `引数 ${argument} が重複しています。`,
          '同じ引数は1回だけ指定してください。'
        );
      }
      flags.add(argument);
      continue;
    }
    if (argument === '--input-dir' || argument === '--data-updated-on') {
      if (values.has(argument)) {
        usageError(
          'CLI-E003',
          `引数 ${argument} が重複しています。`,
          '同じ引数は1回だけ指定してください。'
        );
      }
      const value = args[index + 1];
      if (value === undefined || value.startsWith('--')) {
        usageError(
          'CLI-E002',
          `引数 ${argument} の値がありません。`,
          `${argument} の直後に値を指定してください。`
        );
      }
      values.set(argument, value);
      index += 1;
      continue;
    }
    usageError(
      'CLI-E001',
      `不明な引数 '${argument}' があります。`,
      'READMEの実行例にある引数だけを指定してください。'
    );
  }

  if (!values.has('--input-dir') || !values.has('--data-updated-on')) {
    const missing = [
      values.has('--input-dir') ? undefined : '--input-dir',
      values.has('--data-updated-on') ? undefined : '--data-updated-on'
    ].filter(Boolean);
    usageError(
      'CLI-E006',
      `必須引数がありません: ${missing.join('、')}`,
      '入力ディレクトリと管理データ更新日を指定してください。'
    );
  }
  if (flags.has('--check') && flags.has('--write')) {
    usageError(
      'CLI-E004',
      '--checkと--writeを同時に指定できません。',
      'どちらか一方だけを指定してください。'
    );
  }
  if (!flags.has('--check') && !flags.has('--write')) {
    usageError('CLI-E005', '--checkまたは--writeが必要です。', '最初は--checkを指定してください。');
  }

  const dataUpdatedOn = values.get('--data-updated-on');
  if (!isCalendarDate(dataUpdatedOn)) {
    usageError(
      'CLI-E007',
      '--data-updated-onがYYYY-MM-DD形式の実在する暦日ではありません。',
      '例 2026-08-04 のように実在する日付を指定してください。'
    );
  }

  return {
    inputDir: values.get('--input-dir'),
    dataUpdatedOn,
    mode: flags.has('--write') ? 'write' : 'check'
  };
}
