import { isIP } from 'node:net';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createResult, sortResults } from '../validation/result.js';
import { compileSchema } from '../validation/schema-validator.js';
import {
  ARTIFACT_TYPES,
  FORBIDDEN_PUBLIC_KEYS,
  PUBLIC_ARTIFACT_PATHS,
  PUBLIC_SCHEMA_PATH,
  NATIONAL_PUBLIC_SCHEMA_PATH,
  REGIONAL_PUBLIC_SCHEMA_PATH,
  PublicRuntimeError
} from './public-constants.js';

function publicError(code, file, message, field) {
  return createResult({
    severity: 'error',
    code,
    file,
    message,
    ...(field ? { field } : {}),
    suggested_action: '公開契約と生成処理を確認し、管理データから再生成してください。'
  });
}

export async function loadPublicSchema(repoRoot) {
  let source;
  try {
    source = await readFile(path.join(repoRoot, PUBLIC_SCHEMA_PATH), 'utf8');
    const schema = JSON.parse(source);
    return { schema, validate: compileSchema(schema, { schemaFile: PUBLIC_SCHEMA_PATH }) };
  } catch (error) {
    throw new PublicRuntimeError(
      'PUB-RUN-E002',
      PUBLIC_SCHEMA_PATH,
      `公開Schemaを読み込めません: ${error.message}`,
      error
    );
  }
}

async function loadSchema(repoRoot, schemaPath) {
  try {
    const schema = JSON.parse(await readFile(path.join(repoRoot, schemaPath), 'utf8'));
    return { schema, validate: compileSchema(schema, { schemaFile: schemaPath }) };
  } catch (error) {
    throw new PublicRuntimeError(
      'PUB-RUN-E002',
      schemaPath,
      `公開Schemaを読み込めません: ${error.message}`,
      error
    );
  }
}

export async function loadPublicSchemas(repoRoot) {
  const [legacy, national, regional] = await Promise.all([
    loadSchema(repoRoot, PUBLIC_SCHEMA_PATH),
    loadSchema(repoRoot, NATIONAL_PUBLIC_SCHEMA_PATH),
    loadSchema(repoRoot, REGIONAL_PUBLIC_SCHEMA_PATH)
  ]);
  return { legacy, national, regional };
}

function collectForbiddenKeys(value, currentPath = '$', findings = []) {
  if (!value || typeof value !== 'object') return findings;
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectForbiddenKeys(item, `${currentPath}[${index}]`, findings)
    );
    return findings;
  }
  for (const [key, nested] of Object.entries(value)) {
    const nestedPath = `${currentPath}.${key}`;
    if (FORBIDDEN_PUBLIC_KEYS.has(key)) findings.push(nestedPath);
    collectForbiddenKeys(nested, nestedPath, findings);
  }
  return findings;
}

function ipv4IsForbidden(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function ipv6IsForbidden(address) {
  const normalized = address.toLowerCase();
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/.test(normalized) ||
    (normalized.startsWith('::ffff:') && ipv4IsForbidden(normalized.slice(7)))
  );
}

export function validatePublicUrl(value, { artifactType }) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return '有効なURLではありません。';
  }
  if (url.protocol !== 'https:') return 'HTTPS URLではありません。';
  if (url.username || url.password) return 'URLにユーザー名またはパスワードを含められません。';
  if (url.hash) return 'URLにfragmentを含められません。';
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost'))
    return 'localhostは使用できません。';
  const ipVersion = isIP(hostname);
  if (
    (ipVersion === 4 && ipv4IsForbidden(hostname)) ||
    (ipVersion === 6 && ipv6IsForbidden(hostname))
  ) {
    return 'loopback、private、またはlink-local IPは使用できません。';
  }
  if (artifactType === 'production' && (hostname === 'invalid' || hostname.endsWith('.invalid'))) {
    return 'production成果物では.invalidドメインを使用できません。';
  }
  return undefined;
}

