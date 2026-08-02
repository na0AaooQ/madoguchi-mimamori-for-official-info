import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { runSiteCli } from '../../scripts/site/cli.js';
import { validateSiteRepository, verifySiteArtifacts } from '../../scripts/site/site-artifacts.js';
import { createSiteRepositoryCopy, readJson, writeJson } from '../helpers/site-generation.js';

test('validates and verifies tracked artifacts read-only', async (t) => {
  const root = await createSiteRepositoryCopy(t);
  const file = path.join(root, 'dist/site/preview/ja/index.html');
  const before = await readFile(file, 'utf8');
  assert.deepEqual(await validateSiteRepository(root), []);
  assert.deepEqual(await verifySiteArtifacts(root), []);
  assert.equal(await readFile(file, 'utf8'), before);
});

test('detects missing, stale, unexpected, and directly edited artifacts', async (t) => {
  const root = await createSiteRepositoryCopy(t);
  await rm(path.join(root, 'dist/site/preview/en/privacy/index.html'));
  await writeFile(path.join(root, 'dist/site/preview/stale.html'), '<h1>stale</h1>\n');
  const validation = await validateSiteRepository(root);
  assert.ok(validation.filter(({ code }) => code === 'SITE-E004').length >= 2);

  const editedRoot = await createSiteRepositoryCopy(t);
  const edited = path.join(editedRoot, 'dist/site/preview/ja/index.html');
  await writeFile(
    edited,
    (await readFile(edited, 'utf8')).replace('確認したい公式情報を探す', '手編集')
  );
  assert.ok((await validateSiteRepository(editedRoot)).some(({ code }) => code === 'SITE-E006'));
  assert.ok((await verifySiteArtifacts(editedRoot)).some(({ code }) => code === 'SITE-E006'));
});

test('invalid English input preserves the existing generated site', async (t) => {
  const root = await createSiteRepositoryCopy(t);
  const tracked = path.join(root, 'dist/site/preview/ja/index.html');
  const before = await readFile(tracked, 'utf8');
  const english = await readJson(root, 'site/locales/en.json');
  delete english.preview_notice;
  await writeJson(root, 'site/locales/en.json', english);
  assert.equal(await runSiteCli(['generate'], { cwd: root, stdout: () => {} }), 1);
  assert.equal(await readFile(tracked, 'utf8'), before);
});

test('rejects unsafe anchors and missing destination language notes', async (t) => {
  const unsafeRoot = await createSiteRepositoryCopy(t);
  const japanese = await readJson(unsafeRoot, 'dist/public-data/preview/ja/navigation.json');
  japanese.sections[0].anchor_id = '..';
  await writeJson(unsafeRoot, 'dist/public-data/preview/ja/navigation.json', japanese);
  assert.ok(
    (await validateSiteRepository(unsafeRoot)).some(({ code }) =>
      ['PUB-E004', 'SITE-E002'].includes(code)
    )
  );

  const languageRoot = await createSiteRepositoryCopy(t);
  const english = await readJson(languageRoot, 'dist/public-data/preview/en/navigation.json');
  delete english.sections[0].cards[0].links[0].destination.destination_language_note;
  await writeJson(languageRoot, 'dist/public-data/preview/en/navigation.json', english);
  assert.ok(
    (await validateSiteRepository(languageRoot)).some(({ code }) =>
      ['PUB-E004', 'SITE-E003'].includes(code)
    )
  );
});

test('CLI returns 0, 1, and 2 by result class', async (t) => {
  const root = await createSiteRepositoryCopy(t);
  assert.equal(await runSiteCli(['validate'], { cwd: root, stdout: () => {} }), 0);
  await rm(path.join(root, 'dist/site/preview/ja/index.html'));
  assert.equal(await runSiteCli(['validate'], { cwd: root, stdout: () => {} }), 1);
  let output = '';
  assert.equal(await runSiteCli([], { cwd: root, stderr: (value) => (output = value) }), 2);
  assert.match(output, /SITE-RUN-E001/);
});
