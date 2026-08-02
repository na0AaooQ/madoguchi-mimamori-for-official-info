import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createResult, sortResults } from '../validation/result.js';
import {
  loadPublicSchema,
  validatePublicArtifact
} from '../publication/public-artifact-validator.js';
import {
  ORGANIZATION_NAME_KINDS,
  ROLE_ORDER,
  SITE_ARTIFACT_TYPE,
  SITE_ASSET_SOURCE_PATHS,
  SITE_LOCALES,
  SITE_NAVIGATION_PATHS,
  SITE_UI_LOCALE_PATHS,
  SOURCE_TYPE_CATEGORIES,
  SiteRuntimeError,
  VISIBILITY_CONTEXTS
} from './site-constants.js';

const string = 'string';
const strings = Object.freeze([string]);
const UI_LOCALE_SHAPE = Object.freeze({
  locale: string,
  language_name: string,
  alternate_language_name: string,
  skip_link: string,
  navigation_label: string,
  language_switch_label: string,
  font_size: { label: string, standard: string, large: string },
  preview_notice: { title: string, body: string },
  pages: {
    home_title: string,
    home_heading: string,
    sections_heading: string,
    sections_intro: string,
    organizations_title: string,
    organizations_intro: string,
    privacy_title: string,
    section_back: string,
    empty_section: string,
    organizations_link: string,
    situation_notice: string
  },
  roles: { primary: string, 'temporary-highlight': string, secondary: string },
  visibility: { always: string, normal: string, disaster: string },
  destination_categories: {
    official_site: string,
    official_information: string,
    official_channel: string
  },
  fields: {
    region: string,
    organization: string,
    destination_name: string,
    purpose: string,
    usage: string,
    language_note: string,
    public_note: string,
    destination_checked_on: string,
    official_information_checked_on: string,
    platform: string,
    account_id: string,
    url: string
  },
  destination: {
    fictional_url_note: string,
    external_notice: string,
    official_name_fallback: string
  },
  about: { summary: string, items: strings },
  usage: { summary: string, items: strings },
  privacy: {
    established: string,
    operator_heading: string,
    operator_prefix: string,
    operator_name: string,
    operator_url: string,
    operator_link_label: string,
    input_heading: string,
    input_items: strings,
    unused_heading: string,
    unused_items: strings,
    session_heading: string,
    session_items: strings,
    external_heading: string,
    external_items: strings,
    contact_heading: string,
    contact_items: strings,
    logs_heading: string,
    logs_items: strings,
    revision_heading: string,
    revision_items: strings
  },
  footer: {
    home: string,
    organizations: string,
    privacy: string,
    contact: string,
    contact_prefix: string,
    free_notice: string,
    copyright: string
  }
});

function siteError(code, file, message, field) {
  return createResult({
    severity: 'error',
    code,
    file,
    message,
    ...(field ? { field } : {}),
    suggested_action:
      'preview公開データ、画面用locale、または静的サイト生成処理を確認してください。'
  });
}

async function readJson(repoRoot, relativePath) {
  let source;
  try {
    source = await readFile(path.join(repoRoot, relativePath), 'utf8');
  } catch (error) {
    throw new SiteRuntimeError(
      'SITE-RUN-E002',
      relativePath,
      `入力ファイルを読み込めません: ${error.message}`,
      error
    );
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    return {
      parseError: siteError('SITE-E001', relativePath, `JSON構文が不正です: ${error.message}`)
    };
  }
}

async function readAsset(repoRoot, relativePath) {
  try {
    return await readFile(path.join(repoRoot, relativePath), 'utf8');
  } catch (error) {
    throw new SiteRuntimeError(
      'SITE-RUN-E002',
      relativePath,
      `アセットソースを読み込めません: ${error.message}`,
      error
    );
  }
}

