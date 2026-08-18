import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createResult, sortResults } from '../validation/result.js';
import { regionPath } from '../shared/public-url.js';
import {
  ARTIFACT_TYPES,
  PUBLIC_ARTIFACT_PATHS,
  PUBLIC_LOCALES,
  PUBLIC_REGIONAL_ARTIFACT_ROOTS,
  PublicRuntimeError
} from './public-constants.js';
import { loadPublicSchemas, validatePublicArtifact } from './public-artifact-validator.js';
import {
  loadPreviewInput,
  loadProductionInput,
  readProductionSiteState
} from './public-input-loader.js';
import { buildPublicArtifacts, serializePublicArtifact } from './public-navigation-builder.js';

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

function expectedNationalFiles() {
  return new Set(
    Object.values(PUBLIC_ARTIFACT_PATHS)
      .flatMap((paths) => Object.values(paths))
      .map((file) => file.replace(/^dist\/public-data\//, ''))
  );
}

function regionalFile(mode, locale, slug) {
  return `${PUBLIC_REGIONAL_ARTIFACT_ROOTS[mode]}/${locale}/regions/${slug}/navigation.json`;
}

function regionalFileInfo(file) {
  const match =
    /^(preview|production)\/(ja|en)\/regions\/([a-z0-9]+(?:-[a-z0-9]+)*)\/navigation\.json$/.exec(
      file
    );
  return match ? { mode: match[1], locale: match[2], slug: match[3] } : undefined;
}

function validateRegionalTopology(actual, loaded, results) {
  for (const mode of ['preview', 'production']) {
    const regionsByLocale = {};
    for (const locale of PUBLIC_LOCALES) {
      const nationalFile = PUBLIC_ARTIFACT_PATHS[mode][locale];
      const national = loaded.get(nationalFile)?.value;
      if (!national || !Array.isArray(national.regions)) continue;
      const listed = new Map(national.regions.map((region) => [region.region_slug, region]));
      regionsByLocale[locale] = listed;
      const regionalFiles = [...actual]
        .map((file) => ({ file, info: regionalFileInfo(file) }))
        .filter(({ info }) => info?.mode === mode && info.locale === locale);
      const actualSlugs = regionalFiles.map(({ info }) => info.slug).sort();
      const listedSlugs = [...listed.keys()].sort();
      if (JSON.stringify(actualSlugs) !== JSON.stringify(listedSlugs))
        results.push(
          publicError(
            'PUB-E008',
            `dist/public-data/${mode}/${locale}`,
            '全国トップに掲載する地域集合と地域成果物集合が一致しません。'
          )
        );
      for (const [slug, entry] of listed) {
        const file = regionalFile(mode, locale, slug);
        const relative = file.replace(/^dist\/public-data\//, '');
        if (!actual.has(relative)) {
          results.push(
            publicError('PUB-E008', file, '全国トップに対応する地域成果物がありません。')
          );
          continue;
        }
        const regional = loaded.get(file)?.value;
        if (
          !regional ||
          regional.region?.region_id !== entry.region_id ||
          regional.region?.region_slug !== slug ||
          regional.region?.path !== regionPath(locale, slug) ||
          regional.generated_for_date !== national.generated_for_date
        ) {
          results.push(
            publicError(
              'PUB-E008',
              file,
              '全国トップと地域成果物の地域識別子、path、または基準日が一致しません。'
            )
          );
        }
      }
    }
    const ja = regionsByLocale.ja;
    const en = regionsByLocale.en;
    if (ja && en) {
      const jaSlugs = [...ja.keys()].sort();
      const enSlugs = [...en.keys()].sort();
      if (JSON.stringify(jaSlugs) !== JSON.stringify(enSlugs))
        results.push(
          publicError(
            'PUB-E008',
            `dist/public-data/${mode}`,
            '日英の公開region集合が一致しません。'
          )
        );
      for (const slug of jaSlugs) {
        if (ja.get(slug)?.region_id !== en.get(slug)?.region_id)
          results.push(
            publicError(
              'PUB-E008',
              `dist/public-data/${mode}`,
              `日英のregion_idが一致しません: ${slug}`
            )
          );
      }
    }
  }
}

export async function validatePublicRepository(repoRoot) {
  const results = [];
  const schemas = await loadPublicSchemas(repoRoot);
  const actual = new Set(await collectFiles(path.join(repoRoot, 'dist', 'public-data')));
  const expectedNational = expectedNationalFiles();
  for (const file of actual) {
    if (!expectedNational.has(file) && !regionalFileInfo(file))
      results.push(
        publicError('PUB-E008', `dist/public-data/${file}`, '想定外の公開成果物ファイルです。')
      );
  }

  const presence = Object.fromEntries(
    ['preview', 'production'].map((mode) => [
      mode,
      Object.fromEntries(
        PUBLIC_LOCALES.map((locale) => [
          locale,
          actual.has(PUBLIC_ARTIFACT_PATHS[mode][locale].replace(/^dist\/public-data\//, ''))
        ])
      )
    ])
  );
  for (const locale of PUBLIC_LOCALES) {
    if (!presence.preview[locale])
      results.push(
        publicError(
          'PUB-E008',
          PUBLIC_ARTIFACT_PATHS.preview[locale],
          '必須preview成果物がありません。'
        )
      );
  }
  const productionCount = PUBLIC_LOCALES.filter((locale) => presence.production[locale]).length;
  if (productionCount === 1)
    results.push(
      publicError(
        'PUB-E008',
        'dist/public-data/production',
        'production成果物が片言語だけ存在します。'
      )
    );
  const siteState = await readProductionSiteState(repoRoot);
  if (siteState === 'published' && productionCount === 0)
    results.push(
      publicError(
        'PUB-E007',
        'dist/public-data/production',
        '公開中の正本にproduction成果物がありません。'
      )
    );
  if (siteState !== 'published' && productionCount > 0)
    results.push(
      publicError(
        'PUB-E007',
        'dist/public-data/production',
        '非公開の正本にproduction成果物が残っています。'
      )
    );

  const loaded = new Map();
  for (const mode of ['preview', 'production']) {
    for (const locale of PUBLIC_LOCALES) {
      if (!presence[mode][locale]) continue;
      const file = PUBLIC_ARTIFACT_PATHS[mode][locale];
      const read = await readArtifact(repoRoot, file);
      results.push(...read.results);
      if (!read.value) continue;
      loaded.set(file, read);
      results.push(
        ...validatePublicArtifact(read.value, {
          validateSchema: schemas.legacy.validate,
          validateNationalSchema: schemas.national.validate,
          validateRegionalSchema: schemas.regional.validate,
          file,
          expectedMode: mode,
          expectedLocale: locale
        })
      );
    }
  }
  for (const relative of actual) {
    const info = regionalFileInfo(relative);
    if (!info) continue;
    const file = `dist/public-data/${relative}`;
    const read = await readArtifact(repoRoot, file);
    results.push(...read.results);
    if (!read.value) continue;
    loaded.set(file, read);
    results.push(
      ...validatePublicArtifact(read.value, {
        validateSchema: schemas.legacy.validate,
        validateNationalSchema: schemas.national.validate,
        validateRegionalSchema: schemas.regional.validate,
        file,
        expectedMode: info.mode,
        expectedLocale: info.locale
      })
    );
  }
  validateRegionalTopology(actual, loaded, results);
  for (const mode of ['preview', 'production']) {
    const japanese = loaded.get(PUBLIC_ARTIFACT_PATHS[mode].ja)?.value;
    const english = loaded.get(PUBLIC_ARTIFACT_PATHS[mode].en)?.value;
    if (japanese && english && japanese.generated_for_date !== english.generated_for_date)
      results.push(
        publicError(
          'PUB-E008',
          `dist/public-data/${mode}`,
          '日英成果物のgenerated_for_dateが一致しません。'
        )
      );
  }
  return { results: sortResults(results), loaded, siteState };
}

async function compareArtifacts(repoRoot, mode, artifacts) {
  const results = [];
  for (const locale of PUBLIC_LOCALES) {
    const files = [
      [PUBLIC_ARTIFACT_PATHS[mode][locale], artifacts.national[locale]],
      ...Object.entries(artifacts.regions[locale]).map(([slug, artifact]) => [
        regionalFile(mode, locale, slug),
        artifact
      ])
    ];
    for (const [file, artifact] of files) {
      const tracked = await readFile(path.join(repoRoot, file), 'utf8');
      if (serializePublicArtifact(artifact) !== tracked)
        results.push(
          publicError('PUB-E006', file, '再生成結果がGit管理中の成果物とバイト一致しません。')
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
    const previewArtifacts = buildPublicArtifacts(preview.input, {
      artifactType: ARTIFACT_TYPES.preview,
      asOf: preview.manifest.as_of
    });
    if (previewArtifacts.results.length > 0) return previewArtifacts.results;
    const results = await compareArtifacts(repoRoot, 'preview', previewArtifacts);

    const productionJapanese = repositoryValidation.loaded.get(
      PUBLIC_ARTIFACT_PATHS.production.ja
    )?.value;
    if (productionJapanese) {
      const production = await loadProductionInput(repoRoot);
      const inputErrors = production.results.filter(({ severity }) => severity === 'error');
      if (inputErrors.length > 0) return sortResults(inputErrors);
      const productionArtifacts = buildPublicArtifacts(production.input, {
        artifactType: ARTIFACT_TYPES.production,
        asOf: productionJapanese.generated_for_date
      });
      if (productionArtifacts.results.length > 0) return productionArtifacts.results;
      results.push(...(await compareArtifacts(repoRoot, 'production', productionArtifacts)));
    }
    return sortResults(results);
  } catch (error) {
    if (error instanceof PublicRuntimeError) throw error;
    throw new PublicRuntimeError('PUB-RUN-E002', 'dist/public-data', error.message, error);
  } finally {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
  }
}
