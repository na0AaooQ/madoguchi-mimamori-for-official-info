import {
  DESTINATION_CATEGORY_ORDER,
  ROLE_ORDER,
  SITE_GENERATOR_NAME,
  SITE_LOCALES,
  SITE_OGP_IMAGE_PATH,
  SOURCE_TYPE_CATEGORIES
} from './site-constants.js';
import { absoluteSiteUrl, joinSitePath } from './site-url.js';
import {
  nationalPath,
  privacyPath,
  publicRootPath,
  regionOrganizationsPath,
  regionPath,
  regionSectionPath
} from '../shared/public-url.js';

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function containsJapanese(value) {
  return /[\u3040-\u30ff\u3400-\u9fff]/u.test(value);
}

function languageAttributes(value, locale, forceJapanese = false) {
  return locale === 'en' && (forceJapanese || containsJapanese(value)) ? ' lang="ja"' : '';
}

function list(items) {
  return `<ul>\n${items.map((item) => `          <li>${escapeHtml(item)}</li>`).join('\n')}\n        </ul>`;
}

function alternateLocale(locale) {
  return locale === 'ja' ? 'en' : 'ja';
}

function footerContactAnchor(ui) {
  return `<a href="${escapeHtml(ui.footer.contact_url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(ui.footer.contact_link_label)}">${escapeHtml(ui.footer.contact)}</a>`;
}

function rootOperatorLine(ui, languageAttribute = '', labelSeparator = '') {
  return `<p${languageAttribute}>${escapeHtml(ui.root.operator_label)}${labelSeparator}${escapeHtml(ui.privacy.operator_prefix)}&#x3000;<a href="${escapeHtml(ui.privacy.operator_url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(ui.privacy.operator_link_label)}">${escapeHtml(ui.privacy.operator_name)}</a></p>`;
}

function sitePath(inputs, relative = '') {
  return joinSitePath(inputs.siteUrl.basePath, relative);
}

function siteIconLinks(inputs) {
  return `  <link rel="icon" href="${escapeHtml(sitePath(inputs, 'favicon.ico'))}" sizes="16x16 32x32 48x48">
  <link rel="icon" href="${escapeHtml(sitePath(inputs, 'favicon.svg'))}" type="image/svg+xml" sizes="any">
  <link rel="apple-touch-icon" href="${escapeHtml(sitePath(inputs, 'apple-touch-icon.png'))}" sizes="180x180">`;
}

function commonDetails(site, ui) {
  return `
      <details class="common-details">
        <summary>${escapeHtml(ui.about.summary)}</summary>
        <div class="common-details-content">
          <p>${escapeHtml(site.purpose)}</p>
${list(ui.about.items)}
          <p>${escapeHtml(site.free_use_notice)}</p>
          <p>${escapeHtml(site.disclaimer_summary)}</p>
        </div>
      </details>
      <details class="common-details">
        <summary>${escapeHtml(ui.usage.summary)}</summary>
        <div class="common-details-content">
${list(ui.usage.items)}
          <p>${escapeHtml(site.external_site_notice)}</p>
        </div>
      </details>`;
}

function displayOrganizationName(organization, locale) {
  const forceJapanese = organization.name_kind === 'official-ja-fallback';
  return `<span${languageAttributes(organization.official_name, locale, forceJapanese)}>${escapeHtml(organization.official_name)}</span>`;
}

function metadataRow(label, value) {
  if (value === undefined || value === '') return '';
  return `            <dt>${escapeHtml(label)}</dt>\n            <dd>${value}</dd>`;
}

function dateValue(value) {
  return `<time datetime="${escapeHtml(value)}">${escapeHtml(value)}</time>`;
}

function renderDestination({ destination, link, locale, ui, visibility, showOrganization }) {
  const organization = destination.organization;
  const rows = [];
  if (showOrganization)
    rows.push(metadataRow(ui.fields.organization, displayOrganizationName(organization, locale)));
  rows.push(
    metadataRow(
      ui.fields.destination_name,
      `<span${languageAttributes(destination.display_title, locale)}>${escapeHtml(destination.display_title)}</span>`
    ),
    metadataRow(ui.fields.purpose, escapeHtml(destination.purpose)),
    metadataRow(ui.fields.usage, escapeHtml(visibility)),
    destination.destination_language_note
      ? metadataRow(ui.fields.language_note, escapeHtml(destination.destination_language_note))
      : '',
    metadataRow(ui.fields.url, `<span class="url-text">${escapeHtml(destination.url)}</span>`),
    destination.platform ? metadataRow(ui.fields.platform, escapeHtml(destination.platform)) : '',
    destination.account_id
      ? metadataRow(ui.fields.account_id, escapeHtml(destination.account_id))
      : '',
    link?.public_note ? metadataRow(ui.fields.public_note, escapeHtml(link.public_note)) : '',
    destination.public_note
      ? metadataRow(ui.fields.public_note, escapeHtml(destination.public_note))
      : '',
    metadataRow(ui.fields.destination_checked_on, dateValue(destination.destination_checked_on)),
    metadataRow(
      ui.fields.official_information_checked_on,
      dateValue(destination.official_information_checked_on)
    )
  );
  const fallbackNotice =
    showOrganization && organization.name_kind === 'official-ja-fallback'
      ? `\n          <p class="note">${escapeHtml(ui.destination.official_name_fallback)}</p>`
      : '';
  const organizationSummary =
    showOrganization && organization.summary
      ? `\n          <p${languageAttributes(organization.summary, locale)}>${escapeHtml(organization.summary)}</p>`
      : '';
  const heading = link?.button_label ?? destination.display_title;
  return `        <article class="destination">
          <h4${languageAttributes(heading, locale)}>${escapeHtml(heading)}</h4>
          <dl class="metadata">
${rows.filter(Boolean).join('\n')}
          </dl>${fallbackNotice}${organizationSummary}
          <p class="note">${escapeHtml(ui.destination.fictional_url_note)}</p>
          <p>${escapeHtml(ui.destination.external_notice)}</p>
        </article>`;
}

function renderCard(card, locale, ui) {
  const region = card.region_label
    ? `\n          <span class="card-summary-region">${escapeHtml(card.region_label)}</span>`
    : '';
  const roleGroups = ROLE_ORDER.map((role) => [
    role,
    card.links.filter((link) => link.role === role)
  ])
    .filter(([, links]) => links.length > 0)
    .map(
      ([role, links]) => `
        <section>
          <h3>${escapeHtml(ui.roles[role])}</h3>
${links
  .map((link) =>
    renderDestination({
      destination: link.destination,
      link,
      locale,
      ui,
      visibility: ui.visibility[link.visibility_context],
      showOrganization: true
    })
  )
  .join('\n')}
        </section>`
    )
    .join('');
  const emergency = card.emergency_note
    ? `\n        <p class="note">${escapeHtml(card.emergency_note)}</p>`
    : '';
  return `      <details class="card">
        <summary>
          <span class="card-summary-title">${escapeHtml(card.title)}</span>
          <span class="card-summary-description">${escapeHtml(card.summary)}</span>${region}
        </summary>
        <div class="card-content">${emergency}${roleGroups}
        </div>
      </details>`;
}

