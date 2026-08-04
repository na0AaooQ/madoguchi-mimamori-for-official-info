export const SITE_LOCALES = Object.freeze(['ja', 'en']);

export const SITE_ASSET_SOURCE_PATHS = Object.freeze({
  'assets/styles.css': 'site/assets/styles.css',
  'assets/font-size.js': 'site/assets/font-size.js'
});

export const SITE_MODES = Object.freeze({
  preview: Object.freeze({
    mode: 'preview',
    artifactType: 'fictional-preview',
    outputRoot: 'dist/site/preview',
    basePath: '/preview',
    productionConfigPath: undefined,
    navigationPaths: Object.freeze({
      ja: 'dist/public-data/preview/ja/navigation.json',
      en: 'dist/public-data/preview/en/navigation.json'
    }),
    uiLocalePaths: Object.freeze({
      ja: 'site/locales/ja.json',
      en: 'site/locales/en.json'
    })
  }),
  production: Object.freeze({
    mode: 'production',
    artifactType: 'production',
    outputRoot: 'dist/site/production',
    productionConfigPath: 'site/production.json',
    navigationPaths: Object.freeze({
      ja: 'dist/public-data/production/ja/navigation.json',
      en: 'dist/public-data/production/en/navigation.json'
    }),
    uiLocalePaths: Object.freeze({
      ja: 'site/locales/production/ja.json',
      en: 'site/locales/production/en.json'
    })
  })
});

// Backward-compatible preview constants used by existing tests and imports.
export const SITE_NAVIGATION_PATHS = SITE_MODES.preview.navigationPaths;
export const SITE_UI_LOCALE_PATHS = SITE_MODES.preview.uiLocalePaths;
export const SITE_OUTPUT_ROOT = SITE_MODES.preview.outputRoot;
export const SITE_ARTIFACT_TYPE = SITE_MODES.preview.artifactType;

export const SITE_GENERATOR_NAME = 'madoguchi-static-site-v1';

export const ROLE_ORDER = Object.freeze(['primary', 'temporary-highlight', 'secondary']);
export const VISIBILITY_CONTEXTS = Object.freeze(['always', 'normal', 'disaster']);
export const ORGANIZATION_NAME_KINDS = Object.freeze([
  'official-ja',
  'official-en',
  'official-ja-fallback'
]);

export const DESTINATION_CATEGORY_ORDER = Object.freeze([
  'official_site',
  'official_information',
  'official_channel'
]);

export const SOURCE_TYPE_CATEGORIES = Object.freeze({
  'official-homepage': 'official_site',
  'information-page': 'official_information',
  'disaster-page': 'official_information',
  'service-page': 'official_information',
  'search-service': 'official_information',
  'consultation-guide': 'official_information',
  'social-account': 'official_channel',
  'messaging-service': 'official_channel',
  'email-service': 'official_channel'
});

export function getSiteMode(mode) {
  const config = SITE_MODES[mode];
  if (!config) {
    throw new SiteRuntimeError(
      'SITE-RUN-E001',
      'scripts/site/site-constants.js',
      'modeはpreviewまたはproductionだけです。'
    );
  }
  return config;
}

export class SiteRuntimeError extends Error {
  constructor(code, file, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'SiteRuntimeError';
    this.code = code;
    this.file = file;
  }
}
