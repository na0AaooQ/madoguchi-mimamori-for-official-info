import { execFileSync } from 'node:child_process';
import {
  appendFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { baseUrlsMatch } from '../site/site-url.js';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const shaPattern = /^[a-f0-9]{40}$/i;
const maintenanceFiles = ['404.html', 'index.html'];
const requiredText = [
  'まどぐちみまもり',
  'Madoguchi Mimamori',
  '現在、システムメンテナンス中です。',
  'ご不便をおかけいたしますが、しばらく時間をおいてから再度アクセスしてください。',
  'This site is temporarily unavailable due to maintenance.',
  'We apologize for the inconvenience. Please try again later.'
];

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

export function validateInputs({ mode, productionSha = '', ref, controlSha }) {
  requireCondition(ref === 'refs/heads/main', 'Only refs/heads/main may deploy.');
  requireCondition(['production', 'maintenance'].includes(mode), 'Invalid deploy_mode.');
  requireCondition(shaPattern.test(controlSha ?? ''), 'Invalid control SHA.');
  if (mode === 'production') {
    requireCondition(
      shaPattern.test(productionSha),
      'production_sha must be a full 40-digit hexadecimal commit SHA.'
    );
  } else {
    requireCondition(productionSha === '', 'production_sha must be empty in maintenance mode.');
  }
  return {
    mode,
    controlSha: controlSha.toLowerCase(),
    contentSha: (mode === 'production' ? productionSha : controlSha).toLowerCase()
  };
}

export function validateProductionSha(controlRoot, contentSha, controlSha) {
  requireCondition(
    shaPattern.test(contentSha) && shaPattern.test(controlSha),
    'Invalid commit SHA.'
  );
  requireCondition(
    git(controlRoot, ['rev-parse', 'HEAD']) === controlSha.toLowerCase(),
    'Control checkout SHA mismatch.'
  );
  requireCondition(
    git(controlRoot, ['cat-file', '-t', contentSha]) === 'commit',
    'production_sha must identify an existing commit.'
  );
  git(controlRoot, ['merge-base', '--is-ancestor', contentSha, controlSha]);
}

// This intentionally accepts only the small, static HTML vocabulary used by sorry.html.
// Unknown tags/attributes and CSS resource loading fail closed, without an npm parser.
export function validateSorryPage(source) {
  const html = new TextDecoder('utf-8', { fatal: true }).decode(source);
  requireCondition(
    /^<!doctype html>\s*<html lang="ja">/i.test(html),
    'Expected HTML5 and lang=ja.'
  );
  const allowed = {
    html: ['lang'],
    head: [],
    meta: ['charset', 'name', 'content'],
    title: [],
    style: [],
    body: [],
    main: [],
    p: ['class'],
    h1: [],
    section: ['lang', 'aria-labelledby'],
    h2: ['id']
  };
  const parents = {
    html: undefined,
    head: 'html',
    body: 'html',
    meta: 'head',
    title: 'head',
    style: 'head',
    main: 'body',
    section: 'main',
    h1: 'main',
    h2: 'section'
  };
  const stack = [];
  const counts = {};
  let end = 0;
  for (const match of html.matchAll(/<[^>]*>/g)) {
    requireCondition(!/[<>]/.test(html.slice(end, match.index)), 'Malformed HTML text.');
    end = match.index + match[0].length;
    if (/^<!doctype html>$/i.test(match[0])) {
      requireCondition(match.index === 0, 'Unexpected doctype.');
      continue;
    }
    const tag = /^<(\/?)([a-z][a-z0-9]*)([^<>]*)>$/i.exec(match[0]);
    requireCondition(tag, 'Malformed HTML tag.');
    const [, closing, rawName, rest] = tag;
    const name = rawName.toLowerCase();
    requireCondition(Object.hasOwn(allowed, name), `Forbidden HTML tag: ${name}`);
    if (closing) {
      requireCondition(rest.trim() === '' && stack.pop() === name, 'Invalid HTML nesting.');
      continue;
    }
    if (name === 'p')
      requireCondition(['main', 'section'].includes(stack.at(-1)), 'Invalid paragraph location.');
    else requireCondition(stack.at(-1) === parents[name], `Invalid ${name} location.`);
    let attributes = name === 'meta' ? rest.replace(/\s*\/\s*$/, '') : rest;
    const seen = new Set();
    while (attributes.trim()) {
      const attribute = /^\s+([a-z][a-z0-9-]*)="([^"<>]*)"/i.exec(attributes);
      requireCondition(attribute, 'Only quoted, explicit HTML attributes are allowed.');
      const key = attribute[1].toLowerCase();
      requireCondition(
        allowed[name].includes(key) && !seen.has(key),
        `Forbidden or duplicate attribute: ${key}`
      );
      seen.add(key);
      attributes = attributes.slice(attribute[0].length);
    }
    counts[name] = (counts[name] ?? 0) + 1;
    if (name !== 'meta') stack.push(name);
  }
  requireCondition(stack.length === 0 && html.slice(end).trim() === '', 'Incomplete HTML.');
  for (const name of ['html', 'head', 'title', 'style', 'body', 'main', 'h1', 'h2', 'section']) {
    requireCondition(counts[name] === 1, `Expected exactly one ${name}.`);
  }
  requireCondition(
    counts.meta === 2 && /<meta charset="utf-8"\s*\/?>/i.test(html),
    'Expected UTF-8 metadata.'
  );
  requireCondition(
    /<meta name="viewport" content="width=device-width, initial-scale=1"\s*\/?>/.test(html),
    'Expected responsive viewport.'
  );
  requireCondition(
    /<title>[^<>]*まどぐちみまもり[^<>]*<\/title>/.test(html),
    'Expected site title.'
  );
  requireCondition(html.includes(`<h1>${requiredText[2]}</h1>`), 'Expected Japanese h1.');
  const english = /<section lang="en" aria-labelledby="maintenance-en">([\s\S]*?)<\/section>/.exec(
    html
  )?.[1];
  requireCondition(
    english?.includes(`<h2 id="maintenance-en">${requiredText[4]}</h2>`) &&
      english.includes(requiredText[5]),
    'Expected English section and heading.'
  );
  for (const text of requiredText)
    requireCondition(html.includes(text), `Missing maintenance text: ${text}`);
  const css = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1];
  requireCondition(
    css &&
      !/(?:@|\\|\/\*|url\s*\(|image-set\s*\(|src\s*\(|expression\s*\(|https?:|data:|\/\/)/i.test(
        css
      ),
    'Forbidden CSS resource or executable content.'
  );
  return html;
}

async function assertNoSymlink(root, relative) {
  let current = root;
  for (const segment of ['', ...relative.split('/')]) {
    current = path.join(current, segment);
    const info = await lstat(current).catch((error) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    requireCondition(!info?.isSymbolicLink(), `Symbolic link is not allowed: ${current}`);
  }
}

async function listFiles(root, relative = '') {
  const files = [];
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const file = path.posix.join(relative, entry.name);
    const info = await lstat(path.join(root, file));
    requireCondition(!info.isSymbolicLink(), `Symbolic link is not allowed: ${file}`);
    if (info.isDirectory()) files.push(...(await listFiles(root, file)));
    else {
      requireCondition(
        info.isFile() && info.size > 0 && info.nlink === 1,
        `Invalid or empty artifact file: ${file}`
      );
      files.push(file);
    }
  }
  return files.sort();
}

export async function validateMaintenanceArtifact(directory, source) {
  validateSorryPage(source);
  const entries = await readdir(directory);
  requireCondition(
    JSON.stringify(entries.sort()) === JSON.stringify(maintenanceFiles),
    'Maintenance artifact must contain only index.html and 404.html.'
  );
  requireCondition(
    JSON.stringify(await listFiles(directory)) === JSON.stringify(maintenanceFiles),
    'Invalid maintenance artifact.'
  );
  for (const file of maintenanceFiles) {
    requireCondition(
      (await readFile(path.join(directory, file))).equals(source),
      `${file} differs from sorry.html.`
    );
  }
}

export async function prepareMaintenancePages(root = repoRoot) {
  await assertNoSymlink(root, 'maintenance/sorry.html');
  const source = await readFile(path.join(root, 'maintenance/sorry.html'));
  validateSorryPage(source);
  await assertNoSymlink(root, 'dist/site/maintenance');
  const parent = path.join(root, 'dist/site');
  await mkdir(parent, { recursive: true });
  const staging = await mkdtemp(path.join(parent, '.tmp-maintenance-'));
  const destination = path.join(parent, 'maintenance');
  const backup = `${staging}-previous`;
  let backedUp = false;
  try {
    for (const file of maintenanceFiles) await writeFile(path.join(staging, file), source);
    await validateMaintenanceArtifact(staging, source);
    try {
      await rename(destination, backup);
      backedUp = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    try {
      await rename(staging, destination);
    } catch (error) {
      if (backedUp) await rename(backup, destination);
      throw error;
    }
    await rm(backup, { recursive: true, force: true });
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return destination;
}

export async function validateDeploymentArtifact({
  workspace,
  controlRoot,
  mode,
  productionSha = '',
  ref,
  controlSha,
  actualBaseUrl,
  artifactPath
}) {
  const inputs = validateInputs({ mode, productionSha, ref, controlSha });
  requireCondition(
    path.resolve(controlRoot) === path.join(workspace, 'control'),
    'Control checkout must be isolated in control/.'
  );
  requireCondition(
    git(controlRoot, ['rev-parse', 'HEAD']) === inputs.controlSha,
    'Control checkout SHA mismatch.'
  );
  const expectedPath =
    mode === 'production'
      ? 'production-source/dist/site/production'
      : 'control/dist/site/maintenance';
  requireCondition(
    artifactPath === expectedPath,
    'Artifact path is outside the permitted directory.'
  );
  await assertNoSymlink(workspace, expectedPath);
  const configured = JSON.parse(
    await readFile(path.join(controlRoot, 'site/production.json'), 'utf8')
  );
  requireCondition(
    baseUrlsMatch(configured.base_url, actualBaseUrl),
    'GitHub Pages base URL does not match control configuration.'
  );
  const directory = path.join(workspace, expectedPath);
  if (mode === 'maintenance') {
    await validateMaintenanceArtifact(
      directory,
      await readFile(path.join(controlRoot, 'maintenance/sorry.html'))
    );
  } else {
    validateProductionSha(controlRoot, inputs.contentSha, inputs.controlSha);
    const sourceRoot = path.join(workspace, 'production-source');
    requireCondition(
      git(sourceRoot, ['rev-parse', 'HEAD']) === inputs.contentSha,
      'Production checkout SHA mismatch.'
    );
    const config = JSON.parse(
      await readFile(path.join(sourceRoot, 'site/production.json'), 'utf8')
    );
    requireCondition(
      baseUrlsMatch(config.base_url, actualBaseUrl),
      'GitHub Pages base URL does not match production configuration.'
    );
    const files = await listFiles(directory);
    const tracked = git(sourceRoot, ['ls-files', '-z', '--', 'dist/site/production'])
      .split('\0')
      .filter(Boolean)
      .map((file) => file.slice('dist/site/production/'.length))
      .sort();
    requireCondition(
      files.includes('index.html') &&
        files.includes('404.html') &&
        JSON.stringify(files) === JSON.stringify(tracked),
      'Production artifact must contain exactly the tracked site files.'
    );
    git(sourceRoot, ['diff', '--exit-code', 'HEAD', '--', 'dist/site/production']);
  }
  return { ...inputs, artifactPath: expectedPath, validated: 'true' };
}

async function output(values, env) {
  console.log(JSON.stringify(values, null, 2));
  if (env.GITHUB_OUTPUT) {
    const names = {
      mode: 'mode',
      controlSha: 'control_sha',
      contentSha: 'content_sha',
      artifactPath: 'artifact_path',
      validated: 'validated'
    };
    await appendFile(
      env.GITHUB_OUTPUT,
      Object.entries(values)
        .map(([key, value]) => `${names[key]}=${value}\n`)
        .join('')
    );
  }
}

export async function run(command, env = process.env) {
  const options = {
    mode: env.DEPLOY_MODE,
    productionSha: env.PRODUCTION_SHA ?? '',
    ref: env.GITHUB_REF,
    controlSha: env.CONTROL_SHA
  };
  const inputs = validateInputs(options);
  if (command === 'validate-inputs') {
    requireCondition(
      git(repoRoot, ['rev-parse', 'HEAD']) === inputs.controlSha,
      'Control checkout SHA mismatch.'
    );
    if (inputs.mode === 'production')
      validateProductionSha(repoRoot, inputs.contentSha, inputs.controlSha);
    await output(inputs, env);
  } else if (command === 'prepare-maintenance') {
    requireCondition(
      inputs.mode === 'maintenance',
      'Maintenance generation requires maintenance mode.'
    );
    await prepareMaintenancePages();
    console.log('Maintenance artifact prepared and validated. Deployment has not started.');
  } else if (command === 'validate-artifact') {
    requireCondition(
      env.GITHUB_WORKSPACE && path.isAbsolute(env.GITHUB_WORKSPACE),
      'GITHUB_WORKSPACE must be an absolute directory.'
    );
    const values = await validateDeploymentArtifact({
      ...options,
      workspace: env.GITHUB_WORKSPACE,
      controlRoot: repoRoot,
      actualBaseUrl: env.ACTUAL_BASE_URL,
      artifactPath: env.ARTIFACT_PATH
    });
    await output(values, env);
  } else
    throw new Error(
      'Usage: prepare-pages.js validate-inputs|prepare-maintenance|validate-artifact'
    );
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  run(process.argv[2]).catch((error) => {
    console.error(`Pages validation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
