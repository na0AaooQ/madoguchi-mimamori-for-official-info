import { validateDataRepository } from '../../validation/data-validator.js';
import { MANAGEMENT_UNITS, OUTPUT_FILE_COUNT } from './config.js';
import { convertRecords, createEnvelope, serializeJson } from './converter.js';
import { loadManagementInputs } from './input-loader.js';
import { mapRepositoryResults, validateCandidateRepository } from './repository-validator.js';
import { createImportResult, hasImportErrors, sortImportResults } from './result.js';
import { validateSheetRows } from './sheet-validator.js';
import { decodeTsv, parseTsv, TsvSyntaxError } from './tsv-parser.js';
import { TransactionalWriteError, writeCandidateFiles } from './writer.js';

function parserResult(unit, error) {
  return createImportResult({
    severity: 'error',
    code: error.code,
    file: unit.fileName,
    line: error.line,
    column: `列${error.columnIndex}`,
    columnIndex: error.columnIndex,
    message: error.message,
    suggestedAction: error.suggestedAction
  });
}

function writeErrorResult(error) {
  const rollbackMessage =
    error.rollbackErrors.length === 0
      ? '元の18ファイルへのロールバックを完了しました。'
      : `ロールバックまたは清掃で問題が発生しました: ${error.rollbackErrors.join(' / ')}`;
  return createImportResult({
    severity: 'error',
    code: error.code,
    file: 'data',
    message: `${error.message} ${rollbackMessage}`,
    suggestedAction:
      error.rollbackErrors.length === 0
        ? '原因を修正して--checkから再実行してください。'
        : '表示されたバックアップパスを保全し、既存JSONと比較して復元してください。'
  });
}

function buildCandidates(convertedByUnit, dataUpdatedOn) {
  const candidates = new Map();
  const locationsByUnit = new Map();
  for (const unit of MANAGEMENT_UNITS) {
    const converted = convertedByUnit.get(unit.key);
    locationsByUnit.set(unit.key, converted.locations);
    for (const scope of ['core', 'ja', 'en']) {
      const envelope = createEnvelope(converted.items[scope], dataUpdatedOn);
      candidates.set(unit.outputPaths[scope], serializeJson(envelope));
    }
  }
  return { candidates, locationsByUnit };
}

function rowCounts(convertedByUnit) {
  return Object.fromEntries(
    MANAGEMENT_UNITS.map((unit) => [unit.key, convertedByUnit.get(unit.key).items.core.length])
  );
}

export async function runManagementImport(
  options,
  {
    repoRoot,
    tempParent,
    loadInputs = loadManagementInputs,
    validateCandidates = validateCandidateRepository,
    writeCandidates = writeCandidateFiles,
    writerAfterReplace
  }
) {
  const loaded = await loadInputs({ repoRoot, inputDir: options.inputDir });
  if (loaded.results.length > 0) {
    return { exitCode: 2, results: sortImportResults(loaded.results) };
  }

  const convertedByUnit = new Map();
  const inputResults = [];
  for (const unit of MANAGEMENT_UNITS) {
    try {
      const source = decodeTsv(loaded.buffers.get(unit.fileName));
      const rows = parseTsv(source);
      const sheet = validateSheetRows(unit, rows);
      inputResults.push(...sheet.results);
      if (sheet.results.length > 0) continue;
      const converted = convertRecords(unit, sheet.records);
      inputResults.push(...converted.results);
      convertedByUnit.set(unit.key, converted);
    } catch (error) {
      if (error instanceof TsvSyntaxError) {
        inputResults.push(parserResult(unit, error));
      } else {
        inputResults.push(
          createImportResult({
            severity: 'error',
            code: 'IMPORT-RUN-E001',
            file: unit.fileName,
            message: `TSV処理を実行できません: ${error.message}`,
            suggestedAction: 'ファイルを再出力し、同じ問題が続く場合は実装を確認してください。'
          })
        );
      }
    }
  }
  if (inputResults.length > 0) {
    const runtimeFailure = inputResults.some(({ code }) => code.startsWith('IMPORT-RUN-'));
    return { exitCode: runtimeFailure ? 2 : 1, results: sortImportResults(inputResults) };
  }

  const { candidates, locationsByUnit } = buildCandidates(convertedByUnit, options.dataUpdatedOn);
  const validation = await validateCandidates({
    repoRoot,
    candidates,
    locationsByUnit,
    ...(tempParent ? { tempParent } : {})
  });
  if (hasImportErrors(validation.results)) {
    return {
      exitCode: validation.runtimeFailure ? 2 : 1,
      results: validation.results
    };
  }

  let writtenPaths = [];
  let postValidationResults = [];
  if (options.mode === 'write') {
    try {
      const written = await writeCandidates({
        repoRoot,
        candidates,
        afterReplace: writerAfterReplace,
        validateAfterWrite: async () => {
          const execution = await validateDataRepository(repoRoot);
          const results = mapRepositoryResults(execution, locationsByUnit);
          postValidationResults = results;
          return {
            ok: !hasImportErrors(results) && execution.runtimeResults.length === 0,
            results
          };
        }
      });
      writtenPaths = written.writtenPaths;
    } catch (error) {
      if (error instanceof TransactionalWriteError) {
        return {
          exitCode: 2,
          results: sortImportResults([
            ...(error.postValidation?.results ?? []),
            writeErrorResult(error)
          ])
        };
      }
      return {
        exitCode: 2,
        results: [
          createImportResult({
            severity: 'error',
            code: 'IMPORT-RUN-E004',
            file: 'data',
            message: `書込み処理を実行できません: ${error.message}`,
            suggestedAction: 'data/の権限と空き容量を確認し、--checkから再実行してください。'
          })
        ]
      };
    }
  }

  return {
    exitCode: 0,
    results: sortImportResults(
      options.mode === 'write' ? postValidationResults : validation.results
    ),
    summary: {
      mode: options.mode,
      inputFileCount: MANAGEMENT_UNITS.length,
      generatedFileCount: OUTPUT_FILE_COUNT,
      rows: rowCounts(convertedByUnit),
      dataUpdatedOn: options.dataUpdatedOn,
      writtenPaths
    },
    candidates
  };
}
