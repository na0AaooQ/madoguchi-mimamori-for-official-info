import {
  DESTINATION_CATEGORY_ORDER,
  ROLE_ORDER,
  SITE_GENERATOR_NAME,
  SITE_LOCALES,
  SITE_OGP_IMAGE_PATH,
  SOURCE_TYPE_CATEGORIES
} from './site-constants.js';
import { absoluteSiteUrl, joinSitePath } from './site-url.js';

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

function header(navigation, ui, alternatePath) {
  const locale = navigation.locale;
  const otherLocale = alternateLocale(locale);
  return `
  <header class="site-header">
    <div class="header-inner">
      <a class="site-name" href="/preview/${locale}/">${escapeHtml(navigation.site.site_name)}</a>
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

function footer(navigation, ui) {
  const locale = navigation.locale;
  const operatorLang = locale === 'en' ? ' lang="ja"' : '';
  const contact = footerContactAnchor(ui);
  return `
  <footer class="site-footer">
    <div class="footer-inner">
      <nav aria-label="${escapeHtml(ui.navigation_label)}">
        <ul class="footer-links">
          <li><a href="/preview/${locale}/">${escapeHtml(ui.footer.home)}</a></li>
          <li><a href="/preview/${locale}/organizations/">${escapeHtml(ui.footer.organizations)}</a></li>
          <li><a href="/preview/${locale}/privacy/">${escapeHtml(ui.footer.privacy)}</a></li>
          <li>${contact}</li>
        </ul>
      </nav>
      <p>${escapeHtml(ui.footer.free_notice)}</p>
      <p class="copyright"${operatorLang}>${escapeHtml(ui.footer.copyright)}</p>
    </div>
  </footer>`;
}

function pageShell({ inputs, navigation, ui, title, alternatePath, mainContent }) {
  const pageTitle = `${title}｜${navigation.site.site_name}`;
  return `<!doctype html>
<html lang="${navigation.locale}" data-text-size="standard">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <meta name="generator" content="${SITE_GENERATOR_NAME}">
  <title>${escapeHtml(pageTitle)}</title>
${siteIconLinks(inputs)}
  <link rel="stylesheet" href="/preview/assets/styles.css">
  <script src="/preview/assets/font-size.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#main-content">${escapeHtml(ui.skip_link)}</a>${header(navigation, ui, alternatePath)}
  <div class="page">
    <aside class="preview-notice" aria-label="${escapeHtml(ui.preview_notice.title)}">
      <strong>${escapeHtml(ui.preview_notice.title)}</strong>
      <p>${escapeHtml(ui.preview_notice.body)}</p>
    </aside>
    <main id="main-content">
${mainContent}${commonDetails(navigation.site, ui)}
    </main>
  </div>${footer(navigation, ui)}
</body>
</html>
`;
}

function homePage(inputs, navigation, ui) {
  const locale = navigation.locale;
  const sectionItems = navigation.sections
    .map(
      (section) => `        <li>
          <a class="section-link" href="/preview/${locale}/sections/${escapeHtml(section.anchor_id)}/">
            <strong>${escapeHtml(section.title)}</strong>${section.short_description ? `\n            <span>${escapeHtml(section.short_description)}</span>` : ''}
          </a>
        </li>`
    )
    .join('\n');
  const content = `      <h1>${escapeHtml(ui.pages.home_heading)}</h1>
      <p>${escapeHtml(navigation.site.short_description)}</p>
      <p>${escapeHtml(navigation.site.purpose)}</p>
      <section aria-labelledby="sections-heading">
        <h2 id="sections-heading">${escapeHtml(ui.pages.sections_heading)}</h2>
        <p>${escapeHtml(ui.pages.sections_intro)}</p>
        <ul class="section-list">
${sectionItems}
        </ul>
      </section>
      <a class="primary-link" href="/preview/${locale}/organizations/">${escapeHtml(ui.pages.organizations_link)}</a>`;
  return pageShell({
    inputs,
    navigation,
    ui,
    title: ui.pages.home_title,
    alternatePath: `/preview/${alternateLocale(locale)}/`,
    mainContent: content
  });
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

function sectionPage(inputs, navigation, ui, section) {
  const locale = navigation.locale;
  const cards =
    section.cards.length > 0
      ? section.cards.map((card) => renderCard(card, locale, ui)).join('\n')
      : `      <p class="note">${escapeHtml(ui.pages.empty_section)}</p>`;
  const content = `      <a class="back-link" href="/preview/${locale}/">${escapeHtml(ui.pages.section_back)}</a>
      <h1>${escapeHtml(section.title)}</h1>${section.short_description ? `\n      <p>${escapeHtml(section.short_description)}</p>` : ''}
      <p class="note">${escapeHtml(ui.pages.situation_notice)}</p>
${cards}
      <a class="back-link" href="/preview/${locale}/">${escapeHtml(ui.pages.section_back)}</a>`;
  return pageShell({
    inputs,
    navigation,
    ui,
    title: section.title,
    alternatePath: `/preview/${alternateLocale(locale)}/sections/${section.anchor_id}/`,
    mainContent: content
  });
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

function organizationsPage(inputs, navigation, ui) {
  const locale = navigation.locale;
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
    renderDestination({
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
  const content = `      <h1>${escapeHtml(ui.pages.organizations_title)}</h1>
      <p>${escapeHtml(ui.pages.organizations_intro)}</p>
      <p class="note">${escapeHtml(ui.pages.situation_notice)}</p>
${organizations}`;
  return pageShell({
    inputs,
    navigation,
    ui,
    title: ui.pages.organizations_title,
    alternatePath: `/preview/${alternateLocale(locale)}/organizations/`,
    mainContent: content
  });
}

function privacySection(heading, items) {
  return `      <section>
        <h2>${escapeHtml(heading)}</h2>
${list(items)}
      </section>`;
}

function privacyPage(inputs, navigation, ui) {
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
  return pageShell({
    inputs,
    navigation,
    ui,
    title: ui.pages.privacy_title,
    alternatePath: `/preview/${alternateLocale(locale)}/privacy/`,
    mainContent: content
  });
}

function expectedPreviewSiteArtifactPaths(navigations) {
  const paths = new Set([
    'assets/styles.css',
    'assets/font-size.js',
    'favicon.svg',
    'favicon.ico',
    'apple-touch-icon.png'
  ]);
  for (const locale of SITE_LOCALES) {
    paths.add(`${locale}/index.html`);
    paths.add(`${locale}/organizations/index.html`);
    paths.add(`${locale}/privacy/index.html`);
    for (const section of navigations[locale].sections) {
      paths.add(`${locale}/sections/${section.anchor_id}/index.html`);
    }
  }
  return [...paths].sort();
}

function buildPreviewSiteArtifacts(inputs) {
  const { navigations, uiLocales, assets } = inputs;
  const artifacts = new Map(Object.entries(assets));
  for (const locale of SITE_LOCALES) {
    const navigation = navigations[locale];
    const ui = uiLocales[locale];
    artifacts.set(`${locale}/index.html`, homePage(inputs, navigation, ui));
    artifacts.set(`${locale}/organizations/index.html`, organizationsPage(inputs, navigation, ui));
    artifacts.set(`${locale}/privacy/index.html`, privacyPage(inputs, navigation, ui));
    for (const section of navigation.sections) {
      artifacts.set(
        `${locale}/sections/${section.anchor_id}/index.html`,
        sectionPage(inputs, navigation, ui, section)
      );
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
      <a class="site-name" href="${escapeHtml(productionPath(inputs, `${locale}/`))}">${escapeHtml(navigation.site.site_name)}</a>
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

function productionFooter(inputs, navigation, ui) {
  const locale = navigation.locale;
  const operatorLang = locale === 'en' ? ' lang="ja"' : '';
  const contact = footerContactAnchor(ui);
  return `
  <footer class="site-footer">
    <div class="footer-inner">
      <nav aria-label="${escapeHtml(ui.navigation_label)}">
        <ul class="footer-links">
          <li><a href="${escapeHtml(productionPath(inputs, `${locale}/`))}">${escapeHtml(ui.footer.home)}</a></li>
          <li><a href="${escapeHtml(productionPath(inputs, `${locale}/organizations/`))}">${escapeHtml(ui.footer.organizations)}</a></li>
          <li><a href="${escapeHtml(productionPath(inputs, `${locale}/privacy/`))}">${escapeHtml(ui.footer.privacy)}</a></li>
          <li>${contact}</li>
        </ul>
      </nav>
      <p>${escapeHtml(ui.footer.free_notice)}</p>
      <p class="copyright"${operatorLang}>${escapeHtml(ui.footer.copyright)}</p>
    </div>
  </footer>`;
}

function productionPageShell({
  inputs,
  navigation,
  ui,
  title,
  description,
  pagePath,
  alternatePath,
  mainContent
}) {
  const pageTitle = `${title}｜${navigation.site.site_name}`;
  const socialMetadata = productionSocialMetaTags(inputs, {
    title: pageTitle,
    description,
    pageUrl: absoluteSiteUrl(inputs.siteUrl, pagePath),
    siteName: navigation.site.site_name,
    imageAlt: ui.social.image_alt
  });
  return `<!doctype html>
<html lang="${navigation.locale}" data-text-size="standard">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="${SITE_GENERATOR_NAME}">
  <title>${escapeHtml(pageTitle)}</title>
${socialMetadata}
${siteIconLinks(inputs)}
  <link rel="stylesheet" href="${escapeHtml(productionPath(inputs, 'assets/styles.css'))}">
  <script src="${escapeHtml(productionPath(inputs, 'assets/font-size.js'))}" defer></script>
</head>
<body>
  <a class="skip-link" href="#main-content">${escapeHtml(ui.skip_link)}</a>${productionHeader(inputs, navigation, ui, alternatePath)}
  <div class="page">
    <main id="main-content">
${mainContent}${commonDetails(navigation.site, ui)}
    </main>
  </div>${productionFooter(inputs, navigation, ui)}
</body>
</html>
`;
}

function productionHomePage(inputs, navigation, ui) {
  const locale = navigation.locale;
  const sectionItems = navigation.sections
    .map(
      (section) => `        <li>
          <a class="section-link" href="${escapeHtml(productionPath(inputs, `${locale}/sections/${section.anchor_id}/`))}">
            <strong>${escapeHtml(section.title)}</strong>${section.short_description ? `\n            <span>${escapeHtml(section.short_description)}</span>` : ''}
          </a>
        </li>`
    )
    .join('\n');
  const content = `      <h1>${escapeHtml(ui.pages.home_heading)}</h1>
      <p>${escapeHtml(navigation.site.short_description)}</p>
      <p>${escapeHtml(navigation.site.purpose)}</p>
      <section aria-labelledby="sections-heading">
        <h2 id="sections-heading">${escapeHtml(ui.pages.sections_heading)}</h2>
        <p>${escapeHtml(ui.pages.sections_intro)}</p>
        <ul class="section-list">
${sectionItems}
        </ul>
      </section>
      <a class="primary-link" href="${escapeHtml(productionPath(inputs, `${locale}/organizations/`))}">${escapeHtml(ui.pages.organizations_link)}</a>`;
  return productionPageShell({
    inputs,
    navigation,
    ui,
    title: ui.pages.home_title,
    description: navigation.site.short_description,
    pagePath: `${locale}/`,
    alternatePath: productionPath(inputs, `${alternateLocale(locale)}/`),
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

function productionSectionPage(inputs, navigation, ui, section) {
  const locale = navigation.locale;
  const homePath = productionPath(inputs, `${locale}/`);
  const cards =
    section.cards.length > 0
      ? section.cards.map((card) => renderProductionCard(card, locale, ui)).join('\n')
      : `      <p class="note">${escapeHtml(ui.pages.empty_section)}</p>`;
  const content = `      <a class="back-link" href="${escapeHtml(homePath)}">${escapeHtml(ui.pages.section_back)}</a>
      <h1>${escapeHtml(section.title)}</h1>${section.short_description ? `\n      <p>${escapeHtml(section.short_description)}</p>` : ''}
      <p class="note">${escapeHtml(ui.pages.situation_notice)}</p>
${cards}
      <a class="back-link" href="${escapeHtml(homePath)}">${escapeHtml(ui.pages.section_back)}</a>`;
  return productionPageShell({
    inputs,
    navigation,
    ui,
    title: section.title,
    description: section.short_description,
    pagePath: `${locale}/sections/${section.anchor_id}/`,
    alternatePath: productionPath(
      inputs,
      `${alternateLocale(locale)}/sections/${section.anchor_id}/`
    ),
    mainContent: content
  });
}

function productionOrganizationsPage(inputs, navigation, ui) {
  const locale = navigation.locale;
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
  const content = `      <h1>${escapeHtml(ui.pages.organizations_title)}</h1>
      <p>${escapeHtml(ui.pages.organizations_intro)}</p>
      <p class="note">${escapeHtml(ui.pages.situation_notice)}</p>
${organizations}`;
  return productionPageShell({
    inputs,
    navigation,
    ui,
    title: ui.pages.organizations_title,
    description: ui.pages.organizations_intro,
    pagePath: `${locale}/organizations/`,
    alternatePath: productionPath(inputs, `${alternateLocale(locale)}/organizations/`),
    mainContent: content
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
${privacySection(privacy.revision_heading, privacy.revision_items)}`;
  return productionPageShell({
    inputs,
    navigation,
    ui,
    title: ui.pages.privacy_title,
    description: ui.social.privacy_description,
    pagePath: `${locale}/privacy/`,
    alternatePath: productionPath(inputs, `${alternateLocale(locale)}/privacy/`),
    mainContent: content
  });
}

