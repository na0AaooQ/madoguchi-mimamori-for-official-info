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

test('detects missing and unexpected site icon artifacts', async (t) => {
  const root = await createSiteRepositoryCopy(t);
  await rm(path.join(root, 'dist/site/preview/favicon.ico'));
  await writeFile(path.join(root, 'dist/site/preview/favicon-old.ico'), Buffer.from([0, 1, 2]));
  const results = await validateSiteRepository(root, 'preview');
  assert.ok(
    results.some(
      ({ code, file, message }) =>
        code === 'SITE-E004' && file.endsWith('/favicon.ico') && message.includes('必須成果物')
    )
  );
  assert.ok(
    results.some(
      ({ code, file, message }) =>
        code === 'SITE-E004' && file.endsWith('/favicon-old.ico') && message.includes('想定外')
    )
  );
});

test('detects missing, duplicate, and mode-confused HTML icon references', async (t) => {
  const missingRoot = await createSiteRepositoryCopy(t);
  const missingFile = path.join(missingRoot, 'dist/site/preview/ja/index.html');
  await writeFile(
    missingFile,
    (await readFile(missingFile, 'utf8')).replace(
      '  <link rel="icon" href="/preview/favicon.svg" type="image/svg+xml" sizes="any">\n',
      ''
    )
  );
  assert.ok(
    (await validateSiteRepository(missingRoot, 'preview')).some(
      ({ code, file, message }) =>
        code === 'SITE-E005' &&
        file.endsWith('/ja/index.html') &&
        message.includes('/preview/favicon.svg')
    )
  );

  const duplicateRoot = await createSiteRepositoryCopy(t);
  const duplicateFile = path.join(duplicateRoot, 'dist/site/production/404.html');
  const duplicateLink =
    '  <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">';
  await writeFile(
    duplicateFile,
    (await readFile(duplicateFile, 'utf8')).replace(
      duplicateLink,
      `${duplicateLink}\n${duplicateLink}`
    )
  );
  assert.ok(
    (await validateSiteRepository(duplicateRoot, 'production')).some(
      ({ code, file, message }) =>
        code === 'SITE-E005' && file.endsWith('/404.html') && message.includes('link要素は3件')
    )
  );

  const productionRoot = await createSiteRepositoryCopy(t);
  const productionFile = path.join(productionRoot, 'dist/site/production/index.html');
  await writeFile(
    productionFile,
    (await readFile(productionFile, 'utf8')).replace(
      'href="/favicon.ico"',
      'href="/preview/favicon.ico"'
    )
  );
  assert.ok(
    (await validateSiteRepository(productionRoot, 'production')).some(
      ({ code, file, message }) =>
        code === 'SITE-E005' && file.endsWith('/index.html') && message.includes('modeに一致しない')
    )
  );

  const previewRoot = await createSiteRepositoryCopy(t);
  const previewFile = path.join(previewRoot, 'dist/site/preview/en/privacy/index.html');
  await writeFile(
    previewFile,
    (await readFile(previewFile, 'utf8')).replace(
      'href="/preview/favicon.ico"',
      'href="/favicon.ico"'
    )
  );
  assert.ok(
    (await validateSiteRepository(previewRoot, 'preview')).some(
      ({ code, file, message }) =>
        code === 'SITE-E005' &&
        file.endsWith('/en/privacy/index.html') &&
        message.includes('modeに一致しない')
    )
  );
});

test('compares binary artifacts byte-for-byte without newline validation', async (t) => {
  const root = await createSiteRepositoryCopy(t);
  const binaryFiles = [
    'dist/site/preview/favicon.ico',
    'dist/site/preview/apple-touch-icon.png',
    'dist/site/production/favicon.ico',
    'dist/site/production/apple-touch-icon.png'
  ];
  assert.deepEqual(await validateSiteRepository(root), []);
  const changed = path.join(root, 'dist/site/production/apple-touch-icon.png');
  const source = await readFile(changed);
  source[source.length - 1] ^= 0xff;
  await writeFile(changed, source);
  const results = await verifySiteArtifacts(root, 'production');
  assert.ok(
    results.some(({ code, file }) => code === 'SITE-E006' && file.endsWith('/apple-touch-icon.png'))
  );
  assert.equal(
    results.some(
      ({ file, message }) =>
        binaryFiles.some((binary) => file.endsWith(binary)) && message.includes('末尾改行')
    ),
    false
  );
});

