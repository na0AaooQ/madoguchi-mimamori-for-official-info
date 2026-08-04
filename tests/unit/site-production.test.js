import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  buildSiteArtifacts,
  expectedSiteArtifactPaths,
  productionSitemapUrls
} from '../../scripts/site/site-builder.js';
import { loadSiteInputs } from '../../scripts/site/site-input-loader.js';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const inputs = await loadSiteInputs(repoRoot, 'production');
if (inputs.results.length > 0) throw new Error(JSON.stringify(inputs.results));

test('builds the deterministic 18-file production site from production navigation only', () => {
  const first = buildSiteArtifacts(inputs);
  const cloned = structuredClone(inputs);
  cloned.assets['favicon.ico'] = Buffer.from(cloned.assets['favicon.ico']);
  cloned.assets['apple-touch-icon.png'] = Buffer.from(cloned.assets['apple-touch-icon.png']);
  const second = buildSiteArtifacts(cloned);
  assert.equal(first.size, 18);
  assert.deepEqual([...first], [...second]);
  assert.deepEqual(
    [...first.keys()].sort(),
    expectedSiteArtifactPaths(inputs.navigations, 'production')
  );
  for (const file of ['index.html', '404.html', 'sitemap.xml']) assert.ok(first.has(file));
  for (const draft of ['life-safety-medical', 'roads-transportation', 'support-recovery']) {
    assert.equal(
      [...first.keys()].some((file) => file.includes(draft)),
      false
    );
  }
});

test('generates accessible indexable production HTML and only the 404 is noindex', () => {
  const artifacts = buildSiteArtifacts(inputs);
  for (const [file, source] of artifacts) {
    if (!file.endsWith('.html')) continue;
    assert.equal([...source.matchAll(/<h1(?:\s|>)/g)].length, 1, file);
    assert.doesNotMatch(source, /<details\b[^>]*\sopen(?:\s|>)/, file);
    assert.doesNotMatch(source, /<summary\b[^>]*\srole=/, file);
    assert.doesNotMatch(source, /tabindex="[1-9]/, file);
    assert.doesNotMatch(source, /\/preview\/|example\.invalid/, file);
    assert.equal(
      [...source.matchAll(/<link rel="icon" href="\/favicon\.ico" sizes="16x16 32x32 48x48">/g)]
        .length,
      1,
      file
    );
    assert.equal(
      [
        ...source.matchAll(
          /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml" sizes="any">/g
        )
      ].length,
      1,
      file
    );
    assert.equal(
      [
        ...source.matchAll(
          /<link rel="apple-touch-icon" href="\/apple-touch-icon\.png" sizes="180x180">/g
        )
      ].length,
      1,
      file
    );
    if (file === '404.html') assert.match(source, /<meta name="robots" content="noindex">/);
    else assert.doesNotMatch(source, /<meta name="robots"/);
  }
});

test('uses language-specific contacts and safe clickable external links', () => {
  const artifacts = buildSiteArtifacts(inputs);
  const japanese = artifacts.get('ja/privacy/index.html');
  const english = artifacts.get('en/privacy/index.html');
  assert.match(japanese, /href="https:\/\/portfolio\.na0aaooq\.com\/contact\.html"/);
  assert.doesNotMatch(japanese, /\/en\/contact\.html/);
  assert.match(english, /href="https:\/\/portfolio\.na0aaooq\.com\/en\/contact\.html"/);
  assert.doesNotMatch(english, /href="https:\/\/portfolio\.na0aaooq\.com\/contact\.html"/);
  const section = artifacts.get('ja/sections/public-institutions-disaster/index.html');
  assert.match(section, /href="https:\/\/portal\.bousai\.pref\.kumamoto\.jp\/"/);
  for (const source of [japanese, english, section]) {
    for (const match of source.matchAll(/<a\b[^>]*href="https:\/\/[^>]+>/g)) {
      assert.match(match[0], /target="_blank"/);
      assert.match(match[0], /rel="noopener noreferrer"/);
    }
  }
});

test('generates the canonical 11-URL sitemap in deterministic order', () => {
  const urls = productionSitemapUrls(inputs);
  assert.equal(urls.length, 11);
  assert.equal(urls[0], 'https://madoguchi.kokoromimamori.na0aaooq.com/');
  assert.ok(urls.every((url) => url.startsWith('https://')));
  assert.equal(
    urls.some((url) => /404|assets|navigation\.json|preview/.test(url)),
    false
  );
  const sitemap = buildSiteArtifacts(inputs).get('sitemap.xml');
  assert.ok(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n'));
  assert.ok(sitemap.endsWith('\n'));
  assert.equal([...sitemap.matchAll(/<loc>/g)].length, 11);
});
