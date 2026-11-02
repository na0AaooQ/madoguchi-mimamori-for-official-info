import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  prepareMaintenancePages,
  validateDeploymentArtifact,
  validateInputs,
  validateMaintenanceArtifact,
  validateProductionSha,
  validateSorryPage
} from '../../scripts/maintenance/prepare-pages.js';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const canonical = await readFile(path.join(repoRoot, 'maintenance/sorry.html'));
const baseUrl = 'https://madoguchi.kokoromimamori.na0aaooq.com';
const sha = 'a'.repeat(40);
const inputs = { mode: 'maintenance', productionSha: '', ref: 'refs/heads/main', controlSha: sha };

async function temporaryRoot(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'madoguchi-maintenance-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function put(root, file, content) {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), content);
}

test('MT-01/02/03: canonical Sorry page is nonempty, bilingual, and accessible static HTML', () => {
  assert.ok(canonical.length > 0);
  const html = validateSorryPage(canonical);
  assert.match(html, /max-width: 640px/);
  assert.match(html, /font-family:\s*system-ui/);
  assert.match(html, /border-top:/);
  assert.equal((html.match(/<h1>/g) ?? []).length, 1);
});

test('MT-02/03/04: rejects missing copy, malformed structure, encoding, and forbidden content', () => {
  const html = canonical.toString();
  const variants = [
    '',
    html.replace('しばらく時間をおいてから', ''),
    html.replace('Please try again later.', ''),
    html.replace('<!doctype html>', ''),
    html.replace('charset="utf-8"', 'charset="shift-jis"'),
    html.replace('name="viewport"', 'name="other"'),
    html.replace('<html lang="ja">', '<html lang="en">'),
    html.replace('<section lang="en"', '<section lang="ja"'),
    html.replace('<main>', '<main><h1>Extra heading</h1>'),
    html.replace('</main>', ''),
    html.replaceAll('h2', 'h3'),
    html.replace('<title>', '<title></title><title>'),
    html.replace('<body>', '<body onload="alert(1)">'),
    html.replace('<main>', '<main><script>alert(localStorage.x)</script>'),
    html.replace('<main>', '<main><script src="https://example.invalid/x.js"></script>'),
    html.replace('<main>', '<main><img src="https://example.invalid/x.png">'),
    html.replace('<main>', '<main><iframe src="https://example.invalid"></iframe>'),
    html.replace('<main>', '<main><form></form>'),
    html.replace('<head>', '<head><link rel="stylesheet" href="https://example.invalid/x.css">'),
    html.replace('<head>', '<head><meta http-equiv="refresh" content="0;url=/">'),
    html.replace('<style>', '<style>@import "https://example.invalid/x.css";'),
    html.replace('<style>', '<style>body { background: url(https://example.invalid/x.png); }'),
    html.replace(
      '<style>',
      '<style>body { background: image-set("https://example.invalid/x.png" 1x); }'
    ),
    html.replace('<style>', '<style>/* hidden resource */'),
    html.replace('<style>', '<style>body { background: u\\72l(x); }'),
    html.replace('<main>', '<main><svg><image href="/x"></image></svg>')
  ];
  for (const variant of variants) assert.throws(() => validateSorryPage(Buffer.from(variant)));
  assert.throws(() => validateSorryPage(Buffer.concat([canonical, Buffer.from([0xff])])));
});

test('MT-05/06: replaces stale artifacts with exactly two identical files, preserving normal sites', async (t) => {
  const root = await temporaryRoot(t);
  await put(root, 'maintenance/sorry.html', canonical);
  await put(root, 'dist/site/production/index.html', 'production sentinel');
  await put(root, 'dist/site/preview/index.html', 'preview sentinel');
  await put(root, 'dist/site/maintenance/data/private.json', 'must disappear');
  const directory = await prepareMaintenancePages(root);
  assert.deepEqual((await readdir(directory)).sort(), ['404.html', 'index.html']);
  await validateMaintenanceArtifact(directory, canonical);
  assert.equal(
    await readFile(path.join(root, 'dist/site/production/index.html'), 'utf8'),
    'production sentinel'
  );
  assert.equal(
    await readFile(path.join(root, 'dist/site/preview/index.html'), 'utf8'),
    'preview sentinel'
  );
  assert.deepEqual((await readdir(path.join(root, 'dist/site'))).sort(), [
    'maintenance',
    'preview',
    'production'
  ]);
});

