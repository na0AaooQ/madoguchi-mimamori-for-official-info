import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { TextDecoder } from 'node:util';

import { createResult, sortResults } from '../validation/result.js';
import {
  loadPublicSchema,
  validatePublicArtifact
} from '../publication/public-artifact-validator.js';
import {
  ORGANIZATION_NAME_KINDS,
  ROLE_ORDER,
  SITE_BINARY_ASSET_SOURCE_PATHS,
  SITE_ICON_PATHS,
  SITE_LOCALES,
  SITE_TEXT_ASSET_SOURCE_PATHS,
  SOURCE_TYPE_CATEGORIES,
  SiteRuntimeError,
  VISIBILITY_CONTEXTS,
  getSiteMode
} from './site-constants.js';
import { validateSiteIcon } from './site-icon-validator.js';
import { loadProductionSiteUrl } from './site-url.js';

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });

const string = 'string';
const strings = Object.freeze([string]);
const FOOTER_CONTACTS = Object.freeze({
  ja: Object.freeze({
    contact: '問い合わせ',
    contact_url: 'https://portfolio.na0aaooq.com/contact.html',
    contact_link_label: '問い合わせページを新しいタブで開く'
  }),
  en: Object.freeze({
    contact: 'Contact',
    contact_url: 'https://portfolio.na0aaooq.com/en/contact.html',
    contact_link_label: 'Open the contact page in a new tab'
  })
});
const ENGLISH_MONTHS = Object.freeze([
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]);
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
    last_revised: string,
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
    contact_url: string,
    contact_link_label: string,
    free_notice: string,
    copyright: string
  }
});

const {
  preview_notice: ignoredPreviewNotice,
  destination: ignoredPreviewDestination,
  ...sharedShape
} = UI_LOCALE_SHAPE;
void ignoredPreviewNotice;
void ignoredPreviewDestination;

