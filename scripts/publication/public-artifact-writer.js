import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { createResult, sortResults } from '../validation/result.js';
import { regionPath } from '../shared/public-url.js';
import {
  PUBLIC_ARTIFACT_PATHS,
  PUBLIC_LOCALES,
  PUBLIC_REGIONAL_ARTIFACT_ROOTS,
  PublicRuntimeError
} from './public-constants.js';
import { loadPublicSchemas, validatePublicArtifact } from './public-artifact-validator.js';
import { serializePublicArtifact } from './public-navigation-builder.js';

function publicError(file, message) {
  return createResult({
    severity: 'error',
    code: 'PUB-E008',
    file,
    message,
    suggested_action: '全国トップと地域成果物を同じ入力・基準日から再生成してください。'
  });
}

function validateArtifactTopology(mode, artifacts) {
  const results = [];
  const regionsByLocale = {};
  for (const locale of PUBLIC_LOCALES) {
    const national = artifacts.national?.[locale];
    const regions = artifacts.regions?.[locale];
    if (!national || !regions) {
      results.push(
        publicError(`dist/public-data/${mode}`, '日英の全国・地域成果物を解決できません。')
      );
      continue;
    }
    const listed = new Map((national.regions ?? []).map((entry) => [entry.region_slug, entry]));
    const actual = Object.keys(regions).sort();
    if (JSON.stringify([...listed.keys()].sort()) !== JSON.stringify(actual))
      results.push(
        publicError(
          `dist/public-data/${mode}/${locale}`,
          '全国トップに掲載する地域集合と地域成果物集合が一致しません。'
        )
      );
    for (const [slug, entry] of listed) {
      const regional = regions[slug];
      if (
        !regional ||
        regional.region?.region_id !== entry.region_id ||
        regional.region?.region_slug !== slug ||
        regional.region?.path !== regionPath(locale, slug) ||
        regional.generated_for_date !== national.generated_for_date
      ) {
        results.push(
          publicError(
            `${PUBLIC_REGIONAL_ARTIFACT_ROOTS[mode]}/${locale}/regions/${slug}/navigation.json`,
            '全国トップと地域成果物の地域識別子、path、または基準日が一致しません。'
          )
        );
      }
    }
    regionsByLocale[locale] = listed;
  }
  const japanese = regionsByLocale.ja;
  const english = regionsByLocale.en;
  if (japanese && english) {
    const ja = [...japanese.keys()].sort();
    const en = [...english.keys()].sort();
    if (JSON.stringify(ja) !== JSON.stringify(en))
      results.push(publicError(`dist/public-data/${mode}`, '日英の公開region集合が一致しません。'));
    for (const slug of ja) {
      if (japanese.get(slug)?.region_id !== english.get(slug)?.region_id)
        results.push(
          publicError(`dist/public-data/${mode}`, `日英のregion_idが一致しません: ${slug}`)
        );
    }
  }
  return results;
}

async function validateArtifacts(repoRoot, mode, artifacts) {
  if (
    !PUBLIC_ARTIFACT_PATHS[mode] ||
    PUBLIC_LOCALES.some((locale) => !artifacts?.national?.[locale] || !artifacts?.regions?.[locale])
  ) {
    throw new PublicRuntimeError(
      'PUB-RUN-E003',
      `dist/public-data/${mode}`,
      '日英の全国・地域成果物を解決できません。'
    );
  }
  const schemas = await loadPublicSchemas(repoRoot);
  const results = [];
  for (const locale of PUBLIC_LOCALES) {
    results.push(
      ...validatePublicArtifact(artifacts.national[locale], {
        validateSchema: schemas.legacy.validate,
        validateNationalSchema: schemas.national.validate,
        validateRegionalSchema: schemas.regional.validate,
        file: PUBLIC_ARTIFACT_PATHS[mode][locale],
        expectedMode: mode,
        expectedLocale: locale
      })
    );
    for (const [slug, regional] of Object.entries(artifacts.regions[locale])) {
      results.push(
        ...validatePublicArtifact(regional, {
          validateSchema: schemas.legacy.validate,
          validateNationalSchema: schemas.national.validate,
          validateRegionalSchema: schemas.regional.validate,
          file: `${PUBLIC_REGIONAL_ARTIFACT_ROOTS[mode]}/${locale}/regions/${slug}/navigation.json`,
          expectedMode: mode,
          expectedLocale: locale
        })
      );
    }
  }
  results.push(...validateArtifactTopology(mode, artifacts));
  return sortResults(results);
}

export async function writePublicArtifacts(repoRoot, mode, artifacts, { filesystem = {} } = {}) {
  const validationResults = await validateArtifacts(repoRoot, mode, artifacts);
  if (validationResults.length > 0) return validationResults;

  const io = { mkdir, mkdtemp, rename, rm, writeFile, ...filesystem };

  const publicRoot = path.join(repoRoot, 'dist', 'public-data');
  const targetRoot = path.join(repoRoot, PUBLIC_REGIONAL_ARTIFACT_ROOTS[mode]);
  let temporaryRoot;
  let backupRoot;
  let preserveBackup = false;
  try {
    await io.mkdir(publicRoot, { recursive: true });
    temporaryRoot = await io.mkdtemp(path.join(publicRoot, `.tmp-public-${mode}-`));
    for (const locale of PUBLIC_LOCALES) {
      const nationalTarget = path.join(temporaryRoot, locale, 'navigation.json');
      await io.mkdir(path.dirname(nationalTarget), { recursive: true });
      await io.writeFile(
        nationalTarget,
        serializePublicArtifact(artifacts.national[locale]),
        'utf8'
      );
      for (const [slug, regional] of Object.entries(artifacts.regions[locale])) {
        const regionalTarget = path.join(temporaryRoot, locale, 'regions', slug, 'navigation.json');
        await io.mkdir(path.dirname(regionalTarget), { recursive: true });
        await io.writeFile(regionalTarget, serializePublicArtifact(regional), 'utf8');
      }
    }
    backupRoot = await io.mkdtemp(path.join(publicRoot, `.backup-public-${mode}-`));
    await io.rm(backupRoot, { recursive: true, force: true });
    try {
      await io.rename(targetRoot, backupRoot);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await io.rm(backupRoot, { recursive: true, force: true });
      backupRoot = undefined;
    }
    try {
      await io.rename(temporaryRoot, targetRoot);
      temporaryRoot = undefined;
    } catch (switchError) {
      if (backupRoot) {
        try {
          await io.rename(backupRoot, targetRoot);
          backupRoot = undefined;
        } catch (rollbackError) {
          preserveBackup = true;
          throw new Error(
            `公開成果物の切替に失敗し、rollbackにも失敗したためbackupを保持します: ${rollbackError.message}`,
            { cause: rollbackError }
          );
        }
      }
      throw switchError;
    }
    if (backupRoot) {
      preserveBackup = true;
      await io.rm(backupRoot, { recursive: true, force: true });
      backupRoot = undefined;
      preserveBackup = false;
    }
  } catch (error) {
    throw new PublicRuntimeError(
      'PUB-RUN-E003',
      `dist/public-data/${mode}`,
      `公開成果物を安全に反映できません: ${error.message}`,
      error
    );
  } finally {
    if (temporaryRoot) await io.rm(temporaryRoot, { recursive: true, force: true });
    if (backupRoot && !preserveBackup) await io.rm(backupRoot, { recursive: true, force: true });
  }
  return [];
}