function validateLocaleShape(value, shape, file, currentPath = '$') {
  const results = [];
  if (shape === string) {
    if (typeof value !== 'string' || value.trim() === '') {
      results.push(
        siteError('SITE-E001', file, '必須文言は空でない文字列にしてください。', currentPath)
      );
    } else if (/[<>]/.test(value)) {
      results.push(
        siteError('SITE-E001', file, '画面用localeへHTMLを記載できません。', currentPath)
      );
    }
    return results;
  }
  if (Array.isArray(shape)) {
    if (!Array.isArray(value) || value.length === 0) {
      return [siteError('SITE-E001', file, '必須文言配列は1件以上必要です。', currentPath)];
    }
    return value.flatMap((item, index) =>
      validateLocaleShape(item, shape[0], file, `${currentPath}[${index}]`)
    );
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [
      siteError('SITE-E001', file, '必須の構造化文言オブジェクトがありません。', currentPath)
    ];
  }
  const expectedKeys = Object.keys(shape).sort();
  const actualKeys = Object.keys(value).sort();
  if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) {
    results.push(
      siteError(
        'SITE-E001',
        file,
        `画面用localeのキーが契約と一致しません。期待: ${expectedKeys.join(', ')}`,
        currentPath
      )
    );
  }
  for (const [key, childShape] of Object.entries(shape)) {
    results.push(...validateLocaleShape(value[key], childShape, file, `${currentPath}.${key}`));
  }
  return results;
}

function isSafeAnchor(value) {
  return (
    typeof value === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !value.includes('\\')
  );
}

function isSafeOperatorUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.hostname === 'portfolio.na0aaooq.com' &&
      url.username === '' &&
      url.password === '' &&
      url.search === '' &&
      url.hash === ''
    );
  } catch {
    return false;
  }
}

function walkDestinations(navigation, callback) {
  for (const section of navigation.sections ?? []) {
    for (const card of section.cards ?? []) {
      for (const link of card.links ?? [])
        callback({ section, card, link, destination: link.destination });
    }
  }
}

function validateNavigation(navigation, locale, file) {
  const results = [];
  if (navigation?.artifact_type !== SITE_ARTIFACT_TYPE) {
    results.push(
      siteError(
        'SITE-E001',
        file,
        'fictional-preview以外からpreview画面を生成できません。',
        'artifact_type'
      )
    );
  }
  if (navigation?.locale !== locale) {
    results.push(siteError('SITE-E001', file, '入力パスとlocaleが一致しません。', 'locale'));
  }
  const sectionIds = new Set();
  const anchors = new Set();
  for (const section of navigation?.sections ?? []) {
    if (!isSafeAnchor(section.anchor_id)) {
      results.push(
        siteError(
          'SITE-E002',
          file,
          'anchor_idを安全なURLパスとして使用できません。',
          'sections.anchor_id'
        )
      );
    }
    if (sectionIds.has(section.id))
      results.push(siteError('SITE-E002', file, 'section.idが重複しています。', 'sections.id'));
    if (anchors.has(section.anchor_id))
      results.push(
        siteError('SITE-E002', file, 'anchor_idが重複しています。', 'sections.anchor_id')
      );
    sectionIds.add(section.id);
    anchors.add(section.anchor_id);
  }

  const destinationById = new Map();
  walkDestinations(navigation, ({ link, destination }) => {
    if (!ROLE_ORDER.includes(link.role))
      results.push(siteError('SITE-E003', file, '未対応のroleです。', 'sections.cards.links.role'));
    if (!VISIBILITY_CONTEXTS.includes(link.visibility_context))
      results.push(
        siteError(
          'SITE-E003',
          file,
          '未対応のvisibility_contextです。',
          'sections.cards.links.visibility_context'
        )
      );
    if (!ORGANIZATION_NAME_KINDS.includes(destination.organization?.name_kind))
      results.push(
        siteError(
          'SITE-E003',
          file,
          '未対応のname_kindです。',
          'sections.cards.links.destination.organization.name_kind'
        )
      );
    if (!SOURCE_TYPE_CATEGORIES[destination.source_type])
      results.push(
        siteError(
          'SITE-E003',
          file,
          '案内先を3分類へ変換できないsource_typeです。',
          'sections.cards.links.destination.source_type'
        )
      );
    if (!(destination.destination_locales ?? []).every((value) => SITE_LOCALES.includes(value)))
      results.push(
        siteError(
          'SITE-E003',
          file,
          '未対応の案内先言語です。',
          'sections.cards.links.destination.destination_locales'
        )
      );
    if (
      !(destination.destination_locales ?? []).includes(locale) &&
      !destination.destination_language_note
    ) {
      results.push(
        siteError(
          'SITE-E003',
          file,
          '画面言語に対応しない案内先には言語注意が必要です。',
          'sections.cards.links.destination.destination_language_note'
        )
      );
    }
    const serialized = JSON.stringify(destination);
    const previous = destinationById.get(destination.id);
    if (previous && previous !== serialized)
      results.push(
        siteError(
          'SITE-E001',
          file,
          '同じdestination.idの公開内容が一致しません。',
          'sections.cards.links.destination.id'
        )
      );
    destinationById.set(destination.id, serialized);
  });
  return results;
}

