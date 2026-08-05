import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import {
  buildSiteArtifacts,
  escapeHtml,
  expectedSiteArtifactPaths,
  productionSitemapUrls
} from '../../scripts/site/site-builder.js';
import { loadSiteInputs } from '../../scripts/site/site-input-loader.js';
import { createSiteRepositoryCopy, readJson, writeJson } from '../helpers/site-generation.js';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const inputs = await loadSiteInputs(repoRoot, 'production');
if (inputs.results.length > 0) throw new Error(JSON.stringify(inputs.results));

function countLiteral(source, value) {
  return source.split(value).length - 1;
}

function anchorTag(source, href) {
  const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.match(new RegExp(`<a\\b[^>]*href="${escaped}"[^>]*>`))?.[0];
}

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

test('generates the agreed common UI and accessible bilingual production root', () => {
  const root = buildSiteArtifacts(inputs).get('index.html');
  const japaneseUi = inputs.uiLocales.ja;
  const englishUi = inputs.uiLocales.en;

  assert.match(root, /<html lang="ja" data-text-size="standard">/);
  assert.equal([...root.matchAll(/<h1(?:\s|>)/g)].length, 1);
  assert.match(root, /<title>言語を選択 \/ Choose a language｜まどぐちみまもり<\/title>/);
  assert.match(
    root,
    /<a class="skip-link" href="#main-content">本文へ移動<span lang="en"> \/ Skip to main content<\/span><\/a>/
  );
  assert.match(root, /<header class="site-header">/);
  assert.match(root, /<main id="main-content">/);
  assert.match(root, /<footer class="site-footer">/);
  assert.match(
    root,
    /<span class="site-name">まどぐちみまもり｜<span lang="en">Madoguchi Mimamori<\/span><\/span>/
  );
  assert.doesNotMatch(root, /<a\b[^>]*class="site-name"/);
  assert.doesNotMatch(root, /<a\b[^>]*href="\/"/);

  assert.match(root, /<h1>表示する言語を選ぶ<br><span lang="en">Choose a language<\/span><\/h1>/);
  assert.match(
    root,
    /<p>熊本県・熊本市に関係する公的機関・関係団体自身の公式情報へ進むための案内サイトです。<\/p>/
  );
  assert.match(
    root,
    /<p lang="en">A guide to official information published by public institutions and related organizations serving Kumamoto Prefecture and Kumamoto City\.<\/p>/
  );
  assert.match(root, /<p class="note">行政機関が運営する公式サイトではありません。<\/p>/);
  assert.match(root, /<p class="note" lang="en">This is not an official government website\.<\/p>/);

  const languageLinks = [
    ...root.matchAll(
      /<li><a class="section-link" href="\/(?:ja|en)\/" hreflang="(?:ja|en)" lang="(?:ja|en)"><strong>[^<]+<\/strong><\/a><\/li>/g
    )
  ];
  assert.equal(languageLinks.length, 2);
  assert.equal(countLiteral(root, '>日本語で見る</strong>'), 1);
  assert.equal(countLiteral(root, '>View in English</strong>'), 1);
  assert.match(root, /href="\/ja\/" hreflang="ja" lang="ja"><strong>日本語で見る<\/strong>/);
  assert.match(root, /href="\/en\/" hreflang="en" lang="en"><strong>View in English<\/strong>/);
  assert.doesNotMatch(root, /autofocus/);

  assert.equal(countLiteral(root, 'data-font-size-control'), 1);
  assert.match(root, /<fieldset class="font-size-control" data-font-size-control hidden>/);
  assert.match(root, /<legend>文字サイズ<span lang="en"> \/ Text size<\/span><\/legend>/);
  assert.equal([...root.matchAll(/<button\b[^>]*data-text-size="standard"/g)].length, 1);
  assert.equal([...root.matchAll(/<button\b[^>]*data-text-size="large"/g)].length, 1);
  assert.match(
    root,
    /<button type="button" data-text-size="standard" aria-pressed="true">標準<span lang="en"> \/ Standard<\/span><\/button>/
  );
  assert.match(
    root,
    /<button type="button" data-text-size="large" aria-pressed="false">大<span lang="en"> \/ Large<\/span><\/button>/
  );
  assert.doesNotMatch(root, /<button\b[^>]*aria-label=/);
  assert.equal(countLiteral(root, '<script src="/assets/font-size.js" defer></script>'), 1);

  assert.match(
    root,
    new RegExp(
      `<nav aria-label="${escapeHtml(japaneseUi.root.footer_navigation_label)}">[\\s\\S]*?href="/ja/privacy/"[\\s\\S]*?${escapeHtml(japaneseUi.footer.contact)}`
    )
  );
  assert.match(
    root,
    new RegExp(
      `<nav lang="en" aria-label="${escapeHtml(englishUi.root.footer_navigation_label)}">[\\s\\S]*?href="/en/privacy/"[\\s\\S]*?${escapeHtml(englishUi.footer.contact)}`
    )
  );
  for (const href of ['/ja/privacy/', '/en/privacy/']) {
    const tag = anchorTag(root, href);
    assert.ok(tag);
    assert.doesNotMatch(tag, /target="_blank"/);
  }

  const externalUrls = [
    japaneseUi.footer.contact_url,
    englishUi.footer.contact_url,
    japaneseUi.privacy.operator_url,
    englishUi.privacy.operator_url
  ];
  for (const url of externalUrls) {
    assert.equal(countLiteral(root, url), 1, url);
    const tag = anchorTag(root, url);
    assert.ok(tag, url);
    assert.match(tag, /target="_blank"/);
    assert.match(tag, /rel="noopener noreferrer"/);
  }
  assert.ok(
    anchorTag(root, japaneseUi.footer.contact_url).includes(
      `aria-label="${escapeHtml(japaneseUi.footer.contact_link_label)}"`
    )
  );
  assert.ok(
    anchorTag(root, englishUi.footer.contact_url).includes(
      `aria-label="${escapeHtml(englishUi.footer.contact_link_label)}"`
    )
  );
  assert.ok(
    anchorTag(root, japaneseUi.privacy.operator_url).includes(
      `aria-label="${escapeHtml(japaneseUi.privacy.operator_link_label)}"`
    )
  );
  assert.ok(
    anchorTag(root, englishUi.privacy.operator_url).includes(
      `aria-label="${escapeHtml(englishUi.privacy.operator_link_label)}"`
    )
  );

  assert.match(root, new RegExp(`<p>${escapeHtml(japaneseUi.footer.free_notice)}</p>`));
  assert.match(root, new RegExp(`<p lang="en">${escapeHtml(englishUi.footer.free_notice)}</p>`));
  assert.ok(
    root.includes(
      `${escapeHtml(japaneseUi.root.operator_label)}${escapeHtml(japaneseUi.privacy.operator_prefix)}&#x3000;`
    )
  );
  assert.ok(
    root.includes(
      `<p lang="en">${escapeHtml(englishUi.root.operator_label)} ${escapeHtml(englishUi.privacy.operator_prefix)}&#x3000;`
    )
  );
  assert.equal(countLiteral(root, japaneseUi.footer.copyright), 1);
  assert.equal(japaneseUi.footer.copyright, englishUi.footer.copyright);
  assert.doesNotMatch(
    root,
    />トップページ<|>Home<|全団体・案内先一覧|All Organizations and Destinations/
  );
});

