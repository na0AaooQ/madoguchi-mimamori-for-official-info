import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import * as prettier from 'prettier';

import { runCli } from '../../scripts/import/management-tsv/cli.js';
import { MANAGEMENT_UNITS } from '../../scripts/import/management-tsv/config.js';
import { runManagementImport } from '../../scripts/import/management-tsv/importer.js';
import { writeCandidateFiles } from '../../scripts/import/management-tsv/writer.js';
import {
  createFixtureCopy,
  createRepositoryCopy,
  dataDigest,
  dataFileSources,
  findTransientFiles,
  fixtureRoot,
  mutateTsvCell,
  repoRoot
} from '../helpers/management-tsv.js';

const targetPaths = MANAGEMENT_UNITS.flatMap(({ outputPaths }) =>
  Object.values(outputPaths)
).sort();

function options(inputDir, mode = 'check') {
  return { inputDir, dataUpdatedOn: '2026-08-04', mode };
}

async function runFixture(inputDir = fixtureRoot, dependencies = {}) {
  return runManagementImport(options(inputDir), { repoRoot, ...dependencies });
}

function candidateJson(execution, relativePath) {
  return JSON.parse(execution.candidates.get(relativePath));
}

test('generates 18 deterministic Core, Japanese, and English JSON candidates', async () => {
  const first = await runFixture();
  const second = await runFixture();
  assert.equal(first.exitCode, 0);
  assert.equal(first.candidates.size, 18);
  assert.deepEqual([...first.candidates], [...second.candidates]);
  for (const [relativePath, source] of first.candidates) {
    assert.equal(
      await prettier.check(source, {
        ...(await prettier.resolveConfig(path.join(repoRoot, relativePath))),
        filepath: path.join(repoRoot, relativePath)
      }),
      true,
      relativePath
    );
  }
  assert.deepEqual(first.summary.rows, {
    organizations: 1,
    sources: 1,
    evidence: 3,
    cards: 1,
    'card-source-links': 1,
    regions: 2
  });

  const coreSource = candidateJson(first, 'data/core/sources.json').items[0];
  const japaneseSource = candidateJson(first, 'data/locales/ja/sources.json').items[0];
  const englishSource = candidateJson(first, 'data/locales/en/sources.json').items[0];
  assert.equal(coreSource.id, 'src-example-prefecture-official-home');
  assert.deepEqual(coreSource.destination_locales, ['ja']);
  assert.equal(coreSource.show_in_official_source_list, false);
  assert.equal(Object.hasOwn(coreSource, 'No'), false);
  assert.equal(Object.hasOwn(coreSource, 'source_category_label'), false);
  assert.equal(Object.hasOwn(japaneseSource, 'display_title_ja'), false);
  assert.equal(japaneseSource.public_note, '架空の"引用符"を含む説明です。');
  assert.equal(englishSource.based_on_ja_revision, 1);
  assert.equal(Object.hasOwn(japaneseSource, 'target_audience_note'), false);

  const coreCard = candidateJson(first, 'data/core/cards.json').items[0];
  assert.equal(coreCard.display_order, 1);
  const coreRegions = candidateJson(first, 'data/core/regions.json').items;
  assert.deepEqual(
    coreRegions.map(({ id }) => id),
    ['region-example-prefecture', 'region-example-country']
  );
  assert.equal(coreRegions[0].official_code, '04567');
  assert.equal(coreRegions[1].official_code, '00123');
  const coreEvidence = candidateJson(first, 'data/core/evidence.json').items;
  assert.deepEqual(
    coreEvidence.map(({ id }) => id),
    [
      'evidence-example-organization-official',
      'evidence-example-organization-name-ja',
      'evidence-example-source-official-page'
    ]
  );
  assert.equal(coreEvidence[0].checked_on, '2026-08-02');
});

test('accepts BOM and CRLF variants without changing candidate semantics', async (t) => {
  const directory = await createFixtureCopy(t);
  const organizationPath = path.join(directory, '03-organizations.tsv');
  const organization = await readFile(organizationPath, 'utf8');
  await writeFile(organizationPath, `\uFEFF${organization.replaceAll('\n', '\r\n')}`);
  const execution = await runFixture(directory);
  assert.equal(execution.exitCode, 0);
  assert.equal(execution.candidates.size, 18);
});

test('--check validates all candidates without modifying data and cleans its temporary repository', async (t) => {
  const root = await createRepositoryCopy(t);
  const tempParent = await mkdtemp(path.join(os.tmpdir(), 'madoguchi-tsv-temp-parent-'));
  t.after(() => rm(tempParent, { recursive: true, force: true }));
  const before = await dataDigest(root);
  const execution = await runManagementImport(options('imports/management'), {
    repoRoot: root,
    tempParent
  });
  assert.equal(execution.exitCode, 0);
  assert.equal(await dataDigest(root), before);
  assert.deepEqual(await readdir(tempParent), []);
});

