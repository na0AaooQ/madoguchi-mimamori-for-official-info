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
  const cloned = structuredClone(inputs);
  cloned.assets['favicon.ico'] = Buffer.from(cloned.assets['favicon.ico']);
  cloned.assets['apple-touch-icon.png'] = Buffer.from(cloned.assets['apple-touch-icon.png']);
  const second = buildSiteArtifacts(cloned);
  assert.equal(first.size, 21);
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

test('generated HTML contains semantic structure and only language-approved external anchors', () => {
  const artifacts = buildSiteArtifacts(inputs);
  for (const [file, source] of artifacts) {
    if (!file.endsWith('.html')) continue;
    const locale = file.split('/')[0];
    const ui = inputs.uiLocales[locale];
    assert.equal([...source.matchAll(/<h1(?:\s|>)/g)].length, 1);
    assert.match(source, /<header/);
    assert.match(source, /<nav/);
    assert.match(source, /<main id="main-content">/);
    assert.match(source, /<footer/);
    assert.match(source, /noindex, nofollow, noarchive/);
    assert.equal(
      [
        ...source.matchAll(
          /<link rel="icon" href="\/preview\/favicon\.ico" sizes="16x16 32x32 48x48">/g
        )
      ].length,
      1,
      file
    );
    assert.equal(
      [
        ...source.matchAll(
          /<link rel="icon" href="\/preview\/favicon\.svg" type="image\/svg\+xml" sizes="any">/g
        )
      ].length,
      1,
      file
    );
    assert.equal(
      [
        ...source.matchAll(
          /<link rel="apple-touch-icon" href="\/preview\/apple-touch-icon\.png" sizes="180x180">/g
        )
      ].length,
      1,
      file
    );
    assert.doesNotMatch(source, /<details\s+open/);
    const contactAnchor = `<a href="${ui.footer.contact_url}" target="_blank" rel="noopener noreferrer" aria-label="${ui.footer.contact_link_label}">${ui.footer.contact}</a>`;
    assert.equal(source.split(contactAnchor).length - 1, 1, file);
    assert.equal(source.split(ui.footer.contact_url).length - 1, 1, file);
    assert.doesNotMatch(source, /href="#contact-information"|id="contact-information"/);
    assert.doesNotMatch(
      source,
      new RegExp(
        inputs.uiLocales[locale === 'ja' ? 'en' : 'ja'].footer.contact_url.replaceAll('.', '\\.')
      )
    );
    const externalHrefs = [...source.matchAll(/<a\b[^>]*href="(https:\/\/[^"]+)"/g)].map(
      (match) => match[1]
    );
    if (file === 'ja/privacy/index.html') {
      assert.match(
        source,
        /個人事業主\(屋号: こころみまもり\)&#x3000;<a href="https:\/\/portfolio\.na0aaooq\.com\/about\.html" target="_blank" rel="noopener noreferrer"[^>]*>青木 直之 \(あおき なおひさ\)<\/a>/
      );
      assert.deepEqual(
        externalHrefs.sort(),
        [ui.footer.contact_url, ui.privacy.operator_url].sort()
      );
    } else if (file === 'en/privacy/index.html') {
      assert.match(
        source,
        /Sole Proprietor \(Business name: Kokoro Mimamori\)&#x3000;<a href="https:\/\/portfolio\.na0aaooq\.com\/en\/about\.html" target="_blank" rel="noopener noreferrer"[^>]*>Naohisa Aoki<\/a>/
      );
      assert.deepEqual(
        externalHrefs.sort(),
        [ui.footer.contact_url, ui.privacy.operator_url].sort()
      );
    } else {
      assert.deepEqual(externalHrefs, [ui.footer.contact_url]);
    }
  }
});

test('renders the approved preview privacy wording and revision dates without legacy text', () => {
  const artifacts = buildSiteArtifacts(inputs);
  const japanese = artifacts.get('ja/privacy/index.html');
  const english = artifacts.get('en/privacy/index.html');
  assert.match(japanese, /制定日: 2026年8月3日/);
  assert.match(japanese, /最終改定日: 2026年8月5日/);
  assert.match(japanese, /4\. 文字サイズ設定の一時保存（sessionStorage）/);
  assert.match(japanese, /WebブラウザのsessionStorage（同じタブを開いている間だけ/);
  assert.match(japanese, /問い合わせ先と運営者プロフィールは、実在する外部ページ/);
  assert.doesNotMatch(japanese, /4\. sessionStorage|架空previewの架空案内先URLと問い合わせURL/);
  assert.match(english, /Established: August 3, 2026/);
  assert.match(english, /Last revised: August 5, 2026/);
  assert.match(english, /4\. Temporary text-size storage \(sessionStorage\)/);
  assert.match(english, /If the browser&#39;s sessionStorage feature/);
  assert.match(english, /The contact page and operator profile are real external pages/);
  assert.doesNotMatch(english, /4\. sessionStorage|Fictional destination and contact URLs/);
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
  assert.equal(paths.length, 23);
});

test('keeps text and binary site icon artifacts in their native representations', () => {
  const artifacts = buildSiteArtifacts(inputs);
  assert.equal(typeof artifacts.get('favicon.svg'), 'string');
  assert.equal(Buffer.isBuffer(artifacts.get('favicon.ico')), true);
  assert.equal(Buffer.isBuffer(artifacts.get('apple-touch-icon.png')), true);
});

test('escapes all HTML-sensitive characters', () => {
  assert.equal(escapeHtml('<>&"\''), '&lt;&gt;&amp;&quot;&#39;');
});
