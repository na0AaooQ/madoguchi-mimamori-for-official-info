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
  SiteRuntimeError
} from './site-constants.js';
import { validateSiteIcon } from './site-icon-validator.js';
import { loadSiteInputs } from './site-input-loader.js';
import { joinSitePath } from './site-url.js';

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

  const localizedPage = /^(?:ja|en)\//.test(file);
  if (localizedPage) {
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
  for (const navigation of Object.values(inputs.navigations)) {
    for (const section of navigation.sections) {
      for (const card of section.cards) {
        for (const link of card.links) {
          if (source.includes(`href="${link.destination.url}"`))
            results.push(siteError('SITE-E005', target, '架空の案内先URLがリンク化されています。'));
        }
      }
    }
    if (source.includes(`href="${navigation.site.contact_url}"`))
      results.push(siteError('SITE-E005', target, '架空の問い合わせURLがリンク化されています。'));
  }
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

  const anchors = anchorElements(source);
  for (const { href, attributes } of anchors.filter(({ href }) => /^https:\/\//.test(href))) {
    if (attributes.target !== '_blank')
      results.push(siteError('SITE-E005', target, `外部リンクにtargetがありません: ${href}`));
    const rel = new Set((attributes.rel ?? '').split(/\s+/).filter(Boolean));
    if (!rel.has('noopener') || !rel.has('noreferrer'))
      results.push(siteError('SITE-E005', target, `外部リンクに安全なrelがありません: ${href}`));
  }

  const localizedPage = /^(?:ja|en)\//.test(file);
  if (!localizedPage) {
    if (
      source.includes('<footer') ||
      Object.values(inputs.uiLocales).some(({ footer }) => source.includes(footer.contact_url))
    )
      results.push(
        siteError(
          'SITE-E005',
          target,
          'ルート言語選択ページと404ページへ問い合わせ導線を追加できません。'
        )
      );
  }
  if (isNotFound && anchors.some(({ href }) => /^https:\/\//.test(href)))
    results.push(siteError('SITE-E005', target, '404.htmlへ外部リンクを含められません。'));
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
  const pathname = href.split(/[?#]/, 1)[0];
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
    for (const section of inputs.navigations[locale].sections)
      for (const card of section.cards)
        for (const link of card.links) urls.add(link.destination.url);
    for (const url of urls) {
      if (!localizedHtml.includes(`href="${url}"`))
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
  const expectedPaths = expectedSiteArtifactPaths(inputs.navigations, inputs.mode);
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
    results.push(...validateProductionDestinationLinks(htmlByFile, inputs));
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
