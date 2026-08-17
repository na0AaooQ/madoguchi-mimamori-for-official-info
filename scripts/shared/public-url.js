const SAFE_REGION_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_ANCHOR_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function requireSafe(value, pattern, field) {
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new TypeError(`${field}はURL安全な識別子にしてください。`);
  }
  return value;
}

export function isSafeRegionSlug(value) {
  return typeof value === 'string' && SAFE_REGION_SLUG.test(value);
}

export function publicRootPath() {
  return '/';
}

export function nationalPath(locale) {
  return `/${requireSafe(locale, /^(?:ja|en)$/, 'locale')}/`;
}

export function regionPath(locale, regionSlug) {
  return `${nationalPath(locale)}regions/${requireSafe(regionSlug, SAFE_REGION_SLUG, 'region_slug')}/`;
}

export function regionSectionPath(locale, regionSlug, anchorId) {
  return `${regionPath(locale, regionSlug)}sections/${requireSafe(anchorId, SAFE_ANCHOR_ID, 'anchor_id')}/`;
}

export function regionOrganizationsPath(locale, regionSlug) {
  return `${regionPath(locale, regionSlug)}organizations/`;
}

export function privacyPath(locale) {
  return `/${requireSafe(locale, /^(?:ja|en)$/, 'locale')}/privacy/`;
}

export function logicalPagePath({ locale, pageType, regionSlug, anchorId }) {
  if (pageType === 'national') return nationalPath(locale);
  if (pageType === 'region') return regionPath(locale, regionSlug);
  if (pageType === 'section') return regionSectionPath(locale, regionSlug, anchorId);
  if (pageType === 'organizations') return regionOrganizationsPath(locale, regionSlug);
  if (pageType === 'privacy') return privacyPath(locale);
  throw new TypeError(`未対応のpage typeです: ${pageType}`);
}

export function pageTypeFromPath(pathname) {
  if (pathname === '/') return { pageType: 'root' };
  if (pathname === '/ja/privacy/' || pathname === '/en/privacy/') {
    return { locale: pathname.slice(1, 3), pageType: 'privacy' };
  }
  const organizations = /^\/(ja|en)\/regions\/([a-z0-9]+(?:-[a-z0-9]+)*)\/organizations\/?$/.exec(
    pathname
  );
  if (organizations)
    return { locale: organizations[1], pageType: 'organizations', regionSlug: organizations[2] };
  const section =
    /^\/(ja|en)\/regions\/([a-z0-9]+(?:-[a-z0-9]+)*)\/sections\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(
      pathname
    );
  if (section)
    return {
      locale: section[1],
      pageType: 'section',
      regionSlug: section[2],
      anchorId: section[3]
    };
  const region = /^\/(ja|en)\/regions\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(pathname);
  if (region) return { locale: region[1], pageType: 'region', regionSlug: region[2] };
  const national = /^\/(ja|en)\/?$/.exec(pathname);
  if (national) return { locale: national[1], pageType: 'national' };
  return undefined;
}
