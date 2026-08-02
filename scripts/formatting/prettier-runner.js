import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

import * as prettier from 'prettier';

const execFileAsync = promisify(execFile);
const BASELINE_RELATIVE_PATH = 'scripts/formatting/prettier-baseline.json';
const SUPPORTED_EXTENSIONS = new Set(['.js', '.json', '.md']);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export class BaselineError extends Error {
  constructor(message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'BaselineError';
  }
}

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export function normalizeRelativePath(filePath) {
  return filePath.split(path.sep).join('/');
}

export function isSupportedPath(filePath) {
  const normalized = normalizeRelativePath(filePath);
  return (
    normalized !== 'package-lock.json' && SUPPORTED_EXTENSIONS.has(path.posix.extname(normalized))
  );
}

function assertBaselinePath(filePath) {
  if (typeof filePath !== 'string' || filePath === '') {
    throw new BaselineError('Baseline entry path must be a non-empty string.');
  }
  if (path.posix.isAbsolute(filePath) || path.win32.isAbsolute(filePath)) {
    throw new BaselineError(`Baseline path must be relative: ${filePath}`);
  }
  const normalized = path.posix.normalize(filePath);
  if (normalized !== filePath || normalized === '..' || normalized.startsWith('../')) {
    throw new BaselineError(`Baseline path must stay inside the repository: ${filePath}`);
  }
  if (path.posix.extname(filePath) !== '.md') {
    throw new BaselineError(`Only Markdown may be baselined: ${filePath}`);
  }
}

export async function validateBaseline(
  baseline,
  { repoRoot, trackedAtBase, currentTracked, baseHashes = new Map() }
) {
  if (baseline === null || typeof baseline !== 'object' || Array.isArray(baseline)) {
    throw new BaselineError('Prettier baseline must be a JSON object.');
  }
  if (baseline.version !== 1) {
    throw new BaselineError('Prettier baseline version must be 1.');
  }
  if (typeof baseline.generated_from !== 'string' || baseline.generated_from.trim() === '') {
    throw new BaselineError('Prettier baseline generated_from is required.');
  }
  if (!Array.isArray(baseline.files)) {
    throw new BaselineError('Prettier baseline files must be an array.');
  }

  const seen = new Set();
  for (const entry of baseline.files) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new BaselineError('Each Prettier baseline entry must be an object.');
    }
    assertBaselinePath(entry.path);
    if (seen.has(entry.path)) {
      throw new BaselineError(`Duplicate Prettier baseline path: ${entry.path}`);
    }
    seen.add(entry.path);
    if (!SHA256_PATTERN.test(entry.sha256)) {
      throw new BaselineError(`Invalid SHA-256 for baseline path: ${entry.path}`);
    }
    if (!trackedAtBase.has(entry.path)) {
      throw new BaselineError(
        `Baseline path was not tracked at ${baseline.generated_from}: ${entry.path}`
      );
    }
    if (!currentTracked.has(entry.path)) {
      throw new BaselineError(`Baseline path is not currently Git-tracked: ${entry.path}`);
    }
    const absolutePath = path.join(repoRoot, entry.path);
    try {
      const fileStat = await stat(absolutePath);
      if (!fileStat.isFile()) throw new BaselineError(`Baseline path is not a file: ${entry.path}`);
    } catch (error) {
      if (error instanceof BaselineError) throw error;
      throw new BaselineError(`Baseline path does not exist: ${entry.path}`, error);
    }
    const baseHash = baseHashes.get(entry.path);
    if (baseHash && baseHash !== entry.sha256) {
      throw new BaselineError(
        `Baseline SHA-256 does not match ${baseline.generated_from}: ${entry.path}`
      );
    }
  }

  return baseline;
}

async function gitOutput(repoRoot, args, { nul = false } = {}) {
  const { stdout } = await execFileAsync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });
  if (nul) return stdout.split('\0').filter(Boolean).map(normalizeRelativePath);
  return stdout.split('\n').filter(Boolean).map(normalizeRelativePath);
}

async function readBaseline(repoRoot) {
  const baselinePath = path.join(repoRoot, BASELINE_RELATIVE_PATH);
  let source;
  try {
    source = await readFile(baselinePath, 'utf8');
  } catch (error) {
    throw new BaselineError(`Unable to read ${BASELINE_RELATIVE_PATH}.`, error);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new BaselineError(`${BASELINE_RELATIVE_PATH} is not valid JSON.`, error);
  }
}

async function repositoryBaselineState(repoRoot, baseline) {
  const currentTracked = new Set(
    await gitOutput(repoRoot, ['ls-files', '--cached', '-z'], { nul: true })
  );
  const trackedAtBase = new Set(
    await gitOutput(repoRoot, ['ls-tree', '-r', '--name-only', '-z', baseline.generated_from], {
      nul: true
    })
  );
  const baseHashes = new Map();
  for (const entry of baseline.files) {
    const { stdout } = await execFileAsync(
      'git',
      ['show', `${baseline.generated_from}:${entry.path}`],
      { cwd: repoRoot, encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }
    );
    baseHashes.set(entry.path, sha256(stdout));
  }
  return { currentTracked, trackedAtBase, baseHashes };
}

