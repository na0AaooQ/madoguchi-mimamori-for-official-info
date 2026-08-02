import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { compileSchema } from '../../scripts/validation/schema-validator.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const schemaPaths = {
  sections: 'schemas/core/sections.schema.json',
  cards: 'schemas/core/cards.schema.json',
  cardSourceLinks: 'schemas/core/card-source-links.schema.json',
  localeSections: 'schemas/locales/sections.schema.json',
  localeCards: 'schemas/locales/cards.schema.json',
  localeCardSourceLinks: 'schemas/locales/card-source-links.schema.json'
};
const validators = Object.fromEntries(
  await Promise.all(
    Object.entries(schemaPaths).map(async ([name, schemaPath]) => {
      const schema = JSON.parse(await readFile(path.join(repoRoot, schemaPath), 'utf8'));
      return [name, compileSchema(schema, { schemaFile: schemaPath })];
    })
  )
);

function envelope(items) {
  return { schema_version: '1.0.0', data_updated_on: '2026-08-02', items };
}

const examples = {
  sections: {
    id: 'section-public-institutions-disaster',
    anchor_id: 'public-institutions-disaster',
    display_order: 1,
    publication_status: 'draft'
  },
  cards: {
    id: 'card-example-disaster-information',
    section_id: 'section-public-institutions-disaster',
    region_ids: ['region-example-prefecture'],
    display_order: 1,
    publication_status: 'draft'
  },
  cardSourceLinks: {
    id: 'card-source-example-disaster-information-primary',
    card_id: 'card-example-disaster-information',
    source_id: 'src-example-prefecture-official-home',
    display_order: 1,
    display_locales: ['ja', 'en'],
    role: 'primary',
    visibility_context: 'always',
    publication_status: 'draft'
  },
  localeSections: {
    id: 'section-public-institutions-disaster',
    title: '公的機関・防災全般',
    short_description: '公式案内を探します。',
    locale_status: 'draft',
    content_revision: 1
  },
  localeCards: {
    id: 'card-example-disaster-information',
    title: '防災情報を確認する（架空データ）',
    summary: '架空データ構造を確認するカードです。',
    locale_status: 'draft',
    content_revision: 1
  },
  localeCardSourceLinks: {
    id: 'card-source-example-disaster-information-primary',
    button_label: '架空の案内先を確認する',
    locale_status: 'draft',
    content_revision: 1
  }
};

function assertValid(name, value) {
  const validate = validators[name];
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
}

function assertInvalid(name, value) {
  const validate = validators[name];
  assert.equal(validate(value), false, `${name} unexpectedly accepted invalid data`);
}

test('accepts valid navigation card records and empty arrays', () => {
  for (const [name, item] of Object.entries(examples)) assertValid(name, envelope([item]));
  for (const name of Object.keys(validators)) assertValid(name, envelope([]));
  assertValid(
    'cardSourceLinks',
    envelope([{ ...examples.cardSourceLinks, site_display_start_on: '2026-08-02' }])
  );
  assertValid(
    'cardSourceLinks',
    envelope([
      {
        ...examples.cardSourceLinks,
        site_display_start_on: '2026-08-02',
        site_display_end_on: '2026-08-03'
      }
    ])
  );
  for (const name of ['localeSections', 'localeCards']) {
    assertValid(
      name,
      envelope([
        {
          ...examples[name],
          locale_status: 'published',
          content_reviewed_on: '2026-08-02'
        }
      ])
    );
  }
  assertValid(
    'localeCardSourceLinks',
    envelope([
      {
        ...examples.localeCardSourceLinks,
        locale_status: 'published',
        content_reviewed_on: '2026-08-02'
      }
    ])
  );
});

test('rejects invalid navigation card records', async (t) => {
  const cases = [
    ['section ID prefix', 'sections', { ...examples.sections, id: 'category-example' }],
    ['card ID prefix', 'cards', { ...examples.cards, id: 'item-example' }],
    [
      'card-source-link ID prefix',
      'cardSourceLinks',
      { ...examples.cardSourceLinks, id: 'link-example' }
    ],
    ['invalid anchor characters', 'sections', { ...examples.sections, anchor_id: 'Bad_anchor' }],
    ['leading anchor hyphen', 'sections', { ...examples.sections, anchor_id: '-example' }],
    ['trailing anchor hyphen', 'sections', { ...examples.sections, anchor_id: 'example-' }],
    ['zero section order', 'sections', { ...examples.sections, display_order: 0 }],
    ['zero card order', 'cards', { ...examples.cards, display_order: 0 }],
    ['zero link order', 'cardSourceLinks', { ...examples.cardSourceLinks, display_order: 0 }],
    ['empty card regions', 'cards', { ...examples.cards, region_ids: [] }],
    [
      'duplicate card regions',
      'cards',
      { ...examples.cards, region_ids: ['region-example', 'region-example'] }
    ],
    ['invalid role', 'cardSourceLinks', { ...examples.cardSourceLinks, role: 'recommended' }],
    [
      'invalid visibility context',
      'cardSourceLinks',
      { ...examples.cardSourceLinks, visibility_context: 'emergency' }
    ],
    [
      'empty display locales',
      'cardSourceLinks',
      { ...examples.cardSourceLinks, display_locales: [] }
    ],
    [
      'duplicate display locales',
      'cardSourceLinks',
      { ...examples.cardSourceLinks, display_locales: ['ja', 'ja'] }
    ],
    [
      'unsupported display locale',
      'cardSourceLinks',
      { ...examples.cardSourceLinks, display_locales: ['fr'] }
    ],
    [
      'end date without start date',
      'cardSourceLinks',
      { ...examples.cardSourceLinks, site_display_end_on: '2026-08-02' }
    ],
    ['unknown property', 'cards', { ...examples.cards, url: 'https://example.invalid/' }],
    ['empty internal note', 'sections', { ...examples.sections, internal_note: '' }],
    ['empty title', 'localeSections', { ...examples.localeSections, title: '' }],
    ['empty summary', 'localeCards', { ...examples.localeCards, summary: '' }],
    [
      'published locale without review date',
      'localeCards',
      { ...examples.localeCards, locale_status: 'published' }
    ],
    [
      'published link locale without button label',
      'localeCardSourceLinks',
      {
        id: examples.localeCardSourceLinks.id,
        locale_status: 'published',
        content_revision: 1,
        content_reviewed_on: '2026-08-02'
      }
    ]
  ];
  for (const [name, validatorName, item] of cases) {
    await t.test(name, () => assertInvalid(validatorName, envelope([item])));
  }
});
