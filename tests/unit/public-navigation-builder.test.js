import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildPublicNavigation,
  isLinkActiveOn,
  serializePublicArtifact
} from '../../scripts/publication/public-navigation-builder.js';
import { createPreviewInput } from '../helpers/public-generation.js';

function build(input, locale = 'ja', asOf = '2026-08-02') {
  return buildPublicNavigation(input, { locale, artifactType: 'fictional-preview', asOf });
}

test('builds the Japanese and English allowlisted navigation artifacts', async () => {
  const input = await createPreviewInput();
  for (const locale of ['ja', 'en']) {
    const { artifact, results } = build(input, locale);
    assert.deepEqual(results, []);
    assert.equal(artifact.locale, locale);
    assert.equal(artifact.artifact_type, 'fictional-preview');
    assert.equal(artifact.generated_for_date, '2026-08-02');
    assert.equal(artifact.sections.length, 5);
    assert.deepEqual(
      artifact.sections.map(({ cards }) => cards.length),
      [1, 0, 0, 0, 0]
    );
    const serialized = serializePublicArtifact(artifact);
    for (const key of [
      'display_order',
      'evidence',
      'internal_note',
      'publication_status',
      'destination_status',
      'official_information_status'
    ]) {
      assert.equal(serialized.includes(`"${key}"`), false);
    }
    assert.match(serialized, /"visibility_context": "always"/);
    assert.match(serialized, /"role": "primary"/);
  }
});

test('keeps stable IDs and non-normalizes only reachable source and organization data', async () => {
  const input = await createPreviewInput();
  input.core.sources.push({
    ...structuredClone(input.core.sources[0]),
    id: 'src-unreachable',
    url: 'https://example.invalid/unreachable/'
  });
  input.core.organizations.push({
    ...structuredClone(input.core.organizations[0]),
    id: 'org-unreachable'
  });
  const { artifact } = build(input);
  const serialized = serializePublicArtifact(artifact);
  assert.match(serialized, /section-public-institutions-disaster/);
  assert.match(serialized, /card-example-disaster-information/);
  assert.match(serialized, /card-source-example-disaster-information-primary/);
  assert.match(serialized, /src-example-prefecture-official-home/);
  assert.match(serialized, /org-example-prefecture-disaster-office/);
  assert.doesNotMatch(serialized, /src-unreachable|org-unreachable/);
});

test('includes published empty sections but excludes non-published sections', async (t) => {
  for (const status of ['draft', 'under-review', 'hidden', 'archived']) {
    await t.test(status, async () => {
      const input = await createPreviewInput();
      input.core.sections[4].publication_status = status;
      const { artifact, results } = build(input);
      assert.deepEqual(results, []);
      assert.equal(artifact.sections.length, 4);
      assert.equal(
        artifact.sections.some(({ id }) => id === 'section-support-recovery'),
        false
      );
    });
  }
});

test('excludes non-published cards without exposing their links', async (t) => {
  for (const status of ['draft', 'under-review', 'hidden', 'archived']) {
    await t.test(status, async () => {
      const input = await createPreviewInput();
      input.core.cards[0].publication_status = status;
      const { artifact, results } = build(input);
      assert.deepEqual(results, []);
      assert.deepEqual(
        artifact.sections.map(({ cards }) => cards.length),
        [0, 0, 0, 0, 0]
      );
    });
  }
});

test('uses inclusive date-only display periods', async (t) => {
  const cases = [
    ['no period', {}, '2026-08-02', true],
    ['before start', { site_display_start_on: '2026-08-03' }, '2026-08-02', false],
    ['on start', { site_display_start_on: '2026-08-02' }, '2026-08-02', true],
    [
      'inside',
      { site_display_start_on: '2026-08-01', site_display_end_on: '2026-08-03' },
      '2026-08-02',
      true
    ],
    [
      'on end',
      { site_display_start_on: '2026-08-01', site_display_end_on: '2026-08-02' },
      '2026-08-02',
      true
    ],
    [
      'after end',
      { site_display_start_on: '2026-08-01', site_display_end_on: '2026-08-01' },
      '2026-08-02',
      false
    ]
  ];
  for (const [name, period, asOf, expected] of cases) {
    await t.test(name, () => assert.equal(isLinkActiveOn(period, asOf), expected));
  }
});

test('stops with PUB-E003 when language or period filtering removes every primary', async (t) => {
  const cases = [
    ['language', (link) => (link.display_locales = ['ja']), 'en', '2026-08-02'],
    ['before start', (link) => (link.site_display_start_on = '2026-08-03'), 'ja', '2026-08-02'],
    [
      'after end',
      (link) =>
        Object.assign(link, {
          site_display_start_on: '2026-08-01',
          site_display_end_on: '2026-08-01'
        }),
      'ja',
      '2026-08-02'
    ],
    ['role', (link) => (link.role = 'secondary'), 'ja', '2026-08-02']
  ];
  for (const [name, mutate, locale, asOf] of cases) {
    await t.test(name, async () => {
      const input = await createPreviewInput();
      mutate(input.core.cardSourceLinks[0]);
      const built = build(input, locale, asOf);
      assert.equal(built.artifact, undefined);
      assert.ok(built.results.some(({ code }) => code === 'PUB-E003'));
    });
  }
});

