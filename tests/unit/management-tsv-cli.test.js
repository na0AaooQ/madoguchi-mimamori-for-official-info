import assert from 'node:assert/strict';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { runCli } from '../../scripts/import/management-tsv/cli.js';
import { createRepositoryCopy, fixtureRoot, repoRoot } from '../helpers/management-tsv.js';

async function execute(args, options = {}) {
  const stdout = [];
  const stderr = [];
  const exitCode = await runCli(args, {
    repoRoot,
    stdout: (line) => stdout.push(line),
    stderr: (line) => stderr.push(line),
    ...options
  });
  return { exitCode, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
}

test('rejects invalid CLI argument combinations without stack traces', async (t) => {
  const validPrefix = ['--input-dir', fixtureRoot, '--data-updated-on', '2026-08-04'];
  const cases = [
    [
      'missing input directory argument',
      ['--data-updated-on', '2026-08-04', '--check'],
      'CLI-E006'
    ],
    ['missing date argument', ['--input-dir', fixtureRoot, '--check'], 'CLI-E006'],
    ['missing input directory value', ['--input-dir', '--check'], 'CLI-E002'],
    ['both modes', [...validPrefix, '--check', '--write'], 'CLI-E004'],
    ['missing mode', validPrefix, 'CLI-E005'],
    ['unknown argument', [...validPrefix, '--check', '--unknown'], 'CLI-E001'],
    [
      'duplicate input argument',
      [...validPrefix, '--input-dir', fixtureRoot, '--check'],
      'CLI-E003'
    ],
    [
      'duplicate date argument',
      [...validPrefix, '--data-updated-on', '2026-08-04', '--check'],
      'CLI-E003'
    ],
    ['duplicate mode argument', [...validPrefix, '--check', '--check'], 'CLI-E003'],
    [
      'invalid date format',
      ['--input-dir', fixtureRoot, '--data-updated-on', '2026-8-4', '--check'],
      'CLI-E007'
    ],
    [
      'impossible date',
      ['--input-dir', fixtureRoot, '--data-updated-on', '2026-02-30', '--check'],
      'CLI-E007'
    ]
  ];
  for (const [name, args, code] of cases) {
    await t.test(name, async () => {
      const execution = await execute(args);
      assert.equal(execution.exitCode, 2);
      assert.match(execution.stderr, new RegExp(code));
      assert.doesNotMatch(execution.stderr, /\n\s+at\s/);
    });
  }
});

test('rejects a missing input directory and a missing required TSV', async (t) => {
  const missingDirectory = await execute([
    '--input-dir',
    'does-not-exist',
    '--data-updated-on',
    '2026-08-04',
    '--check'
  ]);
  assert.equal(missingDirectory.exitCode, 2);
  assert.match(missingDirectory.stderr, /INPUT-E001/);

  const root = await createRepositoryCopy(t);
  await rm(path.join(root, 'imports/management/05-evidence.tsv'));
  const missingFile = await execute(
    ['--input-dir', 'imports/management', '--data-updated-on', '2026-08-04', '--check'],
    { repoRoot: root }
  );
  assert.equal(missingFile.exitCode, 2);
  assert.match(missingFile.stderr, /INPUT-E002/);
  assert.match(missingFile.stderr, /05-evidence\.tsv/);
});

test('rejects an unexpected directory collision at a required TSV path', async (t) => {
  const root = await createRepositoryCopy(t);
  const target = path.join(root, 'imports/management/05-evidence.tsv');
  await rm(target);
  await mkdir(target);
  const execution = await execute(
    ['--input-dir', 'imports/management', '--data-updated-on', '2026-08-04', '--check'],
    { repoRoot: root }
  );
  assert.equal(execution.exitCode, 2);
  assert.match(execution.stderr, /INPUT-E003/);
});

test('accepts an absolute input directory path', async () => {
  const execution = await execute([
    '--input-dir',
    fixtureRoot,
    '--data-updated-on',
    '2026-08-04',
    '--check'
  ]);
  assert.equal(execution.exitCode, 0);
  assert.match(execution.stdout, /TSV import validation succeeded/);
});
