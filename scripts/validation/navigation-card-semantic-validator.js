import { isStructurallyPublishableOfficialSource } from './official-source-semantic-validator.js';
import { createResult, sortResults } from './result.js';
import { isSafeRegionSlug } from '../shared/public-url.js';

const NAVIGATION_UNITS = Object.freeze(['sections', 'cards', 'cardSourceLinks']);
const OFFICIAL_UNITS = Object.freeze(['regions', 'organizations', 'sources', 'evidence']);
const SUPPORTED_LOCALES = Object.freeze(['ja', 'en']);
const PUBLICATION_STATUSES = new Set(['draft', 'under-review', 'published', 'hidden', 'archived']);
const VISIBILITY_CONTEXTS = new Set(['always', 'normal', 'disaster']);
const DEFAULT_FILES = Object.freeze({
  core: Object.freeze({
    regions: 'data/core/regions.json',
    sections: 'data/core/sections.json',
    cards: 'data/core/cards.json',
    cardSourceLinks: 'data/core/card-source-links.json'
  }),
  locales: Object.freeze({
    ja: Object.freeze({
      regions: 'data/locales/ja/regions.json',
      sections: 'data/locales/ja/sections.json',
      cards: 'data/locales/ja/cards.json',
      cardSourceLinks: 'data/locales/ja/card-source-links.json'
    }),
    en: Object.freeze({
      regions: 'data/locales/en/regions.json',
      sections: 'data/locales/en/sections.json',
      cards: 'data/locales/en/cards.json',
      cardSourceLinks: 'data/locales/en/card-source-links.json'
    })
  })
});

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function records(value) {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function recordId(record) {
  return typeof record?.id === 'string' && record.id !== '' ? record.id : undefined;
}

function recordsById(items) {
  const index = new Map();
  for (const record of items) {
    const id = recordId(record);
    if (id !== undefined && !index.has(id)) index.set(id, record);
  }
  return index;
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function mergeFiles(files = {}) {
  return {
    core: { ...DEFAULT_FILES.core, ...(files.core ?? {}) },
    locales: {
      ja: { ...DEFAULT_FILES.locales.ja, ...(files.locales?.ja ?? {}) },
      en: { ...DEFAULT_FILES.locales.en, ...(files.locales?.en ?? {}) }
    }
  };
}

function addError(results, { code, file, message, itemId, field, suggestedAction }) {
  results.push(
    createResult({
      severity: 'error',
      code,
      file,
      message,
      ...(itemId ? { item_id: itemId } : {}),
      ...(field ? { field } : {}),
      ...(suggestedAction ? { suggested_action: suggestedAction } : {})
    })
  );
}

function addDuplicateErrors(results, items, file) {
  const seen = new Set();
  const reported = new Set();
  for (const record of items) {
    const id = recordId(record);
    if (!id) continue;
    if (seen.has(id) && !reported.has(id)) {
      addError(results, {
        code: 'E011',
        file,
        itemId: id,
        field: 'id',
        message: `同一管理単位内でID '${id}' が重複しています。`,
        suggestedAction: 'IDを一意にしてください。'
      });
      reported.add(id);
    }
    seen.add(id);
  }
}

function addMissingReference(results, { file, itemId, field, referencedId }) {
  addError(results, {
    code: 'E005',
    file,
    itemId,
    field,
    message: `参照先ID '${referencedId}' が存在しません。`,
    suggestedAction: '参照先を追加するか、IDを修正してください。'
  });
}

function validateReferences(context, results) {
  const { core, indexes, files } = context;
  for (const card of core.cards) {
    const id = recordId(card);
    if (typeof card.section_id === 'string' && !indexes.core.sections.has(card.section_id)) {
      addMissingReference(results, {
        file: files.core.cards,
        itemId: id,
        field: 'section_id',
        referencedId: card.section_id
      });
    }
    for (const regionId of stringArray(card.region_ids)) {
      if (!indexes.core.regions.has(regionId)) {
        addMissingReference(results, {
          file: files.core.cards,
          itemId: id,
          field: 'region_ids',
          referencedId: regionId
        });
      }
    }
  }
  for (const link of core.cardSourceLinks) {
    const id = recordId(link);
    if (typeof link.card_id === 'string' && !indexes.core.cards.has(link.card_id)) {
      addMissingReference(results, {
        file: files.core.cardSourceLinks,
        itemId: id,
        field: 'card_id',
        referencedId: link.card_id
      });
    }
    if (typeof link.source_id === 'string' && !indexes.core.sources.has(link.source_id)) {
      addMissingReference(results, {
        file: files.core.cardSourceLinks,
        itemId: id,
        field: 'source_id',
        referencedId: link.source_id
      });
    }
  }
}

function validateRegionalRouting(context, results) {
  const { core, indexes, files } = context;
  const slugOwners = new Map();
  for (const region of core.regions) {
    const id = recordId(region);
    if (region.region_type === 'prefecture') {
      if (!isSafeRegionSlug(region.region_slug)) {
        addError(results, {
          code: 'E020',
          file: files.core.regions,
          itemId: id,
          field: 'region_slug',
          message: '地域ページを持つprefectureには安全なregion_slugが必要です。',
          suggestedAction: '小文字英数字とハイフンだけのregion_slugを設定してください。'
        });
      } else if (slugOwners.has(region.region_slug)) {
        addError(results, {
          code: 'E020',
          file: files.core.regions,
          itemId: id,
          field: 'region_slug',
          message: `prefecture間でregion_slug '${region.region_slug}' が重複しています。`,
          suggestedAction: '公開URL識別子をprefecture間で一意にしてください。'
        });
      } else slugOwners.set(region.region_slug, id);
      if (!Number.isInteger(region.display_order) || region.display_order < 1) {
        addError(results, {
          code: 'E020',
          file: files.core.regions,
          itemId: id,
          field: 'display_order',
          message: '地域ページを持つprefectureには1以上のdisplay_orderが必要です。',
          suggestedAction: '全国トップでの表示順を正の整数で設定してください。'
        });
      }
    } else if (Object.hasOwn(region, 'region_slug') || Object.hasOwn(region, 'display_order')) {
      addError(results, {
        code: 'E020',
        file: files.core.regions,
        itemId: id,
        field: 'region_slug',
        message: 'region_slugとdisplay_orderはprefectureだけに設定できます。',
        suggestedAction: 'prefecture以外から全国版URL項目を削除してください。'
      });
    }
  }
  for (const region of core.regions.filter(({ region_type: type }) => type === 'municipality')) {
    const parent = indexes.core.regions.get(region.parent_region_id);
    if (parent && parent.region_type !== 'prefecture') {
      addError(results, {
        code: 'E020',
        file: files.core.regions,
        itemId: recordId(region),
        field: 'parent_region_id',
        message: 'municipalityの親地域はprefectureである必要があります。',
        suggestedAction: '都道府県の親地域を指定してください。'
      });
    }
  }
  for (const region of core.regions.filter(({ region_type: type }) => type === 'prefecture')) {
    for (const locale of SUPPORTED_LOCALES) {
      const localized = indexes.locales[locale].regions.get(region.id);
      if (
        region.publication_status === 'published' &&
        localized?.locale_status === 'published' &&
        (typeof localized.navigation_label !== 'string' || localized.navigation_label === '')
      ) {
        addError(results, {
          code: 'E020',
          file: files.locales[locale].regions,
          itemId: region.id,
          field: 'navigation_label',
          message: '公開prefectureの公開localeにはnavigation_labelが必要です。',
          suggestedAction: '全国トップで表示する地域選択肢の名称を追加してください。'
        });
      }
    }
  }
}

function validatePublishedCardRegionScope(context, results) {
  const { core, files } = context;
  for (const card of core.cards) {
    if (card.publication_status !== 'published') continue;
    if (!Array.isArray(card.region_ids) || card.region_ids.length === 0) {
      addError(results, {
        code: 'E020',
        file: files.core.cards,
        itemId: recordId(card),
        field: 'region_ids',
        message: '公開カードには明示的なregion_idsが1件以上必要です。',
        suggestedAction: '全地域への暗黙適用を使わず、掲載対象地域を明示してください。'
      });
    }
  }
}

function addDuplicateValueErrors(
  results,
  items,
  { file, field, keyFor, message, include = () => true }
) {
  const seen = new Map();
  const reported = new Set();
  for (const record of items) {
    if (!include(record)) continue;
    const key = keyFor(record);
    if (key === undefined) continue;
    if (seen.has(key) && !reported.has(key)) {
      addError(results, {
        code: 'E017',
        file,
        itemId: recordId(record),
        field,
        message,
        suggestedAction: `${field}を表示範囲内で一意にしてください。`
      });
      reported.add(key);
    } else if (!seen.has(key)) {
      seen.set(key, record);
    }
  }
}

function validateDisplayUniqueness(context, results) {
  const { core, files } = context;
  addDuplicateValueErrors(results, core.sections, {
    file: files.core.sections,
    field: 'anchor_id',
    keyFor: (section) => (typeof section.anchor_id === 'string' ? section.anchor_id : undefined),
    message: '分野のanchor_idが重複しています。'
  });
  addDuplicateValueErrors(results, core.sections, {
    file: files.core.sections,
    field: 'display_order',
    include: (section) => section.publication_status !== 'archived',
    keyFor: (section) =>
      Number.isInteger(section.display_order) ? String(section.display_order) : undefined,
    message: '現行分野のdisplay_orderが重複しています。'
  });
  addDuplicateValueErrors(results, core.cards, {
    file: files.core.cards,
    field: 'display_order',
    include: (card) => card.publication_status !== 'archived',
    keyFor: (card) =>
      typeof card.section_id === 'string' && Number.isInteger(card.display_order)
        ? `${card.section_id}\u0000${card.display_order}`
        : undefined,
    message: '同じ分野内で現行カードのdisplay_orderが重複しています。'
  });
  addDuplicateValueErrors(results, core.cardSourceLinks, {
    file: files.core.cardSourceLinks,
    field: 'display_order',
    include: (link) => link.publication_status !== 'archived',
    keyFor: (link) =>
      typeof link.card_id === 'string' && Number.isInteger(link.display_order)
        ? `${link.card_id}\u0000${link.display_order}`
        : undefined,
    message: '同じカード内で現行関連のdisplay_orderが重複しています。'
  });
}

function validDateValue(value) {
  const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const valueInMilliseconds = Date.UTC(year, month - 1, day);
  const date = new Date(valueInMilliseconds);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }
  return valueInMilliseconds;
}

function hasContradictoryPeriod(link) {
  const start = validDateValue(link.site_display_start_on);
  const end = validDateValue(link.site_display_end_on);
  return start !== undefined && end !== undefined && end < start;
}

function validateLinkPairsAndPeriods(context, results) {
  const { core, files } = context;
  const seenPairs = new Set();
  const reportedPairs = new Set();
  for (const link of core.cardSourceLinks) {
    const id = recordId(link);
    if (typeof link.card_id === 'string' && typeof link.source_id === 'string') {
      const key = `${link.card_id}\u0000${link.source_id}`;
      if (seenPairs.has(key) && !reportedPairs.has(key)) {
        addError(results, {
          code: 'E018',
          file: files.core.cardSourceLinks,
          itemId: id,
          field: 'source_id',
          message: '同じカードと案内先の組み合わせが重複しています。',
          suggestedAction: 'card_idとsource_idの組み合わせを一意にしてください。'
        });
        reportedPairs.add(key);
      }
      seenPairs.add(key);
    }
    if (hasContradictoryPeriod(link)) {
      addError(results, {
        code: 'E018',
        file: files.core.cardSourceLinks,
        itemId: id,
        field: 'site_display_end_on',
        message: '表示終了日が表示開始日より前です。',
        suggestedAction: '表示開始日と表示終了日の前後関係を修正してください。'
      });
    }
  }
}

function validateCoreLocaleCorrespondence(context, results) {
  const { core, locales, indexes, files } = context;
  for (const unit of ['sections', 'cards']) {
    for (const coreRecord of core[unit]) {
      const id = recordId(coreRecord);
      if (!id) continue;
      const japanese = indexes.locales.ja[unit].get(id);
      const english = indexes.locales.en[unit].get(id);
      if (!japanese) {
        addError(results, {
          code: 'E012',
          file: files.locales.ja[unit],
          itemId: id,
          field: 'id',
          message: '対応する日本語localeが存在しません。',
          suggestedAction: '同じIDの日本語localeを追加してください。'
        });
      }
      if (coreRecord.publication_status === 'published' && !english) {
        addError(results, {
          code: 'E003',
          file: files.locales.en[unit],
          itemId: id,
          field: 'id',
          message: '公開中のcoreに必要な英語localeが存在しません。',
          suggestedAction: '同じIDの英語localeを追加してください。'
        });
      }
      for (const [locale, localeRecord] of [
        ['ja', japanese],
        ['en', english]
      ]) {
        if (
          coreRecord.publication_status === 'published' &&
          localeRecord &&
          localeRecord.locale_status !== 'published'
        ) {
          addError(results, {
            code: 'E014',
            file: files.locales[locale][unit],
            itemId: id,
            field: 'locale_status',
            message: `公開中のcoreに対応する${locale} localeが公開状態ではありません。`,
            suggestedAction: '文面を確認し、locale_statusをpublishedにしてください。'
          });
        }
      }
    }
    for (const locale of SUPPORTED_LOCALES) {
      for (const localeRecord of locales[locale][unit]) {
        const id = recordId(localeRecord);
        if (id && !indexes.core[unit].has(id)) {
          addError(results, {
            code: 'E012',
            file: files.locales[locale][unit],
            itemId: id,
            field: 'id',
            message: `${locale} localeが参照するcoreレコードが存在しません。`,
            suggestedAction: '対応するcoreを追加するか、孤立localeを修正してください。'
          });
        }
      }
    }
  }

  for (const link of core.cardSourceLinks) {
    const id = recordId(link);
    if (!id) continue;
    for (const locale of stringArray(link.display_locales).filter((value) =>
      SUPPORTED_LOCALES.includes(value)
    )) {
      const localeRecord = indexes.locales[locale].cardSourceLinks.get(id);
      if (!localeRecord) {
        addError(results, {
          code: locale === 'en' && link.publication_status === 'published' ? 'E003' : 'E012',
          file: files.locales[locale].cardSourceLinks,
          itemId: id,
          field: 'id',
          message: `display_localesで指定した${locale} localeが存在しません。`,
          suggestedAction: '指定言語の関連localeを追加してください。'
        });
      } else if (
        link.publication_status === 'published' &&
        localeRecord.locale_status !== 'published'
      ) {
        addError(results, {
          code: 'E014',
          file: files.locales[locale].cardSourceLinks,
          itemId: id,
          field: 'locale_status',
          message: `公開中の関連に必要な${locale} localeが公開状態ではありません。`,
          suggestedAction: '文面を確認し、locale_statusをpublishedにしてください。'
        });
      }
    }
  }
  for (const locale of SUPPORTED_LOCALES) {
    for (const localeRecord of locales[locale].cardSourceLinks) {
      const id = recordId(localeRecord);
      if (id && !indexes.core.cardSourceLinks.has(id)) {
        addError(results, {
          code: 'E012',
          file: files.locales[locale].cardSourceLinks,
          itemId: id,
          field: 'id',
          message: `${locale} localeが参照するcoreレコードが存在しません。`,
          suggestedAction: '対応するcoreを追加するか、孤立localeを修正してください。'
        });
      }
    }
  }
}

function validateLocaleRules(context, results) {
  const { locales, indexes, files } = context;
  for (const unit of NAVIGATION_UNITS) {
    for (const japanese of locales.ja[unit]) {
      const id = recordId(japanese);
      if (Object.hasOwn(japanese, 'based_on_ja_revision')) {
        addError(results, {
          code: 'E013',
          file: files.locales.ja[unit],
          itemId: id,
          field: 'based_on_ja_revision',
          message: '日本語localeにbased_on_ja_revisionは設定できません。',
          suggestedAction: 'based_on_ja_revisionを削除してください。'
        });
      }
    }
    for (const english of locales.en[unit]) {
      const id = recordId(english);
      const japanese = id ? indexes.locales.ja[unit].get(id) : undefined;
      if (!Object.hasOwn(english, 'based_on_ja_revision')) {
        addError(results, {
          code: 'E013',
          file: files.locales.en[unit],
          itemId: id,
          field: 'based_on_ja_revision',
          message: '英語localeにbased_on_ja_revisionがありません。',
          suggestedAction: '基にした日本語のcontent_revisionを設定してください。'
        });
      } else if (
        japanese &&
        Number.isInteger(english.based_on_ja_revision) &&
        Number.isInteger(japanese.content_revision) &&
        english.based_on_ja_revision !== japanese.content_revision
      ) {
        addError(results, {
          code: 'E004',
          file: files.locales.en[unit],
          itemId: id,
          field: 'based_on_ja_revision',
          message: '英語localeの改訂元が日本語localeのcontent_revisionと一致しません。',
          suggestedAction: '英語文面を確認し、改訂番号を一致させてください。'
        });
      }
    }
  }

  for (const locale of SUPPORTED_LOCALES) {
    for (const linkLocale of locales[locale].cardSourceLinks) {
      if (
        linkLocale.locale_status === 'published' &&
        (typeof linkLocale.button_label !== 'string' || linkLocale.button_label === '')
      ) {
        addError(results, {
          code: 'E013',
          file: files.locales[locale].cardSourceLinks,
          itemId: recordId(linkLocale),
          field: 'button_label',
          message: '公開中の関連localeにbutton_labelがありません。',
          suggestedAction: '空でないbutton_labelを追加してください。'
        });
      }
    }
  }
}

function addPublicationMismatch(results, { file, itemId, field, referencedId }) {
  addError(results, {
    code: 'E014',
    file,
    itemId,
    field,
    message: `公開中レコードの参照先 '${referencedId}' がpublishedではありません。`,
    suggestedAction: '参照先の公開状態を確認するか、参照を修正してください。'
  });
}

function validatePublishedReferences(context, results) {
  const { core, indexes, files } = context;
  for (const card of core.cards) {
    if (card.publication_status !== 'published') continue;
    const id = recordId(card);
    const section = indexes.core.sections.get(card.section_id);
    if (section && section.publication_status !== 'published') {
      addPublicationMismatch(results, {
        file: files.core.cards,
        itemId: id,
        field: 'section_id',
        referencedId: card.section_id
      });
    }
    for (const regionId of stringArray(card.region_ids)) {
      const region = indexes.core.regions.get(regionId);
      if (region && region.publication_status !== 'published') {
        addPublicationMismatch(results, {
          file: files.core.cards,
          itemId: id,
          field: 'region_ids',
          referencedId: regionId
        });
      }
    }
  }

  for (const link of core.cardSourceLinks) {
    if (link.publication_status !== 'published') continue;
    const id = recordId(link);
    for (const [field, referencedId, index] of [
      ['card_id', link.card_id, indexes.core.cards],
      ['source_id', link.source_id, indexes.core.sources]
    ]) {
      const target = index.get(referencedId);
      if (target && target.publication_status !== 'published') {
        addPublicationMismatch(results, {
          file: files.core.cardSourceLinks,
          itemId: id,
          field,
          referencedId
        });
      }
    }
    const unsupported = stringArray(link.display_locales).filter(
      (locale) => !SUPPORTED_LOCALES.includes(locale)
    );
    if (unsupported.length > 0) {
      addError(results, {
        code: 'E014',
        file: files.core.cardSourceLinks,
        itemId: id,
        field: 'display_locales',
        message: `未対応言語が指定されています: ${unsupported.join('、')}`,
        suggestedAction: 'display_localesはjaまたはenだけにしてください。'
      });
    }
  }
}

function isPublishedRegion(context, regionId, displayLocales, visited = new Set()) {
  if (visited.has(regionId)) return false;
  const region = context.indexes.core.regions.get(regionId);
  if (!region || region.publication_status !== 'published') return false;
  if (
    !displayLocales.every(
      (locale) =>
        context.indexes.locales[locale].regions.get(regionId)?.locale_status === 'published'
    )
  ) {
    return false;
  }
  if (typeof region.parent_region_id !== 'string') return true;
  const nextVisited = new Set(visited);
  nextVisited.add(regionId);
  return isPublishedRegion(context, region.parent_region_id, displayLocales, nextVisited);
}

function hasValidDisplayLocales(link) {
  return (
    Array.isArray(link.display_locales) &&
    link.display_locales.length > 0 &&
    link.display_locales.every(
      (locale) => typeof locale === 'string' && SUPPORTED_LOCALES.includes(locale)
    ) &&
    new Set(link.display_locales).size === link.display_locales.length
  );
}

function isEvaluablePrimaryLink(context, link) {
  if (
    !/^card-source-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(recordId(link) ?? '') ||
    typeof link.card_id !== 'string' ||
    typeof link.source_id !== 'string' ||
    !context.indexes.core.sources.has(link.source_id) ||
    !Number.isInteger(link.display_order) ||
    link.display_order < 1 ||
    !PUBLICATION_STATUSES.has(link.publication_status) ||
    link.role !== 'primary' ||
    !VISIBILITY_CONTEXTS.has(link.visibility_context) ||
    !hasValidDisplayLocales(link)
  ) {
    return false;
  }
  if (
    Object.hasOwn(link, 'site_display_start_on') &&
    validDateValue(link.site_display_start_on) === undefined
  ) {
    return false;
  }
  if (
    Object.hasOwn(link, 'site_display_end_on') &&
    (validDateValue(link.site_display_end_on) === undefined ||
      !Object.hasOwn(link, 'site_display_start_on'))
  ) {
    return false;
  }
  return true;
}

function isStructurallyPublishablePrimary(context, input, card, link) {
  const cardId = recordId(card);
  const displayLocales = link.display_locales;
  if (
    link.publication_status !== 'published' ||
    link.role !== 'primary' ||
    link.card_id !== cardId ||
    hasContradictoryPeriod(link)
  ) {
    return false;
  }
  const section = context.indexes.core.sections.get(card.section_id);
  if (!section || section.publication_status !== 'published') return false;
  if (
    !displayLocales.every(
      (locale) => context.indexes.locales[locale].cards.get(cardId)?.locale_status === 'published'
    )
  ) {
    return false;
  }
  if (
    !stringArray(card.region_ids).every((regionId) =>
      isPublishedRegion(context, regionId, displayLocales)
    )
  ) {
    return false;
  }
  for (const locale of displayLocales) {
    const linkLocale = context.indexes.locales[locale].cardSourceLinks.get(recordId(link));
    if (
      linkLocale?.locale_status !== 'published' ||
      typeof linkLocale.button_label !== 'string' ||
      linkLocale.button_label === ''
    ) {
      return false;
    }
  }
  return isStructurallyPublishableOfficialSource(input, {
    sourceId: link.source_id,
    displayLocales
  });
}

function validatePublishedCardPrimaryLinks(context, input, results) {
  for (const card of context.core.cards) {
    const id = recordId(card);
    if (card.publication_status !== 'published' || !id) continue;
    if (
      typeof card.section_id !== 'string' ||
      !context.indexes.core.sections.has(card.section_id) ||
      (card.region_ids !== undefined &&
        (!Array.isArray(card.region_ids) ||
          !card.region_ids.every(
            (regionId) => typeof regionId === 'string' && context.indexes.core.regions.has(regionId)
          )))
    ) {
      continue;
    }
    const primaryLinks = context.core.cardSourceLinks.filter(
      (link) => link.card_id === id && link.role === 'primary'
    );
    if (
      primaryLinks.some(
        (link) =>
          isEvaluablePrimaryLink(context, link) &&
          isStructurallyPublishablePrimary(context, input, card, link)
      )
    ) {
      continue;
    }
    if (primaryLinks.some((link) => !isEvaluablePrimaryLink(context, link))) continue;
    addError(results, {
      code: 'E019',
      file: context.files.core.cards,
      itemId: id,
      field: 'publication_status',
      message: '公開カードに構造上公開可能な主案内先がありません。',
      suggestedAction: '公開条件を満たすrole: primaryの関連を最低1件用意してください。'
    });
  }
}

function createContext(input, files) {
  const root = isObject(input) ? input : {};
  const coreInput = isObject(root.core) ? root.core : {};
  const localesInput = isObject(root.locales) ? root.locales : {};
  const japaneseInput = isObject(localesInput.ja) ? localesInput.ja : {};
  const englishInput = isObject(localesInput.en) ? localesInput.en : {};
  const core = Object.fromEntries(
    [...NAVIGATION_UNITS, ...OFFICIAL_UNITS].map((unit) => [unit, records(coreInput[unit])])
  );
  const locales = {
    ja: Object.fromEntries(
      [...NAVIGATION_UNITS, ...OFFICIAL_UNITS].map((unit) => [unit, records(japaneseInput[unit])])
    ),
    en: Object.fromEntries(
      [...NAVIGATION_UNITS, ...OFFICIAL_UNITS].map((unit) => [unit, records(englishInput[unit])])
    )
  };
  return {
    core,
    locales,
    files,
    indexes: {
      core: Object.fromEntries(
        [...NAVIGATION_UNITS, ...OFFICIAL_UNITS].map((unit) => [unit, recordsById(core[unit])])
      ),
      locales: {
        ja: Object.fromEntries(
          [...NAVIGATION_UNITS, ...OFFICIAL_UNITS].map((unit) => [
            unit,
            recordsById(locales.ja[unit])
          ])
        ),
        en: Object.fromEntries(
          [...NAVIGATION_UNITS, ...OFFICIAL_UNITS].map((unit) => [
            unit,
            recordsById(locales.en[unit])
          ])
        )
      }
    }
  };
}

export function validateNavigationCardData(input, { files: fileOverrides } = {}) {
  const results = [];
  const context = createContext(input, mergeFiles(fileOverrides));
  for (const unit of NAVIGATION_UNITS) {
    addDuplicateErrors(results, context.core[unit], context.files.core[unit]);
    for (const locale of SUPPORTED_LOCALES) {
      addDuplicateErrors(
        results,
        context.locales[locale][unit],
        context.files.locales[locale][unit]
      );
    }
  }
  validateReferences(context, results);
  validateRegionalRouting(context, results);
  validateDisplayUniqueness(context, results);
  validateLinkPairsAndPeriods(context, results);
  validateCoreLocaleCorrespondence(context, results);
  validateLocaleRules(context, results);
  validatePublishedReferences(context, results);
  validatePublishedCardPrimaryLinks(context, input, results);
  validatePublishedCardRegionScope(context, results);
  return sortResults(results);
}
