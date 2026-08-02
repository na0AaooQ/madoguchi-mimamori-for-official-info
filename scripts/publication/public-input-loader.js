import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { validateDataRepository } from '../validation/data-validator.js';
import { validateNavigationCardData } from '../validation/navigation-card-semantic-validator.js';
import { validateOfficialSourceData } from '../validation/official-source-semantic-validator.js';
import { createResult, sortResults } from '../validation/result.js';
import { compileSchema, normalizeAjvErrors } from '../validation/schema-validator.js';
import { validateSiteData } from '../validation/semantic-validator.js';
import { PREVIEW_FIXTURE_ROOT, PublicRuntimeError } from './public-constants.js';

const INPUT_UNITS = Object.freeze([
  ['regions', 'regions'],
  ['organizations', 'organizations'],
  ['sources', 'sources'],
  ['evidence', 'evidence'],
  ['sections', 'sections'],
  ['cards', 'cards'],
  ['cardSourceLinks', 'card-source-links']
]);

function relativePath(...parts) {
  return path
    .join(...parts)
    .split(path.sep)
    .join('/');
}

async function readJson(repoRoot, file, { contentSyntaxError = false } = {}) {
  let source;
  try {
    source = await readFile(path.join(repoRoot, file), 'utf8');
  } catch (error) {
    throw new PublicRuntimeError(
      'PUB-RUN-E002',
      file,
      `入力JSONを読み込めません: ${error.message}`,
      error
    );
  }
  try {
    return { value: JSON.parse(source), results: [] };
  } catch (error) {
    if (!contentSyntaxError) {
      throw new PublicRuntimeError(
        'PUB-RUN-E002',
        file,
        `JSON構文が不正です: ${error.message}`,
        error
      );
    }
    return {
      value: undefined,
      results: [
        createResult({
          severity: 'error',
          code: 'E001',
          file,
          message: `JSON構文が不正です: ${error.message}`,
          suggested_action: 'JSON構文を修正してください。'
        })
      ]
    };
  }
}

async function readManagementSchemas(repoRoot) {
  const entries = [
    ['site.core', 'schemas/core/site.schema.json'],
    ['site.locale', 'schemas/locales/site.schema.json']
  ];
  for (const [key, fileName] of INPUT_UNITS) {
    entries.push([`core.${key}`, `schemas/core/${fileName}.schema.json`]);
    entries.push([`locale.${key}`, `schemas/locales/${fileName}.schema.json`]);
  }
  const validators = new Map();
  for (const [key, schemaPath] of entries) {
    const { value } = await readJson(repoRoot, schemaPath);
    try {
      validators.set(key, compileSchema(value, { schemaFile: schemaPath }));
    } catch (error) {
      throw new PublicRuntimeError('PUB-RUN-E002', schemaPath, error.message, error);
    }
  }
  return validators;
}

function envelopeItems(value) {
  return Array.isArray(value?.items) ? value.items : [];
}

export function normalizeManagementInput(raw) {
  const root = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const coreRoot = root.core ?? {};
  const localesRoot = root.locales ?? {};
  return {
    site: {
      core: root.site?.core,
      locales: { ja: root.site?.locales?.ja, en: root.site?.locales?.en }
    },
    core: Object.fromEntries(INPUT_UNITS.map(([key]) => [key, envelopeItems(coreRoot[key])])),
    locales: Object.fromEntries(
      ['ja', 'en'].map((locale) => [
        locale,
        Object.fromEntries(
          INPUT_UNITS.map(([key]) => [key, envelopeItems(localesRoot[locale]?.[key])])
        )
      ])
    )
  };
}

