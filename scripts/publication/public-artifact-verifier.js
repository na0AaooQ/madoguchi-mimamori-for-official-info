import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createResult, sortResults } from '../validation/result.js';
import {
  ARTIFACT_TYPES,
  PUBLIC_ARTIFACT_PATHS,
  PUBLIC_LOCALES,
  PublicRuntimeError
} from './public-constants.js';
import { loadPublicSchema, validatePublicArtifact } from './public-artifact-validator.js';
import {
  loadPreviewInput,
  loadProductionInput,
  readProductionSiteState
} from './public-input-loader.js';
import { buildPublicNavigation, serializePublicArtifact } from './public-navigation-builder.js';

function publicError(code, file, message) {
  return createResult({
    severity: 'error',
    code,
    file,
    message,
    suggested_action: '正式成果物を管理データまたはfixtureから再生成してください。'
  });
}

async function collectFiles(root, relative = '') {
  let entries;
  try {
    entries = await readdir(path.join(root, relative), { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new PublicRuntimeError('PUB-RUN-E002', 'dist/public-data', error.message, error);
  }
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(root, child)));
    else if (entry.isFile()) files.push(child.split(path.sep).join('/'));
  }
  return files.sort();
}

async function readArtifact(repoRoot, file) {
  let source;
  try {
    source = await readFile(path.join(repoRoot, file), 'utf8');
  } catch (error) {
    throw new PublicRuntimeError(
      'PUB-RUN-E002',
      file,
      `成果物を読み込めません: ${error.message}`,
      error
    );
  }
  try {
    return { source, value: JSON.parse(source), results: [] };
  } catch (error) {
    return {
      source,
      value: undefined,
      results: [publicError('PUB-E004', file, `JSON構文が不正です: ${error.message}`)]
    };
  }
}