function collectUrls(value, currentPath = '$', findings = []) {
  if (!value || typeof value !== 'object') return findings;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectUrls(item, `${currentPath}[${index}]`, findings));
    return findings;
  }
  for (const [key, nested] of Object.entries(value)) {
    const nestedPath = `${currentPath}.${key}`;
    if ((key === 'url' || key.endsWith('_url')) && typeof nested === 'string') {
      findings.push([nestedPath, nested]);
    }
    collectUrls(nested, nestedPath, findings);
  }
  return findings;
}

function canonicalLocaleOrder(locales) {
  return (
    JSON.stringify(locales) ===
    JSON.stringify(['ja', 'en'].filter((value) => locales.includes(value)))
  );
}

export function validatePublicArtifact(
  artifact,
  {
    validateSchema,
    validateNationalSchema,
    validateRegionalSchema,
    file,
    expectedMode,
    expectedLocale
  }
) {
  const results = [];
  const selectedSchema =
    artifact?.artifact_scope === 'national'
      ? (validateNationalSchema ?? validateSchema)
      : artifact?.artifact_scope === 'region'
        ? (validateRegionalSchema ?? validateSchema)
        : validateSchema;
  if (!selectedSchema(artifact)) {
    for (const error of selectedSchema.errors ?? []) {
      results.push(
        publicError(
          'PUB-E004',
          file,
          `${error.instancePath || '/'} [${error.keyword}] ${error.message}`,
          error.instancePath.replace(/^\//, '').replaceAll('/', '.') || undefined
        )
      );
    }
  }
  const expectedType = ARTIFACT_TYPES[expectedMode];
  if (artifact?.artifact_type !== expectedType) {
    results.push(
      publicError('PUB-E004', file, 'artifact_typeが出力パスと一致しません。', 'artifact_type')
    );
  }
  if (artifact?.locale !== expectedLocale) {
    results.push(publicError('PUB-E004', file, 'localeが出力パスと一致しません。', 'locale'));
  }
  if (artifact?.artifact_scope === 'national' && artifact.locale) {
    for (const entry of artifact.regions ?? []) {
      if (entry.path !== `/${artifact.locale}/regions/${entry.region_slug}/`)
        results.push(
          publicError(
            'PUB-E004',
            file,
            '全国トップのregion pathが共通URL規則と一致しません。',
            'regions.path'
          )
        );
    }
  }
  if (
    artifact?.artifact_scope === 'region' &&
    artifact.region?.path !== `/${artifact.locale}/regions/${artifact.region.region_slug}/`
  ) {
    results.push(
      publicError(
        'PUB-E004',
        file,
        '地域成果物のregion pathが共通URL規則と一致しません。',
        'region.path'
      )
    );
  }
  for (const forbiddenPath of collectForbiddenKeys(artifact)) {
    results.push(
      publicError('PUB-E005', file, `禁止項目が混入しています: ${forbiddenPath}`, forbiddenPath)
    );
  }
  for (const [urlPath, value] of collectUrls(artifact)) {
    const message = validatePublicUrl(value, { artifactType: artifact?.artifact_type });
    if (message) results.push(publicError('PUB-E004', file, message, urlPath));
  }
  if (
    Array.isArray(artifact?.site?.supported_locales) &&
    !canonicalLocaleOrder(artifact.site.supported_locales)
  ) {
    results.push(
      publicError(
        'PUB-E004',
        file,
        'supported_localesの順序が決定論的ではありません。',
        'site.supported_locales'
      )
    );
  }
  for (const section of artifact?.sections ?? []) {
    for (const card of section.cards ?? []) {
      if (!(card.links ?? []).some(({ role }) => role === 'primary')) {
        results.push(
          publicError('PUB-E004', file, 'cardにprimary関連がありません。', 'sections.cards.links')
        );
      }
      for (const link of card.links ?? []) {
        const locales = link.destination?.destination_locales;
        if (Array.isArray(locales) && !canonicalLocaleOrder(locales)) {
          results.push(
            publicError(
              'PUB-E004',
              file,
              'destination_localesの順序が決定論的ではありません。',
              'destination_locales'
            )
          );
        }
      }
    }
  }
  return sortResults(results);
}

export function expectedArtifactPath(mode, locale) {
  return PUBLIC_ARTIFACT_PATHS[mode]?.[locale];
}