export function aggregateOrganizations(navigation) {
  const organizations = [];
  const byId = new Map();
  for (const section of navigation.sections) {
    for (const card of section.cards) {
      for (const link of card.links) {
        const { destination } = link;
        const organizationData = destination.organization;
        let organization = byId.get(organizationData.id);
        if (!organization) {
          organization = {
            organization: organizationData,
            regions: [],
            regionSet: new Set(),
            destinations: [],
            destinationById: new Map()
          };
          byId.set(organizationData.id, organization);
          organizations.push(organization);
        }
        if (card.region_label && !organization.regionSet.has(card.region_label)) {
          organization.regionSet.add(card.region_label);
          organization.regions.push(card.region_label);
        }
        let aggregatedDestination = organization.destinationById.get(destination.id);
        if (!aggregatedDestination) {
          aggregatedDestination = { destination, contexts: new Set() };
          organization.destinationById.set(destination.id, aggregatedDestination);
          organization.destinations.push(aggregatedDestination);
        }
        aggregatedDestination.contexts.add(link.visibility_context);
      }
    }
  }
  return organizations;
}

export function aggregateVisibility(contexts) {
  if (contexts.has('always') || (contexts.has('normal') && contexts.has('disaster')))
    return 'always';
  if (contexts.has('normal')) return 'normal';
  return 'disaster';
}

function privacySection(heading, items) {
  return `      <section>
        <h2>${escapeHtml(heading)}</h2>
${list(items)}
      </section>`;
}

function privacyParagraphSection(heading, paragraphs, links, ui) {
  return `      <section>
        <h2>${escapeHtml(heading)}</h2>
${paragraphs.map((paragraph) => `        <p>${escapeHtml(paragraph)}</p>`).join('\n')}
        <ul>
${links.map(({ label, url }) => `          <li>${externalAnchor(url, label, ui)}</li>`).join('\n')}
        </ul>
      </section>`;
}

