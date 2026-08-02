import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

import {
  CORE_DATA_LAYOUT,
  DATA_LAYOUT,
  EMPTY_DATA_LAYOUT,
  IMPLEMENTED_ARRAY_DATA_LAYOUT,
  LOCALE_DATA_LAYOUT,
  SCHEMA_LAYOUT,
  SITE_DATA_LAYOUT,
  SUPPORTED_LOCALES
} from './data-layout.js';
import { createResult, sortResults } from './result.js';
import { compileSchema, normalizeAjvErrors } from './schema-validator.js';
import { validateOfficialSourceData } from './official-source-semantic-validator.js';
import { validateSiteData } from './semantic-validator.js';

const FORBIDDEN_DATA_PATHS = new Set([
  'data/locales/ja/check-history.json',
  'data/locales/en/check-history.json'
]);
const FORBIDDEN_SCHEMA_PATH = 'schemas/locales/check-history.schema.json';

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function runtimeResult({ code, file, message }) {
  return createResult({
    severity: 'error',
    code,
    file,
    message,
    suggested_action: '検証基盤のSchema、配置対応表、または読込環境を修正してください。'
  });
}

function layoutRuntimeResults() {
  const results = [];
  const dataPaths = DATA_LAYOUT.map(({ dataPath }) => dataPath);
  const schemaPaths = SCHEMA_LAYOUT.map(({ schemaPath }) => schemaPath);
  const mappedSchemaPaths = new Set(DATA_LAYOUT.map(({ schemaPath }) => schemaPath));

  const checks = [
    [CORE_DATA_LAYOUT.length === 14, 'coreデータ管理単位は14件である必要があります。'],
    [
      LOCALE_DATA_LAYOUT.length === 26,
      'localeデータ管理単位は日本語13件・英語13件である必要があります。'
    ],
    [DATA_LAYOUT.length === 40, 'データ配置対応表は40件である必要があります。'],
    [SCHEMA_LAYOUT.length === 27, 'Schema配置対応表は27件である必要があります。'],
    [SITE_DATA_LAYOUT.length === 3, 'siteデータ配置対応表は3件である必要があります。'],
    [
      IMPLEMENTED_ARRAY_DATA_LAYOUT.length === 12,
      '実装済み配列データ配置対応表は12件である必要があります。'
    ],
    [EMPTY_DATA_LAYOUT.length === 25, '空データ配置対応表は25件である必要があります。'],
    [new Set(dataPaths).size === dataPaths.length, 'データファイル対応表に重複があります。'],
    [new Set(schemaPaths).size === schemaPaths.length, 'Schema対応表に重複があります。'],
    [
      mappedSchemaPaths.size === schemaPaths.length &&
        schemaPaths.every((schemaPath) => mappedSchemaPaths.has(schemaPath)),
      'データファイルに対応しないSchema、またはSchemaのないデータファイルがあります。'
    ]
  ];

  for (const [valid, message] of checks) {
    if (!valid) {
      results.push(
        runtimeResult({
          code: 'RUN-E005',
          file: 'scripts/validation/data-layout.js',
          message
        })
      );
    }
  }
  return results;
}

async function directoryState(repoRoot, relativePath, runtimeResults) {
  try {
    const target = await stat(path.join(repoRoot, relativePath));
    return target.isDirectory();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    runtimeResults.push(
      runtimeResult({
        code: 'RUN-E005',
        file: relativePath,
        message: `ディレクトリを確認できません: ${error.message}`
      })
    );
    return false;
  }
}

async function collectJsonFiles(directory, repoRoot, runtimeResults) {
  const files = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    runtimeResults.push(
      runtimeResult({
        code: 'RUN-E005',
        file: normalizePath(path.relative(repoRoot, directory)),
        message: `JSONファイル一覧を読み込めません: ${error.message}`
      })
    );
    return files;
  }

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJsonFiles(absolutePath, repoRoot, runtimeResults)));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(normalizePath(path.relative(repoRoot, absolutePath)));
    }
  }
  return files.sort();
}

async function collectUnsupportedLocales(repoRoot, runtimeResults) {
  const localesRoot = path.join(repoRoot, 'data', 'locales');
  let entries;
  try {
    entries = await readdir(localesRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      runtimeResults.push(
        runtimeResult({
          code: 'RUN-E005',
          file: 'data/locales',
          message: `localeディレクトリを読み込めません: ${error.message}`
        })
      );
    }
    return [];
  }
  return entries
    .filter((entry) => entry.isDirectory() && !SUPPORTED_LOCALES.includes(entry.name))
    .map(({ name }) => name)
    .sort();
}

