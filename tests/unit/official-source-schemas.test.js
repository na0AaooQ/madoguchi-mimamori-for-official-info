import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { compileSchema } from '../../scripts/validation/schema-validator.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const schemaPaths = {
  regions: 'schemas/core/regions.schema.json',
  organizations: 'schemas/core/organizations.schema.json',
  sources: 'schemas/core/sources.schema.json',
  evidence: 'schemas/core/evidence.schema.json',
  localeRegions: 'schemas/locales/regions.schema.json',
  localeOrganizations: 'schemas/locales/organizations.schema.json',
  localeSources: 'schemas/locales/sources.schema.json',
  localeEvidence: 'schemas/locales/evidence.schema.json'
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

const regionItems = [
  {
    id: 'region-example-country',
    region_type: 'country',
    publication_status: 'draft'
  },
  {
    id: 'region-example-prefecture',
    region_type: 'prefecture',
    parent_region_id: 'region-example-country',
    publication_status: 'draft'
  }
];
const organizationItem = {
  id: 'org-example-prefecture-disaster-office',
  organization_type: 'local-government',
  region_ids: ['region-example-prefecture'],
  publication_status: 'draft'
};
const draftSource = {
  id: 'src-example-prefecture-official-home',
  publisher_organization_id: 'org-example-prefecture-disaster-office',
  source_type: 'official-homepage',
  content_format: 'html',
  url: 'https://example.invalid/example-prefecture/',
  destination_locales: ['ja'],
  primary_official_home_for_locales: ['ja'],
  lifecycle_type: 'permanent',
  destination_status: 'needs-review',
  official_information_status: 'unconfirmed',
  show_in_official_source_list: false,
  publication_status: 'draft'
};
const publishedSource = {
  ...draftSource,
  destination_status: 'confirmed',
  destination_checked_on: '2026-08-02',
  official_information_status: 'confirmed',
  official_information_checked_on: '2026-08-02',
  publication_status: 'published'
};
const draftEvidence = {
  id: 'evidence-example-source-official-page',
  target_type: 'source',
  target_id: 'src-example-prefecture-official-home',
  target_aspect: 'official-page',
  evidence_type: 'official-site-link',
  evidence_url: 'https://example.invalid/evidence/',
  checked_on: '2026-08-02',
  status: 'needs-review',
  publication_status: 'draft'
};
const localeExamples = {
  localeRegions: {
    id: 'region-example-country',
    name: 'Example Country',
    locale_status: 'draft',
    content_revision: 1,
    based_on_ja_revision: 1
  },
  localeOrganizations: {
    id: 'org-example-prefecture-disaster-office',
    official_name: '架空県防災情報窓口',
    name_kind: 'official-ja-fallback',
    locale_status: 'draft',
    content_revision: 1,
    based_on_ja_revision: 1
  },
  localeSources: {
    id: 'src-example-prefecture-official-home',
    display_title: 'Example Prefecture Disaster Information Guide',
    purpose: 'Verify the fictional data structure.',
    locale_status: 'draft',
    content_revision: 1,
    based_on_ja_revision: 1
  },
  localeEvidence: {
    id: 'evidence-example-source-official-page',
    description: 'Fictional evidence.',
    locale_status: 'draft',
    content_revision: 1,
    based_on_ja_revision: 1
  }
};

function assertValid(validatorName, value) {
  const validate = validators[validatorName];
  assert.equal(validate(value), true, JSON.stringify(validate.errors));
}

function assertInvalid(validatorName, value) {
  const validate = validators[validatorName];
  assert.equal(validate(value), false, `${validatorName} unexpectedly accepted invalid data`);
}

test('accepts valid core and locale examples, including empty arrays', () => {
  assertValid('regions', envelope(regionItems));
  assertValid('organizations', envelope([organizationItem]));
  assertValid('sources', envelope([draftSource]));
  assertValid('sources', envelope([publishedSource]));
  assertValid('evidence', envelope([draftEvidence]));
  assertValid(
    'evidence',
    envelope([{ ...draftEvidence, status: 'confirmed', publication_status: 'published' }])
  );
  for (const [name, item] of Object.entries(localeExamples)) assertValid(name, envelope([item]));
  for (const [name, item] of Object.entries(localeExamples)) {
    const japanese = structuredClone(item);
    delete japanese.based_on_ja_revision;
    assertValid(name, envelope([japanese]));
  }
  for (const name of Object.keys(validators)) assertValid(name, envelope([]));
});

test('accepts HTTPS source and evidence URLs', () => {
  assertValid('sources', envelope([{ ...draftSource, url: 'https://example.invalid/' }]));
  assertValid(
    'evidence',
    envelope([{ ...draftEvidence, evidence_url: 'https://example.invalid/' }])
  );
});