test('--write updates only the 18 target JSON files after validation', async (t) => {
  const root = await createRepositoryCopy(t);
  const before = await dataFileSources(root);
  const execution = await runManagementImport(options('imports/management', 'write'), {
    repoRoot: root
  });
  assert.equal(execution.exitCode, 0);
  assert.deepEqual(execution.summary.writtenPaths, targetPaths);
  const after = await dataFileSources(root);
  const changed = [...after]
    .filter(([relativePath, source]) => source !== before.get(relativePath))
    .map(([relativePath]) => relativePath)
    .sort();
  assert.deepEqual(changed, targetPaths);
  assert.deepEqual(await findTransientFiles(path.join(root, 'data')), []);
});

test('the CLI reports check and write summaries using an isolated repository', async (t) => {
  const root = await createRepositoryCopy(t);
  for (const mode of ['--check', '--write']) {
    const output = [];
    const errors = [];
    const exitCode = await runCli(
      ['--input-dir', 'imports/management', '--data-updated-on', '2026-08-04', mode],
      { repoRoot: root, stdout: (line) => output.push(line), stderr: (line) => errors.push(line) }
    );
    assert.equal(exitCode, 0);
    assert.deepEqual(errors, []);
    assert.match(output.join('\n'), new RegExp(`Mode: ${mode.slice(2)}`));
    assert.match(output.join('\n'), /Generated JSON files: 18/);
  }
});

test('input validation failure leaves every data file unchanged', async (t) => {
  const root = await createRepositoryCopy(t);
  await mutateTsvCell(
    path.join(root, 'imports/management'),
    '06-cards.tsv',
    'display_order',
    '1.5'
  );
  const before = await dataDigest(root);
  const execution = await runManagementImport(options('imports/management', 'write'), {
    repoRoot: root
  });
  assert.equal(execution.exitCode, 1);
  assert.ok(execution.results.some(({ code }) => code === 'TSV-E036'));
  assert.equal(await dataDigest(root), before);
});

test('existing Schema and semantic validation failure leaves every data file unchanged', async (t) => {
  const root = await createRepositoryCopy(t);
  await mutateTsvCell(
    path.join(root, 'imports/management'),
    '03-organizations.tsv',
    'organization_type',
    'unknown-type'
  );
  const before = await dataDigest(root);
  const execution = await runManagementImport(options('imports/management', 'write'), {
    repoRoot: root
  });
  assert.equal(execution.exitCode, 1);
  assert.ok(
    execution.results.some(
      ({ code, file, line, column }) =>
        code === 'E002' &&
        file === '03-organizations.tsv' &&
        line === 4 &&
        column === 'organization_type'
    )
  );
  assert.equal(await dataDigest(root), before);

  await mutateTsvCell(
    path.join(root, 'imports/management'),
    '03-organizations.tsv',
    'organization_type',
    'local-government'
  );
  await mutateTsvCell(
    path.join(root, 'imports/management'),
    '06-cards.tsv',
    'section_id',
    'section-missing'
  );
  const referenceExecution = await runManagementImport(options('imports/management', 'write'), {
    repoRoot: root
  });
  assert.equal(referenceExecution.exitCode, 1);
  assert.ok(referenceExecution.results.some(({ code }) => code === 'E005'));
  assert.equal(await dataDigest(root), before);
});

test('a simulated mid-write failure restores all 18 original files and removes transients', async (t) => {
  const root = await createRepositoryCopy(t);
  const before = await dataDigest(root);
  const execution = await runManagementImport(options('imports/management', 'write'), {
    repoRoot: root,
    writerAfterReplace: ({ count }) => {
      if (count === 5) throw new Error('simulated replacement failure');
    }
  });
  assert.equal(execution.exitCode, 2);
  assert.ok(execution.results.some(({ code }) => code === 'IMPORT-RUN-E004'));
  assert.equal(await dataDigest(root), before);
  assert.deepEqual(await findTransientFiles(path.join(root, 'data')), []);
});

test('post-write validation failure rolls back every target file', async (t) => {
  const checked = await runFixture();
  const root = await createRepositoryCopy(t);
  const before = await dataDigest(root);
  await assert.rejects(
    writeCandidateFiles({
      repoRoot: root,
      candidates: checked.candidates,
      validateAfterWrite: async () => ({ ok: false, results: [] })
    }),
    /書込み後の管理データ検証に失敗/
  );
  assert.equal(await dataDigest(root), before);
  assert.deepEqual(await findTransientFiles(path.join(root, 'data')), []);
});
