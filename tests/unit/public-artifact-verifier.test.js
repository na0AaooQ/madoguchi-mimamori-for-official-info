import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { runPublicCli } from '../../scripts/publication/cli.js';
import { PUBLIC_ARTIFACT_PATHS } from '../../scripts/publication/public-constants.js';
import {
  validatePublicRepository,
  verifyPublicArtifacts
} from '../../scripts/publication/public-artifact-verifier.js';
import { writePublicArtifacts } from '../../scripts/publication/public-artifact-writer.js';
import {
  createPreviewArtifacts,
  createPublicRepositoryCopy,
  makeProductionArtifact,
  readJson,
  writeJson
} from '../helpers/public-generation.js';

test('validates and verifies tracked preview artifacts read-only', async (t) => {
  const root = await createPublicRepositoryCopy(t);
  const before = await Promise.all(
    Object.values(PUBLIC_ARTIFACT_PATHS.preview).map((file) =>
      readFile(path.join(root, file), 'utf8')
    )
  );
  assert.deepEqual((await validatePublicRepository(root)).results, []);
  assert.deepEqual(await verifyPublicArtifacts(root), []);
  const after = await Promise.all(
    Object.values(PUBLIC_ARTIFACT_PATHS.preview).map((file) =>
      readFile(path.join(root, file), 'utf8')
    )
  );
  assert.deepEqual(after, before);
});

test('detects missing preview languages and unexpected files with PUB-E008', async (t) => {
  const root = await createPublicRepositoryCopy(t);
  await rm(path.join(root, PUBLIC_ARTIFACT_PATHS.preview.en));
  await writeFile(path.join(root, 'dist/public-data/unexpected.json'), '{}\n');
  const { results } = await validatePublicRepository(root);
  assert.ok(results.filter(({ code }) => code === 'PUB-E008').length >= 2);
});

test('detects tracked preview edits and stale fixture generation with PUB-E006', async (t) => {
  const root = await createPublicRepositoryCopy(t);
  const japanese = await readJson(root, PUBLIC_ARTIFACT_PATHS.preview.ja);
  japanese.site.site_name = '手編集';
  await writeJson(root, PUBLIC_ARTIFACT_PATHS.preview.ja, japanese);
  assert.ok((await verifyPublicArtifacts(root)).some(({ code }) => code === 'PUB-E006'));

  const inputFile = 'tests/fixtures/public-generation/preview/input.json';
  const input = await readJson(root, inputFile);
  input.site.locales.en.site_name = 'Changed fictional fixture';
  await writeJson(root, inputFile, input);
  assert.ok((await verifyPublicArtifacts(root)).some(({ code }) => code === 'PUB-E006'));
});

test('enforces production lifecycle and pair rules', async (t) => {
  await t.test('draft with no production is valid', async (t) => {
    const root = await createPublicRepositoryCopy(t);
    assert.deepEqual((await validatePublicRepository(root)).results, []);
  });
  await t.test('draft with production is PUB-E007', async (t) => {
    const root = await createPublicRepositoryCopy(t);
    const previews = await createPreviewArtifacts();
    for (const locale of ['ja', 'en']) {
      await writeJson(
        root,
        PUBLIC_ARTIFACT_PATHS.production[locale],
        makeProductionArtifact(previews[locale])
      );
    }
    assert.ok(
      (await validatePublicRepository(root)).results.some(({ code }) => code === 'PUB-E007')
    );
  });
  await t.test('published with no production is PUB-E007', async (t) => {
    const root = await createPublicRepositoryCopy(t);
    const site = await readJson(root, 'data/core/site.json');
    Object.assign(site, {
      site_publication_status: 'published',
      site_last_checked_on: '2026-08-02',
      contact_url: 'https://public.example/contact/'
    });
    await writeJson(root, 'data/core/site.json', site);
    assert.ok(
      (await validatePublicRepository(root)).results.some(({ code }) => code === 'PUB-E007')
    );
  });
  await t.test('one production language is PUB-E008', async (t) => {
    const root = await createPublicRepositoryCopy(t);
    const previews = await createPreviewArtifacts();
    await writeJson(root, PUBLIC_ARTIFACT_PATHS.production.ja, makeProductionArtifact(previews.ja));
    assert.ok(
      (await validatePublicRepository(root)).results.some(({ code }) => code === 'PUB-E008')
    );
  });
});