function productionRootPage(inputs) {
  const japaneseUi = inputs.uiLocales.ja;
  const englishUi = inputs.uiLocales.en;
  const japaneseRoot = japaneseUi.root;
  const englishRoot = englishUi.root;
  const japaneseSiteName = inputs.navigations.ja.site.site_name;
  const englishSiteName = inputs.navigations.en.site.site_name;
  const pageTitle = `${japaneseRoot.title} / ${englishRoot.title}｜${japaneseSiteName}`;
  const socialMetadata = productionSocialMetaTags(inputs, {
    title: `${japaneseSiteName}｜${englishSiteName}`,
    description: `${japaneseRoot.description} / ${englishRoot.description}`,
    pageUrl: absoluteSiteUrl(inputs.siteUrl),
    siteName: `${japaneseSiteName}｜${englishSiteName}`,
    imageAlt: japaneseUi.social.image_alt
  });
  return `<!doctype html>
<html lang="ja" data-text-size="standard">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="generator" content="${SITE_GENERATOR_NAME}">
  <title>${escapeHtml(pageTitle)}</title>
${socialMetadata}
${siteIconLinks(inputs)}
  <link rel="stylesheet" href="${escapeHtml(productionPath(inputs, 'assets/styles.css'))}">
  <script src="${escapeHtml(productionPath(inputs, 'assets/font-size.js'))}" defer></script>
</head>
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
      <h1 class="root-language-heading">${escapeHtml(japaneseRoot.heading)}<br><span lang="en">${escapeHtml(englishRoot.heading)}</span></h1>
      <p class="root-description-ja">${escapeHtml(japaneseRoot.description)}</p>
      <p lang="en">${escapeHtml(englishRoot.description)}</p>
      <p class="note">${escapeHtml(japaneseRoot.unofficial)}</p>
      <p class="note" lang="en">${escapeHtml(englishRoot.unofficial)}</p>
      <ul class="section-list">
        <li><a class="section-link" href="${escapeHtml(productionPath(inputs, 'ja/'))}" hreflang="ja" lang="ja"><strong>${escapeHtml(japaneseRoot.language_link)}</strong></a></li>
        <li><a class="section-link" href="${escapeHtml(productionPath(inputs, 'en/'))}" hreflang="en" lang="en"><strong>${escapeHtml(englishRoot.language_link)}</strong></a></li>
      </ul>
    </main>
  </div>
  <footer class="site-footer">
    <div class="footer-inner">
      <nav aria-label="${escapeHtml(japaneseRoot.footer_navigation_label)}">
        <ul class="footer-links">
          <li><a href="${escapeHtml(productionPath(inputs, 'ja/privacy/'))}">${escapeHtml(japaneseUi.footer.privacy)}</a></li>
          <li>${footerContactAnchor(japaneseUi)}</li>
        </ul>
      </nav>
      <nav lang="en" aria-label="${escapeHtml(englishRoot.footer_navigation_label)}">
        <ul class="footer-links">
          <li><a href="${escapeHtml(productionPath(inputs, 'en/privacy/'))}">${escapeHtml(englishUi.footer.privacy)}</a></li>
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
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <meta name="generator" content="${SITE_GENERATOR_NAME}">
  <title>${escapeHtml(notFound.title)}｜${escapeHtml(siteName)}</title>
${siteIconLinks(inputs)}
  <link rel="stylesheet" href="${escapeHtml(productionPath(inputs, 'assets/styles.css'))}">
</head>
<body>
  <div class="page">
    <main id="main-content">
      <h1>${escapeHtml(notFound.heading)}</h1>
      <p>${escapeHtml(notFound.body_ja)}</p>
      <p lang="en">${escapeHtml(notFound.body_en)}</p>
      <ul>
        <li><a href="${escapeHtml(productionPath(inputs))}">${escapeHtml(notFound.root_link)}</a></li>
        <li><a href="${escapeHtml(productionPath(inputs, 'ja/'))}" hreflang="ja" lang="ja">${escapeHtml(notFound.japanese_link)}</a></li>
        <li><a href="${escapeHtml(productionPath(inputs, 'en/'))}" hreflang="en" lang="en">${escapeHtml(notFound.english_link)}</a></li>
      </ul>
    </main>
  </div>
</body>
</html>
`;
}