test('rejects common invalid item shapes', async (t) => {
  const cases = [
    ['invalid region ID prefix', 'regions', { ...regionItems[0], id: 'place-example' }],
    [
      'invalid organization enum',
      'organizations',
      { ...organizationItem, organization_type: 'city' }
    ],
    ['empty organization note', 'organizations', { ...organizationItem, internal_note: '' }],
    [
      'duplicate organization region',
      'organizations',
      {
        ...organizationItem,
        region_ids: ['region-example-prefecture', 'region-example-prefecture']
      }
    ],
    ['HTTP source URL', 'sources', { ...draftSource, url: 'http://example.invalid/' }],
    ['FTP source URL', 'sources', { ...draftSource, url: 'ftp://example.invalid/' }],
    ['mailto source URI', 'sources', { ...draftSource, url: 'mailto:test@example.invalid' }],
    ['unknown source property', 'sources', { ...draftSource, unexpected: true }],
    [
      'duplicate destination locale',
      'sources',
      { ...draftSource, destination_locales: ['ja', 'ja'] }
    ],
    [
      'invalid evidence target prefix',
      'evidence',
      { ...draftEvidence, target_type: 'source', target_id: 'org-example' }
    ],
    ['empty locale text', 'localeRegions', { ...localeExamples.localeRegions, name: '' }],
    [
      'descriptive organization name',
      'localeOrganizations',
      { ...localeExamples.localeOrganizations, name_kind: 'descriptive' }
    ],
    [
      'published locale without review date',
      'localeSources',
      { ...localeExamples.localeSources, locale_status: 'published' }
    ]
  ];

  for (const [name, validatorName, item] of cases) {
    await t.test(name, () => assertInvalid(validatorName, envelope([item])));
  }
});

test('enforces published source requirements', async (t) => {
  const cases = [
    ['destination check date', 'destination_checked_on'],
    ['official information check date', 'official_information_checked_on']
  ];
  for (const [name, field] of cases) {
    await t.test(`requires ${name}`, () => {
      const item = structuredClone(publishedSource);
      delete item[field];
      assertInvalid('sources', envelope([item]));
    });
  }
  await t.test('requires confirmed destination status', () => {
    assertInvalid(
      'sources',
      envelope([{ ...publishedSource, destination_status: 'needs-review' }])
    );
  });
  await t.test('requires confirmed official information status', () => {
    assertInvalid(
      'sources',
      envelope([{ ...publishedSource, official_information_status: 'unconfirmed' }])
    );
  });
});

test('enforces source type conditions and rejects unrelated account fields', async (t) => {
  const social = {
    ...draftSource,
    source_type: 'social-account',
    content_format: 'social-profile',
    platform: 'x',
    account_id: 'fictional-account'
  };
  delete social.primary_official_home_for_locales;
  assertValid('sources', envelope([social]));

  await t.test('social account without platform', () => {
    const item = structuredClone(social);
    delete item.platform;
    assertInvalid('sources', envelope([item]));
  });
  await t.test('social account without account ID', () => {
    const item = structuredClone(social);
    delete item.account_id;
    assertInvalid('sources', envelope([item]));
  });
  await t.test('social account with wrong content format', () => {
    assertInvalid('sources', envelope([{ ...social, content_format: 'html' }]));
  });
  await t.test('messaging service without platform', () => {
    const item = {
      ...draftSource,
      source_type: 'messaging-service',
      content_format: 'external-service'
    };
    delete item.primary_official_home_for_locales;
    assertInvalid('sources', envelope([item]));
  });
  await t.test('non-homepage with primary home locales', () => {
    assertInvalid('sources', envelope([{ ...draftSource, source_type: 'information-page' }]));
  });
  await t.test('unrelated source with platform', () => {
    assertInvalid('sources', envelope([{ ...draftSource, platform: 'other' }]));
  });
  await t.test('messaging service with account ID', () => {
    const item = {
      ...draftSource,
      source_type: 'messaging-service',
      content_format: 'external-service',
      platform: 'line',
      account_id: 'fictional-account'
    };
    delete item.primary_official_home_for_locales;
    assertInvalid('sources', envelope([item]));
  });
});

test('enforces evidence conditions', async (t) => {
  await t.test('requires a source ID or URL', () => {
    const item = structuredClone(draftEvidence);
    delete item.evidence_url;
    assertInvalid('evidence', envelope([item]));
  });
  await t.test('accepts both a source ID and URL', () => {
    assertValid(
      'evidence',
      envelope([{ ...draftEvidence, evidence_source_id: 'src-example-prefecture-official-home' }])
    );
  });
  await t.test('requires target locale for official name', () => {
    assertInvalid('evidence', envelope([{ ...draftEvidence, target_aspect: 'official-name' }]));
  });
  await t.test('limits disaster evidence to official names', () => {
    assertInvalid(
      'evidence',
      envelope([
        {
          ...draftEvidence,
          target_type: 'disaster',
          target_id: 'disaster-example',
          target_aspect: 'official-page'
        }
      ])
    );
  });
  await t.test('requires confirmed status when published', () => {
    assertInvalid('evidence', envelope([{ ...draftEvidence, publication_status: 'published' }]));
  });
  await t.test('rejects HTTP evidence URL', () => {
    assertInvalid(
      'evidence',
      envelope([{ ...draftEvidence, evidence_url: 'http://example.invalid/' }])
    );
  });
});
