export const PUBLIC_LOCALES = Object.freeze(['ja', 'en']);
export const PUBLIC_SCHEMA_PATH = 'contracts/public/navigation.schema.json';
export const NATIONAL_PUBLIC_SCHEMA_PATH = 'contracts/public/national-navigation.schema.json';
export const REGIONAL_PUBLIC_SCHEMA_PATH = 'contracts/public/regional-navigation.schema.json';
export const PREVIEW_FIXTURE_ROOT = 'tests/fixtures/public-generation/preview';
export const PUBLIC_ARTIFACT_PATHS = Object.freeze({
  preview: Object.freeze({
    ja: 'dist/public-data/preview/ja/navigation.json',
    en: 'dist/public-data/preview/en/navigation.json'
  }),
  production: Object.freeze({
    ja: 'dist/public-data/production/ja/navigation.json',
    en: 'dist/public-data/production/en/navigation.json'
  })
});
export const PUBLIC_REGIONAL_ARTIFACT_ROOTS = Object.freeze({
  preview: 'dist/public-data/preview',
  production: 'dist/public-data/production'
});
export const ARTIFACT_TYPES = Object.freeze({
  preview: 'fictional-preview',
  production: 'production'
});
export const FORBIDDEN_PUBLIC_KEYS = Object.freeze(
  new Set([
    'internal_note',
    'publication_status',
    'site_publication_status',
    'locale_status',
    'content_revision',
    'based_on_ja_revision',
    'display_order',
    'destination_status',
    'official_information_status',
    'status',
    'evidence',
    'evidence_url',
    'evidence_type',
    'evidence_source_id',
    'target_type',
    'target_id',
    'target_aspect',
    'target_locale',
    'checked_by'
  ])
);

export class PublicRuntimeError extends Error {
  constructor(code, file, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'PublicRuntimeError';
    this.code = code;
    this.file = file;
  }
}