const PRODUCTION_UI_LOCALE_SHAPE = Object.freeze({
  ...sharedShape,
  root: {
    title: string,
    heading: string,
    description: string,
    unofficial: string,
    language_link: string,
    footer_navigation_label: string,
    operator_label: string
  },
  not_found: {
    title: string,
    heading: string,
    body_ja: string,
    body_en: string,
    root_link: string,
    japanese_link: string,
    english_link: string
  },
  destination: {
    external_notice: string,
    official_name_fallback: string,
    external_link_label: string
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

async function readAsset(repoRoot, relativePath, binary = false) {
  try {
    const source = await readFile(path.join(repoRoot, relativePath));
    return binary ? source : utf8Decoder.decode(source);
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

function parseLastRevised(value, locale) {
  if (locale === 'ja') {
    const match = /^最終改定日: (\d{4})年(\d{1,2})月(\d{1,2})日$/.exec(value);
    if (!match) return undefined;
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }
  const match = /^Last revised: ([A-Z][a-z]+) (\d{1,2}), (\d{4})$/.exec(value);
  if (!match) return undefined;
  const month = ENGLISH_MONTHS.indexOf(match[1]) + 1;
  if (month === 0) return undefined;
  return `${match[3]}-${String(month).padStart(2, '0')}-${match[2].padStart(2, '0')}`;
}

function walkDestinations(navigation, callback) {
  for (const section of navigation.sections ?? []) {
    for (const card of section.cards ?? []) {
      for (const link of card.links ?? [])
        callback({ section, card, link, destination: link.destination });
    }
  }
}

function validateNavigation(navigation, locale, file, config) {
  const results = [];
  if (navigation?.artifact_type !== config.artifactType) {
    results.push(
      siteError(
        'SITE-E001',
        file,
        `${config.artifactType}以外から${config.mode}画面を生成できません。`,
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

function validatePair(navigations, uiLocales, config) {
  const results = [];
  const japanese = navigations.ja;
  const english = navigations.en;
  if (!japanese || !english) return results;
  if (japanese.site?.site_id !== english.site?.site_id) {
    results.push(
      siteError('SITE-E001', `dist/public-data/${config.mode}`, '日英のsite_idが一致しません。')
    );
  }
  if ((japanese.sections?.length ?? -1) !== (english.sections?.length ?? -2)) {
    results.push(
      siteError('SITE-E001', `dist/public-data/${config.mode}`, '日英のsection件数が一致しません。')
    );
    return results;
  }
  for (const [index, section] of japanese.sections.entries()) {
    const counterpart = english.sections[index];
    if (section.id !== counterpart.id || section.anchor_id !== counterpart.anchor_id) {
      results.push(
        siteError(
          'SITE-E001',
          `dist/public-data/${config.mode}`,
          `日英のsection対応が一致しません（位置${index + 1}）。`
        )
      );
    }
  }
  const revisedDates = {};
  for (const locale of SITE_LOCALES) {
    revisedDates[locale] = parseLastRevised(uiLocales[locale]?.privacy?.last_revised, locale);
    if (!revisedDates[locale]) {
      results.push(
        siteError(
          'SITE-E001',
          config.uiLocalePaths[locale],
          '最終改定日は言語別の所定形式で記載してください。',
          'privacy.last_revised'
        )
      );
    }
    if (
      config.mode === 'production' &&
      uiLocales[locale]?.footer?.contact_url !== navigations[locale]?.site?.contact_url
    ) {
      results.push(
        siteError(
          'SITE-E001',
          config.uiLocalePaths[locale],
          'productionの問い合わせURLが公開ナビゲーションと一致しません。',
          'footer.contact_url'
        )
      );
    }
  }
  if (revisedDates.ja && revisedDates.en && revisedDates.ja !== revisedDates.en) {
    results.push(
      siteError(
        'SITE-E001',
        `site/locales/${config.mode === 'production' ? 'production/' : ''}`,
        '日英の最終改定日が同じ日付を表していません。',
        'privacy.last_revised'
      )
    );
  }
  if (
    config.mode === 'production' &&
    uiLocales.ja?.footer?.copyright !== uiLocales.en?.footer?.copyright
  ) {
    results.push(
      siteError(
        'SITE-E001',
        'site/locales/production/',
        'productionの日英著作権表記が一致しません。',
        'footer.copyright'
      )
    );
  }
  return results;
}

export async function loadSiteInputs(repoRoot, mode = 'preview') {
  const config = getSiteMode(mode);
  const results = [];
  const navigations = {};
  const uiLocales = {};
  const { validate } = await loadPublicSchema(repoRoot);

  for (const locale of SITE_LOCALES) {
    const navigationPath = config.navigationPaths[locale];
    const navigation = await readJson(repoRoot, navigationPath);
    if (navigation.parseError) results.push(navigation.parseError);
    else {
      navigations[locale] = navigation;
      results.push(
        ...validatePublicArtifact(navigation, {
          validateSchema: validate,
          file: navigationPath,
          expectedMode: mode,
          expectedLocale: locale
        }),
        ...validateNavigation(navigation, locale, navigationPath, config)
      );
    }

    const uiLocalePath = config.uiLocalePaths[locale];
    const uiLocale = await readJson(repoRoot, uiLocalePath);
    if (uiLocale.parseError) results.push(uiLocale.parseError);
    else {
      uiLocales[locale] = uiLocale;
      results.push(
        ...validateLocaleShape(
          uiLocale,
          mode === 'preview' ? UI_LOCALE_SHAPE : PRODUCTION_UI_LOCALE_SHAPE,
          uiLocalePath
        )
      );
      if (uiLocale.locale !== locale)
        results.push(
          siteError('SITE-E001', uiLocalePath, '入力パスと画面用localeが一致しません。', 'locale')
        );
      if (!isSafeOperatorUrl(uiLocale.privacy?.operator_url))
        results.push(
          siteError(
            'SITE-E001',
            uiLocalePath,
            '運営者プロフィールURLは許可されたホストのHTTPS URLにしてください。',
            'privacy.operator_url'
          )
        );
      for (const [field, expected] of Object.entries(FOOTER_CONTACTS[locale])) {
        if (uiLocale.footer?.[field] !== expected) {
          results.push(
            siteError(
              'SITE-E001',
              uiLocalePath,
              '問い合わせ導線は言語別の承認済み文言・URLと完全一致させてください。',
              `footer.${field}`
            )
          );
        }
      }
    }
  }
  results.push(...validatePair(navigations, uiLocales, config));

  const assets = {};
  for (const [outputPath, sourcePath] of Object.entries(SITE_TEXT_ASSET_SOURCE_PATHS)) {
    assets[outputPath] = await readAsset(repoRoot, sourcePath);
  }
  for (const [outputPath, sourcePath] of Object.entries(SITE_BINARY_ASSET_SOURCE_PATHS)) {
    assets[outputPath] = await readAsset(repoRoot, sourcePath, true);
  }
  for (const icon of SITE_ICON_PATHS) {
    const sourcePath = SITE_TEXT_ASSET_SOURCE_PATHS[icon] ?? SITE_BINARY_ASSET_SOURCE_PATHS[icon];
    for (const message of validateSiteIcon(icon, assets[icon]))
      results.push(siteError('SITE-E001', sourcePath, message));
  }

  const siteUrl =
    mode === 'production'
      ? await loadProductionSiteUrl(repoRoot, config.productionConfigPath)
      : { basePath: config.basePath };

  return {
    mode,
    config,
    siteUrl,
    navigations,
    uiLocales,
    assets,
    results: sortResults(results)
  };
}
