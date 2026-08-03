import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ImportUsageError, parseArguments } from './arguments.js';
import { runManagementImport } from './importer.js';
import { createImportResult, formatImportResults } from './result.js';

const DEFAULT_REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const ROW_ORDER = ['regions', 'organizations', 'sources', 'evidence', 'cards', 'card-source-links'];

function printSuccess(summary, stdout) {
  const lines = [
    'TSV import validation succeeded.',
    `Mode: ${summary.mode}`,
    `Input files: ${summary.inputFileCount}`,
    `Generated JSON files: ${summary.generatedFileCount}`,
    'Rows:',
    ...ROW_ORDER.map((key) => `  ${key}: ${summary.rows[key]}`)
  ];
  if (summary.mode === 'write') {
    lines.push('Updated files:', ...summary.writtenPaths.map((file) => `  ${file}`));
  }
  lines.push(`Data updated on: ${summary.dataUpdatedOn}`);
  stdout(lines.join('\n'));
}

export async function runCli(
  args,
  {
    repoRoot = DEFAULT_REPO_ROOT,
    tempParent,
    stdout = console.log,
    stderr = console.error,
    importRunner = runManagementImport,
    importerDependencies = {}
  } = {}
) {
  let options;
  try {
    options = parseArguments(args);
  } catch (error) {
    const result =
      error instanceof ImportUsageError
        ? createImportResult({
            severity: 'error',
            code: error.code,
            file: 'arguments',
            message: error.message,
            suggestedAction: error.suggestedAction
          })
        : createImportResult({
            severity: 'error',
            code: 'IMPORT-RUN-E001',
            file: 'arguments',
            message: `引数処理を実行できません: ${error.message}`,
            suggestedAction: 'READMEの実行例を確認してください。'
          });
    stderr(formatImportResults([result]));
    return 2;
  }

  try {
    const execution = await importRunner(options, {
      repoRoot: path.resolve(repoRoot),
      ...(tempParent ? { tempParent } : {}),
      ...importerDependencies
    });
    if (execution.exitCode !== 0) {
      stderr(formatImportResults(execution.results));
      return execution.exitCode;
    }
    const warnings = execution.results.filter(({ severity }) => severity === 'warning');
    if (warnings.length > 0) stdout(formatImportResults(warnings));
    printSuccess(execution.summary, stdout);
    return 0;
  } catch (error) {
    stderr(
      formatImportResults([
        createImportResult({
          severity: 'error',
          code: 'IMPORT-RUN-E005',
          file: 'data',
          message: `予期しない内部エラーが発生しました: ${error.message}`,
          suggestedAction: '変更を加えず、エラー内容と入力条件を開発者へ共有してください。'
        })
      ])
    );
    return 2;
  }
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectExecution) process.exitCode = await runCli(process.argv.slice(2));