test('allows an out-of-period secondary when an active primary remains', async () => {
  const input = await createPreviewInput();
  input.core.cardSourceLinks.push({
    ...structuredClone(input.core.cardSourceLinks[0]),
    id: 'card-source-example-secondary',
    role: 'secondary',
    display_order: 2,
    site_display_start_on: '2026-08-03'
  });
  for (const locale of ['ja', 'en']) {
    input.locales[locale].cardSourceLinks.push({
      ...structuredClone(input.locales[locale].cardSourceLinks[0]),
      id: 'card-source-example-secondary'
    });
  }
  const { artifact, results } = build(input);
  assert.deepEqual(results, []);
  assert.equal(artifact.sections[0].cards[0].links.length, 1);
  assert.equal(artifact.sections[0].cards[0].links[0].role, 'primary');
});

test('reports site and region publication failures without silently publishing', async () => {
  const draftSite = await createPreviewInput();
  draftSite.site.core.site_publication_status = 'draft';
  assert.ok(build(draftSite).results.some(({ code }) => code === 'PUB-E001'));

  const hiddenRegion = await createPreviewInput();
  hiddenRegion.core.regions[1].publication_status = 'hidden';
  assert.ok(build(hiddenRegion).results.some(({ code }) => code === 'PUB-E002'));
});

test('never uses non-published sources or organizations as a primary destination', async (t) => {
  for (const unit of ['sources', 'organizations']) {
    for (const status of ['draft', 'under-review', 'hidden', 'archived']) {
      await t.test(`${unit} ${status}`, async () => {
        const input = await createPreviewInput();
        input.core[unit][0].publication_status = status;
        const built = build(input);
        assert.equal(built.artifact, undefined);
        assert.ok(built.results.some(({ code }) => code === 'PUB-E003'));
      });
    }
  }
});

test('copies social platform and account ID through the public allowlist', async () => {
  const input = await createPreviewInput();
  Object.assign(input.core.sources[0], {
    source_type: 'social-account',
    content_format: 'social-profile',
    platform: 'x',
    account_id: 'fictional-account'
  });
  delete input.core.sources[0].primary_official_home_for_locales;
  const destination = build(input).artifact.sections[0].cards[0].links[0].destination;
  assert.equal(destination.platform, 'x');
  assert.equal(destination.account_id, 'fictional-account');
});

test('emits the English destination language notice only when needed', async () => {
  const input = await createPreviewInput();
  const english = build(input, 'en').artifact.sections[0].cards[0].links[0].destination;
  const japanese = build(input, 'ja').artifact.sections[0].cards[0].links[0].destination;
  assert.equal(english.destination_language_note, 'The linked page is available in Japanese only.');
  assert.equal(Object.hasOwn(japanese, 'destination_language_note'), false);
});

test('omits absent optional fields rather than writing null or empty strings', async () => {
  const input = await createPreviewInput();
  delete input.locales.ja.sections[1].short_description;
  delete input.locales.ja.cards[0].region_label;
  delete input.locales.ja.cards[0].details_label;
  delete input.locales.ja.cardSourceLinks[0].public_note;
  delete input.locales.ja.sources[0].public_note;
  delete input.locales.ja.organizations[0].summary;
  const artifact = build(input).artifact;
  assert.equal(Object.hasOwn(artifact.sections[1], 'short_description'), false);
  const card = artifact.sections[0].cards[0];
  assert.equal(Object.hasOwn(card, 'region_label'), false);
  assert.equal(Object.hasOwn(card, 'details_label'), false);
  assert.equal(Object.hasOwn(card.links[0], 'public_note'), false);
  assert.equal(Object.hasOwn(card.links[0].destination, 'public_note'), false);
  assert.equal(Object.hasOwn(card.links[0].destination.organization, 'summary'), false);
});

test('is byte deterministic even when input arrays are reversed', async () => {
  const input = await createPreviewInput();
  const original = serializePublicArtifact(build(input).artifact);
  for (const unit of Object.keys(input.core)) input.core[unit].reverse();
  for (const locale of ['ja', 'en']) {
    for (const unit of Object.keys(input.locales[locale])) input.locales[locale][unit].reverse();
  }
  const reordered = serializePublicArtifact(build(input).artifact);
  assert.equal(reordered, original);
  assert.match(original, /^\{\n {2}"schema_version"/);
  assert.match(original, /\n\}\n$/);
  assert.equal(original.endsWith('\n'), true);
  assert.doesNotMatch(original, /generated_at|commit_sha|worker_name/);
});