async function readJson(repoRoot, relativePath, { schema, results, runtimeResults }) {
  let source;
  try {
    source = await readFile(path.join(repoRoot, relativePath), 'utf8');
  } catch (error) {
    runtimeResults.push(
      runtimeResult({
        code: schema ? 'RUN-E002' : 'RUN-E005',
        file: relativePath,
        message: `JSONファイルを読み込めません: ${error.message}`
      })
    );
    return undefined;
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    const target = schema ? runtimeResults : results;
    target.push(
      schema
        ? runtimeResult({
            code: 'RUN-E002',
            file: relativePath,
            message: `SchemaのJSON構文が不正です: ${error.message}`
          })
        : createResult({
            severity: 'error',
            code: 'E001',
            file: relativePath,
            message: `JSON構文が不正です: ${error.message}`,
            suggested_action: 'JSON構文を修正してください。'
          })
    );
    return undefined;
  }
}

function validateSchemaIds(schemas, runtimeResults) {
  const byId = new Map();
  for (const [schemaPath, schema] of [...schemas.entries()].sort()) {
    if (typeof schema?.$id !== 'string' || schema.$id.length === 0) {
      runtimeResults.push(
        runtimeResult({
          code: 'RUN-E003',
          file: schemaPath,
          message: 'Schemaの$idがありません。'
        })
      );
      continue;
    }
    const previous = byId.get(schema.$id);
    if (previous) {
      runtimeResults.push(
        runtimeResult({
          code: 'RUN-E003',
          file: schemaPath,
          message: `Schemaの$idが重複しています: ${schema.$id}（${previous}）`
        })
      );
    } else {
      byId.set(schema.$id, schemaPath);
    }
  }
}

function compileSchemas(schemas, runtimeResults) {
  const compiled = new Map();
  for (const [schemaPath, schema] of [...schemas.entries()].sort()) {
    try {
      compiled.set(schemaPath, compileSchema(schema, { schemaFile: schemaPath }));
    } catch (error) {
      runtimeResults.push(
        runtimeResult({
          code: 'RUN-E004',
          file: schemaPath,
          message: error.message
        })
      );
    }
  }
  return compiled;
}

function validateDataFiles(data, compiledSchemas, results) {
  for (const entry of DATA_LAYOUT) {
    const value = data.get(entry.dataPath);
    const validate = compiledSchemas.get(entry.schemaPath);
    if (value === undefined || !validate) continue;
    if (!validate(value)) {
      results.push(
        ...normalizeAjvErrors(validate.errors, {
          schemaFile: entry.schemaPath,
          file: entry.dataPath
        })
      );
    }
  }
}

