const CORE_MANAGEMENT_UNITS = Object.freeze([
  'site',
  'regions',
  'organizations',
  'sources',
  'evidence',
  'sections',
  'cards',
  'disasters',
  'events',
  'card-source-links',
  'disaster-source-links',
  'event-source-links',
  'check-history',
  'update-history'
]);

const LOCALE_MANAGEMENT_UNITS = Object.freeze([
  'site',
  'regions',
  'organizations',
  'sources',
  'evidence',
  'sections',
  'cards',
  'disasters',
  'events',
  'card-source-links',
  'disaster-source-links',
  'event-source-links',
  'update-history'
]);

const IMPLEMENTED_ARRAY_MANAGEMENT_UNITS = new Set([
  'regions',
  'organizations',
  'sources',
  'evidence',
  'sections',
  'cards',
  'card-source-links'
]);

export const SUPPORTED_LOCALES = Object.freeze(['ja', 'en']);

function dataEntry({ scope, managementUnit, locale }) {
  const isSite = managementUnit === 'site';
  const isImplementedArray = IMPLEMENTED_ARRAY_MANAGEMENT_UNITS.has(managementUnit);
  const dataPath =
    scope === 'core'
      ? `data/core/${managementUnit}.json`
      : `data/locales/${locale}/${managementUnit}.json`;
  const schemaPath =
    scope === 'core'
      ? `schemas/core/${managementUnit}.schema.json`
      : `schemas/locales/${managementUnit}.schema.json`;
  return Object.freeze({
    scope,
    managementUnit,
    locale,
    dataPath,
    schemaPath,
    isSite,
    isImplementedArray
  });
}

export const CORE_DATA_LAYOUT = Object.freeze(
  CORE_MANAGEMENT_UNITS.map((managementUnit) => dataEntry({ scope: 'core', managementUnit }))
);

export const LOCALE_DATA_LAYOUT = Object.freeze(
  SUPPORTED_LOCALES.flatMap((locale) =>
    LOCALE_MANAGEMENT_UNITS.map((managementUnit) =>
      dataEntry({ scope: 'locale', managementUnit, locale })
    )
  )
);

export const DATA_LAYOUT = Object.freeze([...CORE_DATA_LAYOUT, ...LOCALE_DATA_LAYOUT]);

export const SCHEMA_LAYOUT = Object.freeze([
  ...CORE_MANAGEMENT_UNITS.map((managementUnit) =>
    Object.freeze({
      scope: 'core',
      managementUnit,
      schemaPath: `schemas/core/${managementUnit}.schema.json`,
      isSite: managementUnit === 'site'
    })
  ),
  ...LOCALE_MANAGEMENT_UNITS.map((managementUnit) =>
    Object.freeze({
      scope: 'locale',
      managementUnit,
      schemaPath: `schemas/locales/${managementUnit}.schema.json`,
      isSite: managementUnit === 'site'
    })
  )
]);

export const SITE_DATA_LAYOUT = Object.freeze(DATA_LAYOUT.filter(({ isSite }) => isSite));
export const IMPLEMENTED_ARRAY_DATA_LAYOUT = Object.freeze(
  DATA_LAYOUT.filter(({ isImplementedArray }) => isImplementedArray)
);
export const EMPTY_DATA_LAYOUT = Object.freeze(
  DATA_LAYOUT.filter(({ isSite, isImplementedArray }) => !isSite && !isImplementedArray)
);
