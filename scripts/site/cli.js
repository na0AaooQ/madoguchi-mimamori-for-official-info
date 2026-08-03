import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createResult, formatResults } from '../validation/result.js';
import {
  validateSiteRepository,
  verifySiteArtifacts,
  writeSiteArtifacts
} from './site-artifacts.js';
import { SiteRuntimeError, getSiteMode } from './site-constants.js';
import { loadSiteInputs } from './site-input-loader.js';
import { baseUrlsMatch, loadProductionSiteUrl } from './site-url.js';

function usageError() {
  throw new SiteRuntimeError(
    'SITE-RUN-E001',
    'scripts/site/cli.js',
    'Usage: cli.js generate --mode preview|production | validate | verify | check-base-url --actual URL'
  );
}

export function parseSiteArguments(args) {
  if (args.length === 1 && ['validate', 'verify'].includes(args[0])) return { command: args[0] };
  if (args.length === 3 && args[0] === 'generate' && args[1] === '--mode') {
    getSiteMode(args[2]);
    return { command: 'generate', mode: args[2] };
  }
  if (args.length === 3 && args[0] === 'check-base-url' && args[1] === '--actual')
    return { command: 'check-base-url', actual: args[2] };
  usageError();
}

function runtimeResult(error) {
  return createResult({
    severity: 'error',
    code: error.code,
    file: error.file,
    message: error.message,
    suggested_action:
      '引数、公開データ、画面用locale、production設定、生成元、または実行環境を確認してください。'
  });
}

function baseUrlMismatch(configured, actual) {
  return createResult({
    severity: 'error',
    code: 'SITE-E007',
    file: 'site/production.json',
    field: 'base_url',
    message: `Git管理中のbase_url (${configured}) とGitHub Pagesのbase_url (${actual}) が一致しません。`,
    suggested_action:
      'Pages設定とsite/production.jsonを一致させ、productionサイトを再生成してください。'
  });
}

export async function runSiteCli(
  args,
  { cwd = process.cwd(), stdout = console.log, stderr = console.error } = {}
) {
  try {
    const options = parseSiteArguments(args);
    let results;
    if (options.command === 'generate') {
      const inputs = await loadSiteInputs(cwd, options.mode);
      results = inputs.results.length > 0 ? inputs.results : await writeSiteArtifacts(cwd, inputs);
    } else if (options.command === 'validate') results = await validateSiteRepository(cwd);
    else if (options.command === 'verify') results = await verifySiteArtifacts(cwd);
    else {
      const configured = await loadProductionSiteUrl(cwd);
      results = baseUrlsMatch(configured.baseUrl, options.actual)
        ? []
        : [baseUrlMismatch(configured.baseUrl, options.actual)];
    }
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