test('writer validates both artifacts before changing tracked files', async (t) => {
  const root = await createPublicRepositoryCopy(t);
  const previews = await createPreviewArtifacts();
  const before = await readFile(path.join(root, PUBLIC_ARTIFACT_PATHS.preview.ja), 'utf8');
  previews.en.sections[0].cards[0].internal_note = 'must not leak';
  const results = await writePublicArtifacts(root, 'preview', previews);
  assert.ok(results.some(({ code }) => code === 'PUB-E005'));
  assert.equal(await readFile(path.join(root, PUBLIC_ARTIFACT_PATHS.preview.ja), 'utf8'), before);
});

test('failed production generation validation preserves an existing production pair', async (t) => {
  const root = await createPublicRepositoryCopy(t);
  const previews = await createPreviewArtifacts();
  const productions = Object.fromEntries(
    ['ja', 'en'].map((locale) => [locale, makeProductionArtifact(previews[locale])])
  );
  for (const locale of ['ja', 'en']) {
    await writeJson(root, PUBLIC_ARTIFACT_PATHS.production[locale], productions[locale]);
  }
  const before = await Promise.all(
    ['ja', 'en'].map((locale) =>
      readFile(path.join(root, PUBLIC_ARTIFACT_PATHS.production[locale]), 'utf8')
    )
  );
  productions.en.sections[0].cards[0].links[0].destination.url = 'http://unsafe.example/';
  const results = await writePublicArtifacts(root, 'production', productions);
  assert.ok(results.some(({ code }) => code === 'PUB-E004'));
  const after = await Promise.all(
    ['ja', 'en'].map((locale) =>
      readFile(path.join(root, PUBLIC_ARTIFACT_PATHS.production[locale]), 'utf8')
    )
  );
  assert.deepEqual(after, before);
});

test('CLI validates arguments and returns 0, 1, and 2 by error class', async (t) => {
  const runtimeCases = [
    ['missing as-of', ['generate', '--mode', 'production']],
    ['invalid date', ['generate', '--mode', 'production', '--as-of', '2026-02-30']],
    ['unknown option', ['generate', '--mode', 'preview', '--output', '/tmp/out']],
    ['preview as-of', ['generate', '--mode', 'preview', '--as-of', '2026-08-02']]
  ];
  for (const [name, args] of runtimeCases) {
    await t.test(name, async () => {
      let output = '';
      assert.equal(await runPublicCli(args, { stderr: (value) => (output = value) }), 2);
      assert.match(output, /PUB-RUN-E001/);
    });
  }

  await t.test('successful validate and verify', async (t) => {
    const root = await createPublicRepositoryCopy(t);
    for (const args of [['validate'], ['verify']]) {
      let output = '';
      assert.equal(await runPublicCli(args, { cwd: root, stdout: (value) => (output = value) }), 0);
      assert.match(output, /Summary: Error 0, Warning 0, Info 0, Total 0/);
    }
  });

  await t.test('draft production generation is content exit 1 and writes nothing', async (t) => {
    const root = await createPublicRepositoryCopy(t);
    let output = '';
    assert.equal(
      await runPublicCli(['generate', '--mode', 'production', '--as-of', '2026-08-02'], {
        cwd: root,
        stdout: (value) => (output = value)
      }),
      1
    );
    assert.match(output, /PUB-E001/);
    await assert.rejects(() => readFile(path.join(root, PUBLIC_ARTIFACT_PATHS.production.ja)), {
      code: 'ENOENT'
    });
  });

  await t.test('preview generation succeeds at fixed paths', async (t) => {
    const root = await createPublicRepositoryCopy(t);
    await rm(path.join(root, 'dist'), { recursive: true });
    assert.equal(
      await runPublicCli(['generate', '--mode', 'preview'], { cwd: root, stdout: () => {} }),
      0
    );
    for (const file of Object.values(PUBLIC_ARTIFACT_PATHS.preview)) {
      assert.equal((await readFile(path.join(root, file), 'utf8')).endsWith('\n'), true);
    }
  });
});
