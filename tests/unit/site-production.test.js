import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
const previewInputs = await loadSiteInputs(repoRoot, 'preview');
if (previewInputs.results.length > 0) throw new Error(JSON.stringify(previewInputs.results));

function countLiteral(source, value) {
  return source.split(value).length - 1;
}

function anchorTag(source, href) {
  const escaped = href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source.match(new RegExp(`<a\\b[^>]*href="${escaped}"[^>]*>`))?.[0];
}

test('builds the deterministic production site from production navigation only', () => {
  const first = buildSiteArtifacts(inputs);
  const cloned = structuredClone(inputs);
  cloned.assets['favicon.ico'] = Buffer.from(cloned.assets['favicon.ico']);
  cloned.assets['apple-touch-icon.png'] = Buffer.from(cloned.assets['apple-touch-icon.png']);
  cloned.assets['ogp-image.png'] = Buffer.from(cloned.assets['ogp-image.png']);
  const second = buildSiteArtifacts(cloned);
  assert.equal(first.size, expectedSiteArtifactPaths(inputs.navigations, 'production').length);
  assert.deepEqual([...first], [...second]);
  assert.deepEqual(
    [...first.keys()].sort(),
    expectedSiteArtifactPaths(inputs.navigations, 'production')
  );
  for (const file of ['index.html', '404.html', 'sitemap.xml']) assert.ok(first.has(file));
  assert.equal(Buffer.isBuffer(first.get('ogp-image.png')), true);
  assert.match(first.get('assets/styles.css'), /\.production-root \.root-language-heading/);
  assert.doesNotMatch(
    buildSiteArtifacts(previewInputs).get('assets/styles.css'),
    /\.production-root \.root-language-heading/
  );
  for (const locale of ['ja', 'en']) {
    assert.equal(inputs.navigations[locale].sections.length, 5);
    assert.ok(first.has(`${locale}/sections/life-safety-medical/index.html`));
    assert.ok(first.has(`${locale}/sections/roads-transportation/index.html`));
    assert.ok(first.has(`${locale}/sections/support-recovery/index.html`));
  }
});