export function productionSitemapUrls(inputs) {
  const urls = [absoluteSiteUrl(inputs.siteUrl)];
  for (const locale of SITE_LOCALES) urls.push(absoluteSiteUrl(inputs.siteUrl, `${locale}/`));
  for (const locale of SITE_LOCALES) {
    for (const section of inputs.navigations[locale].sections) {
      urls.push(absoluteSiteUrl(inputs.siteUrl, `${locale}/sections/${section.anchor_id}/`));
    }
  }
  for (const locale of SITE_LOCALES)
    urls.push(absoluteSiteUrl(inputs.siteUrl, `${locale}/organizations/`));
  for (const locale of SITE_LOCALES)
    urls.push(absoluteSiteUrl(inputs.siteUrl, `${locale}/privacy/`));
  return urls;
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

function expectedProductionSiteArtifactPaths(navigations) {
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
    paths.add(`${locale}/organizations/index.html`);
    paths.add(`${locale}/privacy/index.html`);
    for (const section of navigations[locale].sections)
      paths.add(`${locale}/sections/${section.anchor_id}/index.html`);
  }
  return [...paths].sort();
}

function buildProductionSiteArtifacts(inputs) {
  const artifacts = new Map(Object.entries(inputs.assets));
  artifacts.set('index.html', productionRootPage(inputs));
  artifacts.set('404.html', productionNotFoundPage(inputs));
  artifacts.set('sitemap.xml', productionSitemap(inputs));
  for (const locale of SITE_LOCALES) {
    const navigation = inputs.navigations[locale];
    const ui = inputs.uiLocales[locale];
    artifacts.set(`${locale}/index.html`, productionHomePage(inputs, navigation, ui));
    artifacts.set(
      `${locale}/organizations/index.html`,
      productionOrganizationsPage(inputs, navigation, ui)
    );
    artifacts.set(`${locale}/privacy/index.html`, productionPrivacyPage(inputs, navigation, ui));
    for (const section of navigation.sections) {
      artifacts.set(
        `${locale}/sections/${section.anchor_id}/index.html`,
        productionSectionPage(inputs, navigation, ui, section)
      );
    }
  }
  return artifacts;
}

export function expectedSiteArtifactPaths(navigations, mode = 'preview') {
  return mode === 'production'
    ? expectedProductionSiteArtifactPaths(navigations)
    : expectedPreviewSiteArtifactPaths(navigations);
}

export function buildSiteArtifacts(inputs) {
  return inputs.mode === 'production'
    ? buildProductionSiteArtifacts(inputs)
    : buildPreviewSiteArtifacts(inputs);
}
