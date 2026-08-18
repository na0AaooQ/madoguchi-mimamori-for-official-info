import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { TextDecoder } from 'node:util';

import { createResult, sortResults } from '../validation/result.js';
import {
  buildSiteArtifacts,
  escapeHtml,
  expectedSiteArtifactPaths,
  productionSitemapUrls
} from './site-builder.js';
import {
  SITE_GENERATOR_NAME,
  SITE_ICON_PATHS,
  SITE_LOCALES,
  SITE_OGP_IMAGE_PATH,
  SiteRuntimeError
} from './site-constants.js';
import { validateOgpImage, validateSiteIcon } from './site-icon-validator.js';
import { loadSiteInputs } from './site-input-loader.js';
import { absoluteSiteUrl, joinSitePath } from './site-url.js';

const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
const TEXT_ARTIFACT_EXTENSIONS = new Set(['.html', '.css', '.js', '.xml', '.svg']);

function siteError(code, file, message) {
  return createResult({
    severity: 'error',
    code,
    file,
    message,
    suggested_action: '生成元を修正し、対象modeのサイトを再生成してください。'
  });
}

async function collectFiles(root, relative = '') {
  let entries;
  try {
    entries = await readdir(path.join(root, relative), { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === '.DS_Store') continue;
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(root, child)));
    else if (entry.isFile()) files.push(child.split(path.sep).join('/'));
  }
  return files.sort();
}

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function countLiteral(source, value) {
  return source.split(value).length - 1;
}

function isTextArtifact(file) {
  return TEXT_ARTIFACT_EXTENSIONS.has(path.extname(file));
}

function artifactEquals(expected, actual) {
  if (typeof expected === 'string' && typeof actual === 'string') return expected === actual;
  if (Buffer.isBuffer(expected) && Buffer.isBuffer(actual)) return expected.equals(actual);
  return false;
}

function outputFile(inputs, file) {
  return `${inputs.config.outputRoot}/${file}`;
}

function htmlBaseContract(source, file, inputs) {
  const results = [];
  const target = outputFile(inputs, file);
  if (!/<html lang="(?:ja|en)"/.test(source))
    results.push(siteError('SITE-E005', target, 'htmlのlangがありません。'));
  if (!source.includes(`<meta name="generator" content="${SITE_GENERATOR_NAME}">`))
    results.push(siteError('SITE-E005', target, '生成元メタ情報がありません。'));
  if (!/<main id="main-content">/.test(source))
    results.push(siteError('SITE-E005', target, 'mainランドマークがありません。'));
  if (count(source, /<h1(?:\s|>)/g) !== 1)
    results.push(siteError('SITE-E005', target, 'h1は各HTMLに1つ必要です。'));
  if (/tabindex="[1-9][0-9]*"/.test(source))
    results.push(siteError('SITE-E005', target, '正のtabindexを使用できません。'));
  if (/<details\b[^>]*\sopen(?:\s|>)/.test(source))
    results.push(siteError('SITE-E005', target, 'detailsを初期openにできません。'));
  if (/<summary\b[^>]*\srole=/.test(source))
    results.push(siteError('SITE-E005', target, 'summaryへ不要なroleを設定できません。'));
  results.push(...siteIconHtmlContract(source, file, inputs));

  const sharedUiPage =
    /^(?:ja|en)\//.test(file) || (inputs.mode === 'production' && file === 'index.html');
  if (sharedUiPage) {
    for (const [pattern, message] of [
      [/<header[ >]/, 'headerランドマークがありません。'],
      [/<nav[ >]/, 'navランドマークがありません。'],
      [/<footer[ >]/, 'footerランドマークがありません。'],
      [/<a class="skip-link" href="#main-content">/, '本文へのスキップリンクがありません。']
    ]) {
      if (!pattern.test(source)) results.push(siteError('SITE-E005', target, message));
    }
  }

  for (const forbidden of ['internal_note', 'display_order', 'publication_status']) {
    if (source.includes(forbidden))
      results.push(siteError('SITE-E005', target, `公開対象外の文字列が含まれます: ${forbidden}`));
  }
  return results;
}