test('adds one standard GA4 Google tag to every production HTML and none to preview HTML', () => {
  const measurementId = inputs.siteUrl.analytics.measurement_id;
  const googleScriptUrl = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  const productionHtml = [...buildSiteArtifacts(inputs)].filter(([file]) => file.endsWith('.html'));
  assert.equal(
    productionHtml.length,
    expectedSiteArtifactPaths(inputs.navigations, 'production').filter((file) =>
      file.endsWith('.html')
    ).length
  );
  for (const [file, source] of productionHtml) {
    assert.equal(countLiteral(source, '<!-- Google tag (gtag.js) -->'), 1, file);
    assert.equal(countLiteral(source, googleScriptUrl), 1, file);
    assert.equal(
      [
        ...source.matchAll(
          /<script async src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-TWRZ1HTRTZ"><\/script>/g
        )
      ].length,
      1,
      file
    );
    assert.equal(countLiteral(source, 'window.dataLayer = window.dataLayer || [];'), 1, file);
    assert.equal(countLiteral(source, 'function gtag(){dataLayer.push(arguments);}'), 1, file);
    assert.equal(countLiteral(source, "gtag('js', new Date());"), 1, file);
    assert.equal(countLiteral(source, `gtag('config', '${measurementId}');`), 1, file);
    assert.equal(countLiteral(source, measurementId), 2, file);
    const headEnd = source.indexOf('</head>');
    const bodyStart = source.indexOf('<body');
    const tagStart = source.indexOf('<!-- Google tag (gtag.js) -->');
    assert.ok(tagStart > source.indexOf('<meta charset="utf-8">'), file);
    assert.ok(tagStart < headEnd && tagStart < bodyStart, file);
    assert.ok(tagStart < source.indexOf('<link rel="stylesheet"'), file);
    assert.doesNotMatch(
      source,
      /window\.location\.origin|document\.createElement\(['"]script|GTM-/
    );
  }
  for (const [file, source] of buildSiteArtifacts(previewInputs)) {
    if (!file.endsWith('.html')) continue;
    for (const marker of [
      'G-TWRZ1HTRTZ',
      'googletagmanager.com/gtag/js',
      'window.dataLayer',
      'function gtag',
      "gtag('js'",
      "gtag('config'",
      'Google tag (gtag.js)'
    ]) {
      assert.equal(source.includes(marker), false, `${file}: ${marker}`);
    }
  }
});

test('publishes the BL-006-B road-information card with two ordered primary destinations', async () => {
  const expected = {
    ja: {
      title: '熊本県内の道路情報を確認する',
      summary:
        '熊本県が提供する道路の通行規制情報と、日本道路交通情報センターが提供する道路交通情報を確認できます。',
      emergencyNote: '道路の通行規制・交通状況に関する最新情報は、リンク先で直接確認してください。',
      labels: ['熊本県の道路通行規制情報を見る', '日本道路交通情報センターを見る']
    },
    en: {
      title: 'Check road information for Kumamoto Prefecture',
      summary:
        'Check road restriction information provided by Kumamoto Prefecture and road traffic information provided by the Japan Road Traffic Information Center (JARTIC).',
      emergencyNote:
        'Check the linked destinations directly for the latest road restrictions and traffic information.',
      labels: [
        'View road traffic restriction information from Kumamoto Prefecture',
        'View the Japan Road Traffic Information Center (JARTIC) in Japanese'
      ]
    }
  };
  const destinationIds = [
    'src-kumamoto-prefecture-road-traffic-restrictions',
    'src-japan-road-traffic-information-center-home'
  ];

  for (const locale of ['ja', 'en']) {
    const navigation = inputs.navigations[locale];
    assert.equal(navigation.sections.length, 5);
    const section = navigation.sections.find(({ id }) => id === 'section-roads-transportation');
    assert.ok(section);
    assert.equal(section.cards.length, 1);
    const [card] = section.cards;
    assert.equal(card.id, 'card-kumamoto-prefecture-road-information');
    assert.equal(card.title, expected[locale].title);
    assert.equal(card.summary, expected[locale].summary);
    assert.equal(card.emergency_note, expected[locale].emergencyNote);
    assert.deepEqual(
      card.links.map(({ destination }) => destination.id),
      destinationIds
    );
    assert.deepEqual(
      card.links.map(({ role }) => role),
      ['primary', 'primary']
    );
    assert.deepEqual(
      card.links.map(({ button_label: buttonLabel }) => buttonLabel),
      expected[locale].labels
    );
  }

  const englishSection = inputs.navigations.en.sections.find(
    ({ id }) => id === 'section-roads-transportation'
  );
  const [prefecture, jartic] = englishSection.cards[0].links;
  assert.equal(
    prefecture.destination.url,
    'https://portal.bousai.pref.kumamoto.jp/?p=traffic&l=99-0&ll=32.63820000000001%2C130.77610000000007&z=9'
  );
  assert.deepEqual(prefecture.destination.destination_locales, ['ja', 'en']);
  assert.equal(
    prefecture.destination.destination_language_note,
    'Some information at the destination may be available only in Japanese.'
  );
  assert.match(
    buildSiteArtifacts(inputs).get('en/sections/roads-transportation/index.html'),
    /href="https:\/\/portal\.bousai\.pref\.kumamoto\.jp\/\?p=traffic&amp;l=99-0&amp;ll=32\.63820000000001%2C130\.77610000000007&amp;z=9"/
  );
  assert.equal(jartic.destination.source_type, 'official-homepage');
  assert.deepEqual(jartic.destination.destination_locales, ['ja']);
  assert.equal(
    jartic.destination.destination_language_note,
    'The destination is available in Japanese only.'
  );

  const coreSources = JSON.parse(
    await readFile(path.join(repoRoot, 'data/core/sources.json'), 'utf8')
  ).items;
  const coreOrganizations = JSON.parse(
    await readFile(path.join(repoRoot, 'data/core/organizations.json'), 'utf8')
  ).items;
  assert.equal(
    coreOrganizations.find(({ id }) => id === 'org-japan-road-traffic-information-center')
      .organization_type,
    'related-public-organization'
  );
  assert.deepEqual(
    coreSources.find(({ id }) => id === 'src-japan-road-traffic-information-center-home')
      .primary_official_home_for_locales,
    ['ja']
  );

  const organizationsPage = buildSiteArtifacts(inputs).get('en/organizations/index.html');
  assert.match(organizationsPage, /Japan Road Traffic Information Center \(JARTIC\)/);
  assert.match(organizationsPage, /Kumamoto Prefecture Road Traffic Restriction Information/);
  assert.match(organizationsPage, /Japan Road Traffic Information Center \(JARTIC\) \(Japanese\)/);
  const previewSerialized = JSON.stringify(previewInputs.navigations);
  assert.equal(previewSerialized.includes('jartic'), false);
  assert.equal(previewSerialized.includes('portal.bousai.pref.kumamoto.jp'), false);
});

test('publishes the BL-006-C residential disaster damage certificate card with one locale-specific primary destination', () => {
  const expected = {
    ja: {
      title: '熊本市の住家のり災証明書について確認する',
      summary:
        '熊本市で災害により住家に被害を受けた場合の、り災証明書の申請・交付に関する案内を確認できます。',
      regionLabel: '熊本市',
      emergencyNote:
        '申請方法、受付日時、必要書類などの最新情報は、リンク先で直接確認してください。',
      buttonLabel: '熊本市の住家のり災証明書の案内を見る',
      sourceId: 'src-kumamoto-prefecture-kumamoto-city-residential-disaster-certificate-ja',
      url: 'https://www.city.kumamoto.jp/kiji0032451/index.html',
      destinationLocales: ['ja']
    },
    en: {
      title: 'Check information about residential disaster damage certificates in Kumamoto City',
      summary:
        "Check Kumamoto City's information about applying for and the issuance of a disaster damage certificate when a residence is damaged by a disaster.",
      regionLabel: 'Kumamoto City',
      emergencyNote:
        'Check the linked destination directly for the latest application methods, reception hours, required documents, and other details.',
      buttonLabel: 'View Kumamoto City residential disaster damage certificate information',
      sourceId: 'src-kumamoto-prefecture-kumamoto-city-residential-disaster-certificate-en',
      url: 'https://www.city.kumamoto.jp.e.fm.hp.transer.com/kiji0032451/index.html',
      destinationLocales: ['en'],
      publicNote:
        'This is an English translation page provided through the official website. The Japanese page is the original source.'
    }
  };

  for (const locale of ['ja', 'en']) {
    const section = inputs.navigations[locale].sections.find(
      ({ id }) => id === 'section-support-recovery'
    );
    assert.ok(section);
    const card = section.cards.find(
      ({ id }) => id === 'card-kumamoto-prefecture-kumamoto-city-residential-disaster-certificate'
    );
    assert.ok(card);
    const [link] = card.links;
    assert.equal(card.title, expected[locale].title);
    assert.equal(card.summary, expected[locale].summary);
    assert.equal(card.region_label, expected[locale].regionLabel);
    assert.equal(card.emergency_note, expected[locale].emergencyNote);
    assert.equal(card.links.length, 1);
    assert.equal(link.role, 'primary');
    assert.equal(link.visibility_context, 'always');
    assert.equal(link.button_label, expected[locale].buttonLabel);
    assert.equal(link.destination.id, expected[locale].sourceId);
    assert.equal(link.destination.source_type, 'information-page');
    assert.equal(link.destination.url, expected[locale].url);
    assert.deepEqual(link.destination.destination_locales, expected[locale].destinationLocales);
    assert.equal(link.destination.organization.id, 'org-kumamoto-prefecture-kumamoto-city');
    assert.equal(link.destination.public_note, expected[locale].publicNote);
  }
});

test('publishes the BL-006-C relief donation card with one locale-specific disaster destination', () => {
  const expected = {
    ja: {
      title: '熊本県が案内する義援金を確認する',
      regionLabel: '熊本県全域',
      linkId: 'card-source-kumamoto-prefecture-relief-donation-ja',
      sourceId: 'src-kumamoto-prefecture-relief-donation-ja',
      destinationLocales: ['ja'],
      url: 'https://www.pref.kumamoto.jp/soshiki/27/274572.html'
    },
    en: {
      title: 'Check Kumamoto Prefecture relief donation information',
      regionLabel: 'Kumamoto Prefecture',
      linkId: 'card-source-kumamoto-prefecture-relief-donation-en',
      sourceId: 'src-kumamoto-prefecture-relief-donation-en',
      destinationLocales: ['en'],
      url: 'https://www.pref.kumamoto.jp.e.qp.hp.transer.com/soshiki/27/274572.html',
      publicNote:
        'This is an English translation page provided through the official website. The Japanese page is the original source.'
    }
  };

  for (const locale of ['ja', 'en']) {
    const section = inputs.navigations[locale].sections.find(
      ({ id }) => id === 'section-support-recovery'
    );
    assert.ok(section);
    assert.deepEqual(
      section.cards.map(({ id }) => id),
      [
        'card-kumamoto-prefecture-kumamoto-city-residential-disaster-certificate',
        'card-kumamoto-prefecture-relief-donation',
        'card-japan-ministry-of-defense-self-defense-forces-disaster-relief-dispatch'
      ]
    );
    const card = section.cards.find(({ id }) => id === 'card-kumamoto-prefecture-relief-donation');
    assert.ok(card);
    assert.equal(card.title, expected[locale].title);
    assert.equal(card.region_label, expected[locale].regionLabel);
    assert.equal(card.links.length, 1);
    const [link] = card.links;
    assert.deepEqual(
      card.links.map(({ id }) => id),
      [expected[locale].linkId]
    );
    assert.equal(link.role, 'primary');
    assert.equal(link.visibility_context, 'disaster');
    assert.deepEqual(
      card.links.map(({ destination }) => destination.id),
      [expected[locale].sourceId]
    );
    assert.deepEqual(link.destination.destination_locales, expected[locale].destinationLocales);
    assert.equal(link.destination.url, expected[locale].url);
    if (locale === 'en') {
      assert.equal(link.destination.public_note, expected[locale].publicNote);
    } else {
      assert.equal(Object.hasOwn(link.destination, 'public_note'), false);
    }
  }

  const artifacts = buildSiteArtifacts(inputs);
  const cardHtml = (html, title) => {
    const start = html.indexOf(`<span class="card-summary-title">${title}</span>`);
    assert.ok(start >= 0);
    const end = html.indexOf('</article>', start);
    assert.ok(end >= 0);
    return html.slice(start, end);
  };
  const japaneseReliefHtml = cardHtml(
    artifacts.get('ja/sections/support-recovery/index.html'),
    '熊本県が案内する義援金を確認する'
  );
  assert.match(japaneseReliefHtml, /<dd>災害時<\/dd>/);
  assert.doesNotMatch(japaneseReliefHtml, /平常時/);
  const englishReliefHtml = cardHtml(
    artifacts.get('en/sections/support-recovery/index.html'),
    'Check Kumamoto Prefecture relief donation information'
  );
  assert.match(englishReliefHtml, /<dd>Disaster situations<\/dd>/);
  assert.doesNotMatch(englishReliefHtml, /Normal and disaster situations/);

  const japaneseOrganizations = artifacts.get('ja/organizations/index.html');
  assert.match(japaneseOrganizations, /<dt>対象地域<\/dt>\s*<dd>熊本県全域<\/dd>/);
  assert.doesNotMatch(japaneseOrganizations, /熊本県全域 \/ 熊本県/);
});

test('publishes BL-006-C third and BL-006-A first release units with safe bilingual source display', () => {
  const expected = {
    mod: {
      ja: {
        title: '防衛省・自衛隊の災害派遣情報を確認する',
        summary: '防衛省・自衛隊による災害派遣の概要と、災害時の最新情報への案内を確認できます。',
        regionLabel: '日本全国',
        emergencyNote:
          '実施中の支援内容、場所、利用日時などの最新情報は、リンク先から案内される公式情報で直接確認してください。',
        buttonLabel: '防衛省・自衛隊の災害派遣情報を見る'
      },
      en: {
        title: 'Check MOD/SDF disaster relief dispatch information',
        summary:
          "Check information about disaster relief dispatches by Japan's Ministry of Defense and Self-Defense Forces, including links to the latest official updates during disasters.",
        regionLabel: 'Japan',
        emergencyNote:
          'For the latest support activities, locations, hours, and other details, check the official information linked from the destination.',
        buttonLabel: 'View MOD/SDF disaster relief dispatch information in Japanese'
      }
    },
    medical: {
      ja: {
        title: '熊本市の救急医療情報を確認する',
        summary: '熊本市が案内する救急医療、休日・夜間の受診先、医療相談などの情報を確認できます。',
        regionLabel: '熊本市',
        emergencyNote:
          '命に関わるなど明らかに緊急を要する場合は、119番通報してください。受診できる医療機関、診療時間、相談窓口などの最新情報は、リンク先で直接確認してください。',
        detailsLabel: '案内先の詳細を見る'
      },
      en: {
        title: 'Check emergency medical care information for Kumamoto City',
        summary:
          "Check Kumamoto City's information about emergency medical care, medical services available on holidays and at night, and medical consultation services.",
        regionLabel: 'Kumamoto City',
        emergencyNote:
          'If the situation is clearly an emergency or life-threatening, call 119. Check the linked official destination directly for the latest available medical facilities, consultation hours, and other details.',
        detailsLabel: 'View destination details'
      }
    }
  };
  const modSourceId = 'src-japan-ministry-of-defense-self-defense-forces-disaster-relief-dispatch';
  const medicalCardId = 'card-kumamoto-prefecture-kumamoto-city-emergency-medical-care';
  const medicalJaSourceId = 'src-kumamoto-prefecture-kumamoto-city-emergency-medical-care-ja';
  const medicalEnSourceId = 'src-kumamoto-prefecture-kumamoto-city-emergency-medical-care-en';
  const consultationSourceId =
    'src-kumamoto-prefecture-kumamoto-city-emergency-medical-consultation-7119-ja';
  const artifacts = buildSiteArtifacts(inputs);

  for (const locale of ['ja', 'en']) {
    const navigation = inputs.navigations[locale];
    assert.equal(navigation.sections.length, 5);

    const lifeSafety = navigation.sections.find(({ id }) => id === 'section-life-safety-medical');
    assert.ok(lifeSafety);
    assert.deepEqual(
      lifeSafety.cards.map(({ id }) => id),
      [medicalCardId]
    );
    assert.ok(artifacts.has(`${locale}/sections/life-safety-medical/index.html`));

    const supportRecovery = navigation.sections.find(({ id }) => id === 'section-support-recovery');
    assert.ok(supportRecovery);
    assert.deepEqual(
      supportRecovery.cards.map(({ id }) => id),
      [
        'card-kumamoto-prefecture-kumamoto-city-residential-disaster-certificate',
        'card-kumamoto-prefecture-relief-donation',
        'card-japan-ministry-of-defense-self-defense-forces-disaster-relief-dispatch'
      ]
    );

    const modCard = supportRecovery.cards.find(
      ({ id }) =>
        id === 'card-japan-ministry-of-defense-self-defense-forces-disaster-relief-dispatch'
    );
    assert.ok(modCard);
    assert.equal(modCard.title, expected.mod[locale].title);
    assert.equal(modCard.summary, expected.mod[locale].summary);
    assert.equal(modCard.region_label, expected.mod[locale].regionLabel);
    assert.equal(modCard.emergency_note, expected.mod[locale].emergencyNote);
    assert.equal(modCard.links.length, 1);
    const [modLink] = modCard.links;
    assert.equal(modLink.destination.id, modSourceId);
    assert.equal(modLink.role, 'primary');
    assert.equal(modLink.visibility_context, 'disaster');
    assert.equal(
      modLink.destination.url,
      'https://www.mod.go.jp/j/approach/defense/saigai/index.html'
    );
    assert.equal(modLink.button_label, expected.mod[locale].buttonLabel);
    if (locale === 'en') {
      assert.equal(
        modLink.destination.destination_language_note,
        'The destination is available in Japanese.'
      );
    } else {
      assert.equal(Object.hasOwn(modLink.destination, 'destination_language_note'), false);
    }

    const medicalCard = lifeSafety.cards[0];
    assert.equal(medicalCard.title, expected.medical[locale].title);
    assert.equal(medicalCard.summary, expected.medical[locale].summary);
    assert.equal(medicalCard.region_label, expected.medical[locale].regionLabel);
    assert.equal(medicalCard.emergency_note, expected.medical[locale].emergencyNote);
    assert.equal(medicalCard.details_label, expected.medical[locale].detailsLabel);
    assert.ok(medicalCard.emergency_note.includes('119'));

    if (locale === 'ja') {
      assert.deepEqual(
        medicalCard.links.map(({ destination }) => destination.id),
        [medicalJaSourceId, consultationSourceId]
      );
      assert.deepEqual(
        medicalCard.links.map(({ role, visibility_context }) => ({ role, visibility_context })),
        [
          { role: 'primary', visibility_context: 'always' },
          { role: 'secondary', visibility_context: 'always' }
        ]
      );
      assert.equal(
        medicalCard.links[0].destination.url,
        'https://www.city.kumamoto.jp/list04206.html'
      );
      assert.equal(
        medicalCard.links[1].destination.url,
        'https://www.city.kumamoto.jp/kiji00365705/index.html'
      );
      assert.deepEqual(
        medicalCard.links.map(({ button_label }) => button_label),
        ['熊本市の救急医療情報を見る', '救急安心センター（#7119）の案内を見る']
      );
    } else {
      assert.deepEqual(
        medicalCard.links.map(({ destination }) => destination.id),
        [medicalEnSourceId]
      );
      assert.equal(medicalCard.links[0].role, 'primary');
      assert.equal(medicalCard.links[0].visibility_context, 'always');
      assert.equal(
        medicalCard.links[0].destination.url,
        'https://www.city.kumamoto.jp.e.fm.hp.transer.com/list04206.html'
      );
      assert.equal(
        medicalCard.links[0].destination.public_note,
        'This is an English translation page provided through the official website. The Japanese page is the original source.'
      );
      assert.doesNotMatch(JSON.stringify(medicalCard), /7119/);
    }
  }

  const modEnglishHtml = artifacts.get('en/sections/support-recovery/index.html');
  assert.ok(modEnglishHtml.includes('The destination is available in Japanese.'));
  assert.doesNotMatch(modEnglishHtml, /入浴支援|給水|休憩場所/);
  for (const [file, source] of artifacts) {
    if (!file.endsWith('.html')) continue;
    assert.doesNotMatch(source, /href="tel:/);
  }
});

test('generates the agreed common UI and accessible bilingual production root', () => {
  const root = buildSiteArtifacts(inputs).get('index.html');
  const japaneseUi = inputs.uiLocales.ja;
  const englishUi = inputs.uiLocales.en;

  assert.match(root, /<html lang="ja" data-text-size="standard">/);
  assert.match(root, /<body class="production-root">/);
  assert.equal([...root.matchAll(/<h1(?:\s|>)/g)].length, 1);
  assert.match(root, /<title>まどぐちみまもり｜熊本県・熊本市の公式情報案内｜言語を選択<\/title>/);
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

  assert.match(
    root,
    /<h1 class="root-language-heading">表示する言語を選ぶ<br><span lang="en">Choose a language<\/span><\/h1>/
  );
  assert.match(
    root,
    new RegExp(
      `<p><strong>${escapeHtml(inputs.navigations.ja.site.site_name)}</strong>｜${escapeHtml(inputs.navigations.ja.site.subtitle)}</p>`
    )
  );
  assert.match(
    root,
    /<p class="root-description-ja">熊本県・熊本市に関係する公的機関・関係団体自身の公式情報へ進むための案内サイトです。<\/p>/
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

test('keeps the approved production home titles, visible site identity, and h1 contracts', () => {
  const artifacts = buildSiteArtifacts(inputs);
  const japanese = artifacts.get('ja/index.html');
  const english = artifacts.get('en/index.html');
  const site = inputs.navigations.ja.site;

  assert.match(japanese, /<title>まどぐちみまもり｜熊本県・熊本市の公式情報案内<\/title>/);
  assert.match(
    japanese,
    new RegExp(
      `<p><strong>${escapeHtml(site.site_name)}</strong>｜${escapeHtml(site.subtitle)}</p>`
    )
  );
  assert.match(japanese, /<h1>確認したい公式情報を探す<\/h1>/);
  assert.equal([...japanese.matchAll(/<h1(?:\s|>)/g)].length, 1);

  assert.match(english, /<title>Home｜Madoguchi Mimamori<\/title>/);
  assert.match(english, /<h1>Find official information to check<\/h1>/);
  assert.equal([...english.matchAll(/<h1(?:\s|>)/g)].length, 1);
  assert.doesNotMatch(
    english,
    new RegExp(
      `<p><strong>${escapeHtml(site.site_name)}</strong>｜${escapeHtml(site.subtitle)}</p>`
    )
  );
});

test('does not add automatic language redirects or browser storage beyond the approved scripts', () => {
  const root = buildSiteArtifacts(inputs).get('index.html');
  assert.doesNotMatch(root, /http-equiv=["']refresh|meta\s+refresh/i);
  assert.doesNotMatch(root, /location\.href|location\.replace/);
  assert.doesNotMatch(root, /localStorage|document\.cookie|fetch\(|XMLHttpRequest/);
  assert.doesNotMatch(root, /window\.location\.origin|document\.createElement\(['"]script/);
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
  for (const [key, marker] of Object.entries(changedEnglish.root)) {
    if (key === 'title') assert.doesNotMatch(changedHtml, new RegExp(marker));
    else assert.match(changedHtml, new RegExp(marker));
  }

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

test('renders the approved production privacy analytics explanations and Google official links', () => {
  const artifacts = buildSiteArtifacts(inputs);
  const japanese = artifacts.get('ja/privacy/index.html');
  const english = artifacts.get('en/privacy/index.html');
  assert.match(japanese, /制定日: 2026年8月4日/);
  assert.match(japanese, /最終改定日: 2026年8月6日/);
  assert.match(japanese, /4\. 文字サイズ設定の一時保存（sessionStorage）/);
  assert.match(japanese, /8\. アクセス解析について/);
  for (const marker of [
    'Google Analytics 4を利用しています。',
    'Google Analytics 4はCookieを使用し、ページの閲覧状況、当サイトから外部サイトへのリンクのクリック、アクセス日時、アクセス元の概算地域、ブラウザーおよび端末に関する情報などを収集します。',
    '氏名、メールアドレスその他の特定の個人を直接識別できる情報を送信することはありません。',
    'GoogleシグナルまたはUser-IDには利用しません。',
    '運営者のみに付与しています。',
    '解析データを第三者へ提供せず、独自のアクセス解析システムへの二次利用も行いません。',
    '14か月に設定しています。',
    'Google アナリティクス オプトアウト アドオン'
  ]) {
    assert.match(japanese, new RegExp(marker));
  }
  assert.match(english, /Established: August 4, 2026/);
  assert.match(english, /Last revised: August 6, 2026/);
  assert.match(english, /4\. Temporary text-size storage \(sessionStorage\)/);
  assert.match(english, /8\. Website Analytics/);
  for (const marker of [
    'Google Analytics 4, a service provided by Google LLC',
    'uses cookies to collect information such as page views, clicks on links from this website to external websites, access dates and times, approximate geographic location, and browser and device information.',
    'does not send names, email addresses, or other information that directly identifies a specific individual',
    'Google signals, or User-ID.',
    'granted only to the site operator.',
    'does not provide analytics data to third parties or use it in a separate analytics system',
    '14 months',
    'Google Analytics Opt-out Browser Add-on'
  ]) {
    assert.match(english, new RegExp(marker));
  }
  for (const [source, links] of [
    [japanese, inputs.uiLocales.ja.privacy.analytics.links],
    [english, inputs.uiLocales.en.privacy.analytics.links]
  ]) {
    assert.equal(links.length, 3);
    for (const { label, url } of links) {
      const tag = anchorTag(source, url);
      assert.ok(tag, url);
      assert.match(tag, /target="_blank"/);
      assert.match(tag, /rel="noopener noreferrer"/);
      assert.ok(source.includes(`>${label}</a>`), label);
    }
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

test('generates the canonical sitemap in deterministic order', () => {
  const urls = productionSitemapUrls(inputs);
  const expectedLength = 1 + ['ja', 'en'].length * (3 + inputs.navigations.ja.sections.length);
  assert.equal(urls.length, expectedLength);
  assert.equal(urls[0], 'https://madoguchi.kokoromimamori.na0aaooq.com/');
  assert.ok(urls.every((url) => url.startsWith('https://')));
  assert.equal(
    urls.some((url) => /404|assets|navigation\.json|preview/.test(url)),
    false
  );
  const sitemap = buildSiteArtifacts(inputs).get('sitemap.xml');
  assert.ok(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n'));
  assert.ok(sitemap.endsWith('\n'));
  assert.equal([...sitemap.matchAll(/<loc>/g)].length, expectedLength);
});
