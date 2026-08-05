import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { SiteRuntimeError } from './site-constants.js';

export function parseProductionBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError('base_urlは有効なURLにしてください。');
  }
  if (url.protocol !== 'https:') throw new TypeError('base_urlはHTTPS URLにしてください。');
  if (url.username || url.password)
    throw new TypeError('base_urlにusernameまたはpasswordを含められません。');
  if (url.search) throw new TypeError('base_urlにqueryを含められません。');
  if (url.hash) throw new TypeError('base_urlにfragmentを含められません。');

  const segments = url.pathname.split('/').filter(Boolean);
  const basePath = segments.length === 0 ? '' : `/${segments.join('/')}`;
  const baseUrl = `${url.origin}${basePath}`;
  return Object.freeze({ baseUrl, origin: url.origin, basePath });
}

export function joinSitePath(basePath, relative = '') {
  const baseSegments = String(basePath ?? '')
    .split('/')
    .filter(Boolean);
  const relativeSegments = String(relative).split('/').filter(Boolean);
  const alreadyPrefixed = baseSegments.every(
    (segment, index) => relativeSegments[index] === segment
  );
  const segments = [
    ...baseSegments,
    ...(alreadyPrefixed ? relativeSegments.slice(baseSegments.length) : relativeSegments)
  ];
  const pathname = `/${segments.join('/')}`;
  const wantsDirectory = relative === '' || String(relative).endsWith('/');
  return wantsDirectory ? `${pathname === '/' ? '' : pathname}/` : pathname;
}

export function absoluteSiteUrl(siteUrl, relative = '') {
  return `${siteUrl.origin}${joinSitePath(siteUrl.basePath, relative)}`;
}

export function baseUrlsMatch(configured, actual) {
  try {
    return parseProductionBaseUrl(configured).baseUrl === parseProductionBaseUrl(actual).baseUrl;
  } catch {
    return false;
  }
}

export function parseProductionSiteConfig(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(['analytics', 'base_url']) ||
    !value.analytics ||
    typeof value.analytics !== 'object' ||
    Array.isArray(value.analytics) ||
    JSON.stringify(Object.keys(value.analytics).sort()) !== JSON.stringify(['measurement_id'])
  ) {
    throw new TypeError(
      'production設定はanalytics.measurement_idとbase_urlだけを持つオブジェクトにしてください。'
    );
  }
  const measurementId = value.analytics.measurement_id;
  if (typeof measurementId !== 'string' || measurementId === '')
    throw new TypeError('analytics.measurement_idは空でない文字列にしてください。');
  if (measurementId.trim() !== measurementId)
    throw new TypeError('analytics.measurement_idの前後に空白を含められません。');
  if (!/^G-[A-Z0-9]+$/.test(measurementId))
    throw new TypeError('analytics.measurement_idはGA4測定ID形式にしてください。');
  return Object.freeze({
    ...parseProductionBaseUrl(value.base_url),
    analytics: Object.freeze({ measurement_id: measurementId })
  });
}

export async function loadProductionSiteConfig(repoRoot, relativePath = 'site/production.json') {
  let source;
  try {
    source = await readFile(path.join(repoRoot, relativePath), 'utf8');
  } catch (error) {
    throw new SiteRuntimeError(
      'SITE-RUN-E002',
      relativePath,
      `production設定を読み込めません: ${error.message}`,
      error
    );
  }
  let value;
  try {
    value = JSON.parse(source);
  } catch (error) {
    throw new SiteRuntimeError(
      'SITE-RUN-E002',
      relativePath,
      `production設定のJSON構文が不正です: ${error.message}`,
      error
    );
  }
  try {
    return parseProductionSiteConfig(value);
  } catch (error) {
    throw new SiteRuntimeError('SITE-RUN-E002', relativePath, error.message, error);
  }
}

export async function loadProductionSiteUrl(repoRoot, relativePath = 'site/production.json') {
  return loadProductionSiteConfig(repoRoot, relativePath);
}
