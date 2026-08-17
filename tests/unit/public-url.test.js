import assert from 'node:assert/strict';
import test from 'node:test';

import {
  logicalPagePath,
  pageTypeFromPath,
  privacyPath,
  regionOrganizationsPath,
  regionPath,
  regionSectionPath
} from '../../scripts/shared/public-url.js';

test('generates and classifies the nationwide logical URL set consistently', () => {
  const pages = [
    ['national', '/ja/', { locale: 'ja', pageType: 'national' }],
    ['region', '/ja/regions/example/', { locale: 'ja', pageType: 'region', regionSlug: 'example' }],
    [
      'section',
      '/ja/regions/example/sections/safety/',
      { locale: 'ja', pageType: 'section', regionSlug: 'example', anchorId: 'safety' }
    ],
    [
      'organizations',
      '/ja/regions/example/organizations/',
      { locale: 'ja', pageType: 'organizations', regionSlug: 'example' }
    ],
    ['privacy', '/ja/privacy/', { locale: 'ja', pageType: 'privacy' }]
  ];
  for (const [pageType, expectedPath, expectedPage] of pages) {
    const input = {
      locale: 'ja',
      pageType,
      regionSlug: 'example',
      anchorId: 'safety'
    };
    assert.equal(logicalPagePath(input), expectedPath);
    assert.deepEqual(pageTypeFromPath(expectedPath), expectedPage);
  }
  assert.equal(regionPath('en', 'second-example'), '/en/regions/second-example/');
  assert.equal(
    regionSectionPath('en', 'second-example', 'public-institutions'),
    '/en/regions/second-example/sections/public-institutions/'
  );
  assert.equal(
    regionOrganizationsPath('en', 'second-example'),
    '/en/regions/second-example/organizations/'
  );
  assert.equal(privacyPath('en'), '/en/privacy/');
});

test('rejects unsafe public URL identifiers', () => {
  assert.throws(() => regionPath('ja', 'Kumamoto'), /region_slug/);
  assert.throws(() => regionSectionPath('ja', 'example', '../unsafe'), /anchor_id/);
  assert.equal(pageTypeFromPath('/ja/sections/legacy/'), undefined);
});