test('invalid English input preserves the existing generated site', async (t) => {
  const root = await createSiteRepositoryCopy(t);
  const tracked = path.join(root, 'dist/site/preview/ja/index.html');
  const before = await readFile(tracked, 'utf8');
  const english = await readJson(root, 'site/locales/en.json');
  delete english.preview_notice;
  await writeJson(root, 'site/locales/en.json', english);
  assert.equal(
    await runSiteCli(['generate', '--mode', 'preview'], { cwd: root, stdout: () => {} }),
    1
  );
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

test('rejects an unsafe operator profile URL', async (t) => {
  const root = await createSiteRepositoryCopy(t);
  const japanese = await readJson(root, 'site/locales/ja.json');
  japanese.privacy.operator_url = 'javascript:alert(1)';
  await writeJson(root, 'site/locales/ja.json', japanese);
  assert.ok(
    (await validateSiteRepository(root)).some(
      ({ code, field }) => code === 'SITE-E001' && field === 'privacy.operator_url'
    )
  );
});

test('detects every footer contact-link contract regression', async (t) => {
  const contactUrl = 'https://portfolio.na0aaooq.com/contact.html';
  const contactAnchor = `<a href="${contactUrl}" target="_blank" rel="noopener noreferrer" aria-label="問い合わせページを新しいタブで開く">問い合わせ</a>`;
  for (const { name, mutate, expected } of [
    {
      name: 'internal anchor',
      mutate: (source) => source.replace(`href="${contactUrl}"`, 'href="#contact-information"'),
      expected: '内部アンカー'
    },
    {
      name: 'contact-information ID',
      mutate: (source) =>
        source.replace(
          '<footer class="site-footer">',
          '<footer id="contact-information" class="site-footer">'
        ),
      expected: 'contact-information ID'
    },
    {
      name: 'duplicate URL row',
      mutate: (source) =>
        source.replace(
          '<footer class="site-footer">',
          `<p>${contactUrl}</p>\n  <footer class="site-footer">`
        ),
      expected: 'href以外へ重複表示'
    },
    {
      name: 'missing target',
      mutate: (source) => source.replace(' target="_blank"', ''),
      expected: 'target="_blank"'
    },
    {
      name: 'missing noopener',
      mutate: (source) => source.replace('rel="noopener noreferrer"', 'rel="noreferrer"'),
      expected: 'noopenerとnoreferrer'
    },
    {
      name: 'missing noreferrer',
      mutate: (source) => source.replace('rel="noopener noreferrer"', 'rel="noopener"'),
      expected: 'noopenerとnoreferrer'
    },
    {
      name: 'wrong aria-label',
      mutate: (source) =>
        source.replace('aria-label="問い合わせページを新しいタブで開く"', 'aria-label="不一致"'),
      expected: 'aria-label'
    },
    {
      name: 'English URL on Japanese page',
      mutate: (source) =>
        source.replace(contactUrl, 'https://portfolio.na0aaooq.com/en/contact.html'),
      expected: '別言語'
    },
    {
      name: 'duplicate contact anchor',
      mutate: (source) => source.replace(contactAnchor, `${contactAnchor}${contactAnchor}`),
      expected: '1件必要'
    }
  ]) {
    await t.test(name, async (t) => {
      const root = await createSiteRepositoryCopy(t);
      const file = path.join(root, 'dist/site/preview/ja/index.html');
      await writeFile(file, mutate(await readFile(file, 'utf8')));
      const results = await validateSiteRepository(root, 'preview');
      assert.ok(
        results.some(({ message }) => message.includes(expected)),
        JSON.stringify(results)
      );
    });
  }
});

test('rejects footer and contact links on the production 404 page', async (t) => {
  const root = await createSiteRepositoryCopy(t);
  const file = path.join(root, 'dist/site/production/404.html');
  await writeFile(
    file,
    (await readFile(file, 'utf8')).replace(
      '<main id="main-content">',
      '<footer>https://portfolio.na0aaooq.com/contact.html</footer>\n    <main id="main-content">'
    )
  );
  const results = await validateSiteRepository(root, 'production');
  assert.ok(
    results.some(({ message }) => message.includes('404.htmlへフッターや問い合わせ導線')),
    JSON.stringify(results)
  );
});

test('detects mixed old and new privacy sessionStorage wording', async (t) => {
  const root = await createSiteRepositoryCopy(t);
  const file = path.join(root, 'dist/site/preview/en/privacy/index.html');
  await writeFile(
    file,
    (await readFile(file, 'utf8'))
      .replace(
        '4. Temporary text-size storage (sessionStorage)',
        '4. Temporary text-size storage (sessionStorage) / 4. sessionStorage'
      )
      .replace(
        'If the browser&#39;s sessionStorage feature (temporary storage that keeps data only while the same tab remains open) is unavailable, the site displays the standard text size.',
        'If sessionStorage is unavailable, the site displays the standard text size.'
      )
  );
  const results = await validateSiteRepository(root, 'preview');
  assert.ok(results.some(({ message }) => message.includes('旧sessionStorage説明')));
  assert.ok(results.some(({ message }) => message.includes('合意済みのsessionStorage説明')));
});

test('does not mix preview and production navigation artifact types', async (t) => {
  const productionRoot = await createSiteRepositoryCopy(t);
  const production = await readJson(
    productionRoot,
    'dist/public-data/production/ja/navigation.json'
  );
  production.artifact_type = 'fictional-preview';
  await writeJson(productionRoot, 'dist/public-data/production/ja/navigation.json', production);
  assert.ok(
    (await validateSiteRepository(productionRoot, 'production')).some(
      ({ code }) => code === 'PUB-E004'
    )
  );

  const previewRoot = await createSiteRepositoryCopy(t);
  const preview = await readJson(previewRoot, 'dist/public-data/preview/ja/navigation.json');
  preview.artifact_type = 'production';
  await writeJson(previewRoot, 'dist/public-data/preview/ja/navigation.json', preview);
  assert.ok(
    (await validateSiteRepository(previewRoot, 'preview')).some(({ code }) => code === 'PUB-E004')
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