export async function collectCandidateFiles(repoRoot) {
  const listed = await gitOutput(
    repoRoot,
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { nul: true }
  );
  const ignorePath = path.join(repoRoot, '.prettierignore');
  const candidates = [];

  for (const relativePath of [...new Set(listed)].sort()) {
    if (!isSupportedPath(relativePath)) continue;
    const absolutePath = path.join(repoRoot, relativePath);
    try {
      await access(absolutePath);
    } catch {
      continue;
    }
    const fileInfo = await prettier.getFileInfo(absolutePath, {
      ignorePath,
      withNodeModules: false
    });
    if (!fileInfo.ignored && fileInfo.inferredParser) candidates.push(relativePath);
  }

  return candidates;
}

export async function selectFormatTargets({ repoRoot, candidates, baseline }) {
  const baselineByPath = new Map(baseline.files.map((entry) => [entry.path, entry.sha256]));
  const targets = [];
  const deferred = [];
  const staleBaselinePaths = [];

  for (const relativePath of [...candidates].sort()) {
    const registeredHash = baselineByPath.get(relativePath);
    if (!registeredHash || path.posix.extname(relativePath) !== '.md') {
      targets.push(relativePath);
      continue;
    }
    const currentHash = sha256(await readFile(path.join(repoRoot, relativePath)));
    if (currentHash === registeredHash) {
      deferred.push(relativePath);
    } else {
      targets.push(relativePath);
      staleBaselinePaths.push(relativePath);
    }
  }

  return { targets, deferred, staleBaselinePaths };
}

async function prettierOptions(absolutePath) {
  return { ...(await prettier.resolveConfig(absolutePath)), filepath: absolutePath };
}

export async function checkTargets(repoRoot, targets) {
  const unformatted = [];
  for (const relativePath of targets) {
    const absolutePath = path.join(repoRoot, relativePath);
    const source = await readFile(absolutePath, 'utf8');
    if (!(await prettier.check(source, await prettierOptions(absolutePath)))) {
      unformatted.push(relativePath);
    }
  }
  return unformatted;
}

export async function writeTargets(repoRoot, targets) {
  const changed = [];
  for (const relativePath of targets) {
    const absolutePath = path.join(repoRoot, relativePath);
    const source = await readFile(absolutePath, 'utf8');
    const formatted = await prettier.format(source, await prettierOptions(absolutePath));
    if (formatted !== source) {
      await writeFile(absolutePath, formatted);
      changed.push(relativePath);
    }
  }
  return changed;
}

async function removeStaleBaselineEntries(repoRoot, baseline, stalePaths) {
  if (stalePaths.length === 0) return;
  const stale = new Set(stalePaths);
  const updated = {
    ...baseline,
    files: baseline.files.filter(({ path: filePath }) => !stale.has(filePath))
  };
  const absolutePath = path.join(repoRoot, BASELINE_RELATIVE_PATH);
  const formatted = await prettier.format(`${JSON.stringify(updated, null, 2)}\n`, {
    ...(await prettier.resolveConfig(absolutePath)),
    filepath: absolutePath
  });
  await writeFile(absolutePath, formatted);
}

function printDeferred(deferred, output) {
  if (deferred.length === 0) return;
  output(`Deferred ${deferred.length} unchanged legacy Markdown file(s) by SHA-256 baseline:`);
  for (const filePath of deferred) output(`  ${filePath}`);
  output('These files are not claimed to be Prettier-formatted.');
}

export async function runPrettier({
  mode,
  repoRoot,
  output = console.log,
  errorOutput = console.error
}) {
  const baseline = await readBaseline(repoRoot);
  const state = await repositoryBaselineState(repoRoot, baseline);
  await validateBaseline(baseline, { repoRoot, ...state });
  const candidates = await collectCandidateFiles(repoRoot);
  const selection = await selectFormatTargets({ repoRoot, candidates, baseline });
  printDeferred(selection.deferred, output);

  if (mode === 'check') {
    const unformatted = await checkTargets(repoRoot, selection.targets);
    for (const filePath of unformatted) {
      errorOutput(`Prettier formatting required: ${filePath} (run npm run format)`);
    }
    if (unformatted.length > 0) return 1;
    if (selection.staleBaselinePaths.length > 0) {
      errorOutput(
        `Changed baseline Markdown must be formatted and removed from the baseline: ${selection.staleBaselinePaths.join(', ')}`
      );
      return 2;
    }
    return 0;
  }

  const changed = await writeTargets(repoRoot, selection.targets);
  await removeStaleBaselineEntries(repoRoot, baseline, selection.staleBaselinePaths);
  output(`Formatted ${changed.length} file(s).`);
  return 0;
}

function parseMode(args) {
  if (args.length !== 1 || !['--check', '--write'].includes(args[0])) {
    throw new BaselineError('Usage: prettier-runner.js --check | --write');
  }
  return args[0].slice(2);
}

export async function main(args = process.argv.slice(2)) {
  try {
    const mode = parseMode(args);
    return await runPrettier({ mode, repoRoot: process.cwd() });
  } catch (error) {
    console.error(`Prettier runner error: ${error.message}`);
    return 2;
  }
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectExecution) process.exitCode = await main();
