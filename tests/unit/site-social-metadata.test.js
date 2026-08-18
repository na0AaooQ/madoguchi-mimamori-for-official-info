import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { validateSiteRepository } from '../../scripts/site/site-artifacts.js';
import {
  buildSiteArtifacts,
  escapeHtml,
  expectedSiteArtifactPaths,
  productionSitemapUrls,
  productionSocialMetaTags
} from '../../scripts/site/site-builder.js';
import { loadSiteInputs } from '../../scripts/site/site-input-loader.js';
import { createSiteRepositoryCopy, readJson, writeJson } from '../helpers/site-generation.js';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const productionInputs = await loadSiteInputs(repoRoot, 'production');
const previewInputs = await loadSiteInputs(repoRoot, 'preview');
if (productionInputs.results.length > 0) throw new Error(JSON.stringify(productionInputs.results));
if (previewInputs.results.length > 0) throw new Error(JSON.stringify(previewInputs.results));

const OPEN_GRAPH_KEYS = Object.freeze([
  'og:title',
  'og:description',
  'og:type',
  'og:url',
  'og:site_name',
  'og:image',
  'og:image:type',
  'og:image:width',
  'og:image:height',
  'og:image:alt'
]);
const TWITTER_KEYS = Object.freeze([
  'twitter:card',
  'twitter:site',
  'twitter:title',
  'twitter:description',
  'twitter:image',
  'twitter:image:alt'
]);
const IMAGE_URL = 'https://madoguchi.kokoromimamori.na0aaooq.com/ogp-image.png';

