import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  checkTargets,
  isSupportedPath,
  selectFormatTargets,
  sha256,
  validateBaseline,
  writeTargets
} from '../../scripts/formatting/prettier-runner.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const runnerPath = path.join(repoRoot, 'scripts', 'formatting', 'prettier-runner.js');

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'madoguchi-prettier-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function baseline(files = []) {
  return { version: 1, generated_from: 'test-base', files };
}

test('selects new and unregistered Markdown', async (t) => {
  const root = await temporaryDirectory(t);
  await writeFile(path.join(root, 'new.md'), '# New\n');
  const selection = await selectFormatTargets({
    repoRoot: root,
    candidates: ['new.md'],
    baseline: baseline()
  });
  assert.deepEqual(selection.targets, ['new.md']);
});

test('defers only matching baselined Markdown', async (t) => {
  const root = await temporaryDirectory(t);
  const source = '# Legacy\n';
  await writeFile(path.join(root, 'legacy.md'), source);
  const selection = await selectFormatTargets({
    repoRoot: root,
    candidates: ['legacy.md'],
    baseline: baseline([{ path: 'legacy.md', sha256: sha256(source) }])
  });
  assert.deepEqual(selection.deferred, ['legacy.md']);
  assert.deepEqual(selection.targets, []);
});

test('selects baselined Markdown after content changes', async (t) => {
  const root = await temporaryDirectory(t);
  await writeFile(path.join(root, 'legacy.md'), '# Changed\n');
  const selection = await selectFormatTargets({
    repoRoot: root,
    candidates: ['legacy.md'],
    baseline: baseline([{ path: 'legacy.md', sha256: sha256('# Legacy\n') }])
  });
  assert.deepEqual(selection.targets, ['legacy.md']);
  assert.deepEqual(selection.staleBaselinePaths, ['legacy.md']);
});

test('always selects JavaScript and JSON', async (t) => {
  const root = await temporaryDirectory(t);
  await writeFile(path.join(root, 'test.js'), 'const x=1\n');
  await writeFile(path.join(root, 'test.json'), '{}\n');
  const selection = await selectFormatTargets({
    repoRoot: root,
    candidates: ['test.json', 'test.js'],
    baseline: baseline()
  });
  assert.deepEqual(selection.targets, ['test.js', 'test.json']);
});

test('excludes package-lock.json from supported paths', () => {
  assert.equal(isSupportedPath('package-lock.json'), false);
  assert.equal(isSupportedPath('package.json'), true);
});

test('rejects a missing baseline file', async (t) => {
  const root = await temporaryDirectory(t);
  await assert.rejects(
    validateBaseline(baseline([{ path: 'missing.md', sha256: 'a'.repeat(64) }]), {
      repoRoot: root,
      trackedAtBase: new Set(['missing.md']),
      currentTracked: new Set(['missing.md'])
    }),
    /does not exist/
  );
});

test('rejects a newly added Markdown baseline entry', async (t) => {
  const root = await temporaryDirectory(t);
  await writeFile(path.join(root, 'new.md'), '# New\n');
  await assert.rejects(
    validateBaseline(baseline([{ path: 'new.md', sha256: sha256('# New\n') }]), {
      repoRoot: root,
      trackedAtBase: new Set(),
      currentTracked: new Set()
    }),
    /was not tracked/
  );
});

test('rejects duplicate baseline paths', async (t) => {
  const root = await temporaryDirectory(t);
  await writeFile(path.join(root, 'legacy.md'), '# Legacy\n');
  const entry = { path: 'legacy.md', sha256: 'a'.repeat(64) };
  await assert.rejects(
    validateBaseline(baseline([entry, entry]), {
      repoRoot: root,
      trackedAtBase: new Set(['legacy.md']),
      currentTracked: new Set(['legacy.md'])
    }),
    /Duplicate/
  );
});

test('rejects an invalid SHA-256', async (t) => {
  const root = await temporaryDirectory(t);
  await writeFile(path.join(root, 'legacy.md'), '# Legacy\n');
  await assert.rejects(
    validateBaseline(baseline([{ path: 'legacy.md', sha256: 'invalid' }]), {
      repoRoot: root,
      trackedAtBase: new Set(['legacy.md']),
      currentTracked: new Set(['legacy.md'])
    }),
    /Invalid SHA-256/
  );
});

test('rejects non-Markdown baseline entries', async (t) => {
  const root = await temporaryDirectory(t);
  await writeFile(path.join(root, 'test.json'), '{}\n');
  await assert.rejects(
    validateBaseline(baseline([{ path: 'test.json', sha256: 'a'.repeat(64) }]), {
      repoRoot: root,
      trackedAtBase: new Set(['test.json']),
      currentTracked: new Set(['test.json'])
    }),
    /Only Markdown/
  );
});

test('--check helper does not write files', async (t) => {
  const root = await temporaryDirectory(t);
  const source = 'const value={a:1}\n';
  await writeFile(path.join(root, 'test.js'), source);
  assert.deepEqual(await checkTargets(root, ['test.js']), ['test.js']);
  assert.equal(await readFile(path.join(root, 'test.js'), 'utf8'), source);
});

test('--write helper formats only selected files', async (t) => {
  const root = await temporaryDirectory(t);
  const javascript = 'const value={a:1}\n';
  const markdown = '# Legacy\n\ntext\n';
  await writeFile(path.join(root, 'test.js'), javascript);
  await writeFile(path.join(root, 'legacy.md'), markdown);
  await writeTargets(root, ['test.js']);
  assert.notEqual(await readFile(path.join(root, 'test.js'), 'utf8'), javascript);
  assert.equal(await readFile(path.join(root, 'legacy.md'), 'utf8'), markdown);
});

test('--write leaves unchanged baselined Markdown untouched', async (t) => {
  const root = await temporaryDirectory(t);
  const source = '# Legacy\n\n|a|b|\n|-|-|\n|1|2|\n';
  await writeFile(path.join(root, 'legacy.md'), source);
  const selection = await selectFormatTargets({
    repoRoot: root,
    candidates: ['legacy.md'],
    baseline: baseline([{ path: 'legacy.md', sha256: sha256(source) }])
  });
  await writeTargets(root, selection.targets);
  assert.equal(await readFile(path.join(root, 'legacy.md'), 'utf8'), source);
});

test('unknown CLI arguments exit 2', () => {
  const result = spawnSync(process.execPath, [runnerPath, '--unknown'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage/);
});

test('target order is deterministic', async (t) => {
  const root = await temporaryDirectory(t);
  await writeFile(path.join(root, 'a.js'), 'const a=1\n');
  await writeFile(path.join(root, 'b.js'), 'const b=1\n');
  const selection = await selectFormatTargets({
    repoRoot: root,
    candidates: ['b.js', 'a.js'],
    baseline: baseline()
  });
  assert.deepEqual(selection.targets, ['a.js', 'b.js']);
});