function linkElements(source) {
  return [...source.matchAll(/<link\b([^>]*)>/g)].map((element) => {
    const attributes = {};
    for (const attribute of element[1].matchAll(/(?:^|\s)([^\s=/>]+)(?:\s*=\s*"([^"]*)")?/g))
      attributes[attribute[1]] = attribute[2] ?? '';
    return attributes;
  });
}

function siteIconHtmlContract(source, file, inputs) {
  const target = outputFile(inputs, file);
  const expected = [
    {
      rel: 'icon',
      href: joinSitePath(inputs.siteUrl.basePath, 'favicon.ico'),
      sizes: '16x16 32x32 48x48'
    },
    {
      rel: 'icon',
      href: joinSitePath(inputs.siteUrl.basePath, 'favicon.svg'),
      type: 'image/svg+xml',
      sizes: 'any'
    },
    {
      rel: 'apple-touch-icon',
      href: joinSitePath(inputs.siteUrl.basePath, 'apple-touch-icon.png'),
      sizes: '180x180'
    }
  ];
  const iconLinks = linkElements(source).filter(({ rel = '' }) => {
    const tokens = rel.split(/\s+/);
    return tokens.includes('icon') || tokens.includes('apple-touch-icon');
  });
  const results = [];
  if (iconLinks.length !== expected.length)
    results.push(siteError('SITE-E005', target, 'サイトアイコンのlink要素は3件必要です。'));

  for (const contract of expected) {
    const matches = iconLinks.filter(
      ({ rel, href }) => rel === contract.rel && href === contract.href
    );
    if (matches.length !== 1) {
      results.push(
        siteError(
          'SITE-E005',
          target,
          `${contract.href}を参照するrel="${contract.rel}"のlink要素は1件必要です。`
        )
      );
      continue;
    }
    const [attributes] = matches;
    if (attributes.sizes !== contract.sizes)
      results.push(siteError('SITE-E005', target, `${contract.href}のsizes属性が不正です。`));
    if ((contract.type ?? '') !== (attributes.type ?? ''))
      results.push(siteError('SITE-E005', target, `${contract.href}のtype属性が不正です。`));
  }
  for (const attributes of iconLinks) {
    if (!expected.some(({ rel, href }) => attributes.rel === rel && attributes.href === href)) {
      results.push(
        siteError('SITE-E005', target, 'modeに一致しないサイトアイコン参照があります。')
      );
    }
  }
  return results;
}

function previewHtmlContract(source, file, inputs) {
  const results = [];
  const target = outputFile(inputs, file);
  const locale = file.split('/')[0];
  const ui = inputs.uiLocales[locale];
  if (!source.includes('<meta name="robots" content="noindex, nofollow, noarchive">'))
    results.push(siteError('SITE-E005', target, 'previewのrobotsメタ情報がありません。'));
  if (!source.includes(ui.preview_notice.title))
    results.push(siteError('SITE-E005', target, '架空preview注意がありません。'));
  if (socialMetaElements(source).length > 0)
    results.push(siteError('SITE-E005', target, 'previewへOGP・X向けメタ情報を設定できません。'));
  if (/\bG-[A-Z0-9]+\b/.test(source))
    results.push(siteError('SITE-E005', target, 'previewへGA4測定IDを出力できません。'));
  for (const marker of [
    'googletagmanager.com/gtag/js',
    'window.dataLayer',
    'function gtag',
    "gtag('js'",
    "gtag('config'",
    'Google tag (gtag.js)'
  ]) {
    if (source.includes(marker))
      results.push(
        siteError('SITE-E005', target, `previewへGoogleタグを出力できません: ${marker}`)
      );
  }
  const allowedExternalUrls = new Set([ui.privacy.operator_url, ui.footer.contact_url]);
  for (const { href, attributes } of anchorElements(source).filter(({ href }) =>
    /^https:\/\//.test(href)
  )) {
    if (!allowedExternalUrls.has(href))
      results.push(
        siteError('SITE-E005', target, `previewに許可されていない外部リンクがあります: ${href}`)
      );
    if (attributes.target !== '_blank')
      results.push(
        siteError('SITE-E005', target, `preview外部リンクにtargetがありません: ${href}`)
      );
    const rel = new Set((attributes.rel ?? '').split(/\s+/).filter(Boolean));
    if (!rel.has('noopener') || !rel.has('noreferrer'))
      results.push(
        siteError('SITE-E005', target, `preview外部リンクに安全なrelがありません: ${href}`)
      );
  }
  const contentNavigations =
    inputs.mode === 'preview'
      ? Object.values(inputs.regionalNavigations ?? {}).flatMap((bySlug) => Object.values(bySlug))
      : Object.values(inputs.navigations);
  for (const navigation of contentNavigations) {
    for (const section of navigation.sections) {
      for (const card of section.cards) {
        for (const link of card.links) {
          if (source.includes(`href="${escapeHtml(link.destination.url)}"`))
            results.push(siteError('SITE-E005', target, '架空の案内先URLがリンク化されています。'));
        }
      }
    }
    if (source.includes(`href="${escapeHtml(navigation.site.contact_url)}"`))
      results.push(siteError('SITE-E005', target, '架空の問い合わせURLがリンク化されています。'));
  }
  if (/\/(?:ja|en)\/sections\//.test(source) || /\/(?:ja|en)\/organizations\//.test(source))
    results.push(siteError('SITE-E005', target, 'previewへ地域なし旧URLを内部リンクできません。'));
  if (/hreflang="x-default"|rel="canonical"/.test(source))
    results.push(siteError('SITE-E005', target, 'x-defaultとcanonicalは工程Aの対象外です。'));
  return results;
}

function expectedLocalizedLogicalLinks(file, inputs) {
  const match = /^(ja|en)\/(.*)index\.html$/.exec(file);
  if (!match) return undefined;
  const [, locale, rest] = match;
  const relative = rest === '' ? `${locale}/` : `${locale}/${rest}`;
  const alternateLocaleValue = locale === 'ja' ? 'en' : 'ja';
  const alternate = `${alternateLocaleValue}/${relative.slice(locale.length + 1)}`;
  const toHref =
    inputs.mode === 'production'
      ? (value) => absoluteSiteUrl(inputs.siteUrl, value)
      : (value) => sitePathForValidation(inputs, value);
  return {
    current: toHref(relative),
    alternate: toHref(alternate)
  };
}

function sitePathForValidation(inputs, relative) {
  return joinSitePath(inputs.siteUrl.basePath, relative);
}

function validateLocalizedHreflang(source, file, inputs, expectedPaths) {
  if (file === 'index.html' || file === '404.html') return [];
  const expected = expectedLocalizedLogicalLinks(file, inputs);
  if (!expected) return [];
  const alternateLinks = linkElements(source).filter(({ rel = '' }) =>
    rel.split(/\s+/).includes('alternate')
  );
  const results = [];
  const locale = file.split('/')[0];
  const expectedByLocale =
    locale === 'ja'
      ? [
          ['ja', expected.current],
          ['en', expected.alternate]
        ]
      : [
          ['ja', expected.alternate],
          ['en', expected.current]
        ];
  for (const [hreflang, href] of expectedByLocale) {
    const matches = alternateLinks.filter(
      (link) => link.hreflang === hreflang && link.href === href
    );
    if (matches.length !== 1)
      results.push(
        siteError(
          'SITE-E005',
          outputFile(inputs, file),
          `hreflang=${hreflang}の論理対応が不正です。`
        )
      );
    const target = hrefToArtifact(href, inputs);
    if (!target || !expectedPaths.has(target))
      results.push(
        siteError('SITE-E005', outputFile(inputs, file), `hreflang先が存在しません: ${href}`)
      );
  }
  if (alternateLinks.length !== 2)
    results.push(
      siteError(
        'SITE-E005',
        outputFile(inputs, file),
        'hreflangはselfとalternateの2件だけ必要です。'
      )
    );
  if (alternateLinks.some(({ hreflang }) => hreflang === 'x-default'))
    results.push(siteError('SITE-E005', outputFile(inputs, file), 'x-defaultは設定できません。'));
  return results;
}

function parseAttributes(source) {
  const attributes = {};
  for (const match of source.matchAll(/(?:^|\s)([^\s=/>]+)(?:\s*=\s*"([^"]*)")?/g))
    attributes[match[1]] = match[2] ?? '';
  return attributes;
}

function anchorElements(source) {
  return [...source.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map((match) => {
    const attributes = parseAttributes(match[1]);
    return { href: attributes.href ?? '', attributes, content: match[2] };
  });
}

function metaElements(source) {
  return [...source.matchAll(/<meta\b([^>]*)>/g)].map((match) => parseAttributes(match[1]));
}

function socialMetaElements(source) {
  return metaElements(source).filter(
    ({ property = '', name = '' }) => property.startsWith('og:') || name.startsWith('twitter:')
  );
}

function expectedProductionSocialMetadata(file, inputs) {
  if (file === '404.html') return undefined;
  const imageUrl = absoluteSiteUrl(inputs.siteUrl, SITE_OGP_IMAGE_PATH);
  if (file === 'index.html') {
    const japaneseUi = inputs.uiLocales.ja;
    const englishUi = inputs.uiLocales.en;
    const japaneseName = inputs.navigations.ja.site.site_name;
    const englishName = inputs.navigations.en.site.site_name;
    const title = `${japaneseName}｜${englishName}`;
    const description = `${japaneseUi.root.description} / ${englishUi.root.description}`;
    return {
      title,
      description,
      pageUrl: absoluteSiteUrl(inputs.siteUrl),
      siteName: title,
      imageUrl,
      imageAlt: japaneseUi.social.image_alt
    };
  }

  const match = /^(ja|en)\/(.*)index\.html$/.exec(file);
  if (!match) return undefined;
  const [, locale, rest] = match;
  const national = inputs.navigations[locale];
  const ui = inputs.uiLocales[locale];
  let title;
  let description;
  let pagePath = `/${locale}/${rest}`;
  if (rest === '') {
    title = [national.site.site_name, national.site.subtitle].join(locale === 'ja' ? '｜' : ' | ');
    description = national.site.short_description;
    pagePath = `/${locale}/`;
  } else if (rest === 'privacy/') {
    title = [ui.pages.privacy_title, national.site.site_name].join(locale === 'ja' ? '｜' : ' | ');
    description = ui.social.privacy_description;
  } else {
    const regionMatch = /^regions\/([^/]+)\/(.*)$/.exec(rest);
    if (!regionMatch) return undefined;
    const [, slug, regionalRest] = regionMatch;
    const navigation = inputs.regionalNavigations[locale]?.[slug];
    if (!navigation) return undefined;
    if (regionalRest === '') {
      title = [navigation.region.region_name, navigation.site.site_name].join(
        locale === 'ja' ? '｜' : ' | '
      );
      description = navigation.region.scope_note;
    } else if (regionalRest === 'organizations/') {
      title = [
        ui.pages.organizations_title,
        navigation.region.region_name,
        navigation.site.site_name
      ].join(locale === 'ja' ? '｜' : ' | ');
      description = ui.pages.organizations_intro;
    } else {
      const sectionMatch = /^sections\/([^/]+)\/$/.exec(regionalRest);
      const section = sectionMatch
        ? navigation.sections.find(({ anchor_id: anchorId }) => anchorId === sectionMatch[1])
        : undefined;
      if (!section) return undefined;
      title = [section.title, navigation.region.region_name, navigation.site.site_name].join(
        locale === 'ja' ? '｜' : ' | '
      );
      description = section.short_description;
    }
  }
  return {
    title,
    description,
    pageUrl: absoluteSiteUrl(inputs.siteUrl, pagePath),
    siteName: national.site.site_name,
    imageUrl,
    imageAlt: ui.social.image_alt
  };
}

function forbiddenMetadataContract(source, file, inputs) {
  const results = [];
  const target = outputFile(inputs, file);
  const metas = metaElements(source);
  for (const key of ['fb:app_id', 'og:image:secure_url', 'og:locale']) {
    if (metas.some(({ property }) => property === key))
      results.push(siteError('SITE-E005', target, `${key}は今回の対象外です。`));
  }
  if (metas.some(({ name }) => name === 'twitter:creator'))
    results.push(siteError('SITE-E005', target, 'twitter:creatorは今回の対象外です。'));
  if (metas.some(({ name }) => name === 'description'))
    results.push(siteError('SITE-E005', target, '新しいmeta descriptionは追加できません。'));
  if (linkElements(source).some(({ rel = '' }) => rel.split(/\s+/).includes('canonical')))
    results.push(siteError('SITE-E005', target, 'canonicalは今回の対象外です。'));
  if (/<script\b[^>]*type="application\/ld\+json"/i.test(source))
    results.push(siteError('SITE-E005', target, 'JSON-LDは今回の対象外です。'));
  return results;
}

function productionSocialHtmlContract(source, file, inputs) {
  const results = forbiddenMetadataContract(source, file, inputs);
  const target = outputFile(inputs, file);
  const social = socialMetaElements(source);
  const expectedPage = expectedProductionSocialMetadata(file, inputs);
  if (!expectedPage) {
    if (social.length > 0)
      results.push(
        siteError('SITE-E005', target, '404.htmlへOGP・X向けメタ情報を設定できません。')
      );
    return results;
  }

  const expected = new Map([
    ['og:title', expectedPage.title],
    ['og:description', expectedPage.description],
    ['og:type', 'website'],
    ['og:url', expectedPage.pageUrl],
    ['og:site_name', expectedPage.siteName],
    ['og:image', expectedPage.imageUrl],
    ['og:image:type', 'image/png'],
    ['og:image:width', '1200'],
    ['og:image:height', '630'],
    ['og:image:alt', expectedPage.imageAlt],
    ['twitter:card', 'summary_large_image'],
    ['twitter:site', '@na0AaooQ'],
    ['twitter:title', expectedPage.title],
    ['twitter:description', expectedPage.description],
    ['twitter:image', expectedPage.imageUrl],
    ['twitter:image:alt', expectedPage.imageAlt]
  ]);
  if (social.length !== expected.size)
    results.push(siteError('SITE-E005', target, 'OGP・X向けメタ情報は16件必要です。'));
  for (const [key, value] of expected) {
    const matches = social.filter(({ property, name }) => property === key || name === key);
    if (matches.length !== 1) {
      results.push(siteError('SITE-E005', target, `${key}は1件だけ必要です。`));
      continue;
    }
    const [attributes] = matches;
    const expectedAttribute = key.startsWith('og:') ? 'property' : 'name';
    if (!(expectedAttribute in attributes) || attributes.content !== escapeHtml(value))
      results.push(siteError('SITE-E005', target, `${key}の属性または値が不正です。`));
  }
  for (const attributes of social) {
    const key = attributes.property ?? attributes.name;
    if (!expected.has(key))
      results.push(siteError('SITE-E005', target, `想定外のSNSメタ情報があります: ${key}`));
  }
  for (const key of ['og:url', 'og:image', 'twitter:image']) {
    const content = social.find(({ property, name }) => property === key || name === key)?.content;
    if (!content || !content.startsWith('https://') || /localhost|\/preview\//.test(content))
      results.push(siteError('SITE-E005', target, `${key}は正式なHTTPS絶対URLにしてください。`));
  }
  return results;
}

function validateProductionSocialUrlSet(htmlByFile, inputs) {
  const urls = [];
  for (const [file, source] of htmlByFile) {
    if (file === '404.html') continue;
    const meta = socialMetaElements(source).find(({ property }) => property === 'og:url');
    if (meta?.content) urls.push(meta.content);
  }
  const expected = productionSitemapUrls(inputs);
  if (
    urls.length !== new Set(urls).size ||
    JSON.stringify([...urls].sort()) !== JSON.stringify([...expected].sort())
  ) {
    return [
      siteError(
        'SITE-E005',
        inputs.config.outputRoot,
        '通常ページのog:url集合は重複なくsitemap URL集合と一致させてください。'
      )
    ];
  }
  return [];
}

function localizedContactHtmlContract(source, file, inputs) {
  const results = [];
  const match = /^(ja|en)\//.exec(file);
  if (!match) return results;
  const locale = match[1];
  const otherLocale = locale === 'ja' ? 'en' : 'ja';
  const ui = inputs.uiLocales[locale];
  const expectedUrl = ui.footer.contact_url;
  const wrongUrl = inputs.uiLocales[otherLocale].footer.contact_url;
  const target = outputFile(inputs, file);
  const contacts = anchorElements(source).filter(({ href }) => href === expectedUrl);
  if (contacts.length !== 1) {
    results.push(
      siteError('SITE-E005', target, '言語別問い合わせリンクは各フッターに1件必要です。')
    );
  } else {
    const [contact] = contacts;
    if (contact.content !== escapeHtml(ui.footer.contact))
      results.push(
        siteError('SITE-E005', target, '問い合わせリンクの表示文言がLocaleと一致しません。')
      );
    if (contact.attributes.target !== '_blank')
      results.push(
        siteError('SITE-E005', target, '問い合わせリンクにtarget="_blank"がありません。')
      );
    const rel = new Set((contact.attributes.rel ?? '').split(/\s+/).filter(Boolean));
    if (!rel.has('noopener') || !rel.has('noreferrer'))
      results.push(
        siteError('SITE-E005', target, '問い合わせリンクのrelにnoopenerとnoreferrerが必要です。')
      );
    if (contact.attributes['aria-label'] !== ui.footer.contact_link_label)
      results.push(
        siteError('SITE-E005', target, '問い合わせリンクのaria-labelがLocaleと一致しません。')
      );
  }
  if (countLiteral(source, expectedUrl) !== 1)
    results.push(siteError('SITE-E005', target, '問い合わせURLはhref以外へ重複表示できません。'));
  if (wrongUrl !== expectedUrl && source.includes(wrongUrl))
    results.push(siteError('SITE-E005', target, '別言語の問い合わせURLが混入しています。'));
  if (source.includes('href="#contact-information"'))
    results.push(siteError('SITE-E005', target, '廃止した問い合わせ内部アンカーが残っています。'));
  if (/\bid="contact-information"/.test(source))
    results.push(siteError('SITE-E005', target, '廃止したcontact-information IDが残っています。'));
  const navigationContact = inputs.navigations[locale].site.contact_url;
  if (navigationContact !== expectedUrl && source.includes(navigationContact))
    results.push(
      siteError('SITE-E005', target, '公開データの問い合わせURLを画面へ重複表示できません。')
    );
  return results;
}

function privacyHtmlContract(source, file, inputs) {
  if (!/^(ja|en)\/privacy\/index\.html$/.test(file)) return [];
  const results = [];
  const locale = file.split('/')[0];
  const privacy = inputs.uiLocales[locale].privacy;
  const target = outputFile(inputs, file);
  for (const [value, label] of [
    [privacy.established, '制定日'],
    [privacy.last_revised, '最終改定日']
  ]) {
    if (countLiteral(source, escapeHtml(value)) !== 1)
      results.push(siteError('SITE-E005', target, `${label}はプライバシーポリシーに1件必要です。`));
  }
  const sessionContract =
    locale === 'ja'
      ? {
          heading: '4. 文字サイズ設定の一時保存（sessionStorage）',
          item: 'WebブラウザのsessionStorage（同じタブを開いている間だけ、一時的にブラウザ内へデータを保存できる仕組み）を利用できない場合は、文字サイズを標準で表示します。',
          oldHeading: '4. sessionStorage',
          oldItem: 'sessionStorageを利用できない場合は標準サイズで表示します。'
        }
      : {
          heading: '4. Temporary text-size storage (sessionStorage)',
          item: "If the browser's sessionStorage feature (temporary storage that keeps data only while the same tab remains open) is unavailable, the site displays the standard text size.",
          oldHeading: '4. sessionStorage',
          oldItem: 'If sessionStorage is unavailable, the site displays the standard text size.'
        };
  for (const value of [sessionContract.heading, sessionContract.item]) {
    if (!source.includes(escapeHtml(value)))
      results.push(siteError('SITE-E005', target, '合意済みのsessionStorage説明がありません。'));
  }
  for (const value of [sessionContract.oldHeading, sessionContract.oldItem]) {
    if (source.includes(escapeHtml(value)))
      results.push(siteError('SITE-E005', target, '旧sessionStorage説明が残っています。'));
  }
  if (inputs.mode === 'production') {
    const analytics = privacy.analytics;
    if (countLiteral(source, escapeHtml(analytics.heading)) !== 1)
      results.push(siteError('SITE-E005', target, 'アクセス解析の見出しは1件必要です。'));
    for (const paragraph of analytics.paragraphs) {
      if (countLiteral(source, escapeHtml(paragraph)) !== 1)
        results.push(siteError('SITE-E005', target, 'アクセス解析の説明がLocaleと一致しません。'));
    }
    const analyticsLinks = anchorElements(source).filter(({ href }) =>
      analytics.links.some(({ url }) => url === href)
    );
    if (analyticsLinks.length !== analytics.links.length)
      results.push(siteError('SITE-E005', target, 'Google公式リンクは3件必要です。'));
    for (const { label, url } of analytics.links) {
      const matches = analyticsLinks.filter(({ href }) => href === url);
      if (matches.length !== 1) {
        results.push(siteError('SITE-E005', target, `Google公式リンクは1件必要です: ${url}`));
        continue;
      }
      const [link] = matches;
      if (link.content !== escapeHtml(label))
        results.push(siteError('SITE-E005', target, `Google公式リンクのラベルが不正です: ${url}`));
      if (link.attributes.target !== '_blank')
        results.push(
          siteError('SITE-E005', target, `Google公式リンクにtargetがありません: ${url}`)
        );
      const rel = new Set((link.attributes.rel ?? '').split(/\s+/).filter(Boolean));
      if (!rel.has('noopener') || !rel.has('noreferrer'))
        results.push(
          siteError('SITE-E005', target, `Google公式リンクに安全なrelがありません: ${url}`)
        );
    }
  }
  if (source.includes('undefined') || /<p>\s*<\/p>/.test(source))
    results.push(
      siteError('SITE-E005', target, 'プライバシーポリシーに未定義値または空行があります。')
    );
  return results;
}

function productionHtmlContract(source, file, inputs) {
  const results = [];
  const target = outputFile(inputs, file);
  const isNotFound = file === '404.html';
  const measurementId = inputs.siteUrl.analytics.measurement_id;
  const googleScriptUrl = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  const headEnd = source.indexOf('</head>');
  const bodyStart = source.indexOf('<body');
  if (
    countLiteral(source, '<!-- Google tag (gtag.js) -->') !== 1 ||
    countLiteral(source, googleScriptUrl) !== 1 ||
    count(
      source,
      /<script\b(?=[^>]*\basync(?:\s|=|>))(?=[^>]*\bsrc="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=[^"]+")[^>]*>/g
    ) !== 1 ||
    countLiteral(source, 'window.dataLayer = window.dataLayer || [];') !== 1 ||
    countLiteral(source, 'function gtag(){dataLayer.push(arguments);}') !== 1 ||
    countLiteral(source, "gtag('js', new Date());") !== 1 ||
    countLiteral(source, `gtag('config', '${measurementId}');`) !== 1 ||
    countLiteral(source, measurementId) !== 2 ||
    headEnd === -1 ||
    bodyStart === -1 ||
    source.indexOf('<!-- Google tag (gtag.js) -->') > headEnd ||
    source.indexOf('<!-- Google tag (gtag.js) -->') > bodyStart
  ) {
    results.push(siteError('SITE-E005', target, 'Googleタグはhead内に標準構成で1組だけ必要です。'));
  }
  if (isNotFound) {
    if (!source.includes('<meta name="robots" content="noindex">'))
      results.push(siteError('SITE-E005', target, '404.htmlにはnoindexが必要です。'));
    if (/nofollow/.test(source))
      results.push(siteError('SITE-E005', target, '404.htmlへnofollowを設定できません。'));
  } else if (/<meta name="robots"/.test(source)) {
    results.push(siteError('SITE-E005', target, 'index可能ページへrobotsメタを設定できません。'));
  }

  const forbiddenMarkers = [
    '/preview/',
    'example.invalid',
    '架空データ',
    '架空URL',
    '将来の本番画面では',
    'ホスティングは未決定',
    '公開環境は未決定',
    'fictional URL',
    'future production version'
  ];
  for (const marker of forbiddenMarkers) {
    if (source.includes(marker))
      results.push(siteError('SITE-E005', target, `production禁止文言があります: ${marker}`));
  }
  if (/\/(?:ja|en)\/(?:sections\/|organizations\/)/.test(source))
    results.push(siteError('SITE-E005', target, '地域なしの旧URLが生成物へ残っています。'));

  const anchors = anchorElements(source);
  for (const { href, attributes } of anchors.filter(({ href }) => /^https:\/\//.test(href))) {
    if (attributes.target !== '_blank')
      results.push(siteError('SITE-E005', target, `外部リンクにtargetがありません: ${href}`));
    const rel = new Set((attributes.rel ?? '').split(/\s+/).filter(Boolean));
    if (!rel.has('noopener') || !rel.has('noreferrer'))
      results.push(siteError('SITE-E005', target, `外部リンクに安全なrelがありません: ${href}`));
  }

  if (isNotFound) {
    if (
      source.includes('<footer') ||
      Object.values(inputs.uiLocales).some(({ footer }) => source.includes(footer.contact_url))
    )
      results.push(
        siteError('SITE-E005', target, '404.htmlへフッターや問い合わせ導線を追加できません。')
      );
  }
  if (isNotFound && anchors.some(({ href }) => /^https:\/\//.test(href)))
    results.push(siteError('SITE-E005', target, '404.htmlへ外部リンクを含められません。'));
  results.push(...productionSocialHtmlContract(source, file, inputs));
  return results;
}

function internalReferences(source) {
  return [
    ...[...source.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((match) => match[1]),
    ...[...source.matchAll(/<link\b[^>]*href="([^"]+)"/g)].map((match) => match[1]),
    ...[...source.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map((match) => match[1])
  ].filter((value) => value.startsWith('/') && !value.startsWith('//'));
}

function hrefToArtifact(href, inputs) {
  let pathname = href.split(/[?#]/, 1)[0];
  if (/^https:\/\//.test(href)) {
    try {
      const url = new URL(href);
      if (url.origin !== inputs.siteUrl.origin) return undefined;
      pathname = url.pathname;
    } catch {
      return undefined;
    }
  }
  const basePath = inputs.siteUrl.basePath || '';
  if (basePath && pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return undefined;
  const relative = pathname.slice(basePath.length).replace(/^\//, '');
  if (relative === '' || pathname.endsWith('/')) return `${relative}index.html`;
  return relative;
}

function validateSitemap(source, inputs) {
  const results = [];
  const target = outputFile(inputs, 'sitemap.xml');
  if (!source.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n'))
    results.push(siteError('SITE-E005', target, 'sitemap.xmlのXML宣言が不正です。'));
  if (!source.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'))
    results.push(siteError('SITE-E005', target, 'sitemap.xmlのurlset名前空間が不正です。'));
  const urls = [...source.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const expected = productionSitemapUrls(inputs);
  if (JSON.stringify(urls) !== JSON.stringify(expected))
    results.push(siteError('SITE-E005', target, 'sitemap.xmlのURL集合または順序が不正です。'));
  if (urls.some((url) => !url.startsWith('https://')))
    results.push(siteError('SITE-E005', target, 'sitemap.xmlには絶対HTTPS URLだけを使用します。'));
  for (const forbidden of ['404', '/assets/', 'navigation.json', '/preview/', 'example.invalid']) {
    if (source.includes(forbidden))
      results.push(siteError('SITE-E005', target, `sitemap.xmlに禁止対象があります: ${forbidden}`));
  }
  return results;
}

function validateProductionDestinationLinks(htmlByFile, inputs) {
  const results = [];
  for (const locale of SITE_LOCALES) {
    const localizedHtml = [...htmlByFile]
      .filter(([file]) => file.startsWith(`${locale}/`))
      .map(([, source]) => source)
      .join('\n');
    const urls = new Set();
    for (const navigation of Object.values(inputs.regionalNavigations[locale] ?? {}))
      for (const section of navigation.sections)
        for (const card of section.cards)
          for (const link of card.links) urls.add(link.destination.url);
    for (const url of urls) {
      if (!localizedHtml.includes(`href="${escapeHtml(url)}"`))
        results.push(
          siteError(
            'SITE-E005',
            inputs.config.outputRoot,
            `${locale}の案内先URLがリンク化されていません: ${url}`
          )
        );
    }
  }
  return results;
}

export async function validateArtifactsAt(root, inputs, { compareExpected = false } = {}) {
  const results = [];
  const expectedPaths = expectedSiteArtifactPaths(
    inputs.navigations,
    inputs.mode,
    inputs.regionalNavigations
  );
  const expected = new Set(expectedPaths);
  const actualPaths = await collectFiles(root);
  const actual = new Set(actualPaths);
  for (const file of expectedPaths) {
    if (!actual.has(file))
      results.push(siteError('SITE-E004', outputFile(inputs, file), '必須成果物がありません。'));
  }
  for (const file of actualPaths) {
    if (!expected.has(file))
      results.push(
        siteError('SITE-E004', outputFile(inputs, file), '想定外または古い成果物です。')
      );
  }

  const built = compareExpected ? buildSiteArtifacts(inputs) : undefined;
  const htmlByFile = new Map();
  for (const file of actualPaths) {
    let source;
    try {
      const bytes = await readFile(path.join(root, file));
      if (isTextArtifact(file)) {
        try {
          source = utf8Decoder.decode(bytes);
        } catch {
          results.push(
            siteError('SITE-E005', outputFile(inputs, file), 'UTF-8テキストとして読めません。')
          );
          continue;
        }
      } else source = bytes;
    } catch (error) {
      throw new SiteRuntimeError('SITE-RUN-E002', outputFile(inputs, file), error.message, error);
    }
    if (typeof source === 'string' && !source.endsWith('\n'))
      results.push(siteError('SITE-E005', outputFile(inputs, file), '末尾改行がありません。'));
    if (SITE_ICON_PATHS.includes(file)) {
      for (const message of validateSiteIcon(file, source))
        results.push(siteError('SITE-E005', outputFile(inputs, file), message));
    }
    if (file === SITE_OGP_IMAGE_PATH) {
      for (const message of validateOgpImage(source))
        results.push(siteError('SITE-E005', outputFile(inputs, file), message));
    }
    if (file.endsWith('.html') && expected.has(file)) {
      htmlByFile.set(file, source);
      results.push(...htmlBaseContract(source, file, inputs));
      results.push(...localizedContactHtmlContract(source, file, inputs));
      results.push(...privacyHtmlContract(source, file, inputs));
      results.push(
        ...(inputs.mode === 'preview'
          ? previewHtmlContract(source, file, inputs)
          : productionHtmlContract(source, file, inputs))
      );
      results.push(...validateLocalizedHreflang(source, file, inputs, expected));
      for (const href of internalReferences(source)) {
        if (href.includes('//'))
          results.push(
            siteError(
              'SITE-E005',
              outputFile(inputs, file),
              `内部URLに二重スラッシュがあります: ${href}`
            )
          );
        const target = hrefToArtifact(href, inputs);
        if (!target || !expected.has(target))
          results.push(
            siteError('SITE-E005', outputFile(inputs, file), `内部リンク先が存在しません: ${href}`)
          );
      }
    }
    if (inputs.mode === 'production' && file === 'sitemap.xml')
      results.push(...validateSitemap(source, inputs));
    if (compareExpected && !artifactEquals(built.get(file), source))
      results.push(
        siteError(
          'SITE-E006',
          outputFile(inputs, file),
          '再生成結果がGit管理中の成果物とバイト一致しません。'
        )
      );
  }
  if (inputs.mode === 'production')
    results.push(
      ...validateProductionDestinationLinks(htmlByFile, inputs),
      ...validateProductionSocialUrlSet(htmlByFile, inputs)
    );
  return sortResults(results);
}

async function writeMap(root, artifacts) {
  for (const [relative, source] of artifacts) {
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    if (typeof source === 'string') await writeFile(target, source, 'utf8');
    else if (Buffer.isBuffer(source)) await writeFile(target, source);
    else throw new TypeError(`未対応のサイト成果物型です: ${relative}`);
  }
}

export async function writeSiteArtifacts(repoRoot, inputs) {
  const artifacts = buildSiteArtifacts(inputs);
  const siteRoot = path.join(repoRoot, 'dist', 'site');
  const target = path.join(repoRoot, inputs.config.outputRoot);
  let temporaryRoot;
  let backup;
  try {
    await mkdir(siteRoot, { recursive: true });
    temporaryRoot = await mkdtemp(path.join(siteRoot, `.tmp-${inputs.mode}-`));
    await writeMap(temporaryRoot, artifacts);
    const validation = await validateArtifactsAt(temporaryRoot, inputs);
    if (validation.length > 0) return validation;
    backup = await mkdtemp(path.join(siteRoot, `.backup-${inputs.mode}-`));
    await rm(backup, { recursive: true, force: true });
    try {
      await rename(target, backup);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      backup = undefined;
    }
    try {
      await rename(temporaryRoot, target);
      temporaryRoot = undefined;
    } catch (error) {
      if (backup) await rename(backup, target);
      backup = undefined;
      throw error;
    }
    if (backup) await rm(backup, { recursive: true, force: true });
    return [];
  } catch (error) {
    throw new SiteRuntimeError(
      'SITE-RUN-E003',
      inputs.config.outputRoot,
      `サイト成果物を安全に反映できません: ${error.message}`,
      error
    );
  } finally {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
    if (backup) await rm(backup, { recursive: true, force: true });
  }
}

async function validateMode(repoRoot, mode, compareExpected) {
  const inputs = await loadSiteInputs(repoRoot, mode);
  if (inputs.results.length > 0) return inputs.results;
  return validateArtifactsAt(path.join(repoRoot, inputs.config.outputRoot), inputs, {
    compareExpected
  });
}

export async function validateSiteRepository(repoRoot, mode) {
  const modes = mode ? [mode] : ['preview', 'production'];
  const results = [];
  for (const current of modes) results.push(...(await validateMode(repoRoot, current, true)));
  return sortResults(results);
}

export async function verifySiteArtifacts(repoRoot, mode) {
  const modes = mode ? [mode] : ['preview', 'production'];
  const results = [];
  for (const current of modes) {
    const inputs = await loadSiteInputs(repoRoot, current);
    if (inputs.results.length > 0) {
      results.push(...inputs.results);
      continue;
    }
    const repositoryResults = await validateArtifactsAt(
      path.join(repoRoot, inputs.config.outputRoot),
      inputs
    );
    if (repositoryResults.length > 0) {
      results.push(...repositoryResults);
      continue;
    }
    let temporaryRoot;
    try {
      temporaryRoot = await mkdtemp(path.join(os.tmpdir(), `madoguchi-site-${current}-verify-`));
      await writeMap(temporaryRoot, buildSiteArtifacts(inputs));
      results.push(...(await validateArtifactsAt(temporaryRoot, inputs)));
      results.push(
        ...(await validateArtifactsAt(path.join(repoRoot, inputs.config.outputRoot), inputs, {
          compareExpected: true
        }))
      );
    } finally {
      if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
    }
  }
  return sortResults(results);
}
