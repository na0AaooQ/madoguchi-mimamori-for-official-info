import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createResult, formatResults, sortResults } from '../validation/result.js';
import { ARTIFACT_TYPES, PUBLIC_LOCALES, PublicRuntimeError } from './public-constants.js';
import { validatePublicRepository, verifyPublicArtifacts } from './public-artifact-verifier.js';
import { writePublicArtifacts } from './public-artifact-writer.js';
import { loadPreviewInput, loadProductionInput } from './public-input-loader.js';
import { buildPublicNavigation, isValidDateOnly } from './public-navigation-builder.js';

function usageError(message) {
  throw new PublicRuntimeError('PUB-RUN-E001', 'scripts/publication/cli.js', message);
}

export function parsePublicArguments(args) {
  if (args.length === 1 && args[0] === 'validate') return { command: 'validate' };
  if (args.length === 1 && args[0] === 'verify') return { command: 'verify' };
  if (args[0] !== 'generate')
    usageError(
      'Usage: cli.js generate --mode preview | generate --mode production --as-of YYYY-MM-DD | validate | verify'
    );
  const values = new Map();
  for (let index = 1; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!['--mode', '--as-of'].includes(key) || !value || values.has(key))
      usageError('generateの引数が不正です。');
    values.set(key, value);
  }
  const mode = values.get('--mode');
  if (mode === 'preview') {
    if (values.has('--as-of') || args.length !== 3)
      usageError('preview生成へ--as-ofを指定できません。');
    return { command: 'generate', mode };
  }
  if (mode === 'production') {
    const asOf = values.get('--as-of');
    if (args.length !== 5 || !isValidDateOnly(asOf))
      usageError('production生成には有効な--as-of YYYY-MM-DDが必要です。');
    return { command: 'generate', mode, asOf };
  }
  usageError('modeはpreviewまたはproductionだけです。');
}

function runtimeResult(error) {
  return createResult({
    severity: 'error',
    code: error.code,
    file: error.file,
    message: error.message,
    suggested_action: '引数、入力ファイル、公開Schema、または実行環境を確認してください。'
  });
}

async function generate(repoRoot, options) {
  const loaded =
    options.mode === 'preview'
      ? await loadPreviewInput(repoRoot)
      : await loadProductionInput(repoRoot);
  const inputErrors = loaded.results.filter(({ severity }) => severity === 'error');
  if (inputErrors.length > 0) return { results: inputErrors, exitCode: 1 };
  const asOf = options.mode === 'preview' ? loaded.manifest.as_of : options.asOf;
  const artifacts = {};
  const results = [];
  for (const locale of PUBLIC_LOCALES) {
    const built = buildPublicNavigation(loaded.input, {
      locale,
      artifactType: ARTIFACT_TYPES[options.mode],
      asOf
    });
    results.push(...built.results);
    if (built.artifact) artifacts[locale] = built.artifact;
  }
  if (results.length > 0) return { results: sortResults(results), exitCode: 1 };
  const writeResults = await writePublicArtifacts(repoRoot, options.mode, artifacts);
  return { results: writeResults, exitCode: writeResults.length > 0 ? 1 : 0 };
}

export async function runPublicCli(
  args,
  { cwd = process.cwd(), stdout = console.log, stderr = console.error } = {}
) {
  try {
    const options = parsePublicArguments(args);
    let execution;
    if (options.command === 'generate') execution = await generate(cwd, options);
    else if (options.command === 'validate') {
      const { results } = await validatePublicRepository(cwd);
      execution = { results, exitCode: results.length > 0 ? 1 : 0 };
    } else {
      const results = await verifyPublicArtifacts(cwd);
      execution = { results, exitCode: results.length > 0 ? 1 : 0 };
    }
    stdout(formatResults(execution.results));
    return execution.exitCode;
  } catch (error) {
    const result =
      error instanceof PublicRuntimeError
        ? runtimeResult(error)
        : runtimeResult(
            new PublicRuntimeError(
              'PUB-RUN-E004',
              'scripts/publication/cli.js',
              `想定外の内部例外です: ${error.stack ?? error.message}`,
              error
            )
          );
    stderr(formatResults([result]));
    return 2;
  }
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectExecution) process.exitCode = await runPublicCli(process.argv.slice(2));