test('does not add automatic language redirects or browser storage and network features', () => {
  const root = buildSiteArtifacts(inputs).get('index.html');
  assert.doesNotMatch(root, /http-equiv=["']refresh|meta\s+refresh/i);
  assert.doesNotMatch(root, /location\.href|location\.replace/);
  assert.doesNotMatch(root, /<script(?![^>]*src="\/assets\/font-size\.js")/);
  assert.doesNotMatch(root, /localStorage|document\.cookie|fetch\(|XMLHttpRequest/);
});

test('uses one language-specific source for each production root responsibility', async (t) => {
  const japaneseRoot = inputs.uiLocales.ja.root;
  const englishRoot = inputs.uiLocales.en.root;
  assert.deepEqual(Object.keys(japaneseRoot).sort(), Object.keys(englishRoot).sort());
  for (const legacyKey of [
    'description_ja',
    'description_en',
    'unofficial_ja',
    'unofficial_en',
    'japanese_link',
    'english_link'
  ]) {
    assert.equal(legacyKey in japaneseRoot, false);
    assert.equal(legacyKey in englishRoot, false);
  }

  const changedRoot = await createSiteRepositoryCopy(t);
  const englishPath = 'site/locales/production/en.json';
  const changedEnglish = await readJson(changedRoot, englishPath);
  Object.assign(changedEnglish.root, {
    title: 'English root title marker',
    heading: 'English root heading marker',
    description: 'English root description marker.',
    unofficial: 'English root unofficial marker.',
    language_link: 'English root link marker',
    footer_navigation_label: 'English root navigation marker',
    operator_label: 'English root operator marker:'
  });
  await writeJson(changedRoot, englishPath, changedEnglish);
  const changedInputs = await loadSiteInputs(changedRoot, 'production');
  assert.deepEqual(changedInputs.results, []);
  const changedHtml = buildSiteArtifacts(changedInputs).get('index.html');
  for (const marker of Object.values(changedEnglish.root))
    assert.match(changedHtml, new RegExp(marker));

  const strictRoot = await createSiteRepositoryCopy(t);
  const strictEnglish = await readJson(strictRoot, englishPath);
  delete strictEnglish.root.description;
  strictEnglish.root.description_ja = 'Legacy duplicate';
  await writeJson(strictRoot, englishPath, strictEnglish);
  const strictInputs = await loadSiteInputs(strictRoot, 'production');
  assert.ok(
    strictInputs.results.some(({ field }) => field === '$.root' || field === '$.root.description')
  );

  const copyrightRoot = await createSiteRepositoryCopy(t);
  const copyrightEnglish = await readJson(copyrightRoot, englishPath);
  copyrightEnglish.footer.copyright = 'Different copyright marker';
  await writeJson(copyrightRoot, englishPath, copyrightEnglish);
  const copyrightInputs = await loadSiteInputs(copyrightRoot, 'production');
  assert.ok(copyrightInputs.results.some(({ field }) => field === 'footer.copyright'));

  const previewRoot = await createSiteRepositoryCopy(t);
  const previewPath = 'site/locales/en.json';
  const previewEnglish = await readJson(previewRoot, previewPath);
  previewEnglish.root = { title: 'Preview root is not allowed' };
  await writeJson(previewRoot, previewPath, previewEnglish);
  const previewInputs = await loadSiteInputs(previewRoot, 'preview');
  assert.ok(previewInputs.results.some(({ field }) => field === '$'));
});

test('generates accessible indexable production HTML and only the 404 is noindex', () => {
  const artifacts = buildSiteArtifacts(inputs);
  for (const [file, source] of artifacts) {
    if (!file.endsWith('.html')) continue;
    assert.equal([...source.matchAll(/<h1(?:\s|>)/g)].length, 1, file);
    assert.doesNotMatch(source, /<details\b[^>]*\sopen(?:\s|>)/, file);
    assert.doesNotMatch(source, /<summary\b[^>]*\srole=/, file);
    assert.doesNotMatch(source, /tabindex="[1-9]/, file);
    assert.doesNotMatch(source, /autofocus/, file);
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
  for (const [file, source] of artifacts) {
    if (!file.endsWith('.html')) continue;
    for (const match of source.matchAll(/<a\b[^>]*href="https:\/\/[^>]+>/g)) {
      assert.match(match[0], /target="_blank"/);
      assert.match(match[0], /rel="noopener noreferrer"/);
    }
    if (file === '404.html') {
      assert.doesNotMatch(source, /<footer|portfolio\.na0aaooq\.com\/./);
      continue;
    }
    if (file === 'index.html') continue;
    const locale = file.split('/')[0];
    const ui = inputs.uiLocales[locale];
    const contactAnchor = `<a href="${ui.footer.contact_url}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(ui.footer.contact_link_label)}">${ui.footer.contact}</a>`;
    assert.equal(source.split(contactAnchor).length - 1, 1, file);
    assert.equal(source.split(ui.footer.contact_url).length - 1, 1, file);
    assert.doesNotMatch(source, /href="#contact-information"|id="contact-information"/);
    assert.doesNotMatch(
      source,
      new RegExp(
        inputs.uiLocales[locale === 'ja' ? 'en' : 'ja'].footer.contact_url.replaceAll('.', '\\.')
      )
    );
  }
});

test('keeps production privacy text outside BL-004 unchanged', () => {
  const artifacts = buildSiteArtifacts(inputs);
  const japanese = artifacts.get('ja/privacy/index.html');
  const english = artifacts.get('en/privacy/index.html');
  assert.match(japanese, /制定日: 2026年8月4日/);
  assert.match(japanese, /最終改定日: 2026年8月5日/);
  assert.match(japanese, /4\. 文字サイズ設定の一時保存（sessionStorage）/);
  assert.match(
    japanese,
    /公的機関・関係団体の案内先、問い合わせ先、運営者プロフィールは外部サイトです。/
  );
  assert.match(english, /Established: August 4, 2026/);
  assert.match(english, /Last revised: August 5, 2026/);
  assert.match(english, /4\. Temporary text-size storage \(sessionStorage\)/);
  assert.match(
    english,
    /Destinations of public institutions and related organizations, the contact page, and the operator profile are external sites\./
  );
  for (const source of [japanese, english]) {
    assert.doesNotMatch(
      source,
      /4\. sessionStorage|sessionStorageを利用できない場合は標準サイズで表示します。|If sessionStorage is unavailable, the site displays the standard text size\./
    );
  }
});

test('keeps preview, localized production pages, 404, and sitemap scope unchanged', async () => {
  const previewInputs = await loadSiteInputs(repoRoot, 'preview');
  assert.deepEqual(previewInputs.results, []);
  const preview = buildSiteArtifacts(previewInputs);
  assert.equal(preview.size, 21);
  assert.equal(preview.has('index.html'), false);

  const production = buildSiteArtifacts(inputs);
  const notFound = production.get('404.html');
  assert.match(notFound, /<meta name="robots" content="noindex">/);
  assert.doesNotMatch(notFound, /<footer|portfolio\.na0aaooq\.com/);
  for (const locale of ['ja', 'en']) {
    const home = production.get(`${locale}/index.html`);
    assert.match(home, /<header class="site-header">/);
    assert.match(home, /<main id="main-content">/);
    assert.match(home, /<footer class="site-footer">/);
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
