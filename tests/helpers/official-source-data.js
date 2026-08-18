const TODAY = '2026-08-02';

function localeRecord(id, fields) {
  return {
    id,
    ...fields,
    locale_status: 'draft',
    content_revision: 1
  };
}

export function createDraftOfficialSourceData() {
  return {
    core: {
      regions: [
        {
          id: 'region-example-country',
          region_type: 'country',
          publication_status: 'draft'
        },
        {
          id: 'region-example-prefecture',
          region_type: 'prefecture',
          parent_region_id: 'region-example-country',
          region_slug: 'example',
          display_order: 1,
          publication_status: 'draft'
        }
      ],
      organizations: [
        {
          id: 'org-example-prefecture-disaster-office',
          organization_type: 'local-government',
          region_ids: ['region-example-prefecture'],
          publication_status: 'draft'
        }
      ],
      sources: [
        {
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
        }
      ],
      evidence: [
        {
          id: 'evidence-example-organization-official',
          target_type: 'organization',
          target_id: 'org-example-prefecture-disaster-office',
          target_aspect: 'official-organization',
          evidence_type: 'official-organization-page',
          evidence_url: 'https://example.invalid/example-prefecture/about/',
          checked_on: TODAY,
          status: 'needs-review',
          publication_status: 'draft'
        },
        {
          id: 'evidence-example-organization-name-ja',
          target_type: 'organization',
          target_id: 'org-example-prefecture-disaster-office',
          target_aspect: 'official-name',
          target_locale: 'ja',
          evidence_type: 'official-organization-page',
          evidence_url: 'https://example.invalid/example-prefecture/about/',
          checked_on: TODAY,
          status: 'needs-review',
          publication_status: 'draft'
        },
        {
          id: 'evidence-example-source-official-page',
          target_type: 'source',
          target_id: 'src-example-prefecture-official-home',
          target_aspect: 'official-page',
          evidence_type: 'official-site-link',
          evidence_url: 'https://example.invalid/example-prefecture/official-links/',
          checked_on: TODAY,
          status: 'needs-review',
          publication_status: 'draft'
        }
      ],
      disasters: []
    },
    locales: {
      ja: {
        regions: [
          localeRecord('region-example-country', { name: '架空国' }),
          localeRecord('region-example-prefecture', {
            name: '架空県',
            navigation_label: '架空県（例）'
          })
        ],
        organizations: [
          localeRecord('org-example-prefecture-disaster-office', {
            official_name: '架空県防災情報窓口',
            name_kind: 'official-ja'
          })
        ],
        sources: [
          localeRecord('src-example-prefecture-official-home', {
            display_title: '架空県 防災情報案内（架空データ）',
            purpose: '架空データ構造の確認'
          })
        ],
        evidence: [
          localeRecord('evidence-example-organization-official', {
            description: '団体の公式性を確認する架空根拠'
          }),
          localeRecord('evidence-example-organization-name-ja', {
            description: '団体名称を確認する架空根拠'
          }),
          localeRecord('evidence-example-source-official-page', {
            description: '案内先の公式性を確認する架空根拠'
          })
        ]
      },
      en: {
        regions: [
          {
            ...localeRecord('region-example-country', { name: 'Example Country' }),
            based_on_ja_revision: 1
          },
          {
            ...localeRecord('region-example-prefecture', {
              name: 'Example Prefecture',
              navigation_label: 'Example Prefecture'
            }),
            based_on_ja_revision: 1
          }
        ],
        organizations: [
          {
            ...localeRecord('org-example-prefecture-disaster-office', {
              official_name: '架空県防災情報窓口',
              name_kind: 'official-ja-fallback'
            }),
            based_on_ja_revision: 1
          }
        ],
        sources: [
          {
            ...localeRecord('src-example-prefecture-official-home', {
              display_title: 'Example Prefecture Disaster Information Guide',
              purpose: 'Verify the fictional data structure.',
              destination_language_note: 'The linked page is available in Japanese only.'
            }),
            based_on_ja_revision: 1
          }
        ],
        evidence: [
          {
            ...localeRecord('evidence-example-organization-official', {
              description: 'Fictional evidence for the organization.'
            }),
            based_on_ja_revision: 1
          },
          {
            ...localeRecord('evidence-example-organization-name-ja', {
              description: 'Fictional evidence for the Japanese name.'
            }),
            based_on_ja_revision: 1
          },
          {
            ...localeRecord('evidence-example-source-official-page', {
              description: 'Fictional evidence for the official page.'
            }),
            based_on_ja_revision: 1
          }
        ]
      }
    }
  };
}

export function createPublishedOfficialSourceData() {
  const input = createDraftOfficialSourceData();
  for (const unit of ['regions', 'organizations', 'sources', 'evidence']) {
    for (const record of input.core[unit]) record.publication_status = 'published';
    for (const locale of ['ja', 'en']) {
      for (const record of input.locales[locale][unit]) {
        record.locale_status = 'published';
        record.content_reviewed_on = TODAY;
      }
    }
  }

  const source = input.core.sources[0];
  source.destination_status = 'confirmed';
  source.destination_checked_on = TODAY;
  source.official_information_status = 'confirmed';
  source.official_information_checked_on = TODAY;

  for (const evidence of input.core.evidence) evidence.status = 'confirmed';
  return input;
}