function validatePair(navigations) {
  const results = [];
  const japanese = navigations.ja;
  const english = navigations.en;
  if (!japanese || !english) return results;
  if (japanese.site?.site_id !== english.site?.site_id) {
    results.push(
      siteError('SITE-E001', 'dist/public-data/preview', '日英のsite_idが一致しません。')
    );
  }
  if ((japanese.sections?.length ?? -1) !== (english.sections?.length ?? -2)) {
    results.push(
      siteError('SITE-E001', 'dist/public-data/preview', '日英のsection件数が一致しません。')
    );
    return results;
  }
  for (const [index, section] of japanese.sections.entries()) {
    const counterpart = english.sections[index];
    if (section.id !== counterpart.id || section.anchor_id !== counterpart.anchor_id) {
      results.push(
        siteError(
          'SITE-E001',
          'dist/public-data/preview',
          `日英のsection対応が一致しません（位置${index + 1}）。`
        )
      );
    }
  }
  return results;
}

export async function loadSiteInputs(repoRoot) {
  const results = [];
  const navigations = {};
  const uiLocales = {};
  const { validate } = await loadPublicSchema(repoRoot);

  for (const locale of SITE_LOCALES) {
    const navigation = await readJson(repoRoot, SITE_NAVIGATION_PATHS[locale]);
    if (navigation.parseError) results.push(navigation.parseError);
    else {
      navigations[locale] = navigation;
      results.push(
        ...validatePublicArtifact(navigation, {
          validateSchema: validate,
          file: SITE_NAVIGATION_PATHS[locale],
          expectedMode: 'preview',
          expectedLocale: locale
        }),
        ...validateNavigation(navigation, locale, SITE_NAVIGATION_PATHS[locale])
      );
    }

    const uiLocale = await readJson(repoRoot, SITE_UI_LOCALE_PATHS[locale]);
    if (uiLocale.parseError) results.push(uiLocale.parseError);
    else {
      uiLocales[locale] = uiLocale;
      results.push(...validateLocaleShape(uiLocale, UI_LOCALE_SHAPE, SITE_UI_LOCALE_PATHS[locale]));
      if (uiLocale.locale !== locale)
        results.push(
          siteError(
            'SITE-E001',
            SITE_UI_LOCALE_PATHS[locale],
            '入力パスと画面用localeが一致しません。',
            'locale'
          )
        );
      if (!isSafeOperatorUrl(uiLocale.privacy?.operator_url))
        results.push(
          siteError(
            'SITE-E001',
            SITE_UI_LOCALE_PATHS[locale],
            '運営者プロフィールURLは許可されたホストのHTTPS URLにしてください。',
            'privacy.operator_url'
          )
        );
    }
  }
  results.push(...validatePair(navigations));

  const assets = {};
  for (const [outputPath, sourcePath] of Object.entries(SITE_ASSET_SOURCE_PATHS)) {
    assets[outputPath] = await readAsset(repoRoot, sourcePath);
  }

  return { navigations, uiLocales, assets, results: sortResults(results) };
}
