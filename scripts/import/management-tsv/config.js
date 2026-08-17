export const SCHEMA_VERSION = '1.0.0';

const managementUnits = [
  {
    key: 'organizations',
    fileName: '03-organizations.tsv',
    idColumn: 'organization_id',
    headers: [
      'No',
      'organization_id',
      'organization_type',
      'region_ids',
      'parent_organization_id',
      'publication_status',
      'official_name_ja',
      'display_name_ja',
      'name_kind_ja',
      'summary_ja',
      'locale_status_ja',
      'content_revision_ja',
      'content_reviewed_on_ja',
      'official_name_en',
      'display_name_en',
      'name_kind_en',
      'summary_en',
      'locale_status_en',
      'content_revision_en',
      'based_on_ja_revision_en',
      'content_reviewed_on_en',
      'internal_note'
    ]
  },
  {
    key: 'sources',
    fileName: '04-sources.tsv',
    idColumn: 'source_id',
    omittedColumns: ['source_category_label'],
    headers: [
      'No',
      'source_id',
      'publisher_organization_id',
      'related_organization_ids',
      'source_category_label',
      'source_type',
      'content_format',
      'url',
      'destination_locales',
      'equivalent_source_group_id',
      'platform',
      'account_id',
      'primary_official_home_for_locales',
      'lifecycle_type',
      'destination_status',
      'destination_checked_on',
      'official_information_status',
      'official_information_checked_on',
      'show_in_official_source_list',
      'publication_status',
      'display_title_ja',
      'purpose_ja',
      'target_audience_note_ja',
      'destination_language_note_ja',
      'public_note_ja',
      'locale_status_ja',
      'content_revision_ja',
      'content_reviewed_on_ja',
      'display_title_en',
      'purpose_en',
      'target_audience_note_en',
      'destination_language_note_en',
      'public_note_en',
      'locale_status_en',
      'content_revision_en',
      'based_on_ja_revision_en',
      'content_reviewed_on_en',
      'internal_note'
    ]
  },
  {
    key: 'evidence',
    fileName: '05-evidence.tsv',
    idColumn: 'evidence_id',
    headers: [
      'No',
      'evidence_id',
      'target_type',
      'target_id',
      'target_aspect',
      'target_locale',
      'evidence_type',
      'evidence_source_id',
      'evidence_url',
      'checked_on',
      'status',
      'publication_status',
      'description_ja',
      'locale_status_ja',
      'content_revision_ja',
      'content_reviewed_on_ja',
      'description_en',
      'locale_status_en',
      'content_revision_en',
      'based_on_ja_revision_en',
      'content_reviewed_on_en',
      'internal_note'
    ]
  },
  {
    key: 'cards',
    fileName: '06-cards.tsv',
    idColumn: 'card_id',
    headers: [
      'No',
      'card_id',
      'section_id',
      'region_ids',
      'display_order',
      'publication_status',
      'title_ja',
      'summary_ja',
      'region_label_ja',
      'emergency_note_ja',
      'details_label_ja',
      'locale_status_ja',
      'content_revision_ja',
      'content_reviewed_on_ja',
      'title_en',
      'summary_en',
      'region_label_en',
      'emergency_note_en',
      'details_label_en',
      'locale_status_en',
      'content_revision_en',
      'based_on_ja_revision_en',
      'content_reviewed_on_en',
      'internal_note'
    ]
  },
  {
    key: 'card-source-links',
    fileName: '07-card-source-links.tsv',
    idColumn: 'card_source_link_id',
    headers: [
      'No',
      'card_source_link_id',
      'card_id',
      'source_id',
      'display_order',
      'display_locales',
      'site_display_start_on',
      'site_display_end_on',
      'publication_status',
      'role',
      'visibility_context',
      'button_label_ja',
      'public_note_ja',
      'locale_status_ja',
      'content_revision_ja',
      'content_reviewed_on_ja',
      'button_label_en',
      'public_note_en',
      'locale_status_en',
      'content_revision_en',
      'based_on_ja_revision_en',
      'content_reviewed_on_en',
      'internal_note'
    ]
  },
  {
    key: 'regions',
    fileName: '08-regions.tsv',
    idColumn: 'region_id',
    headers: [
      'No',
      'region_id',
      'region_type',
      'parent_region_id',
      'region_slug',
      'display_order',
      'official_code',
      'publication_status',
      'name_ja',
      'short_name_ja',
      'scope_note_ja',
      'navigation_label_ja',
      'locale_status_ja',
      'content_revision_ja',
      'content_reviewed_on_ja',
      'name_en',
      'short_name_en',
      'scope_note_en',
      'navigation_label_en',
      'locale_status_en',
      'content_revision_en',
      'based_on_ja_revision_en',
      'content_reviewed_on_en',
      'internal_note'
    ]
  }
];

export const MANAGEMENT_UNITS = Object.freeze(
  managementUnits.map((unit) =>
    Object.freeze({
      ...unit,
      headers: Object.freeze(unit.headers),
      omittedColumns: Object.freeze(unit.omittedColumns ?? []),
      outputPaths: Object.freeze({
        core: `data/core/${unit.key}.json`,
        ja: `data/locales/ja/${unit.key}.json`,
        en: `data/locales/en/${unit.key}.json`
      })
    })
  )
);

export const ARRAY_COLUMNS = new Set([
  'region_ids',
  'related_organization_ids',
  'destination_locales',
  'primary_official_home_for_locales',
  'display_locales'
]);

export const BOOLEAN_COLUMNS = new Set(['show_in_official_source_list']);

export const INTEGER_COLUMNS = new Set([
  'display_order',
  'content_revision_ja',
  'content_revision_en',
  'based_on_ja_revision_en'
]);

export const DATE_COLUMNS = new Set([
  'checked_on',
  'destination_checked_on',
  'official_information_checked_on',
  'content_reviewed_on_ja',
  'content_reviewed_on_en',
  'site_display_start_on',
  'site_display_end_on'
]);

export const OUTPUT_FILE_COUNT = MANAGEMENT_UNITS.length * 3;