export async function validateDataRepository(repoRoot) {
  const results = [];
  const runtimeResults = layoutRuntimeResults();
  const dataDirectoryExists = await directoryState(repoRoot, 'data', runtimeResults);
  const schemaDirectoryExists = await directoryState(repoRoot, 'schemas', runtimeResults);

  if (!dataDirectoryExists) {
    results.push(
      createResult({
        severity: 'error',
        code: 'E006',
        file: 'data',
        message: '本番用dataディレクトリがありません。',
        suggested_action: '必須40データファイルを配置してください。'
      })
    );
  }
  if (!schemaDirectoryExists) {
    runtimeResults.push(
      runtimeResult({
        code: 'RUN-E001',
        file: 'schemas',
        message: '本番用schemasディレクトリがありません。'
      })
    );
  }

  const actualDataFiles = dataDirectoryExists
    ? await collectJsonFiles(path.join(repoRoot, 'data'), repoRoot, runtimeResults)
    : [];
  const actualSchemaFiles = schemaDirectoryExists
    ? await collectJsonFiles(path.join(repoRoot, 'schemas'), repoRoot, runtimeResults)
    : [];
  const actualData = new Set(actualDataFiles);
  const actualSchemas = new Set(actualSchemaFiles);
  const expectedData = new Set(DATA_LAYOUT.map(({ dataPath }) => dataPath));
  const expectedSchemas = new Set(SCHEMA_LAYOUT.map(({ schemaPath }) => schemaPath));

  for (const { dataPath } of DATA_LAYOUT) {
    if (!actualData.has(dataPath)) {
      results.push(
        createResult({
          severity: 'error',
          code: 'E006',
          file: dataPath,
          message: '必須データファイルがありません。',
          suggested_action: '配置対応表どおりに空データファイルを追加してください。'
        })
      );
    }
  }
  for (const { schemaPath } of SCHEMA_LAYOUT) {
    if (!actualSchemas.has(schemaPath)) {
      runtimeResults.push(
        runtimeResult({
          code: 'RUN-E001',
          file: schemaPath,
          message: '必須Schemaファイルがありません。'
        })
      );
    }
  }

  for (const dataPath of actualDataFiles.filter((file) => !expectedData.has(file))) {
    const forbidden = FORBIDDEN_DATA_PATHS.has(dataPath);
    results.push(
      createResult({
        severity: 'error',
        code: forbidden ? 'E009' : 'E007',
        file: dataPath,
        message: forbidden
          ? 'locale版check-history.jsonは禁止されています。'
          : '配置対応表にないデータJSONファイルです。',
        suggested_action: forbidden
          ? '内部確認履歴はdata/core/check-history.jsonだけで管理してください。'
          : 'ファイルを正しい管理単位へ配置するか、不要なファイルを除いてください。'
      })
    );
  }
  for (const schemaPath of actualSchemaFiles.filter((file) => !expectedSchemas.has(file))) {
    runtimeResults.push(
      runtimeResult({
        code: 'RUN-E001',
        file: schemaPath,
        message:
          schemaPath === FORBIDDEN_SCHEMA_PATH
            ? 'locale版check-history Schemaは禁止されています。'
            : '配置対応表にないSchema JSONファイルです。'
      })
    );
  }
  for (const locale of await collectUnsupportedLocales(repoRoot, runtimeResults)) {
    results.push(
      createResult({
        severity: 'error',
        code: 'E008',
        file: `data/locales/${locale}`,
        message: `未対応locale '${locale}' のディレクトリがあります。`,
        suggested_action: `対応localeは${SUPPORTED_LOCALES.join('、')}だけです。`
      })
    );
  }

  const schemas = new Map();
  for (const { schemaPath } of SCHEMA_LAYOUT) {
    if (!actualSchemas.has(schemaPath)) continue;
    const schema = await readJson(repoRoot, schemaPath, { schema: true, results, runtimeResults });
    if (schema !== undefined) schemas.set(schemaPath, schema);
  }
  validateSchemaIds(schemas, runtimeResults);
  const compiledSchemas = compileSchemas(schemas, runtimeResults);

  const data = new Map();
  for (const { dataPath } of DATA_LAYOUT) {
    if (!actualData.has(dataPath)) continue;
    const value = await readJson(repoRoot, dataPath, { schema: false, results, runtimeResults });
    if (value !== undefined) data.set(dataPath, value);
  }
  validateDataFiles(data, compiledSchemas, results);

  const coreSite = data.get('data/core/site.json');
  const japaneseSite = data.get('data/locales/ja/site.json');
  const englishSite = data.get('data/locales/en/site.json');
  if (coreSite !== undefined && japaneseSite !== undefined && englishSite !== undefined) {
    results.push(
      ...validateSiteData(
        { core: coreSite, ja: japaneseSite, en: englishSite },
        {
          files: {
            core: 'data/core/site.json',
            ja: 'data/locales/ja/site.json',
            en: 'data/locales/en/site.json'
          }
        }
      )
    );
  }

  const items = (dataPath) => {
    const value = data.get(dataPath);
    return Array.isArray(value?.items) ? value.items : [];
  };
  results.push(
    ...validateOfficialSourceData({
      core: {
        regions: items('data/core/regions.json'),
        organizations: items('data/core/organizations.json'),
        sources: items('data/core/sources.json'),
        evidence: items('data/core/evidence.json'),
        disasters: items('data/core/disasters.json')
      },
      locales: {
        ja: {
          regions: items('data/locales/ja/regions.json'),
          organizations: items('data/locales/ja/organizations.json'),
          sources: items('data/locales/ja/sources.json'),
          evidence: items('data/locales/ja/evidence.json')
        },
        en: {
          regions: items('data/locales/en/regions.json'),
          organizations: items('data/locales/en/organizations.json'),
          sources: items('data/locales/en/sources.json'),
          evidence: items('data/locales/en/evidence.json')
        }
      }
    })
  );

  return {
    results: sortResults(results),
    runtimeResults: sortResults(runtimeResults)
  };
}
