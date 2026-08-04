import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { runSiteCli } from '../../scripts/site/cli.js';
import {
  absoluteSiteUrl,
  baseUrlsMatch,
  joinSitePath,
  parseProductionBaseUrl
} from '../../scripts/site/site-url.js';

const repoRoot = path.resolve(import.meta.dirname, '../..');

test('parses project URLs and root custom domains with normalized trailing slash', () => {
  assert.deepEqual(parseProductionBaseUrl('https://na0aaooq.github.io/repository/'), {
    baseUrl: 'https://na0aaooq.github.io/repository',
    origin: 'https://na0aaooq.github.io',
    basePath: '/repository'
  });
  assert.deepEqual(parseProductionBaseUrl('https://madoguchi.example/'), {
    baseUrl: 'https://madoguchi.example',
    origin: 'https://madoguchi.example',
    basePath: ''
  });
});

test('rejects unsafe production base URLs', () => {
  for (const value of [
    'http://example.com',
    'https://user:pass@example.com',
    'https://example.com/?query=1',
    'https://example.com/#fragment'
  ]) {
    assert.throws(() => parseProductionBaseUrl(value), TypeError);
  }
});

test('joins paths without duplicate base paths or double slashes', () => {
  assert.equal(joinSitePath('/repository', 'ja/'), '/repository/ja/');
  assert.equal(joinSitePath('/repository', '/repository/ja/'), '/repository/ja/');
  assert.equal(joinSitePath('', 'assets/styles.css'), '/assets/styles.css');
  assert.equal(
    joinSitePath('/nested/repository', '/nested/repository/en/'),
    '/nested/repository/en/'
  );
  assert.equal(
    absoluteSiteUrl(parseProductionBaseUrl('https://na0aaooq.github.io/repository'), 'ja/'),
    'https://na0aaooq.github.io/repository/ja/'
  );
});

test('compares configure-pages base URLs after trailing-slash normalization', async () => {
  assert.equal(
    baseUrlsMatch(
      'https://madoguchi.kokoromimamori.na0aaooq.com',
      'https://madoguchi.kokoromimamori.na0aaooq.com/'
    ),
    true
  );
  assert.equal(baseUrlsMatch('https://example.com', 'https://example.com/other'), false);
  assert.equal(
    await runSiteCli(
      ['check-base-url', '--actual', 'https://madoguchi.kokoromimamori.na0aaooq.com/'],
      { cwd: repoRoot, stdout: () => {} }
    ),
    0
  );
  assert.equal(
    await runSiteCli(['check-base-url', '--actual', 'https://na0aaooq.github.io/repository'], {
      cwd: repoRoot,
      stdout: () => {}
    }),
    1
  );
});
