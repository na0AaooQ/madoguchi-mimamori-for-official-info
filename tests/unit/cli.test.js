import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const cliPath = path.join(repoRoot, 'scripts', 'validation', 'cli.js');

function runCli(args, cwd = repoRoot) {
  return spawnSync(process.execPath, [cliPath, ...args], { cwd, encoding: 'utf8' });
}

test('CLI exits 0 for valid data', () => {
  const result = runCli([
    '--schema',
    'tests/fixtures/schemas/item.schema.json',
    '--data',
    'tests/fixtures/valid/item.json'
  ]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Error 0/);
});

test('CLI exits 1 for validation Error', () => {
  const result = runCli([
    '--schema',
    'tests/fixtures/schemas/item.schema.json',
    '--data',
    'tests/fixtures/invalid/item.json'
  ]);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /E002/);
});

test('CLI treats malformed JSON as validation Error with exit 1', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'madoguchi-cli-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(path.join(directory, 'broken.json'), '{ broken');
  const result = runCli(
    [
      '--schema',
      path.join(repoRoot, 'tests/fixtures/schemas/item.schema.json'),
      '--data',
      'broken.json'
    ],
    directory
  );
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /E001/);
});

test('CLI exits 2 for a runtime read failure', () => {
  const result = runCli(['--schema', 'missing-schema.json', '--data', 'missing-data.json']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Unable to read/);
});

test('--fixtures exits 0 when expected failures match', () => {
  const result = runCli(['--fixtures']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Error 0/);
});

test('invalid CLI arguments exit 2 with useful output', () => {
  const result = runCli(['--unknown']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage/);
});
