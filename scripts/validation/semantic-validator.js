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

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function siteItemId(site, fallback) {
  return typeof site.site_id === 'string' && site.site_id.trim() !== '' ? site.site_id : fallback;
}

export function validateSiteData(
  input,
  {
    files = {
      core: 'data/core/site.json',
      ja: 'data/locales/ja/site.json',
      en: 'data/locales/en/site.json'
    }
  } = {}
) {
  if (!isObject(input) || !isObject(input.core) || !isObject(input.ja) || !isObject(input.en)) {
    return [];
  }

  const { core, ja, en } = input;
  const results = [];
  const siteId = typeof core.site_id === 'string' ? core.site_id : undefined;
  const japaneseItemId = siteItemId(ja, siteId);
  const englishItemId = siteItemId(en, siteId);
  const hasEnglishRevision = Object.hasOwn(en, 'based_on_ja_revision');

  if (!hasEnglishRevision) {
    results.push(
      createResult({
        severity: 'error',
        code: 'E003',
        file: files.en,
        ...(englishItemId ? { item_id: englishItemId } : {}),
        field: 'based_on_ja_revision',
        message: '英語siteにbased_on_ja_revisionがありません。',
        suggested_action: '基にした日本語siteのcontent_revisionを設定してください。'
      })
    );
  } else if (en.based_on_ja_revision !== ja.content_revision) {
    results.push(
      createResult({
        severity: 'error',
        code: 'E004',
        file: files.en,
        ...(englishItemId ? { item_id: englishItemId } : {}),
        field: 'based_on_ja_revision',
        message: '英語siteの改訂元が日本語siteのcontent_revisionと一致しません。',
        suggested_action: '英語文面を確認し、改訂番号を一致させてください。'
      })
    );
  }

  if (Object.hasOwn(ja, 'based_on_ja_revision')) {
    results.push(
      createResult({
        severity: 'error',
        code: 'E010',
        file: files.ja,
        ...(japaneseItemId ? { item_id: japaneseItemId } : {}),
        field: 'based_on_ja_revision',
        message: '日本語siteにbased_on_ja_revisionを設定できません。',
        suggested_action: '日本語siteからbased_on_ja_revisionを削除してください。'
      })
    );
  }

  if (core.site_id !== ja.site_id || core.site_id !== en.site_id) {
    results.push(
      createResult({
        severity: 'error',
        code: 'E010',
        file: files.core,
        field: 'site_id',
        message: 'core・日本語・英語siteのsite_idが一致しません。',
        suggested_action: '3ファイルのsite_idを一致させてください。'
      })
    );
  }
  if (core.default_locale !== 'ja') {
    results.push(
      createResult({
        severity: 'error',
        code: 'E010',
        file: files.core,
        ...(siteId ? { item_id: siteId } : {}),
        field: 'default_locale',
        message: 'default_localeはjaである必要があります。',
        suggested_action: 'default_localeをjaへ修正してください。'
      })
    );
  }

  const locales = core.supported_locales;
  const supportedLocalesAreValid =
    Array.isArray(locales) &&
    locales.length === 2 &&
    new Set(locales).size === 2 &&
    locales.includes('ja') &&
    locales.includes('en');
  if (!supportedLocalesAreValid) {
    results.push(
      createResult({
        severity: 'error',
        code: 'E010',
        file: files.core,
        ...(siteId ? { item_id: siteId } : {}),
        field: 'supported_locales',
        message: 'supported_localesは重複のないjaとenの2件である必要があります。',
        suggested_action: 'supported_localesをja、enへ修正してください。'
      })
    );
  }

  for (const [locale, site] of [
    ['ja', ja],
    ['en', en]
  ]) {
    const itemId = siteItemId(site, siteId);
    if (site.locale !== locale) {
      results.push(
        createResult({
          severity: 'error',
          code: 'E010',
          file: files[locale],
          ...(itemId ? { item_id: itemId } : {}),
          field: 'locale',
          message: `${locale}のsiteファイルに異なるlocaleが設定されています。`,
          suggested_action: `localeを${locale}へ修正してください。`
        })
      );
    }
    if (site.locale_status === 'under-review') {
      results.push(
        createResult({
          severity: 'warning',
          code: 'W001',
          file: files[locale],
          ...(itemId ? { item_id: itemId } : {}),
          field: 'locale_status',
          message: `${locale} localeは人による確認中です。`
        })
      );
    } else if (site.locale_status === 'draft') {
      results.push(
        createResult({
          severity: 'info',
          code: 'I001',
          file: files[locale],
          ...(itemId ? { item_id: itemId } : {}),
          field: 'locale_status',
          message: `${locale} localeは下書きです。`
        })
      );
    }
  }

  return sortResults(results);
}