test('MT-01/05/06: missing or invalid source fails without replacing existing artifacts', async (t) => {
  const root = await temporaryRoot(t);
  await assert.rejects(prepareMaintenancePages(root));
  await put(root, 'maintenance/sorry.html', canonical);
  const directory = await prepareMaintenancePages(root);
  await put(root, 'maintenance/sorry.html', '<html>invalid</html>');
  await assert.rejects(prepareMaintenancePages(root));
  assert.deepEqual(await readFile(path.join(directory, 'index.html')), canonical);
  await writeFile(path.join(directory, '404.html'), 'different');
  await assert.rejects(validateMaintenanceArtifact(directory, canonical));
  await writeFile(path.join(directory, '404.html'), canonical);
  await mkdir(path.join(directory, 'extra-empty-directory'));
  await assert.rejects(validateMaintenanceArtifact(directory, canonical));
});

test('MT-06: rejects symbolic links in source and output paths', async (t) => {
  const root = await temporaryRoot(t);
  await put(root, 'source.html', canonical);
  await mkdir(path.join(root, 'maintenance'));
  await symlink(path.join(root, 'source.html'), path.join(root, 'maintenance/sorry.html'));
  await assert.rejects(prepareMaintenancePages(root), /Symbolic link/);
  await rm(path.join(root, 'maintenance/sorry.html'));
  await put(root, 'maintenance/sorry.html', canonical);
  await mkdir(path.join(root, 'elsewhere'));
  await symlink(path.join(root, 'elsewhere'), path.join(root, 'dist'));
  await assert.rejects(prepareMaintenancePages(root), /Symbolic link/);
});

test('MT-07, DP-01/02/03, PR-01: accepts only main and exact mode/SHA combinations', () => {
  assert.equal(validateInputs(inputs).contentSha, sha);
  assert.equal(
    validateInputs({ ...inputs, mode: 'production', productionSha: sha.toUpperCase() }).contentSha,
    sha
  );
  for (const changes of [
    { ref: 'refs/heads/feature/test' },
    { ref: 'refs/tags/main' },
    { mode: '' },
    { mode: 'other' },
    { mode: 'Production' },
    { productionSha: sha },
    { productionSha: ' ' },
    { mode: 'production', productionSha: '' },
    { mode: 'production', productionSha: 'a'.repeat(39) },
    { mode: 'production', productionSha: 'g'.repeat(40) },
    { mode: 'production', productionSha: `${sha}\n` },
    { mode: 'production', productionSha: '$(touch unwanted)' },
    { controlSha: '' }
  ])
    assert.throws(() => validateInputs({ ...inputs, ...changes }));
});

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function commit(root, message) {
  git(root, ['add', '.']);
  git(root, [
    '-c',
    'user.name=Local Test',
    '-c',
    'user.email=test@example.invalid',
    'commit',
    '-m',
    message
  ]);
  return git(root, ['rev-parse', 'HEAD']);
}

async function deploymentFixture(t) {
  const workspace = await temporaryRoot(t);
  const controlRoot = path.join(workspace, 'control');
  await mkdir(controlRoot);
  git(controlRoot, ['init', '-b', 'main']);
  await put(controlRoot, 'site/production.json', JSON.stringify({ base_url: baseUrl }));
  await put(controlRoot, 'dist/site/production/index.html', 'old published site');
  await put(controlRoot, 'dist/site/production/404.html', 'old 404');
  const publishedSha = commit(controlRoot, 'old published commit without maintenance feature');
  await put(controlRoot, 'dist/site/production/index.html', 'unpublished main site');
  await put(controlRoot, 'maintenance/sorry.html', canonical);
  const controlSha = commit(controlRoot, 'control with unpublished content and maintenance');
  const sourceRoot = path.join(workspace, 'production-source');
  git(workspace, ['clone', '--no-hardlinks', controlRoot, sourceRoot]);
  git(sourceRoot, ['checkout', '--detach', publishedSha]);
  const options = {
    workspace,
    controlRoot,
    mode: 'production',
    productionSha: publishedSha,
    ref: 'refs/heads/main',
    controlSha,
    actualBaseUrl: `${baseUrl}/`,
    artifactPath: 'production-source/dist/site/production'
  };
  return { ...options, options, sourceRoot, publishedSha };
}

test('PR-02/03: rejects nonexistent, non-commit, and off-main SHAs', async (t) => {
  const { controlRoot, publishedSha, controlSha } = await deploymentFixture(t);
  validateProductionSha(controlRoot, publishedSha, controlSha);
  assert.throws(() => validateProductionSha(controlRoot, '0'.repeat(40), controlSha));
  assert.throws(() =>
    validateProductionSha(
      controlRoot,
      git(controlRoot, ['rev-parse', `${publishedSha}^{tree}`]),
      controlSha
    )
  );
  git(controlRoot, ['checkout', '-b', 'outside-main', publishedSha]);
  await put(controlRoot, 'unrelated.txt', 'off main');
  const offMain = commit(controlRoot, 'outside main ancestry');
  git(controlRoot, ['checkout', 'main']);
  assert.throws(() => validateProductionSha(controlRoot, offMain, controlSha));
  assert.throws(
    () => validateProductionSha(controlRoot, publishedSha, publishedSha),
    /Control checkout/
  );
});

