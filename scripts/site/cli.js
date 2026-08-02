import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createResult, formatResults } from '../validation/result.js';
import {
  validateSiteRepository,
  verifySiteArtifacts,
  writeSiteArtifacts
} from './site-artifacts.js';
import { SiteRuntimeError } from './site-constants.js';
import { loadSiteInputs } from './site-input-loader.js';

function runtimeResult(error) {
  return createResult({
    severity: 'error',
    code: error.code,
    file: error.file,
    message: error.message,
    suggested_action:
      '引数、preview公開データ、画面用locale、生成元、または実行環境を確認してください。'
  });
}

export async function runSiteCli(
  args,
  { cwd = process.cwd(), stdout = console.log, stderr = console.error } = {}
) {
  try {
    if (args.length !== 1 || !['generate', 'validate', 'verify'].includes(args[0])) {
      throw new SiteRuntimeError(
        'SITE-RUN-E001',
        'scripts/site/cli.js',
        'Usage: cli.js generate | validate | verify'
      );
    }
    let results;
    if (args[0] === 'generate') {
      const inputs = await loadSiteInputs(cwd);
      results = inputs.results.length > 0 ? inputs.results : await writeSiteArtifacts(cwd, inputs);
    } else if (args[0] === 'validate') results = await validateSiteRepository(cwd);
    else results = await verifySiteArtifacts(cwd);
    stdout(formatResults(results));
    return results.some(({ severity }) => severity === 'error') ? 1 : 0;
  } catch (error) {
    const runtimeError =
      error instanceof SiteRuntimeError
        ? error
        : new SiteRuntimeError(
            'SITE-RUN-E004',
            'scripts/site/cli.js',
            `想定外の内部例外です: ${error.stack ?? error.message}`,
            error
          );
    stderr(formatResults([runtimeResult(runtimeError)]));
    return 2;
  }
}

const direct =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (direct) process.exitCode = await runSiteCli(process.argv.slice(2));
