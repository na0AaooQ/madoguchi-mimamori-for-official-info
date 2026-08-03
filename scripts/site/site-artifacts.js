import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createResult, sortResults } from '../validation/result.js';
import {
  buildSiteArtifacts,
  expectedSiteArtifactPaths,
  productionSitemapUrls
} from './site-builder.js';
import { SITE_GENERATOR_NAME, SITE_LOCALES, SiteRuntimeError } from './site-constants.js';
import { loadSiteInputs } from './site-input-loader.js';

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

function previewHtmlContract(source, file, inputs) {
  const results = [];
  const target = outputFile(inputs, file);
  const locale = file.split('/')[0];
  const ui = inputs.uiLocales[locale];
  if (!source.includes('<meta name="robots" content="noindex, nofollow, noarchive">'))
    results.push(siteError('SITE-E005', target, 'previewのrobotsメタ情報がありません。'));
  if (!source.includes(ui.preview_notice.title))
    results.push(siteError('SITE-E005', target, '架空preview注意がありません。'));
  if (/<a\b[^>]*href="https?:\/\/(?!portfolio\.na0aaooq\.com\/)/i.test(source))
    results.push(siteError('SITE-E005', target, 'previewに許可されていない外部リンクがあります。'));
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

function anchorAttributes(source) {
  return [...source.matchAll(/<a\b([^>]*)href="([^"]+)"([^>]*)>/g)].map((match) => ({
    href: match[2],
    attributes: `${match[1]} ${match[3]}`
  }));
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

  const anchors = anchorAttributes(source);
  for (const { href, attributes } of anchors.filter(({ href }) => /^https:\/\//.test(href))) {
    if (!/\btarget="_blank"/.test(attributes))
      results.push(siteError('SITE-E005', target, `外部リンクにtargetがありません: ${href}`));
    if (!/\brel="noopener noreferrer"/.test(attributes))
      results.push(siteError('SITE-E005', target, `外部リンクに安全なrelがありません: ${href}`));
  }

  if (/^(?:ja|en)\//.test(file)) {
    const locale = file.split('/')[0];
    const expectedContact = inputs.navigations[locale].site.contact_url;
    const otherLocale = locale === 'ja' ? 'en' : 'ja';
    const wrongContact = inputs.navigations[otherLocale].site.contact_url;
    if (!source.includes(`href="${expectedContact}"`))
      results.push(siteError('SITE-E005', target, '言語別問い合わせリンクがありません。'));
    if (wrongContact !== expectedContact && source.includes(wrongContact))
      results.push(siteError('SITE-E005', target, '別言語の問い合わせURLが混入しています。'));
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
      source = await readFile(path.join(root, file), 'utf8');
    } catch (error) {
      throw new SiteRuntimeError('SITE-RUN-E002', outputFile(inputs, file), error.message, error);
    }
    if (!source.endsWith('\n'))
      results.push(siteError('SITE-E005', outputFile(inputs, file), '末尾改行がありません。'));
    if (file.endsWith('.html') && expected.has(file)) {
      htmlByFile.set(file, source);
      results.push(...htmlBaseContract(source, file, inputs));
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
    if (compareExpected && built.get(file) !== source)
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
    await writeFile(target, source, 'utf8');
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