function expectedFiles() {
  return new Set(
    Object.values(PUBLIC_ARTIFACT_PATHS)
      .flatMap((paths) => Object.values(paths))
      .map((file) => file.replace(/^dist\/public-data\//, ''))
  );
}

export async function validatePublicRepository(repoRoot) {
  const results = [];
  const { validate } = await loadPublicSchema(repoRoot);
  const actual = new Set(await collectFiles(path.join(repoRoot, 'dist', 'public-data')));
  const expected = expectedFiles();
  for (const file of actual) {
    if (!expected.has(file)) {
      results.push(
        publicError('PUB-E008', `dist/public-data/${file}`, '想定外の公開成果物ファイルです。')
      );
    }
  }

  const previewPresence = Object.fromEntries(
    PUBLIC_LOCALES.map((locale) => [
      locale,
      actual.has(PUBLIC_ARTIFACT_PATHS.preview[locale].replace(/^dist\/public-data\//, ''))
    ])
  );
  for (const locale of PUBLIC_LOCALES) {
    if (!previewPresence[locale]) {
      results.push(
        publicError(
          'PUB-E008',
          PUBLIC_ARTIFACT_PATHS.preview[locale],
          '必須preview成果物がありません。'
        )
      );
    }
  }

  const productionPresence = Object.fromEntries(
    PUBLIC_LOCALES.map((locale) => [
      locale,
      actual.has(PUBLIC_ARTIFACT_PATHS.production[locale].replace(/^dist\/public-data\//, ''))
    ])
  );
  const productionCount = PUBLIC_LOCALES.filter((locale) => productionPresence[locale]).length;
  if (productionCount === 1) {
    results.push(
      publicError(
        'PUB-E008',
        'dist/public-data/production',
        'production成果物が片言語だけ存在します。'
      )
    );
  }
  const siteState = await readProductionSiteState(repoRoot);
  if (siteState === 'published' && productionCount === 0) {
    results.push(
      publicError(
        'PUB-E007',
        'dist/public-data/production',
        '公開中の正本にproduction成果物がありません。'
      )
    );
  }
  if (siteState !== 'published' && productionCount > 0) {
    results.push(
      publicError(
        'PUB-E007',
        'dist/public-data/production',
        '非公開の正本にproduction成果物が残っています。'
      )
    );
  }

  const loaded = new Map();
  for (const mode of ['preview', 'production']) {
    for (const locale of PUBLIC_LOCALES) {
      if (mode === 'production' && !productionPresence[locale]) continue;
      if (mode === 'preview' && !previewPresence[locale]) continue;
      const file = PUBLIC_ARTIFACT_PATHS[mode][locale];
      const read = await readArtifact(repoRoot, file);
      results.push(...read.results);
      if (!read.value) continue;
      loaded.set(file, read);
      results.push(
        ...validatePublicArtifact(read.value, {
          validateSchema: validate,
          file,
          expectedMode: mode,
          expectedLocale: locale
        })
      );
    }
  }
  for (const mode of ['preview', 'production']) {
    const japanese = loaded.get(PUBLIC_ARTIFACT_PATHS[mode].ja)?.value;
    const english = loaded.get(PUBLIC_ARTIFACT_PATHS[mode].en)?.value;
    if (japanese && english && japanese.generated_for_date !== english.generated_for_date) {
      results.push(
        publicError(
          'PUB-E008',
          `dist/public-data/${mode}`,
          '日英成果物のgenerated_for_dateが一致しません。'
        )
      );
    }
  }
  return { results: sortResults(results), loaded, siteState };
}

function buildPair(input, artifactType, asOf) {
  const artifacts = {};
  const results = [];
  for (const locale of PUBLIC_LOCALES) {
    const built = buildPublicNavigation(input, { locale, artifactType, asOf });
    results.push(...built.results);
    if (built.artifact) artifacts[locale] = built.artifact;
  }
  return { artifacts, results: sortResults(results) };
}

async function comparePair(repoRoot, mode, artifacts, temporaryRoot) {
  const results = [];
  for (const locale of PUBLIC_LOCALES) {
    const regenerated = serializePublicArtifact(artifacts[locale]);
    const temporaryFile = path.join(temporaryRoot, `${mode}-${locale}-navigation.json`);
    await writeFile(temporaryFile, regenerated, 'utf8');
    const tracked = await readFile(
      path.join(repoRoot, PUBLIC_ARTIFACT_PATHS[mode][locale]),
      'utf8'
    );
    if (regenerated !== tracked) {
      results.push(
        publicError(
          'PUB-E006',
          PUBLIC_ARTIFACT_PATHS[mode][locale],
          '再生成結果がGit管理中の成果物とバイト一致しません。'
        )
      );
    }
  }
  return results;
}

export async function verifyPublicArtifacts(repoRoot) {
  const repositoryValidation = await validatePublicRepository(repoRoot);
  if (repositoryValidation.results.length > 0) return repositoryValidation.results;
  let temporaryRoot;
  try {
    temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'madoguchi-public-verify-'));
    await mkdir(temporaryRoot, { recursive: true });
    const preview = await loadPreviewInput(repoRoot);
    if (preview.results.some(({ severity }) => severity === 'error')) return preview.results;
    const previewPair = buildPair(preview.input, ARTIFACT_TYPES.preview, preview.manifest.as_of);
    if (previewPair.results.length > 0) return previewPair.results;
    const results = await comparePair(repoRoot, 'preview', previewPair.artifacts, temporaryRoot);

    const productionJapanese = repositoryValidation.loaded.get(
      PUBLIC_ARTIFACT_PATHS.production.ja
    )?.value;
    if (productionJapanese) {
      const production = await loadProductionInput(repoRoot);
      const inputErrors = production.results.filter(({ severity }) => severity === 'error');
      if (inputErrors.length > 0) return sortResults(inputErrors);
      const productionPair = buildPair(
        production.input,
        ARTIFACT_TYPES.production,
        productionJapanese.generated_for_date
      );
      if (productionPair.results.length > 0) return productionPair.results;
      results.push(
        ...(await comparePair(repoRoot, 'production', productionPair.artifacts, temporaryRoot))
      );
    }
    return sortResults(results);
  } catch (error) {
    if (error instanceof PublicRuntimeError) throw error;
    throw new PublicRuntimeError('PUB-RUN-E002', 'dist/public-data', error.message, error);
  } finally {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
  }
}