async function validateManagementInput(repoRoot, raw, file) {
  const validators = await readManagementSchemas(repoRoot);
  const targets = [
    ['site.core', raw?.site?.core],
    ['site.locale', raw?.site?.locales?.ja],
    ['site.locale', raw?.site?.locales?.en]
  ];
  for (const [key] of INPUT_UNITS) {
    targets.push([`core.${key}`, raw?.core?.[key]]);
    targets.push([`locale.${key}`, raw?.locales?.ja?.[key]]);
    targets.push([`locale.${key}`, raw?.locales?.en?.[key]]);
  }
  const results = [];
  for (const [key, value] of targets) {
    const validate = validators.get(key);
    if (!validate(value)) {
      results.push(...normalizeAjvErrors(validate.errors, { file }));
    }
  }
  if (results.length > 0) return sortResults(results);

  const input = normalizeManagementInput(raw);
  results.push(
    ...validateSiteData(
      {
        core: input.site.core,
        ja: input.site.locales.ja,
        en: input.site.locales.en
      },
      { files: { core: file, ja: file, en: file } }
    )
  );
  const files = {
    core: Object.fromEntries(INPUT_UNITS.map(([key]) => [key, file])),
    locales: {
      ja: Object.fromEntries(INPUT_UNITS.map(([key]) => [key, file])),
      en: Object.fromEntries(INPUT_UNITS.map(([key]) => [key, file]))
    }
  };
  results.push(...validateOfficialSourceData(input, { files }));
  results.push(...validateNavigationCardData(input, { files }));
  return sortResults(results);
}

async function readProductionRaw(repoRoot) {
  const raw = { site: { locales: {} }, core: {}, locales: { ja: {}, en: {} } };
  raw.site.core = (await readJson(repoRoot, 'data/core/site.json')).value;
  for (const locale of ['ja', 'en']) {
    raw.site.locales[locale] = (await readJson(repoRoot, `data/locales/${locale}/site.json`)).value;
  }
  for (const [key, fileName] of INPUT_UNITS) {
    raw.core[key] = (await readJson(repoRoot, `data/core/${fileName}.json`)).value;
    for (const locale of ['ja', 'en']) {
      raw.locales[locale][key] = (
        await readJson(repoRoot, `data/locales/${locale}/${fileName}.json`)
      ).value;
    }
  }
  return raw;
}

export async function loadProductionInput(repoRoot) {
  const validation = await validateDataRepository(repoRoot);
  if (validation.runtimeResults.length > 0) {
    throw new PublicRuntimeError(
      'PUB-RUN-E002',
      validation.runtimeResults[0].file,
      '本番用管理データの検証基盤を実行できません。'
    );
  }
  const hasErrors = validation.results.some(({ severity }) => severity === 'error');
  if (hasErrors) return { input: undefined, results: validation.results };
  const raw = await readProductionRaw(repoRoot);
  return { input: normalizeManagementInput(raw), results: validation.results };
}

export async function loadPreviewInput(repoRoot) {
  const manifestPath = relativePath(PREVIEW_FIXTURE_ROOT, 'manifest.json');
  const inputPath = relativePath(PREVIEW_FIXTURE_ROOT, 'input.json');
  const [{ value: manifest }, inputRead] = await Promise.all([
    readJson(repoRoot, manifestPath),
    readJson(repoRoot, inputPath, { contentSyntaxError: true })
  ]);
  if (
    manifest?.fixture_id !== 'minimum-published-navigation' ||
    manifest?.artifact_type !== 'fictional-preview' ||
    manifest?.as_of !== '2026-08-02'
  ) {
    throw new PublicRuntimeError(
      'PUB-RUN-E002',
      manifestPath,
      'preview manifestのfixture_id、artifact_type、as_ofが不正です。'
    );
  }
  if (inputRead.results.length > 0) {
    return { input: undefined, manifest, results: inputRead.results };
  }
  const results = await validateManagementInput(repoRoot, inputRead.value, inputPath);
  return {
    input: results.some(({ severity }) => severity === 'error')
      ? undefined
      : normalizeManagementInput(inputRead.value),
    manifest,
    results
  };
}

export async function readProductionSiteState(repoRoot) {
  return (await readJson(repoRoot, 'data/core/site.json')).value?.site_publication_status;
}
