import assert from 'node:assert/strict';
import test from 'node:test';

import {
  aggregateOrganizations,
  aggregateVisibility,
  buildSiteArtifacts,
  escapeHtml,
  expectedSiteArtifactPaths
} from '../../scripts/site/site-builder.js';
import { loadInputs } from '../helpers/site-generation.js';

const inputs = await loadInputs();

test('builds the complete deterministic Japanese and English preview site', () => {
  const first = buildSiteArtifacts(inputs);
  const second = buildSiteArtifacts(structuredClone(inputs));
  assert.equal(first.size, 18);
  assert.deepEqual([...first], [...second]);
  assert.deepEqual([...first.keys()].sort(), expectedSiteArtifactPaths(inputs.navigations));
  for (const locale of ['ja', 'en']) {
    assert.ok(first.has(`${locale}/index.html`));
    assert.ok(first.has(`${locale}/organizations/index.html`));
    assert.ok(first.has(`${locale}/privacy/index.html`));
    for (const section of inputs.navigations[locale].sections) {
      assert.ok(first.has(`${locale}/sections/${section.anchor_id}/index.html`));
    }
  }
});

test('generated HTML contains semantic structure and only approved operator profile anchors', () => {
  const artifacts = buildSiteArtifacts(inputs);
  for (const [file, source] of artifacts) {
    if (!file.endsWith('.html')) continue;
    assert.equal([...source.matchAll(/<h1(?:\s|>)/g)].length, 1);
    assert.match(source, /<header/);
    assert.match(source, /<nav/);
    assert.match(source, /<main id="main-content">/);
    assert.match(source, /<footer/);
    assert.match(source, /noindex, nofollow, noarchive/);
    assert.doesNotMatch(source, /<details\s+open/);
    if (file === 'ja/privacy/index.html') {
      assert.match(
        source,
        /個人事業主\(屋号: こころみまもり\)&#x3000;<a href="https:\/\/portfolio\.na0aaooq\.com\/about\.html" target="_blank" rel="noopener noreferrer"[^>]*>青木 直之 \(あおき なおひさ\)<\/a>/
      );
    } else if (file === 'en/privacy/index.html') {
      assert.match(
        source,
        /Sole Proprietor \(Business name: Kokoro Mimamori\)&#x3000;<a href="https:\/\/portfolio\.na0aaooq\.com\/en\/about\.html" target="_blank" rel="noopener noreferrer"[^>]*>Naohisa Aoki<\/a>/
      );
    } else {
      assert.doesNotMatch(source, /<a\b[^>]*href="https?:\/\//i);
      assert.doesNotMatch(source, /target="_blank"/);
    }
  }
});

test('renders cards, empty sections, language warnings, and fictional URLs safely', () => {
  const artifacts = buildSiteArtifacts(inputs);
  const japaneseCard = artifacts.get('ja/sections/public-institutions-disaster/index.html');
  const englishCard = artifacts.get('en/sections/public-institutions-disaster/index.html');
  const empty = artifacts.get('ja/sections/lifelines/index.html');
  assert.match(japaneseCard, /<details class="card">/);
  assert.match(japaneseCard, /主な案内先/);
  assert.match(japaneseCard, /平常時・災害時/);
  assert.match(japaneseCard, /https:\/\/example\.invalid\/example-prefecture\//);
  assert.doesNotMatch(japaneseCard, /href="https:\/\/example\.invalid/);
  assert.match(englishCard, /lang="ja">架空県防災情報窓口/);
  assert.match(englishCard, /The linked page is available in Japanese only\./);
  assert.match(empty, /現在、この分野に表示できる案内はありません。/);
});

test('deduplicates organizations, destinations, and regions in first-seen order', () => {
  const navigation = structuredClone(inputs.navigations.ja);
  const card = structuredClone(navigation.sections[0].cards[0]);
  navigation.sections[1].cards.push(card);
  const organizations = aggregateOrganizations(navigation);
  assert.equal(organizations.length, 1);
  assert.equal(organizations[0].destinations.length, 1);
  assert.deepEqual(organizations[0].regions, ['架空県']);
});

test('aggregates visibility contexts according to the public display rules', () => {
  assert.equal(aggregateVisibility(new Set(['always'])), 'always');
  assert.equal(aggregateVisibility(new Set(['normal', 'disaster'])), 'always');
  assert.equal(aggregateVisibility(new Set(['normal'])), 'normal');
  assert.equal(aggregateVisibility(new Set(['disaster'])), 'disaster');
});

test('derives changed section paths without fixing the section count in code', () => {
  const changed = structuredClone(inputs);
  for (const locale of ['ja', 'en']) {
    changed.navigations[locale].sections.push({
      id: 'section-extra-fictional',
      anchor_id: 'extra-fictional',
      title: locale === 'ja' ? '追加の架空分野' : 'Additional Fictional Topic',
      cards: []
    });
  }
  const paths = expectedSiteArtifactPaths(changed.navigations);
  assert.ok(paths.includes('ja/sections/extra-fictional/index.html'));
  assert.ok(paths.includes('en/sections/extra-fictional/index.html'));
  assert.equal(paths.length, 20);
});

test('escapes all HTML-sensitive characters', () => {
  assert.equal(escapeHtml('<>&"\''), '&lt;&gt;&amp;&quot;&#39;');
});
