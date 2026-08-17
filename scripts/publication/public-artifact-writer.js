import { mkdir, mkdtemp, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { sortResults } from '../validation/result.js';
import {
  PUBLIC_ARTIFACT_PATHS,
  PUBLIC_LOCALES,
  PUBLIC_REGIONAL_ARTIFACT_ROOTS,
  PublicRuntimeError
} from './public-constants.js';
import {
  loadPublicSchema,
  loadPublicSchemas,
  validatePublicArtifact
} from './public-artifact-validator.js';
import { serializePublicArtifact } from './public-navigation-builder.js';

async function restoreTarget(target, previous) {
  if (previous === undefined) {
    try {
      await unlink(target);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  } else {
    await writeFile(target, previous);
  }
}

async function readExisting(target) {
  try {
    return await readFile(target);
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

export async function writePublicArtifacts(repoRoot, mode, artifacts) {
  if (mode === 'preview' && artifacts?.national && artifacts?.regions) {
    return writePreviewPublicArtifacts(repoRoot, mode, artifacts);
  }
  if (!PUBLIC_ARTIFACT_PATHS[mode] || PUBLIC_LOCALES.some((locale) => !artifacts?.[locale])) {
    throw new PublicRuntimeError(
      'PUB-RUN-E003',
      'dist/public-data',
      '固定の日英出力を解決できません。'
    );
  }
  const { validate } = await loadPublicSchema(repoRoot);
  const validationResults = PUBLIC_LOCALES.flatMap((locale) =>
    validatePublicArtifact(artifacts[locale], {
      validateSchema: validate,
      file: PUBLIC_ARTIFACT_PATHS[mode][locale],
      expectedMode: mode,
      expectedLocale: locale
    })
  );
  if (validationResults.length > 0) return sortResults(validationResults);

  const publicRoot = path.join(repoRoot, 'dist', 'public-data');
  let temporaryRoot;
  try {
    await mkdir(publicRoot, { recursive: true });
    temporaryRoot = await mkdtemp(path.join(publicRoot, '.tmp-public-'));
    const temporaryFiles = {};
    for (const locale of PUBLIC_LOCALES) {
      temporaryFiles[locale] = path.join(temporaryRoot, `${locale}.json`);
      await writeFile(temporaryFiles[locale], serializePublicArtifact(artifacts[locale]), 'utf8');
    }

    const targets = Object.fromEntries(
      PUBLIC_LOCALES.map((locale) => [
        locale,
        path.join(repoRoot, PUBLIC_ARTIFACT_PATHS[mode][locale])
      ])
    );
    const previous = Object.fromEntries(
      await Promise.all(
        PUBLIC_LOCALES.map(async (locale) => [locale, await readExisting(targets[locale])])
      )
    );
    const replaced = [];
    try {
      for (const locale of PUBLIC_LOCALES) {
        await mkdir(path.dirname(targets[locale]), { recursive: true });
        await rename(temporaryFiles[locale], targets[locale]);
        replaced.push(locale);
      }
    } catch (error) {
      for (const locale of replaced.reverse())
        await restoreTarget(targets[locale], previous[locale]);
      throw error;
    }
  } catch (error) {
    throw new PublicRuntimeError(
      'PUB-RUN-E003',
      `dist/public-data/${mode}`,
      `公開成果物を安全に反映できません: ${error.message}`,
      error
    );
  } finally {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
  }
  return [];
}

async function writePreviewPublicArtifacts(repoRoot, mode, artifacts) {
  if (PUBLIC_LOCALES.some((locale) => !artifacts.national?.[locale])) {
    throw new PublicRuntimeError(
      'PUB-RUN-E003',
      'dist/public-data/preview',
      '全国トップの日英成果物を解決できません。'
    );
  }
  const schemas = await loadPublicSchemas(repoRoot);
  const validationResults = [];
  for (const locale of PUBLIC_LOCALES) {
    validationResults.push(
      ...validatePublicArtifact(artifacts.national[locale], {
        validateSchema: schemas.legacy.validate,
        validateNationalSchema: schemas.national.validate,
        validateRegionalSchema: schemas.regional.validate,
        file: PUBLIC_ARTIFACT_PATHS.preview[locale],
        expectedMode: mode,
        expectedLocale: locale
      })
    );
    for (const [slug, regional] of Object.entries(artifacts.regions[locale] ?? {})) {
      validationResults.push(
        ...validatePublicArtifact(regional, {
          validateSchema: schemas.legacy.validate,
          validateNationalSchema: schemas.national.validate,
          validateRegionalSchema: schemas.regional.validate,
          file: `${PUBLIC_REGIONAL_ARTIFACT_ROOTS.preview}/${locale}/regions/${slug}/navigation.json`,
          expectedMode: mode,
          expectedLocale: locale
        })
      );
    }
  }
  if (validationResults.length > 0) return sortResults(validationResults);

  const publicRoot = path.join(repoRoot, 'dist', 'public-data');
  const targetRoot = path.join(repoRoot, PUBLIC_REGIONAL_ARTIFACT_ROOTS.preview);
  let temporaryRoot;
  let backupRoot;
  try {
    await mkdir(publicRoot, { recursive: true });
    temporaryRoot = await mkdtemp(path.join(publicRoot, '.tmp-public-preview-'));
    for (const locale of PUBLIC_LOCALES) {
      const nationalTarget = path.join(temporaryRoot, locale, 'navigation.json');
      await mkdir(path.dirname(nationalTarget), { recursive: true });
      await writeFile(nationalTarget, serializePublicArtifact(artifacts.national[locale]), 'utf8');
      for (const [slug, regional] of Object.entries(artifacts.regions[locale] ?? {})) {
        const regionalTarget = path.join(temporaryRoot, locale, 'regions', slug, 'navigation.json');
        await mkdir(path.dirname(regionalTarget), { recursive: true });
        await writeFile(regionalTarget, serializePublicArtifact(regional), 'utf8');
      }
    }
    backupRoot = await mkdtemp(path.join(publicRoot, '.backup-public-preview-'));
    await rm(backupRoot, { recursive: true, force: true });
    try {
      await rename(targetRoot, backupRoot);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      backupRoot = undefined;
    }
    await rename(temporaryRoot, targetRoot);
    temporaryRoot = undefined;
    if (backupRoot) {
      await rm(backupRoot, { recursive: true, force: true });
      backupRoot = undefined;
    }
  } catch (error) {
    if (backupRoot && temporaryRoot) {
      try {
        await rename(backupRoot, targetRoot);
      } catch {
        // Preserve the original failure; the backup remains recoverable if rollback itself fails.
      }
    }
    throw new PublicRuntimeError(
      'PUB-RUN-E003',
      'dist/public-data/preview',
      `公開成果物を安全に反映できません: ${error.message}`,
      error
    );
  } finally {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
    if (backupRoot) await rm(backupRoot, { recursive: true, force: true });
  }
  return [];
}