test('PR-04/06: isolated old SHA uses its tracked files while the newer control selects them', async (t) => {
  const { options, sourceRoot, controlRoot, publishedSha } = await deploymentFixture(t);
  const result = await validateDeploymentArtifact(options);
  assert.equal(result.validated, 'true');
  assert.equal(result.contentSha, publishedSha);
  assert.equal(
    await readFile(path.join(sourceRoot, 'dist/site/production/index.html'), 'utf8'),
    'old published site'
  );
  assert.equal(
    await readFile(path.join(controlRoot, 'dist/site/production/index.html'), 'utf8'),
    'unpublished main site'
  );
  await assert.rejects(readFile(path.join(sourceRoot, 'maintenance/sorry.html')));
});

test('DP-04/05/06: rejects URL mismatch, wrong path, empty, altered, extra, or linked production files', async (t) => {
  const { options, sourceRoot } = await deploymentFixture(t);
  for (const actualBaseUrl of [
    '',
    'http://madoguchi.kokoromimamori.na0aaooq.com',
    'https://example.invalid',
    `${baseUrl}/other`
  ]) {
    await assert.rejects(validateDeploymentArtifact({ ...options, actualBaseUrl }), /base URL/);
  }
  for (const artifactPath of [
    '.',
    'data',
    'control/dist/site/production',
    'production-source',
    '/tmp',
    '../dist/site/production'
  ]) {
    await assert.rejects(validateDeploymentArtifact({ ...options, artifactPath }), /Artifact path/);
  }
  await put(sourceRoot, 'dist/site/production/private.json', 'extra');
  await assert.rejects(validateDeploymentArtifact(options), /exactly the tracked/);
  await rm(path.join(sourceRoot, 'dist/site/production/private.json'));
  await put(sourceRoot, 'dist/site/production/index.html', 'tampered');
  await assert.rejects(validateDeploymentArtifact(options));
  await put(sourceRoot, 'dist/site/production/index.html', '');
  await assert.rejects(validateDeploymentArtifact(options), /empty artifact/);
  await rm(path.join(sourceRoot, 'dist/site/production/index.html'));
  await symlink(
    path.join(sourceRoot, 'site/production.json'),
    path.join(sourceRoot, 'dist/site/production/index.html')
  );
  await assert.rejects(validateDeploymentArtifact(options), /Symbolic link/);
  await rm(path.join(sourceRoot, 'dist/site/production'), { recursive: true });
  await mkdir(path.join(sourceRoot, 'dist/site/production'));
  await assert.rejects(validateDeploymentArtifact(options));
});

test('maintenance validation is independent of production checkout, npm dependencies, and builds', async (t) => {
  const { options, controlRoot, sourceRoot } = await deploymentFixture(t);
  await rm(sourceRoot, { recursive: true });
  await put(controlRoot, 'package.json', '{broken production package');
  await prepareMaintenancePages(controlRoot);
  const maintenance = {
    ...options,
    mode: 'maintenance',
    productionSha: '',
    artifactPath: 'control/dist/site/maintenance'
  };
  assert.equal((await validateDeploymentArtifact(maintenance)).contentSha, options.controlSha);
  await assert.rejects(
    validateDeploymentArtifact({ ...maintenance, actualBaseUrl: 'https://example.invalid' }),
    /base URL/
  );
  await put(controlRoot, 'dist/site/maintenance/private.json', 'must not upload');
  await assert.rejects(validateDeploymentArtifact(maintenance), /only index.html and 404.html/);
});

test('MT-08: CLI failure exits nonzero without emitting upload approval or executing shell input', async (t) => {
  const root = await temporaryRoot(t);
  const output = path.join(root, 'github-output');
  await writeFile(output, '');
  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, 'scripts/maintenance/prepare-pages.js'), 'validate-inputs'],
    {
      cwd: root,
      env: {
        ...process.env,
        GITHUB_REF: 'refs/heads/main',
        CONTROL_SHA: sha,
        DEPLOY_MODE: 'production',
        PRODUCTION_SHA: '$(touch unwanted)',
        GITHUB_OUTPUT: output
      },
      encoding: 'utf8'
    }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Pages validation failed/);
  assert.equal(await readFile(output, 'utf8'), '');
  assert.deepEqual(await readdir(root), ['github-output']);
});