function previewLogicalPath(inputs, logicalPath) {
  return sitePath(inputs, logicalPath.replace(/^\//, ''));
}

function previewNavigationHeader(inputs, navigation, ui, alternatePath) {
  const locale = navigation.locale;
  const otherLocale = alternateLocale(locale);
  return `
  <header class="site-header">
    <div class="header-inner">
      <a class="site-name" href="${escapeHtml(previewLogicalPath(inputs, nationalPath(locale)))}">${escapeHtml(navigation.site.site_name)}</a>
      <div class="header-actions">
        <nav aria-label="${escapeHtml(ui.navigation_label)}">
          <a class="language-link" href="${escapeHtml(alternatePath)}" hreflang="${otherLocale}" lang="${otherLocale}" aria-label="${escapeHtml(ui.language_switch_label)}">${escapeHtml(ui.alternate_language_name)}</a>
        </nav>
        <fieldset class="font-size-control" data-font-size-control hidden>
          <legend>${escapeHtml(ui.font_size.label)}</legend>
          <button type="button" data-text-size="standard" aria-pressed="true">${escapeHtml(ui.font_size.standard)}</button>
          <button type="button" data-text-size="large" aria-pressed="false">${escapeHtml(ui.font_size.large)}</button>
        </fieldset>
      </div>
    </div>
  </header>`;
}

function previewNavigationFooter(inputs, navigation, ui, regionSlug) {
  const locale = navigation.locale;
  const home = regionSlug
    ? previewLogicalPath(inputs, regionPath(locale, regionSlug))
    : previewLogicalPath(inputs, nationalPath(locale));
  const national = previewLogicalPath(inputs, nationalPath(locale));
  const privacy = previewLogicalPath(inputs, privacyPath(locale));
  const links = [
    `<li><a href="${escapeHtml(home)}">${escapeHtml(ui.footer.home)}</a></li>`,
    ...(regionSlug
      ? [
          `<li><a href="${escapeHtml(national)}">${escapeHtml(ui.pages.national_home_link)}</a></li>`,
          `<li><a href="${escapeHtml(previewLogicalPath(inputs, regionOrganizationsPath(locale, regionSlug)))}">${escapeHtml(ui.footer.organizations)}</a></li>`
        ]
      : []),
    `<li><a href="${escapeHtml(privacy)}">${escapeHtml(ui.footer.privacy)}</a></li>`,
    `<li>${footerContactAnchor(ui)}</li>`
  ].join('\n          ');
  return `
  <footer class="site-footer">
    <div class="footer-inner">
      <nav aria-label="${escapeHtml(ui.navigation_label)}">
        <ul class="footer-links">
          ${links}
        </ul>
      </nav>
      <p>${escapeHtml(ui.footer.free_notice)}</p>
      <p class="copyright"${locale === 'en' ? ' lang="ja"' : ''}>${escapeHtml(ui.footer.copyright)}</p>
    </div>
  </footer>`;
}

function previewHreflangLinks(currentPath, alternatePath) {
  const locale = currentPath.match(/^\/(?:preview\/)?(ja|en)\//)?.[1] ?? 'ja';
  const alternateLocaleValue = alternateLocale(locale);
  return `  <link rel="alternate" hreflang="${locale}" href="${escapeHtml(currentPath)}">
  <link rel="alternate" hreflang="${alternateLocaleValue}" href="${escapeHtml(alternatePath)}">`;
}

function regionalPreviewPageShell({
  inputs,
  navigation,
  ui,
  title,
  currentPath,
  alternatePath,
  mainContent,
  regionSlug
}) {
  const pageTitle = `${title}｜${navigation.site.site_name}`;
  return `<!doctype html>
<html lang="${navigation.locale}" data-text-size="standard">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <meta name="generator" content="${SITE_GENERATOR_NAME}">
  <title>${escapeHtml(pageTitle)}</title>
${previewHreflangLinks(currentPath, alternatePath)}
${siteIconLinks(inputs)}
  <link rel="stylesheet" href="${escapeHtml(sitePath(inputs, 'assets/styles.css'))}">
  <script src="${escapeHtml(sitePath(inputs, 'assets/font-size.js'))}" defer></script>
</head>
<body>
  <a class="skip-link" href="#main-content">${escapeHtml(ui.skip_link)}</a>${previewNavigationHeader(inputs, navigation, ui, alternatePath)}
  <div class="page">
    <aside class="preview-notice" aria-label="${escapeHtml(ui.preview_notice.title)}">
      <strong>${escapeHtml(ui.preview_notice.title)}</strong>
      <p>${escapeHtml(ui.preview_notice.body)}</p>
    </aside>
    <main id="main-content">
${mainContent}${commonDetails(navigation.site, ui)}
    </main>
  </div>${previewNavigationFooter(inputs, navigation, ui, regionSlug)}
</body>
</html>
`;
}

function previewNationalPage(inputs, navigation, ui) {
  const locale = navigation.locale;
  const regions = (navigation.regions ?? [])
    .map(
      (region) => `        <li>
          <a class="section-link" href="${escapeHtml(previewLogicalPath(inputs, region.path))}">
            <strong>${escapeHtml(region.navigation_label)}</strong>${region.scope_note ? `\n            <span>${escapeHtml(region.scope_note)}</span>` : ''}
          </a>
        </li>`
    )
    .join('\n');
  const content = `      <h1>${escapeHtml(ui.pages.home_heading)}</h1>
      <p>${escapeHtml(navigation.site.short_description)}</p>
      <p>${escapeHtml(navigation.site.purpose)}</p>
      <section aria-labelledby="regions-heading">
        <h2 id="regions-heading">${escapeHtml(ui.pages.regions_heading)}</h2>
        <p>${escapeHtml(ui.pages.regions_intro)}</p>
        <ul class="section-list">
${regions}
        </ul>
      </section>`;
  const currentPath = previewLogicalPath(inputs, nationalPath(locale));
  return regionalPreviewPageShell({
    inputs,
    navigation,
    ui,
    title: ui.pages.home_title,
    currentPath,
    alternatePath: previewLogicalPath(inputs, nationalPath(alternateLocale(locale))),
    mainContent: content
  });
}

function previewRegionPage(inputs, navigation, ui) {
  const locale = navigation.locale;
  const region = navigation.region;
  const sectionItems = navigation.sections
    .map(
      (section) => `        <li>
          <a class="section-link" href="${escapeHtml(previewLogicalPath(inputs, regionSectionPath(locale, region.region_slug, section.anchor_id)))}">
            <strong>${escapeHtml(section.title)}</strong>${section.short_description ? `\n            <span>${escapeHtml(section.short_description)}</span>` : ''}
          </a>
        </li>`
    )
    .join('\n');
  const content = `      <a class="back-link" href="${escapeHtml(previewLogicalPath(inputs, nationalPath(locale)))}">${escapeHtml(ui.pages.national_home_link)}</a>
      <h1>${escapeHtml(region.region_name)}</h1>${region.scope_note ? `\n      <p>${escapeHtml(region.scope_note)}</p>` : ''}
      <p>${escapeHtml(navigation.site.purpose)}</p>
      <section aria-labelledby="sections-heading">
        <h2 id="sections-heading">${escapeHtml(ui.pages.sections_heading)}</h2>
        <p>${escapeHtml(ui.pages.sections_intro)}</p>
        <ul class="section-list">
${sectionItems}
        </ul>
      </section>
      <a class="primary-link" href="${escapeHtml(previewLogicalPath(inputs, regionOrganizationsPath(locale, region.region_slug)))}">${escapeHtml(ui.pages.organizations_link)}</a>`;
  const currentPath = previewLogicalPath(inputs, regionPath(locale, region.region_slug));
  return regionalPreviewPageShell({
    inputs,
    navigation,
    ui,
    title: region.region_name,
    currentPath,
    alternatePath: previewLogicalPath(
      inputs,
      regionPath(alternateLocale(locale), region.region_slug)
    ),
    mainContent: content,
    regionSlug: region.region_slug
  });
}

function previewRegionSectionPage(inputs, navigation, ui, section) {
  const locale = navigation.locale;
  const slug = navigation.region.region_slug;
  const cards =
    section.cards.length > 0
      ? section.cards.map((card) => renderCard(card, locale, ui)).join('\n')
      : `      <p class="note">${escapeHtml(ui.pages.empty_section)}</p>`;
  const regionHome = previewLogicalPath(inputs, regionPath(locale, slug));
  const content = `      <a class="back-link" href="${escapeHtml(regionHome)}">${escapeHtml(ui.pages.region_back)}</a>
      <h1>${escapeHtml(section.title)}</h1>${section.short_description ? `\n      <p>${escapeHtml(section.short_description)}</p>` : ''}
      <p class="note">${escapeHtml(ui.pages.situation_notice)}</p>
${cards}
      <a class="back-link" href="${escapeHtml(regionHome)}">${escapeHtml(ui.pages.region_back)}</a>`;
  return regionalPreviewPageShell({
    inputs,
    navigation,
    ui,
    title: section.title,
    currentPath: previewLogicalPath(inputs, regionSectionPath(locale, slug, section.anchor_id)),
    alternatePath: previewLogicalPath(
      inputs,
      regionSectionPath(alternateLocale(locale), slug, section.anchor_id)
    ),
    mainContent: content,
    regionSlug: slug
  });
}

function previewRegionOrganizationsPage(inputs, navigation, ui) {
  const locale = navigation.locale;
  const slug = navigation.region.region_slug;
  const organizations = aggregateOrganizations(navigation)
    .map(({ organization, regions, destinations }) => {
      const fallback =
        organization.name_kind === 'official-ja-fallback'
          ? `\n        <p class="note">${escapeHtml(ui.destination.official_name_fallback)}</p>`
          : '';
      const summary = organization.summary
        ? `\n        <p${languageAttributes(organization.summary, locale)}>${escapeHtml(organization.summary)}</p>`
        : '';
      const regionText =
        regions.length > 0
          ? `\n        <dl class="metadata">\n${metadataRow(ui.fields.region, regions.map(escapeHtml).join(' / '))}\n        </dl>`
          : '';
      const categories = DESTINATION_CATEGORY_ORDER.map((category) => [
        category,
        destinations.filter(
          ({ destination }) => SOURCE_TYPE_CATEGORIES[destination.source_type] === category
        )
      ])
        .filter(([, entries]) => entries.length > 0)
        .map(
          ([category, entries]) =>
            `\n        <section>\n          <h3>${escapeHtml(ui.destination_categories[category])}</h3>\n${entries.map(({ destination, contexts }) => renderDestination({ destination, locale, ui, visibility: ui.visibility[aggregateVisibility(contexts)], showOrganization: false })).join('\n')}\n        </section>`
        )
        .join('');
      return `      <article class="organization">\n        <h2${languageAttributes(organization.official_name, locale, organization.name_kind === 'official-ja-fallback')}>${escapeHtml(organization.official_name)}</h2>${fallback}${summary}${regionText}${categories}\n      </article>`;
    })
    .join('\n');
  const content = `      <a class="back-link" href="${escapeHtml(previewLogicalPath(inputs, regionPath(locale, slug)))}">${escapeHtml(ui.pages.region_back)}</a>
      <h1>${escapeHtml(ui.pages.organizations_title)}</h1>
      <p>${escapeHtml(ui.pages.organizations_intro)}</p>
      <p class="note">${escapeHtml(ui.pages.situation_notice)}</p>
${organizations}`;
  return regionalPreviewPageShell({
    inputs,
    navigation,
    ui,
    title: ui.pages.organizations_title,
    currentPath: previewLogicalPath(inputs, regionOrganizationsPath(locale, slug)),
    alternatePath: previewLogicalPath(
      inputs,
      regionOrganizationsPath(alternateLocale(locale), slug)
    ),
    mainContent: content,
    regionSlug: slug
  });
}

function previewPrivacyPage(inputs, navigation, ui) {
  const locale = navigation.locale;
  const privacy = ui.privacy;
  const content = `      <h1>${escapeHtml(ui.pages.privacy_title)}</h1>
      <p>${escapeHtml(privacy.established)}</p>
      <p>${escapeHtml(privacy.last_revised)}</p>
      <section>
        <h2>${escapeHtml(privacy.operator_heading)}</h2>
        <p>${escapeHtml(privacy.operator_prefix)}&#x3000;<a href="${escapeHtml(privacy.operator_url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(privacy.operator_link_label)}">${escapeHtml(privacy.operator_name)}</a></p>
      </section>
${privacySection(privacy.input_heading, privacy.input_items)}
${privacySection(privacy.unused_heading, privacy.unused_items)}
${privacySection(privacy.session_heading, privacy.session_items)}
${privacySection(privacy.external_heading, privacy.external_items)}
${privacySection(privacy.contact_heading, privacy.contact_items)}
${privacySection(privacy.logs_heading, privacy.logs_items)}
${privacySection(privacy.revision_heading, privacy.revision_items)}`;
  return regionalPreviewPageShell({
    inputs,
    navigation,
    ui,
    title: ui.pages.privacy_title,
    currentPath: previewLogicalPath(inputs, privacyPath(locale)),
    alternatePath: previewLogicalPath(inputs, privacyPath(alternateLocale(locale))),
    mainContent: content
  });
}

function expectedPreviewSiteArtifactPaths(navigations, regionalNavigations = {}) {
  const paths = new Set([
    'assets/styles.css',
    'assets/font-size.js',
    'favicon.svg',
    'favicon.ico',
    'apple-touch-icon.png'
  ]);
  for (const locale of SITE_LOCALES) {
    paths.add(`${locale}/index.html`);
    paths.add(`${locale}/privacy/index.html`);
    for (const navigation of Object.values(regionalNavigations[locale] ?? {})) {
      const slug = navigation.region.region_slug;
      paths.add(`${locale}/regions/${slug}/index.html`);
      paths.add(`${locale}/regions/${slug}/organizations/index.html`);
      for (const section of navigation.sections) {
        paths.add(`${locale}/regions/${slug}/sections/${section.anchor_id}/index.html`);
      }
    }
  }
  return [...paths].sort();
}

function buildPreviewSiteArtifacts(inputs) {
  const { navigations, regionalNavigations, uiLocales, assets } = inputs;
  const artifacts = new Map(Object.entries(assets));
  for (const locale of SITE_LOCALES) {
    const national = navigations[locale];
    const ui = uiLocales[locale];
    artifacts.set(`${locale}/index.html`, previewNationalPage(inputs, national, ui));
    artifacts.set(`${locale}/privacy/index.html`, previewPrivacyPage(inputs, national, ui));
    for (const navigation of Object.values(regionalNavigations[locale] ?? {})) {
      const slug = navigation.region.region_slug;
      artifacts.set(
        `${locale}/regions/${slug}/index.html`,
        previewRegionPage(inputs, navigation, ui)
      );
      artifacts.set(
        `${locale}/regions/${slug}/organizations/index.html`,
        previewRegionOrganizationsPage(inputs, navigation, ui)
      );
      for (const section of navigation.sections) {
        artifacts.set(
          `${locale}/regions/${slug}/sections/${section.anchor_id}/index.html`,
          previewRegionSectionPage(inputs, navigation, ui, section)
        );
      }
    }
  }
  return artifacts;
}

function productionPath(inputs, relative = '') {
  return sitePath(inputs, relative);
}

export function productionSocialMetaTags(
  inputs,
  { title, description, pageUrl, siteName, imageAlt }
) {
  const imageUrl = absoluteSiteUrl(inputs.siteUrl, SITE_OGP_IMAGE_PATH);
  const tags = [
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:type', 'website'],
    ['property', 'og:url', pageUrl],
    ['property', 'og:site_name', siteName],
    ['property', 'og:image', imageUrl],
    ['property', 'og:image:type', 'image/png'],
    ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'],
    ['property', 'og:image:alt', imageAlt],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:site', '@na0AaooQ'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
    ['name', 'twitter:image', imageUrl],
    ['name', 'twitter:image:alt', imageAlt]
  ];
  return tags
    .map(
      ([attribute, key, content]) =>
        `  <meta ${escapeHtml(attribute)}="${escapeHtml(key)}" content="${escapeHtml(content)}">`
    )
    .join('\n');
}

export function googleAnalyticsTag(measurementId) {
  return `  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(measurementId)}"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());

    gtag('config', '${escapeHtml(measurementId)}');
  </script>`;
}

function externalAnchor(url, text, ui, extraAttributes = '') {
  const label = `${text}（${ui.destination.external_link_label}）`;
  return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(label)}"${extraAttributes}>${escapeHtml(text)}</a>`;
}

function productionHeader(inputs, navigation, ui, alternatePath) {
  const locale = navigation.locale;
  const otherLocale = alternateLocale(locale);
  return `
  <header class="site-header">
    <div class="header-inner">
      <a class="site-name" href="${escapeHtml(productionPath(inputs, nationalPath(locale)))}">${escapeHtml(navigation.site.site_name)}</a>
      <div class="header-actions">
        <nav aria-label="${escapeHtml(ui.navigation_label)}">
          <a class="language-link" href="${escapeHtml(alternatePath)}" hreflang="${otherLocale}" lang="${otherLocale}" aria-label="${escapeHtml(ui.language_switch_label)}">${escapeHtml(ui.alternate_language_name)}</a>
        </nav>
        <fieldset class="font-size-control" data-font-size-control hidden>
          <legend>${escapeHtml(ui.font_size.label)}</legend>
          <button type="button" data-text-size="standard" aria-pressed="true">${escapeHtml(ui.font_size.standard)}</button>
          <button type="button" data-text-size="large" aria-pressed="false">${escapeHtml(ui.font_size.large)}</button>
        </fieldset>
      </div>
    </div>
  </header>`;
}

function productionFooter(inputs, navigation, ui, regionSlug) {
  const locale = navigation.locale;
  const operatorLang = locale === 'en' ? ' lang="ja"' : '';
  const contact = footerContactAnchor(ui);
  const home = regionSlug ? regionPath(locale, regionSlug) : nationalPath(locale);
  const links = [
    `<li><a href="${escapeHtml(productionPath(inputs, home))}">${escapeHtml(ui.footer.home)}</a></li>`,
    ...(regionSlug
      ? [
          `<li><a href="${escapeHtml(productionPath(inputs, nationalPath(locale)))}">${escapeHtml(ui.pages.national_home_link)}</a></li>`,
          `<li><a href="${escapeHtml(productionPath(inputs, regionOrganizationsPath(locale, regionSlug)))}">${escapeHtml(ui.footer.organizations)}</a></li>`
        ]
      : []),
    `<li><a href="${escapeHtml(productionPath(inputs, privacyPath(locale)))}">${escapeHtml(ui.footer.privacy)}</a></li>`,
    `<li>${contact}</li>`
  ].join('\n          ');
  return `
  <footer class="site-footer">
    <div class="footer-inner">
      <nav aria-label="${escapeHtml(ui.navigation_label)}">
        <ul class="footer-links">
          ${links}
        </ul>
      </nav>
      <p>${escapeHtml(ui.footer.free_notice)}</p>
      <p class="copyright"${operatorLang}>${escapeHtml(ui.footer.copyright)}</p>
    </div>
  </footer>`;
}

function productionHead({
  inputs,
  title,
  socialMetadata = '',
  alternateLinks = '',
  robots = '',
  includeFontSizeScript = true
}) {
  const robotsMeta = robots ? `  ${robots}\n` : '';
  const fontSizeScript = includeFontSizeScript
    ? `\n  <script src="${escapeHtml(productionPath(inputs, 'assets/font-size.js'))}" defer></script>`
    : '';
  return `<head>
  <meta charset="utf-8">
${googleAnalyticsTag(inputs.siteUrl.analytics.measurement_id)}
  <meta name="viewport" content="width=device-width, initial-scale=1">
${robotsMeta}  <meta name="generator" content="${SITE_GENERATOR_NAME}">
  <title>${escapeHtml(title)}</title>
${socialMetadata ? `${socialMetadata}\n` : ''}${alternateLinks ? `${alternateLinks}\n` : ''}${siteIconLinks(inputs)}
  <link rel="stylesheet" href="${escapeHtml(productionPath(inputs, 'assets/styles.css'))}">${fontSizeScript}
</head>`;
}

function productionHreflangLinks(inputs, currentPath, alternatePath) {
  const locale = currentPath.startsWith('/en/') ? 'en' : 'ja';
  const otherLocale = alternateLocale(locale);
  return `  <link rel="alternate" hreflang="${locale}" href="${escapeHtml(absoluteSiteUrl(inputs.siteUrl, currentPath))}">
  <link rel="alternate" hreflang="${otherLocale}" href="${escapeHtml(absoluteSiteUrl(inputs.siteUrl, alternatePath))}">`;
}

function localizedPageTitle(locale, parts) {
  return parts.join(locale === 'ja' ? '｜' : ' | ');
}

function productionPageShell({
  inputs,
  navigation,
  ui,
  title,
  description,
  pagePath,
  alternatePath,
  mainContent,
  regionSlug
}) {
  const socialMetadata = productionSocialMetaTags(inputs, {
    title,
    description,
    pageUrl: absoluteSiteUrl(inputs.siteUrl, pagePath),
    siteName: navigation.site.site_name,
    imageAlt: ui.social.image_alt
  });
  return `<!doctype html>
<html lang="${navigation.locale}" data-text-size="standard">
${productionHead({
  inputs,
  title,
  socialMetadata,
  alternateLinks: productionHreflangLinks(inputs, pagePath, alternatePath)
})}
<body>
  <a class="skip-link" href="#main-content">${escapeHtml(ui.skip_link)}</a>${productionHeader(inputs, navigation, ui, alternatePath)}
  <div class="page">
    <main id="main-content">
${mainContent}${commonDetails(navigation.site, ui)}
    </main>
  </div>${productionFooter(inputs, navigation, ui, regionSlug)}
</body>
</html>
`;
}

function productionNationalPage(inputs, navigation, ui) {
  const locale = navigation.locale;
  const siteIdentity =
    locale === 'ja'
      ? `      <p><strong>${escapeHtml(navigation.site.site_name)}</strong>｜${escapeHtml(navigation.site.subtitle)}</p>
`
      : '';
  const regionItems = navigation.regions
    .map(
      (region) => `        <li>
          <a class="section-link" href="${escapeHtml(productionPath(inputs, region.path))}">
            <strong>${escapeHtml(region.navigation_label)}</strong>${region.scope_note ? `\n            <span>${escapeHtml(region.scope_note)}</span>` : ''}
          </a>
        </li>`
    )
    .join('\n');
  const content = `${siteIdentity}      <h1>${escapeHtml(ui.pages.home_heading)}</h1>
      <p>${escapeHtml(navigation.site.short_description)}</p>
      <p>${escapeHtml(navigation.site.purpose)}</p>
      <section aria-labelledby="regions-heading">
        <h2 id="regions-heading">${escapeHtml(ui.pages.regions_heading)}</h2>
        <p>${escapeHtml(ui.pages.regions_intro)}</p>
        <ul class="section-list">
${regionItems}
        </ul>
      </section>`;
  return productionPageShell({
    inputs,
    navigation,
    ui,
    title: localizedPageTitle(locale, [navigation.site.site_name, navigation.site.subtitle]),
    description: navigation.site.short_description,
    pagePath: nationalPath(locale),
    alternatePath: nationalPath(alternateLocale(locale)),
    mainContent: content
  });
}

function renderProductionDestination({
  destination,
  link,
  locale,
  ui,
  visibility,
  showOrganization
}) {
  const organization = destination.organization;
  const rows = [];
  if (showOrganization)
    rows.push(metadataRow(ui.fields.organization, displayOrganizationName(organization, locale)));
  const urlLink = externalAnchor(destination.url, destination.url, ui);
  rows.push(
    metadataRow(
      ui.fields.destination_name,
      `<span${languageAttributes(destination.display_title, locale)}>${escapeHtml(destination.display_title)}</span>`
    ),
    metadataRow(ui.fields.purpose, escapeHtml(destination.purpose)),
    metadataRow(ui.fields.usage, escapeHtml(visibility)),
    destination.destination_language_note
      ? metadataRow(ui.fields.language_note, escapeHtml(destination.destination_language_note))
      : '',
    metadataRow(ui.fields.url, `<span class="url-text">${urlLink}</span>`),
    destination.platform ? metadataRow(ui.fields.platform, escapeHtml(destination.platform)) : '',
    destination.account_id
      ? metadataRow(ui.fields.account_id, escapeHtml(destination.account_id))
      : '',
    link?.public_note ? metadataRow(ui.fields.public_note, escapeHtml(link.public_note)) : '',
    destination.public_note
      ? metadataRow(ui.fields.public_note, escapeHtml(destination.public_note))
      : '',
    metadataRow(ui.fields.destination_checked_on, dateValue(destination.destination_checked_on)),
    metadataRow(
      ui.fields.official_information_checked_on,
      dateValue(destination.official_information_checked_on)
    )
  );
  const fallbackNotice =
    showOrganization && organization.name_kind === 'official-ja-fallback'
      ? `\n          <p class="note">${escapeHtml(ui.destination.official_name_fallback)}</p>`
      : '';
  const organizationSummary =
    showOrganization && organization.summary
      ? `\n          <p${languageAttributes(organization.summary, locale)}>${escapeHtml(organization.summary)}</p>`
      : '';
  const heading = link?.button_label ?? destination.display_title;
  return `        <article class="destination">
          <h4${languageAttributes(heading, locale)}>${escapeHtml(heading)}</h4>
          <dl class="metadata">
${rows.filter(Boolean).join('\n')}
          </dl>${fallbackNotice}${organizationSummary}
          <p>${escapeHtml(ui.destination.external_notice)}</p>
        </article>`;
}

function renderProductionCard(card, locale, ui) {
  const region = card.region_label
    ? `\n          <span class="card-summary-region">${escapeHtml(card.region_label)}</span>`
    : '';
  const roleGroups = ROLE_ORDER.map((role) => [
    role,
    card.links.filter((link) => link.role === role)
  ])
    .filter(([, links]) => links.length > 0)
    .map(
      ([role, links]) => `
        <section>
          <h3>${escapeHtml(ui.roles[role])}</h3>
${links
  .map((link) =>
    renderProductionDestination({
      destination: link.destination,
      link,
      locale,
      ui,
      visibility: ui.visibility[link.visibility_context],
      showOrganization: true
    })
  )
  .join('\n')}
        </section>`
    )
    .join('');
  const emergency = card.emergency_note
    ? `\n        <p class="note">${escapeHtml(card.emergency_note)}</p>`
    : '';
  return `      <details class="card">
        <summary>
          <span class="card-summary-title">${escapeHtml(card.title)}</span>
          <span class="card-summary-description">${escapeHtml(card.summary)}</span>${region}
        </summary>
        <div class="card-content">${emergency}${roleGroups}
        </div>
      </details>`;
}

function productionRegionPage(inputs, navigation, ui) {
  const locale = navigation.locale;
  const region = navigation.region;
  const sectionItems = navigation.sections
    .map(
      (section) => `        <li>
          <a class="section-link" href="${escapeHtml(productionPath(inputs, regionSectionPath(locale, region.region_slug, section.anchor_id)))}">
            <strong>${escapeHtml(section.title)}</strong>${section.short_description ? `\n            <span>${escapeHtml(section.short_description)}</span>` : ''}
          </a>
        </li>`
    )
    .join('\n');
  const content = `      <a class="back-link" href="${escapeHtml(productionPath(inputs, nationalPath(locale)))}">${escapeHtml(ui.pages.national_home_link)}</a>
      <h1>${escapeHtml(region.region_name)}</h1>${region.scope_note ? `\n      <p>${escapeHtml(region.scope_note)}</p>` : ''}
      <p>${escapeHtml(navigation.site.purpose)}</p>
      <section aria-labelledby="sections-heading">
        <h2 id="sections-heading">${escapeHtml(ui.pages.sections_heading)}</h2>
        <p>${escapeHtml(ui.pages.sections_intro)}</p>
        <ul class="section-list">
${sectionItems}
        </ul>
      </section>
      <a class="primary-link" href="${escapeHtml(productionPath(inputs, regionOrganizationsPath(locale, region.region_slug)))}">${escapeHtml(ui.pages.organizations_link)}</a>`;
  return productionPageShell({
    inputs,
    navigation,
    ui,
    title: localizedPageTitle(locale, [region.region_name, navigation.site.site_name]),
    description: region.scope_note,
    pagePath: regionPath(locale, region.region_slug),
    alternatePath: regionPath(alternateLocale(locale), region.region_slug),
    mainContent: content,
    regionSlug: region.region_slug
  });
}

function productionRegionSectionPage(inputs, navigation, ui, section) {
  const locale = navigation.locale;
  const slug = navigation.region.region_slug;
  const homePath = productionPath(inputs, regionPath(locale, slug));
  const cards =
    section.cards.length > 0
      ? section.cards.map((card) => renderProductionCard(card, locale, ui)).join('\n')
      : `      <p class="note">${escapeHtml(ui.pages.empty_section)}</p>`;
  const content = `      <a class="back-link" href="${escapeHtml(homePath)}">${escapeHtml(ui.pages.region_back)}</a>
      <h1>${escapeHtml(section.title)}</h1>${section.short_description ? `\n      <p>${escapeHtml(section.short_description)}</p>` : ''}
      <p class="note">${escapeHtml(ui.pages.situation_notice)}</p>
${cards}
      <a class="back-link" href="${escapeHtml(homePath)}">${escapeHtml(ui.pages.region_back)}</a>`;
  return productionPageShell({
    inputs,
    navigation,
    ui,
    title: localizedPageTitle(locale, [
      section.title,
      navigation.region.region_name,
      navigation.site.site_name
    ]),
    description: section.short_description,
    pagePath: regionSectionPath(locale, slug, section.anchor_id),
    alternatePath: regionSectionPath(alternateLocale(locale), slug, section.anchor_id),
    mainContent: content,
    regionSlug: slug
  });
}

function productionRegionOrganizationsPage(inputs, navigation, ui) {
  const locale = navigation.locale;
  const slug = navigation.region.region_slug;
  const organizations = aggregateOrganizations(navigation)
    .map(({ organization, regions, destinations }) => {
      const fallback =
        organization.name_kind === 'official-ja-fallback'
          ? `\n        <p class="note">${escapeHtml(ui.destination.official_name_fallback)}</p>`
          : '';
      const summary = organization.summary
        ? `\n        <p${languageAttributes(organization.summary, locale)}>${escapeHtml(organization.summary)}</p>`
        : '';
      const regionText =
        regions.length > 0
          ? `\n        <dl class="metadata">\n${metadataRow(ui.fields.region, regions.map(escapeHtml).join(' / '))}\n        </dl>`
          : '';
      const categories = DESTINATION_CATEGORY_ORDER.map((category) => [
        category,
        destinations.filter(
          ({ destination }) => SOURCE_TYPE_CATEGORIES[destination.source_type] === category
        )
      ])
        .filter(([, entries]) => entries.length > 0)
        .map(
          ([category, entries]) => `
        <section>
          <h3>${escapeHtml(ui.destination_categories[category])}</h3>
${entries
  .map(({ destination, contexts }) =>
    renderProductionDestination({
      destination,
      locale,
      ui,
      visibility: ui.visibility[aggregateVisibility(contexts)],
      showOrganization: false
    })
  )
  .join('\n')}
        </section>`
        )
        .join('');
      return `      <article class="organization">
        <h2${languageAttributes(organization.official_name, locale, organization.name_kind === 'official-ja-fallback')}>${escapeHtml(organization.official_name)}</h2>${fallback}${summary}${regionText}${categories}
      </article>`;
    })
    .join('\n');
  const content = `      <a class="back-link" href="${escapeHtml(productionPath(inputs, regionPath(locale, slug)))}">${escapeHtml(ui.pages.region_back)}</a>
      <h1>${escapeHtml(ui.pages.organizations_title)}</h1>
      <p>${escapeHtml(ui.pages.organizations_intro)}</p>
      <p class="note">${escapeHtml(ui.pages.situation_notice)}</p>
${organizations}`;
  return productionPageShell({
    inputs,
    navigation,
    ui,
    title: localizedPageTitle(locale, [
      ui.pages.organizations_title,
      navigation.region.region_name,
      navigation.site.site_name
    ]),
    description: ui.pages.organizations_intro,
    pagePath: regionOrganizationsPath(locale, slug),
    alternatePath: regionOrganizationsPath(alternateLocale(locale), slug),
    mainContent: content,
    regionSlug: slug
  });
}

function productionPrivacyPage(inputs, navigation, ui) {
  const locale = navigation.locale;
  const privacy = ui.privacy;
  const operator = externalAnchor(
    privacy.operator_url,
    privacy.operator_name,
    ui,
    locale === 'en' ? ' lang="en"' : ''
  );
  const content = `      <h1>${escapeHtml(ui.pages.privacy_title)}</h1>
      <p>${escapeHtml(privacy.established)}</p>
      <p>${escapeHtml(privacy.last_revised)}</p>
      <section>
        <h2>${escapeHtml(privacy.operator_heading)}</h2>
        <p>${escapeHtml(privacy.operator_prefix)}&#x3000;${operator}</p>
      </section>
${privacySection(privacy.input_heading, privacy.input_items)}
${privacySection(privacy.unused_heading, privacy.unused_items)}
${privacySection(privacy.session_heading, privacy.session_items)}
${privacySection(privacy.external_heading, privacy.external_items)}
${privacySection(privacy.contact_heading, privacy.contact_items)}
${privacySection(privacy.logs_heading, privacy.logs_items)}
${privacyParagraphSection(
  privacy.analytics.heading,
  privacy.analytics.paragraphs,
  privacy.analytics.links,
  ui
)}
${privacySection(privacy.revision_heading, privacy.revision_items)}`;
  return productionPageShell({
    inputs,
    navigation,
    ui,
    title: localizedPageTitle(locale, [ui.pages.privacy_title, navigation.site.site_name]),
    description: ui.social.privacy_description,
    pagePath: privacyPath(locale),
    alternatePath: privacyPath(alternateLocale(locale)),
    mainContent: content
  });
}

function productionRootPage(inputs) {
  const japaneseUi = inputs.uiLocales.ja;
  const englishUi = inputs.uiLocales.en;
  const japaneseRoot = japaneseUi.root;
  const englishRoot = englishUi.root;
  const japaneseSite = inputs.navigations.ja.site;
  const japaneseSiteName = inputs.navigations.ja.site.site_name;
  const japaneseSiteSubtitle = japaneseSite.subtitle;
  const englishSiteName = inputs.navigations.en.site.site_name;
  const documentTitle = `${japaneseSiteName}｜${japaneseSiteSubtitle}｜${japaneseRoot.title}`;
  const socialMetadata = productionSocialMetaTags(inputs, {
    title: `${japaneseSiteName}｜${englishSiteName}`,
    description: `${japaneseRoot.description} / ${englishRoot.description}`,
    pageUrl: absoluteSiteUrl(inputs.siteUrl),
    siteName: `${japaneseSiteName}｜${englishSiteName}`,
    imageAlt: japaneseUi.social.image_alt
  });
  return `<!doctype html>
<html lang="ja" data-text-size="standard">
${productionHead({ inputs, title: documentTitle, socialMetadata })}
<body class="production-root">
  <a class="skip-link" href="#main-content">${escapeHtml(japaneseUi.skip_link)}<span lang="en"> / ${escapeHtml(englishUi.skip_link)}</span></a>
  <header class="site-header">
    <div class="header-inner">
      <span class="site-name">${escapeHtml(japaneseSiteName)}｜<span lang="en">${escapeHtml(englishSiteName)}</span></span>
      <div class="header-actions">
        <fieldset class="font-size-control" data-font-size-control hidden>
          <legend>${escapeHtml(japaneseUi.font_size.label)}<span lang="en"> / ${escapeHtml(englishUi.font_size.label)}</span></legend>
          <button type="button" data-text-size="standard" aria-pressed="true">${escapeHtml(japaneseUi.font_size.standard)}<span lang="en"> / ${escapeHtml(englishUi.font_size.standard)}</span></button>
          <button type="button" data-text-size="large" aria-pressed="false">${escapeHtml(japaneseUi.font_size.large)}<span lang="en"> / ${escapeHtml(englishUi.font_size.large)}</span></button>
        </fieldset>
      </div>
    </div>
  </header>
  <div class="page">
    <main id="main-content">
      <p><strong>${escapeHtml(japaneseSiteName)}</strong>｜${escapeHtml(japaneseSiteSubtitle)}</p>
      <h1 class="root-language-heading">${escapeHtml(japaneseRoot.heading)}<br><span lang="en">${escapeHtml(englishRoot.heading)}</span></h1>
      <p class="root-description-ja">${escapeHtml(japaneseRoot.description)}</p>
      <p lang="en">${escapeHtml(englishRoot.description)}</p>
      <p class="note">${escapeHtml(japaneseRoot.unofficial)}</p>
      <p class="note" lang="en">${escapeHtml(englishRoot.unofficial)}</p>
      <ul class="section-list">
        <li><a class="section-link" href="${escapeHtml(productionPath(inputs, nationalPath('ja')))}" hreflang="ja" lang="ja"><strong>${escapeHtml(japaneseRoot.language_link)}</strong></a></li>
        <li><a class="section-link" href="${escapeHtml(productionPath(inputs, nationalPath('en')))}" hreflang="en" lang="en"><strong>${escapeHtml(englishRoot.language_link)}</strong></a></li>
      </ul>
    </main>
  </div>
  <footer class="site-footer">
    <div class="footer-inner">
      <nav aria-label="${escapeHtml(japaneseRoot.footer_navigation_label)}">
        <ul class="footer-links">
          <li><a href="${escapeHtml(productionPath(inputs, privacyPath('ja')))}">${escapeHtml(japaneseUi.footer.privacy)}</a></li>
          <li>${footerContactAnchor(japaneseUi)}</li>
        </ul>
      </nav>
      <nav lang="en" aria-label="${escapeHtml(englishRoot.footer_navigation_label)}">
        <ul class="footer-links">
          <li><a href="${escapeHtml(productionPath(inputs, privacyPath('en')))}">${escapeHtml(englishUi.footer.privacy)}</a></li>
          <li>${footerContactAnchor(englishUi)}</li>
        </ul>
      </nav>
      <p>${escapeHtml(japaneseUi.footer.free_notice)}</p>
      <p lang="en">${escapeHtml(englishUi.footer.free_notice)}</p>
      ${rootOperatorLine(japaneseUi)}
      ${rootOperatorLine(englishUi, ' lang="en"', ' ')}
      <p class="copyright">${escapeHtml(japaneseUi.footer.copyright)}</p>
    </div>
  </footer>
</body>
</html>
`;
}

function productionNotFoundPage(inputs) {
  const ui = inputs.uiLocales.ja;
  const notFound = ui.not_found;
  const siteName = inputs.navigations.ja.site.site_name;
  return `<!doctype html>
<html lang="ja">
${productionHead({
  inputs,
  title: `${notFound.title}｜${siteName}`,
  robots: '<meta name="robots" content="noindex">',
  includeFontSizeScript: false
})}
<body>
  <div class="page">
    <main id="main-content">
      <h1>${escapeHtml(notFound.heading)}</h1>
      <p>${escapeHtml(notFound.body_ja)}</p>
      <p lang="en">${escapeHtml(notFound.body_en)}</p>
      <ul>
        <li><a href="${escapeHtml(productionPath(inputs, publicRootPath()))}">${escapeHtml(notFound.root_link)}</a></li>
        <li><a href="${escapeHtml(productionPath(inputs, nationalPath('ja')))}" hreflang="ja" lang="ja">${escapeHtml(notFound.japanese_link)}</a></li>
        <li><a href="${escapeHtml(productionPath(inputs, nationalPath('en')))}" hreflang="en" lang="en">${escapeHtml(notFound.english_link)}</a></li>
      </ul>
    </main>
  </div>
</body>
</html>
`;
}

export function productionSitemapUrls(inputs) {
  return regionalSitemapUrls(inputs);
}

export function regionalSitemapUrls(inputs) {
  const paths = [publicRootPath()];
  for (const locale of SITE_LOCALES) paths.push(nationalPath(locale));
  for (const locale of SITE_LOCALES) {
    for (const navigation of Object.values(inputs.regionalNavigations?.[locale] ?? {})) {
      const slug = navigation.region.region_slug;
      paths.push(regionPath(locale, slug));
      for (const section of navigation.sections) {
        paths.push(regionSectionPath(locale, slug, section.anchor_id));
      }
      paths.push(regionOrganizationsPath(locale, slug));
    }
  }
  for (const locale of SITE_LOCALES) paths.push(privacyPath(locale));
  return paths.map((pathname) => absoluteSiteUrl(inputs.siteUrl, pathname.replace(/^\//, '')));
}

function productionSitemap(inputs) {
  const entries = productionSitemapUrls(inputs)
    .map((url) => `  <url><loc>${escapeHtml(url)}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

function expectedProductionSiteArtifactPaths(navigations, regionalNavigations = {}) {
  const paths = new Set([
    'index.html',
    '404.html',
    'sitemap.xml',
    'assets/styles.css',
    'assets/font-size.js',
    'favicon.svg',
    'favicon.ico',
    'apple-touch-icon.png',
    SITE_OGP_IMAGE_PATH
  ]);
  for (const locale of SITE_LOCALES) {
    paths.add(`${locale}/index.html`);
    paths.add(`${locale}/privacy/index.html`);
    for (const navigation of Object.values(regionalNavigations[locale] ?? {})) {
      const slug = navigation.region.region_slug;
      paths.add(`${locale}/regions/${slug}/index.html`);
      paths.add(`${locale}/regions/${slug}/organizations/index.html`);
      for (const section of navigation.sections)
        paths.add(`${locale}/regions/${slug}/sections/${section.anchor_id}/index.html`);
    }
  }
  return [...paths].sort();
}

function buildProductionSiteArtifacts(inputs) {
  const artifacts = new Map(Object.entries(inputs.assets));
  artifacts.set('index.html', productionRootPage(inputs));
  artifacts.set('404.html', productionNotFoundPage(inputs));
  artifacts.set('sitemap.xml', productionSitemap(inputs));
  for (const locale of SITE_LOCALES) {
    const national = inputs.navigations[locale];
    const ui = inputs.uiLocales[locale];
    artifacts.set(`${locale}/index.html`, productionNationalPage(inputs, national, ui));
    artifacts.set(`${locale}/privacy/index.html`, productionPrivacyPage(inputs, national, ui));
    for (const navigation of Object.values(inputs.regionalNavigations[locale] ?? {})) {
      const slug = navigation.region.region_slug;
      artifacts.set(
        `${locale}/regions/${slug}/index.html`,
        productionRegionPage(inputs, navigation, ui)
      );
      artifacts.set(
        `${locale}/regions/${slug}/organizations/index.html`,
        productionRegionOrganizationsPage(inputs, navigation, ui)
      );
      for (const section of navigation.sections) {
        artifacts.set(
          `${locale}/regions/${slug}/sections/${section.anchor_id}/index.html`,
          productionRegionSectionPage(inputs, navigation, ui, section)
        );
      }
    }
  }
  return artifacts;
}

export function expectedSiteArtifactPaths(navigations, mode = 'preview', regionalNavigations = {}) {
  return mode === 'production'
    ? expectedProductionSiteArtifactPaths(navigations, regionalNavigations)
    : expectedPreviewSiteArtifactPaths(navigations, regionalNavigations);
}

export function buildSiteArtifacts(inputs) {
  return inputs.mode === 'production'
    ? buildProductionSiteArtifacts(inputs)
    : buildPreviewSiteArtifacts(inputs);
}
