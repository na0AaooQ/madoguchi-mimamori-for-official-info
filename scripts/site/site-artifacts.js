import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createResult, sortResults } from '../validation/result.js';
import { buildSiteArtifacts, escapeHtml, expectedSiteArtifactPaths } from './site-builder.js';
import { SITE_GENERATOR_NAME, SITE_OUTPUT_ROOT, SiteRuntimeError } from './site-constants.js';
import { loadSiteInputs } from './site-input-loader.js';

function siteError(code, file, message) {
  return createResult({
    severity: 'error',
    code,
    file,
    message,
    suggested_action: '生成元を修正し、previewサイトを再生成してください。'
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

function htmlContractResults(source, file, inputs) {
  const results = [];
  const locale = file.split('/')[0];
  const ui = inputs.uiLocales[locale];
  const requiredPatterns = [
    [/<html lang="(?:ja|en)"/, 'htmlのlangがありません。'],
    [/<meta name="robots" content="noindex, nofollow, noarchive">/, 'robotsメタ情報がありません。'],
    [
      new RegExp(`<meta name="generator" content="${SITE_GENERATOR_NAME}">`),
      '生成元メタ情報がありません。'
    ],
    [/<header[ >]/, 'headerランドマークがありません。'],
    [/<nav[ >]/, 'navランドマークがありません。'],
    [/<main id="main-content">/, 'mainランドマークがありません。'],
    [/<footer[ >]/, 'footerランドマークがありません。'],
    [/<a class="skip-link" href="#main-content">/, '本文へのスキップリンクがありません。'],
    [
      new RegExp(ui.preview_notice.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      '架空preview注意がありません。'
    ]
  ];
  for (const [pattern, message] of requiredPatterns) {
    if (!pattern.test(source))
      results.push(siteError('SITE-E005', `${SITE_OUTPUT_ROOT}/${file}`, message));
  }
  if (count(source, /<h1(?:\s|>)/g) !== 1)
    results.push(siteError('SITE-E005', `${SITE_OUTPUT_ROOT}/${file}`, 'h1は1つ必要です。'));
  const externalAnchors = [...source.matchAll(/<a\b[^>]*href="https?:\/\/[^"]+"[^>]*>/gi)].map(
    (match) => match[0]
  );
  const expectedOperatorAnchor =
    file === `${locale}/privacy/index.html`
      ? `<a href="${escapeHtml(ui.privacy.operator_url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(ui.privacy.operator_link_label)}">`
      : undefined;
  if (
    expectedOperatorAnchor
      ? externalAnchors.length !== 1 || externalAnchors[0] !== expectedOperatorAnchor
      : externalAnchors.length !== 0
  )
    results.push(
      siteError(
        'SITE-E005',
        `${SITE_OUTPUT_ROOT}/${file}`,
        'previewに許可されていない外部URLのa[href]があります。'
      )
    );
  if (/tabindex="[1-9][0-9]*"/.test(source))
    results.push(siteError('SITE-E005', `${SITE_OUTPUT_ROOT}/${file}`, '正のtabindexがあります。'));
  if (count(source, /target="_blank"/g) !== (expectedOperatorAnchor ? 1 : 0))
    results.push(
      siteError(
        'SITE-E005',
        `${SITE_OUTPUT_ROOT}/${file}`,
        '許可されていないtarget="_blank"があります。'
      )
    );
  if (/<details\s+open/.test(source))
    results.push(
      siteError('SITE-E005', `${SITE_OUTPUT_ROOT}/${file}`, 'detailsは初期状態を閉じてください。')
    );
  if (/<summary[^>]*role=/.test(source))
    results.push(
      siteError('SITE-E005', `${SITE_OUTPUT_ROOT}/${file}`, 'summaryへ独自roleを付けられません。')
    );
  if (
    !/data-text-size="standard" aria-pressed="true"/.test(source) ||
    !/data-text-size="large" aria-pressed="false"/.test(source)
  )
    results.push(
      siteError(
        'SITE-E005',
        `${SITE_OUTPUT_ROOT}/${file}`,
        '文字サイズボタンの初期aria-pressedが不正です。'
      )
    );
  for (const forbidden of ['evidence', 'internal_note', 'display_order', 'publication_status']) {
    if (source.includes(forbidden))
      results.push(
        siteError(
          'SITE-E005',
          `${SITE_OUTPUT_ROOT}/${file}`,
          `公開対象外の文字列が含まれます: ${forbidden}`
        )
      );
  }
  return results;
}

function internalTargets(source) {
  return [...source.matchAll(/<a\b[^>]*href="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((href) => href.startsWith('/preview/'));
}

function hrefToArtifact(href) {
  const pathname = href.split(/[?#]/, 1)[0];
  if (!pathname.startsWith('/preview/')) return undefined;
  const relative = pathname.slice('/preview/'.length);
  if (relative.endsWith('/')) return `${relative}index.html`;
  return relative;
}

export async function validateArtifactsAt(root, inputs, { compareExpected = false } = {}) {
  const results = [];
  const expectedPaths = expectedSiteArtifactPaths(inputs.navigations);
  const expected = new Set(expectedPaths);
  const actualPaths = await collectFiles(root);
  const actual = new Set(actualPaths);
  for (const file of expectedPaths)
    if (!actual.has(file))
      results.push(
        siteError('SITE-E004', `${SITE_OUTPUT_ROOT}/${file}`, '必須成果物がありません。')
      );
  for (const file of actualPaths)
    if (!expected.has(file))
      results.push(
        siteError('SITE-E004', `${SITE_OUTPUT_ROOT}/${file}`, '想定外または古い成果物です。')
      );

  const built = compareExpected ? buildSiteArtifacts(inputs) : undefined;
  for (const file of actualPaths) {
    let source;
    try {
      source = await readFile(path.join(root, file), 'utf8');
    } catch (error) {
      throw new SiteRuntimeError(
        'SITE-RUN-E002',
        `${SITE_OUTPUT_ROOT}/${file}`,
        error.message,
        error
      );
    }
    if (!source.endsWith('\n'))
      results.push(
        siteError('SITE-E005', `${SITE_OUTPUT_ROOT}/${file}`, 'ファイル末尾に改行がありません。')
      );
    if (file.endsWith('.html') && expected.has(file)) {
      results.push(...htmlContractResults(source, file, inputs));
      for (const href of internalTargets(source)) {
        const target = hrefToArtifact(href);
        if (target && !expected.has(target))
          results.push(
            siteError(
              'SITE-E005',
              `${SITE_OUTPUT_ROOT}/${file}`,
              `内部リンク先が存在しません: ${href}`
            )
          );
      }
    }
    if (compareExpected && built.get(file) !== source)
      results.push(
        siteError(
          'SITE-E006',
          `${SITE_OUTPUT_ROOT}/${file}`,
          '再生成結果がGit管理中の成果物とバイト一致しません。'
        )
      );
  }
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
  const target = path.join(repoRoot, SITE_OUTPUT_ROOT);
  let temporaryRoot;
  let backup;
  try {
    await mkdir(siteRoot, { recursive: true });
    temporaryRoot = await mkdtemp(path.join(siteRoot, '.tmp-preview-'));
    await writeMap(temporaryRoot, artifacts);
    const validation = await validateArtifactsAt(temporaryRoot, inputs);
    if (validation.length > 0) return validation;
    backup = await mkdtemp(path.join(siteRoot, '.backup-preview-'));
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
      SITE_OUTPUT_ROOT,
      `サイト成果物を安全に反映できません: ${error.message}`,
      error
    );
  } finally {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
    if (backup) await rm(backup, { recursive: true, force: true });
  }
}

export async function validateSiteRepository(repoRoot) {
  const inputs = await loadSiteInputs(repoRoot);
  if (inputs.results.length > 0) return inputs.results;
  return validateArtifactsAt(path.join(repoRoot, SITE_OUTPUT_ROOT), inputs, {
    compareExpected: true
  });
}

export async function verifySiteArtifacts(repoRoot) {
  const inputs = await loadSiteInputs(repoRoot);
  if (inputs.results.length > 0) return inputs.results;
  const repositoryResults = await validateArtifactsAt(
    path.join(repoRoot, SITE_OUTPUT_ROOT),
    inputs
  );
  if (repositoryResults.length > 0) return repositoryResults;
  let temporaryRoot;
  try {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'madoguchi-site-verify-'));
    await writeMap(temporaryRoot, buildSiteArtifacts(inputs));
    const temporaryResults = await validateArtifactsAt(temporaryRoot, inputs);
    if (temporaryResults.length > 0) return temporaryResults;
    return validateArtifactsAt(path.join(repoRoot, SITE_OUTPUT_ROOT), inputs, {
      compareExpected: true
    });
  } finally {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
  }
}