function parseAttributes(source) {
  const attributes = {};
  for (const match of source.matchAll(/(?:^|\s)([^\s=/>]+)(?:\s*=\s*"([^"]*)")?/g))
    attributes[match[1]] = match[2] ?? '';
  return attributes;
}

function socialMetadata(source) {
  return [...source.matchAll(/<meta\b([^>]*)>/g)]
    .map((match) => parseAttributes(match[1]))
    .filter(
      ({ property = '', name = '' }) => property.startsWith('og:') || name.startsWith('twitter:')
    );
}

function metadataByKey(source) {
  return new Map(
    socialMetadata(source).map((attributes) => [attributes.property ?? attributes.name, attributes])
  );
}

function expectedPageMetadata(file) {
  if (file === 'index.html') {
    const japaneseUi = productionInputs.uiLocales.ja;
    const englishUi = productionInputs.uiLocales.en;
    return {
      title: 'まどぐちみまもり｜Madoguchi Mimamori',
      description: `${japaneseUi.root.description} / ${englishUi.root.description}`,
      url: 'https://madoguchi.kokoromimamori.na0aaooq.com/',
      siteName: 'まどぐちみまもり｜Madoguchi Mimamori',
      imageAlt: japaneseUi.social.image_alt
    };
  }

  const [, locale, rest] = /^(ja|en)\/(.*)index\.html$/.exec(file);
  const navigation = productionInputs.navigations[locale];
  const regional = productionInputs.regionalNavigations[locale].kumamoto;
  const ui = productionInputs.uiLocales[locale];
  let title;
  let description;
  let relative;
  let titleIncludesSite = true;
  if (rest === '') {
    title = [navigation.site.site_name, navigation.site.subtitle].join(
      locale === 'ja' ? '｜' : ' | '
    );
    description = navigation.site.short_description;
    relative = `${locale}/`;
    titleIncludesSite = false;
  } else if (rest === 'regions/kumamoto/') {
    title = [regional.region.region_name, navigation.site.site_name].join(
      locale === 'ja' ? '｜' : ' | '
    );
    description = regional.region.scope_note;
    relative = `${locale}/regions/kumamoto/`;
    titleIncludesSite = false;
  } else if (rest === 'regions/kumamoto/organizations/') {
    title = ui.pages.organizations_title;
    description = ui.pages.organizations_intro;
    title = [title, regional.region.region_name, navigation.site.site_name].join(
      locale === 'ja' ? '｜' : ' | '
    );
    relative = `${locale}/regions/kumamoto/organizations/`;
    titleIncludesSite = false;
  } else if (rest === 'privacy/') {
    title = ui.pages.privacy_title;
    description = ui.social.privacy_description;
    relative = `${locale}/privacy/`;
  } else {
    const anchorId = /^regions\/kumamoto\/sections\/([^/]+)\/$/.exec(rest)[1];
    const section = regional.sections.find(({ anchor_id: value }) => value === anchorId);
    title = [section.title, regional.region.region_name, navigation.site.site_name].join(
      locale === 'ja' ? '｜' : ' | '
    );
    description = section.short_description;
    relative = `${locale}/regions/kumamoto/sections/${anchorId}/`;
    titleIncludesSite = false;
  }
  return {
    title: titleIncludesSite
      ? `${title}${locale === 'ja' ? '｜' : ' | '}${navigation.site.site_name}`
      : title,
    description,
    url: `https://madoguchi.kokoromimamori.na0aaooq.com/${relative}`,
    siteName: navigation.site.site_name,
    imageAlt: ui.social.image_alt
  };
}

test('generates one complete 16-tag social metadata set for every production page', () => {
  const artifacts = buildSiteArtifacts(productionInputs);
  const pages = [...artifacts]
    .filter(([file]) => file.endsWith('.html') && file !== '404.html')
    .sort(([left], [right]) => left.localeCompare(right));
  const sitemapUrls = productionSitemapUrls(productionInputs);
  assert.equal(pages.length, sitemapUrls.length);

  const pageUrls = [];
  for (const [file, source] of pages) {
    const tags = socialMetadata(source);
    const keys = tags.map(({ property, name }) => property ?? name);
    const byKey = metadataByKey(source);
    const expected = expectedPageMetadata(file);
    assert.equal(tags.length, 16, file);
    assert.equal(new Set(keys).size, 16, file);
    assert.deepEqual(keys.slice(0, 10), OPEN_GRAPH_KEYS, file);
    assert.deepEqual(keys.slice(10), TWITTER_KEYS, file);
    assert.ok(
      tags.slice(0, 10).every(({ property, name }) => property && name === undefined),
      file
    );
    assert.ok(
      tags.slice(10).every(({ property, name }) => name && property === undefined),
      file
    );

    assert.equal(byKey.get('og:title').content, escapeHtml(expected.title), file);
    assert.equal(byKey.get('og:description').content, escapeHtml(expected.description), file);
    assert.equal(byKey.get('og:type').content, 'website', file);
    assert.equal(byKey.get('og:url').content, expected.url, file);
    assert.equal(byKey.get('og:site_name').content, escapeHtml(expected.siteName), file);
    assert.equal(byKey.get('og:image').content, IMAGE_URL, file);
    assert.equal(byKey.get('og:image:type').content, 'image/png', file);
    assert.equal(byKey.get('og:image:width').content, '1200', file);
    assert.equal(byKey.get('og:image:height').content, '630', file);
    assert.equal(byKey.get('og:image:alt').content, escapeHtml(expected.imageAlt), file);
    assert.equal(byKey.get('twitter:card').content, 'summary_large_image', file);
    assert.equal(byKey.get('twitter:site').content, '@na0AaooQ', file);
    assert.equal(byKey.get('twitter:title').content, byKey.get('og:title').content, file);
    assert.equal(
      byKey.get('twitter:description').content,
      byKey.get('og:description').content,
      file
    );
    assert.equal(byKey.get('twitter:image').content, byKey.get('og:image').content, file);
    assert.equal(byKey.get('twitter:image:alt').content, byKey.get('og:image:alt').content, file);

    for (const key of ['og:url', 'og:image', 'twitter:image']) {
      const value = byKey.get(key).content;
      assert.match(value, /^https:\/\//, `${file}: ${key}`);
      assert.doesNotMatch(value, /localhost|\/preview\//, `${file}: ${key}`);
      assert.doesNotMatch(value, /^\//, `${file}: ${key}`);
    }
    pageUrls.push(byKey.get('og:url').content);
  }

  assert.equal(new Set(pageUrls).size, sitemapUrls.length);
  assert.deepEqual([...pageUrls].sort(), [...sitemapUrls].sort());
});

test('keeps preview and production 404 outside the social metadata scope', () => {
  const preview = buildSiteArtifacts(previewInputs);
  assert.equal(preview.size, 19);
  assert.equal(preview.has('ogp-image.png'), false);
  for (const [file, source] of preview) {
    if (file.endsWith('.html')) assert.deepEqual(socialMetadata(source), [], file);
  }

  const production = buildSiteArtifacts(productionInputs);
  assert.equal(
    production.size,
    expectedSiteArtifactPaths(
      productionInputs.navigations,
      'production',
      productionInputs.regionalNavigations
    ).length
  );
  assert.deepEqual(socialMetadata(production.get('404.html')), []);
  assert.match(production.get('404.html'), /<meta name="robots" content="noindex">/);
  assert.equal(
    production.get('ogp-image.png').equals(productionInputs.assets['ogp-image.png']),
    true
  );
});

test('does not generate metadata that is outside BL-019', () => {
  const artifacts = buildSiteArtifacts(productionInputs);
  for (const [file, source] of artifacts) {
    if (!file.endsWith('.html')) continue;
    assert.doesNotMatch(source, /fb:app_id|twitter:creator|og:image:secure_url|og:locale/, file);
    assert.doesNotMatch(source, /<script\b[^>]*type="application\/ld\+json"/i, file);
    assert.doesNotMatch(source, /<link\b[^>]*rel="canonical"/i, file);
    assert.doesNotMatch(source, /<meta\b[^>]*name="description"/i, file);
  }
});

test('escapes every generated social metadata attribute value', () => {
  const marker = `<>&"'`;
  const source = productionSocialMetaTags(productionInputs, {
    title: marker,
    description: marker,
    pageUrl: `https://example.test/?a=1&b=2`,
    siteName: marker,
    imageAlt: marker
  });
  const byKey = metadataByKey(source);
  const escaped = '&lt;&gt;&amp;&quot;&#39;';
  for (const key of [
    'og:title',
    'og:description',
    'og:site_name',
    'og:image:alt',
    'twitter:title',
    'twitter:description',
    'twitter:image:alt'
  ]) {
    assert.equal(byKey.get(key).content, escaped, key);
  }
  assert.equal(byKey.get('og:url').content, 'https://example.test/?a=1&amp;b=2');
});

test('enforces the strict production social locale contract and rejects it in preview', async (t) => {
  assert.deepEqual(
    Object.keys(productionInputs.uiLocales.ja.social).sort(),
    Object.keys(productionInputs.uiLocales.en.social).sort()
  );
  for (const { name, mutate } of [
    { name: 'missing social', mutate: (value) => delete value.social },
    { name: 'missing image_alt', mutate: (value) => delete value.social.image_alt },
    {
      name: 'empty privacy_description',
      mutate: (value) => (value.social.privacy_description = '')
    },
    { name: 'unexpected key', mutate: (value) => (value.social.twitter_title = 'duplicate') }
  ]) {
    await t.test(name, async (t) => {
      const root = await createSiteRepositoryCopy(t);
      const relative = 'site/locales/production/ja.json';
      const locale = await readJson(root, relative);
      mutate(locale);
      await writeJson(root, relative, locale);
      const inputs = await loadSiteInputs(root, 'production');
      assert.ok(inputs.results.some(({ code }) => code === 'SITE-E001'));
    });
  }

  const previewRoot = await createSiteRepositoryCopy(t);
  const previewRelative = 'site/locales/ja.json';
  const previewLocale = await readJson(previewRoot, previewRelative);
  previewLocale.social = {
    image_alt: 'previewでは許可しない',
    privacy_description: 'previewでは許可しない'
  };
  await writeJson(previewRoot, previewRelative, previewLocale);
  const preview = await loadSiteInputs(previewRoot, 'preview');
  assert.ok(preview.results.some(({ code, field }) => code === 'SITE-E001' && field === '$'));
});

test('does not read the production-only OGP source for preview inputs', async (t) => {
  const root = await createSiteRepositoryCopy(t);
  await rm(path.join(root, 'site/assets/ogp-image.png'));
  const preview = await loadSiteInputs(root, 'preview');
  assert.deepEqual(preview.results, []);
  assert.equal('ogp-image.png' in preview.assets, false);
  await assert.rejects(loadSiteInputs(root, 'production'), /ogp-image\.png/);
});

test('site validation detects duplicate social metadata and a stale OGP artifact', async (t) => {
  const root = await createSiteRepositoryCopy(t);
  const htmlPath = path.join(root, 'dist/site/production/ja/index.html');
  const html = await readFile(htmlPath, 'utf8');
  const tag =
    '  <meta property="og:title" content="まどぐちみまもり｜公的機関・関係団体の公式情報案内">';
  await writeFile(htmlPath, html.replace(tag, `${tag}\n${tag}`));
  const imagePath = path.join(root, 'dist/site/production/ogp-image.png');
  const image = await readFile(imagePath);
  image[image.length - 1] ^= 0xff;
  await writeFile(imagePath, image);
  const results = await validateSiteRepository(root, 'production');
  assert.ok(results.some(({ message }) => message.includes('og:titleは1件だけ')));
  assert.ok(
    results.some(({ code, file }) => code === 'SITE-E006' && file.endsWith('/ogp-image.png'))
  );
});
