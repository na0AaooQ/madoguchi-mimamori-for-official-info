import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { validateDataRepository } from '../../validation/data-validator.js';
import { MANAGEMENT_UNITS } from './config.js';
import { createImportResult, sortImportResults } from './result.js';

function targetIndex() {
  const index = new Map();
  for (const unit of MANAGEMENT_UNITS) {
    for (const scope of ['core', 'ja', 'en']) {
      index.set(unit.outputPaths[scope], { unit, scope });
    }
  }
  return index;
}

const TARGETS = targetIndex();

function itemIndexFromResult(validation) {
  const fieldMatch = /^items\.(\d+)(?:\.|$)/.exec(validation.field ?? '');
  if (fieldMatch) return Number(fieldMatch[1]);
  const messageMatch = /^\/items\/(\d+)(?:\/|\s|$)/.exec(validation.message);
  return messageMatch ? Number(messageMatch[1]) : undefined;
}

function sourceColumn(unit, scope, validation) {
  let property = validation.field;
  if (property?.startsWith('items.')) property = property.split('.')[2];
  if (!property || /^\d+$/.test(property)) return undefined;
  if (property === 'id') return unit.idColumn;
  return scope === 'core' ? property : `${property}_${scope}`;
}

export function mapRepositoryResults(execution, locationsByUnit) {
  const mapped = [];
  for (const validation of [...execution.results, ...execution.runtimeResults]) {
    const target = TARGETS.get(validation.file);
    if (!target) {
      mapped.push(
        createImportResult({
          severity: validation.severity,
          code: validation.code,
          file: validation.file,
          column: validation.field,
          message: validation.message,
          suggestedAction:
            validation.suggested_action ??
            '既存Schemaまたは参照データとの整合性を修正してください。'
        })
      );
      continue;
    }

    const unitLocations = locationsByUnit.get(target.unit.key)?.[target.scope] ?? [];
    const itemIndex = itemIndexFromResult(validation);
    const location =
      validation.item_id === undefined
        ? unitLocations[itemIndex]
        : unitLocations.find(({ id }) => id === validation.item_id);
    const column = sourceColumn(target.unit, target.scope, validation);
    const columnIndex =
      location && column && target.unit.headers.includes(column)
        ? target.unit.headers.indexOf(column) + location.headerOffset + 1
        : undefined;
    mapped.push(
      createImportResult({
        severity: validation.severity,
        code: validation.code,
        file: target.unit.fileName,
        line: location?.line,
        column,
        columnIndex,
        message: validation.message,
        suggestedAction:
          validation.suggested_action ??
          'TSVの該当行を既存Schemaと意味検証に合う値へ修正してください。'
      })
    );
  }
  return sortImportResults(mapped);
}

function runtimeResult(code, file, message, suggestedAction) {
  return createImportResult({
    severity: 'error',
    code,
    file,
    message,
    suggestedAction
  });
}

export async function validateCandidateRepository({
  repoRoot,
  candidates,
  locationsByUnit,
  tempParent = os.tmpdir()
}) {
  let temporaryRepository;
  let output;
  try {
    temporaryRepository = await mkdtemp(path.join(tempParent, 'madoguchi-management-tsv-'));
    await Promise.all([
      cp(path.join(repoRoot, 'data'), path.join(temporaryRepository, 'data'), { recursive: true }),
      cp(path.join(repoRoot, 'schemas'), path.join(temporaryRepository, 'schemas'), {
        recursive: true
      })
    ]);
    for (const [relativePath, source] of [...candidates.entries()].sort()) {
      const target = path.join(temporaryRepository, relativePath);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, source, 'utf8');
    }
    const execution = await validateDataRepository(temporaryRepository);
    output = {
      results: mapRepositoryResults(execution, locationsByUnit),
      runtimeFailure: execution.runtimeResults.length > 0
    };
  } catch (error) {
    output = {
      results: [
        runtimeResult(
          'IMPORT-RUN-E002',
          'data',
          `候補JSONの一時検証を実行できません: ${error.message}`,
          '一時ディレクトリの権限、data、schemasの状態を確認してください。'
        )
      ],
      runtimeFailure: true
    };
  } finally {
    if (temporaryRepository) {
      try {
        await rm(temporaryRepository, { recursive: true, force: true });
      } catch (error) {
        output.results = sortImportResults([
          ...output.results,
          runtimeResult(
            'IMPORT-RUN-E003',
            temporaryRepository,
            `一時検証ディレクトリを削除できません: ${error.message}`,
            '表示された一時ディレクトリを確認し、手動で削除してください。'
          )
        ]);
        output.runtimeFailure = true;
      }
    }
  }
  return output;
}
