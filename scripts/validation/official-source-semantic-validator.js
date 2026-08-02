import { createResult, sortResults } from './result.js';

const IMPLEMENTED_UNITS = Object.freeze(['regions', 'organizations', 'sources', 'evidence']);
const DEFAULT_FILES = Object.freeze({
  core: Object.freeze(
    Object.fromEntries(IMPLEMENTED_UNITS.map((unit) => [unit, `data/core/${unit}.json`]))
  ),
  locales: Object.freeze({
    ja: Object.freeze(
      Object.fromEntries(IMPLEMENTED_UNITS.map((unit) => [unit, `data/locales/ja/${unit}.json`]))
    ),
    en: Object.freeze(
      Object.fromEntries(IMPLEMENTED_UNITS.map((unit) => [unit, `data/locales/en/${unit}.json`]))
    )
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
    if (id === undefined) continue;
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

  for (const region of core.regions) {
    const id = recordId(region);
    if (
      typeof region.parent_region_id === 'string' &&
      !indexes.core.regions.has(region.parent_region_id)
    ) {
      addMissingReference(results, {
        file: files.core.regions,
        itemId: id,
        field: 'parent_region_id',
        referencedId: region.parent_region_id
      });
    }
  }

  for (const organization of core.organizations) {
    const id = recordId(organization);
    for (const regionId of stringArray(organization.region_ids)) {
      if (!indexes.core.regions.has(regionId)) {
        addMissingReference(results, {
          file: files.core.organizations,
          itemId: id,
          field: 'region_ids',
          referencedId: regionId
        });
      }
    }
    if (
      typeof organization.parent_organization_id === 'string' &&
      !indexes.core.organizations.has(organization.parent_organization_id)
    ) {
      addMissingReference(results, {
        file: files.core.organizations,
        itemId: id,
        field: 'parent_organization_id',
        referencedId: organization.parent_organization_id
      });
    }
  }

  for (const source of core.sources) {
    const id = recordId(source);
    if (
      typeof source.publisher_organization_id === 'string' &&
      !indexes.core.organizations.has(source.publisher_organization_id)
    ) {
      addMissingReference(results, {
        file: files.core.sources,
        itemId: id,
        field: 'publisher_organization_id',
        referencedId: source.publisher_organization_id
      });
    }
    for (const organizationId of stringArray(source.related_organization_ids)) {
      if (!indexes.core.organizations.has(organizationId)) {
        addMissingReference(results, {
          file: files.core.sources,
          itemId: id,
          field: 'related_organization_ids',
          referencedId: organizationId
        });
      }
    }
  }

  const targets = {
    organization: indexes.core.organizations,
    source: indexes.core.sources,
    disaster: indexes.core.disasters
  };
  for (const evidence of core.evidence) {
    const id = recordId(evidence);
    const targetIndex = targets[evidence.target_type];
    if (
      targetIndex &&
      typeof evidence.target_id === 'string' &&
      !targetIndex.has(evidence.target_id)
    ) {
      addMissingReference(results, {
        file: files.core.evidence,
        itemId: id,
        field: 'target_id',
        referencedId: evidence.target_id
      });
    }
    if (
      typeof evidence.evidence_source_id === 'string' &&
      !indexes.core.sources.has(evidence.evidence_source_id)
    ) {
      addMissingReference(results, {
        file: files.core.evidence,
        itemId: id,
        field: 'evidence_source_id',
        referencedId: evidence.evidence_source_id
      });
    }
  }
}

function validateHierarchy(context, results) {
  const { core, indexes, files } = context;
  for (const region of core.regions) {
    const id = recordId(region);
    if (id && region.parent_region_id === id) {
      addError(results, {
        code: 'E016',
        file: files.core.regions,
        itemId: id,
        field: 'parent_region_id',
        message: '地域が自分自身を親地域に指定しています。',
        suggestedAction: '自己参照を解消してください。'
      });
    }
  }
  for (const organization of core.organizations) {
    const id = recordId(organization);
    if (id && organization.parent_organization_id === id) {
      addError(results, {
        code: 'E016',
        file: files.core.organizations,
        itemId: id,
        field: 'parent_organization_id',
        message: '団体が自分自身を親団体に指定しています。',
        suggestedAction: '自己参照を解消してください。'
      });
    }
  }

  const completed = new Set();
  const reportedCycles = new Set();
  for (const startId of [...indexes.core.regions.keys()].sort()) {
    if (completed.has(startId)) continue;
    const path = [];
    const positions = new Map();
    let currentId = startId;
    while (indexes.core.regions.has(currentId) && !completed.has(currentId)) {
      if (positions.has(currentId)) {
        const cycle = path.slice(positions.get(currentId));
        if (cycle.length > 1) {
          const key = [...cycle].sort().join('\u0000');
          if (!reportedCycles.has(key)) {
            const itemId = [...cycle].sort()[0];
            addError(results, {
              code: 'E016',
              file: files.core.regions,
              itemId,
              field: 'parent_region_id',
              message: `地域階層が循環しています: ${cycle.join(' -> ')} -> ${currentId}`,
              suggestedAction: '循環しない親子関係へ修正してください。'
            });
            reportedCycles.add(key);
          }
        }
        break;
      }
      positions.set(currentId, path.length);
      path.push(currentId);
      const parentId = indexes.core.regions.get(currentId)?.parent_region_id;
      if (typeof parentId !== 'string' || parentId === currentId) break;
      currentId = parentId;
    }
    for (const id of path) completed.add(id);
  }
}

function validateCoreLocaleCorrespondence(context, results) {
  const { core, indexes, files } = context;
  for (const unit of IMPLEMENTED_UNITS) {
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
      if (
        coreRecord.publication_status === 'published' &&
        japanese &&
        japanese.locale_status !== 'published'
      ) {
        addError(results, {
          code: 'E014',
          file: files.locales.ja[unit],
          itemId: id,
          field: 'locale_status',
          message: '公開中のcoreに対応する日本語localeが公開状態ではありません。',
          suggestedAction: '文面を確認し、locale_statusをpublishedにしてください。'
        });
      }
      if (
        coreRecord.publication_status === 'published' &&
        english &&
        english.locale_status !== 'published'
      ) {
        addError(results, {
          code: 'E014',
          file: files.locales.en[unit],
          itemId: id,
          field: 'locale_status',
          message: '公開中のcoreに対応する英語localeが公開状態ではありません。',
          suggestedAction: '文面を確認し、locale_statusをpublishedにしてください。'
        });
      }
    }

    for (const locale of ['ja', 'en']) {
      for (const localeRecord of context.locales[locale][unit]) {
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
}

function validateLocaleRules(context, results) {
  const { locales, indexes, files } = context;
  for (const unit of IMPLEMENTED_UNITS) {
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

  for (const japanese of locales.ja.organizations) {
    const id = recordId(japanese);
    if (typeof japanese.name_kind === 'string' && japanese.name_kind !== 'official-ja') {
      addError(results, {
        code: 'E013',
        file: files.locales.ja.organizations,
        itemId: id,
        field: 'name_kind',
        message: '日本語団体localeのname_kindはofficial-jaである必要があります。',
        suggestedAction: '公式日本語名称を確認してofficial-jaを設定してください。'
      });
    }
  }
  for (const english of locales.en.organizations) {
    const id = recordId(english);
    if (
      typeof english.name_kind === 'string' &&
      !['official-en', 'official-ja-fallback'].includes(english.name_kind)
    ) {
      addError(results, {
        code: 'E013',
        file: files.locales.en.organizations,
        itemId: id,
        field: 'name_kind',
        message:
          '英語団体localeのname_kindはofficial-enまたはofficial-ja-fallbackである必要があります。',
        suggestedAction: '公式名称の根拠に応じたname_kindを修正してください。'
      });
    }
    const japanese = id ? indexes.locales.ja.organizations.get(id) : undefined;
    if (
      english.name_kind === 'official-ja-fallback' &&
      japanese &&
      typeof english.official_name === 'string' &&
      typeof japanese.official_name === 'string' &&
      english.official_name !== japanese.official_name
    ) {
      addError(results, {
        code: 'E013',
        file: files.locales.en.organizations,
        itemId: id,
        field: 'official_name',
        message: 'official-ja-fallbackの名称が日本語の公式名称と一致しません。',
        suggestedAction: '英語版のofficial_nameを日本語公式名称と完全一致させてください。'
      });
    }
  }

  for (const source of context.core.sources) {
    const id = recordId(source);
    const english = id ? indexes.locales.en.sources.get(id) : undefined;
    if (
      source.publication_status === 'published' &&
      Array.isArray(source.destination_locales) &&
      !source.destination_locales.includes('en') &&
      english?.locale_status === 'published' &&
      (typeof english.destination_language_note !== 'string' ||
        english.destination_language_note === '')
    ) {
      addError(results, {
        code: 'E013',
        file: files.locales.en.sources,
        itemId: id,
        field: 'destination_language_note',
        message: '英語版から公開する日本語のみの案内先に言語注意文がありません。',
        suggestedAction: '英語source localeにdestination_language_noteを追加してください。'
      });
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
  for (const region of core.regions) {
    if (region.publication_status !== 'published' || typeof region.parent_region_id !== 'string') {
      continue;
    }
    const parent = indexes.core.regions.get(region.parent_region_id);
    if (parent && parent.publication_status !== 'published') {
      addPublicationMismatch(results, {
        file: files.core.regions,
        itemId: recordId(region),
        field: 'parent_region_id',
        referencedId: region.parent_region_id
      });
    }
  }
  for (const organization of core.organizations) {
    if (organization.publication_status !== 'published') continue;
    for (const regionId of stringArray(organization.region_ids)) {
      const region = indexes.core.regions.get(regionId);
      if (region && region.publication_status !== 'published') {
        addPublicationMismatch(results, {
          file: files.core.organizations,
          itemId: recordId(organization),
          field: 'region_ids',
          referencedId: regionId
        });
      }
    }
    if (typeof organization.parent_organization_id === 'string') {
      const parent = indexes.core.organizations.get(organization.parent_organization_id);
      if (parent && parent.publication_status !== 'published') {
        addPublicationMismatch(results, {
          file: files.core.organizations,
          itemId: recordId(organization),
          field: 'parent_organization_id',
          referencedId: organization.parent_organization_id
        });
      }
    }
  }
  for (const source of core.sources) {
    const id = recordId(source);
    if (source.publication_status === 'published') {
      const publisher = indexes.core.organizations.get(source.publisher_organization_id);
      if (publisher && publisher.publication_status !== 'published') {
        addPublicationMismatch(results, {
          file: files.core.sources,
          itemId: id,
          field: 'publisher_organization_id',
          referencedId: source.publisher_organization_id
        });
      }
      for (const organizationId of stringArray(source.related_organization_ids)) {
        const organization = indexes.core.organizations.get(organizationId);
        if (organization && organization.publication_status !== 'published') {
          addPublicationMismatch(results, {
            file: files.core.sources,
            itemId: id,
            field: 'related_organization_ids',
            referencedId: organizationId
          });
        }
      }
    }
    const destinationLocales = new Set(stringArray(source.destination_locales));
    for (const locale of stringArray(source.primary_official_home_for_locales)) {
      if (!destinationLocales.has(locale)) {
        addError(results, {
          code: 'E014',
          file: files.core.sources,
          itemId: id,
          field: 'primary_official_home_for_locales',
          message: `主公式ホームの言語 '${locale}' が案内先の利用可能言語に含まれていません。`,
          suggestedAction:
            'destination_localesとprimary_official_home_for_localesを整合させてください。'
        });
      }
    }
  }

  const targets = {
    organization: indexes.core.organizations,
    source: indexes.core.sources,
    disaster: indexes.core.disasters
  };
  for (const evidence of core.evidence) {
    if (evidence.publication_status !== 'published') continue;
    const target = targets[evidence.target_type]?.get(evidence.target_id);
    if (target && target.publication_status !== 'published') {
      addPublicationMismatch(results, {
        file: files.core.evidence,
        itemId: recordId(evidence),
        field: 'target_id',
        referencedId: evidence.target_id
      });
    }
    if (typeof evidence.evidence_source_id === 'string') {
      const source = indexes.core.sources.get(evidence.evidence_source_id);
      if (source && source.publication_status !== 'published') {
        addPublicationMismatch(results, {
          file: files.core.evidence,
          itemId: recordId(evidence),
          field: 'evidence_source_id',
          referencedId: evidence.evidence_source_id
        });
      }
    }
  }
}

function validEvidence(context, evidence) {
  const id = recordId(evidence);
  if (
    !id ||
    evidence.publication_status !== 'published' ||
    evidence.status !== 'confirmed' ||
    typeof evidence.checked_on !== 'string' ||
    evidence.checked_on === ''
  ) {
    return false;
  }
  const hasUrl = typeof evidence.evidence_url === 'string' && evidence.evidence_url !== '';
  const hasSource =
    typeof evidence.evidence_source_id === 'string' && evidence.evidence_source_id !== '';
  if (!hasUrl && !hasSource) return false;
  if (
    context.indexes.locales.ja.evidence.get(id)?.locale_status !== 'published' ||
    context.indexes.locales.en.evidence.get(id)?.locale_status !== 'published'
  ) {
    return false;
  }
  if (hasSource) {
    const source = context.indexes.core.sources.get(evidence.evidence_source_id);
    if (
      !source ||
      source.publication_status !== 'published' ||
      source.destination_status !== 'confirmed' ||
      source.official_information_status !== 'confirmed'
    ) {
      return false;
    }
  }
  return true;
}

function hasValidEvidence(context, { targetType, targetId, targetAspect, targetLocale }) {
  return context.core.evidence.some(
    (evidence) =>
      evidence.target_type === targetType &&
      evidence.target_id === targetId &&
      evidence.target_aspect === targetAspect &&
      (targetLocale === undefined || evidence.target_locale === targetLocale) &&
      validEvidence(context, evidence)
  );
}

function addEvidenceError(results, { file, itemId, field, message }) {
  addError(results, {
    code: 'E015',
    file,
    itemId,
    field,
    message,
    suggestedAction: '公開条件を満たす公式性確認根拠を追加または修正してください。'
  });
}

function validateRequiredEvidence(context, results) {
  const { core, indexes, files } = context;
  for (const organization of core.organizations) {
    const id = recordId(organization);
    if (!id || organization.publication_status !== 'published') continue;
    if (
      !hasValidEvidence(context, {
        targetType: 'organization',
        targetId: id,
        targetAspect: 'official-organization'
      })
    ) {
      addEvidenceError(results, {
        file: files.core.organizations,
        itemId: id,
        field: 'publication_status',
        message: '公開団体に、団体自体の公式性を示す有効な根拠がありません。'
      });
    }
    const hasJapaneseNameEvidence = hasValidEvidence(context, {
      targetType: 'organization',
      targetId: id,
      targetAspect: 'official-name',
      targetLocale: 'ja'
    });
    if (!hasJapaneseNameEvidence) {
      addEvidenceError(results, {
        file: files.core.organizations,
        itemId: id,
        field: 'publication_status',
        message: '公開団体に、表示する日本語公式名称の有効な根拠がありません。'
      });
    }
    const english = indexes.locales.en.organizations.get(id);
    if (
      english?.name_kind === 'official-en' &&
      !hasValidEvidence(context, {
        targetType: 'organization',
        targetId: id,
        targetAspect: 'official-name',
        targetLocale: 'en'
      })
    ) {
      addEvidenceError(results, {
        file: files.locales.en.organizations,
        itemId: id,
        field: 'name_kind',
        message: '公開するofficial-en名称の有効な公式名称根拠がありません。'
      });
    }
  }

  for (const source of core.sources) {
    const id = recordId(source);
    if (!id || source.publication_status !== 'published') continue;
    const hasOfficialPage = hasValidEvidence(context, {
      targetType: 'source',
      targetId: id,
      targetAspect: 'official-page'
    });
    const hasOfficialAccount = hasValidEvidence(context, {
      targetType: 'source',
      targetId: id,
      targetAspect: 'official-account'
    });
    if (!hasOfficialPage && !hasOfficialAccount) {
      addEvidenceError(results, {
        file: files.core.sources,
        itemId: id,
        field: 'publication_status',
        message: '公開案内先にofficial-pageまたはofficial-accountの有効な根拠がありません。'
      });
    }
  }
}

function createContext(input, files) {
  const root = isObject(input) ? input : {};
  const coreInput = isObject(root.core) ? root.core : {};
  const localesInput = isObject(root.locales) ? root.locales : {};
  const japaneseInput = isObject(localesInput.ja) ? localesInput.ja : {};
  const englishInput = isObject(localesInput.en) ? localesInput.en : {};
  const core = Object.fromEntries(
    IMPLEMENTED_UNITS.map((unit) => [unit, records(coreInput[unit])])
  );
  core.disasters = records(coreInput.disasters);
  const locales = {
    ja: Object.fromEntries(IMPLEMENTED_UNITS.map((unit) => [unit, records(japaneseInput[unit])])),
    en: Object.fromEntries(IMPLEMENTED_UNITS.map((unit) => [unit, records(englishInput[unit])]))
  };
  return {
    core,
    locales,
    files,
    indexes: {
      core: Object.fromEntries(
        [...IMPLEMENTED_UNITS, 'disasters'].map((unit) => [unit, recordsById(core[unit])])
      ),
      locales: {
        ja: Object.fromEntries(
          IMPLEMENTED_UNITS.map((unit) => [unit, recordsById(locales.ja[unit])])
        ),
        en: Object.fromEntries(
          IMPLEMENTED_UNITS.map((unit) => [unit, recordsById(locales.en[unit])])
        )
      }
    }
  };
}

export function validateOfficialSourceData(input, { files: fileOverrides } = {}) {
  const results = [];
  const context = createContext(input, mergeFiles(fileOverrides));

  for (const unit of IMPLEMENTED_UNITS) {
    addDuplicateErrors(results, context.core[unit], context.files.core[unit]);
    for (const locale of ['ja', 'en']) {
      addDuplicateErrors(
        results,
        context.locales[locale][unit],
        context.files.locales[locale][unit]
      );
    }
  }

  validateReferences(context, results);
  validateHierarchy(context, results);
  validateCoreLocaleCorrespondence(context, results);
  validateLocaleRules(context, results);
  validatePublishedReferences(context, results);
  validateRequiredEvidence(context, results);
  return sortResults(results);
}
