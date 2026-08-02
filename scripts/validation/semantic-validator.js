import { createResult, sortResults } from './result.js';

function requireArray(value, field) {
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  return value;
}

function recordsById(records) {
  return new Map(records.map((record) => [record.id, record]));
}

export function validateSemanticData(input, { file = '<semantic-data>' } = {}) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('semantic input must be an object');
  }

  const core = requireArray(input.core ?? [], 'core');
  const references = requireArray(input.references ?? [], 'references');
  const locales = input.locales ?? {};
  if (locales === null || typeof locales !== 'object' || Array.isArray(locales)) {
    throw new TypeError('locales must be an object');
  }

  const japanese = requireArray(locales.ja ?? [], 'locales.ja');
  const english = requireArray(locales.en ?? [], 'locales.en');
  const coreIndex = recordsById(core);
  const englishIndex = recordsById(english);
  const referenceIds = new Set(references.map(({ id }) => id));
  const results = [];

  for (const japaneseRecord of japanese) {
    const coreRecord = coreIndex.get(japaneseRecord.id);
    const requiresEnglish = coreRecord?.display_locales?.includes('en') ?? false;
    const englishRecord = englishIndex.get(japaneseRecord.id);

    if (requiresEnglish && !englishRecord) {
      results.push(
        createResult({
          severity: 'error',
          code: 'E003',
          file,
          item_id: japaneseRecord.id,
          field: 'locales.en',
          message: '必要な英語localeが存在しません。',
          suggested_action: '同じIDの英語localeを追加してください。'
        })
      );
    }

    if (englishRecord && englishRecord.based_on_ja_revision !== japaneseRecord.content_revision) {
      results.push(
        createResult({
          severity: 'error',
          code: 'E004',
          file,
          item_id: japaneseRecord.id,
          field: 'based_on_ja_revision',
          message: '英語localeの改訂元が日本語localeのcontent_revisionと一致しません。',
          suggested_action: '英語文面を確認し、改訂番号を一致させてください。'
        })
      );
    }
  }

  for (const coreRecord of core) {
    for (const referencedId of coreRecord.related_ids ?? []) {
      if (!referenceIds.has(referencedId)) {
        results.push(
          createResult({
            severity: 'error',
            code: 'E005',
            file,
            item_id: coreRecord.id,
            field: 'related_ids',
            message: `参照先ID '${referencedId}' が存在しません。`,
            suggested_action: '参照先を追加するか、IDを修正してください。'
          })
        );
      }
    }
  }

  for (const [locale, records] of Object.entries(locales)) {
    requireArray(records, `locales.${locale}`);
    for (const record of records) {
      if (record.locale_status === 'under-review') {
        results.push(
          createResult({
            severity: 'warning',
            code: 'W001',
            file,
            item_id: record.id,
            field: 'locale_status',
            message: `${locale} localeは人による確認中です。`
          })
        );
      } else if (record.locale_status === 'draft') {
        results.push(
          createResult({
            severity: 'info',
            code: 'I001',
            file,
            item_id: record.id,
            field: 'locale_status',
            message: `${locale} localeは下書きです。`
          })
        );
      }
    }
  }

  return sortResults(results);
}
