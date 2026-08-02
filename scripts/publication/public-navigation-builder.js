import { isStructurallyPublishableOfficialSource } from '../validation/official-source-semantic-validator.js';
import { createResult, sortResults } from '../validation/result.js';
import { PUBLIC_LOCALES } from './public-constants.js';

const LOCALE_ORDER = new Map(PUBLIC_LOCALES.map((locale, index) => [locale, index]));

export function isValidDateOnly(value) {
  const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isLinkActiveOn(link, asOf) {
  return (
    (!link.site_display_start_on || link.site_display_start_on <= asOf) &&
    (!link.site_display_end_on || asOf <= link.site_display_end_on)
  );
}

function indexById(items) {
  return new Map(items.map((item) => [item.id, item]));
}

function sortByDisplayOrder(items) {
  return [...items].sort(
    (left, right) => left.display_order - right.display_order || left.id.localeCompare(right.id)
  );
}

function sortLocales(locales) {
  return [...locales].sort(
    (left, right) =>
      (LOCALE_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (LOCALE_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER) || left.localeCompare(right)
  );
}

function addOptional(target, key, value) {
  if (typeof value === 'string' && value !== '') target[key] = value;
}

function publicationError(code, file, message, itemId, field) {
  return createResult({
    severity: 'error',
    code,
    file,
    message,
    ...(itemId ? { item_id: itemId } : {}),
    ...(field ? { field } : {}),
    suggested_action: '管理データの公開状態、locale、参照、表示期間を確認してください。'
  });
}

function regionIsPublishable(regionId, locale, indexes, visited = new Set()) {
  if (visited.has(regionId)) return false;
  const region = indexes.core.regions.get(regionId);
  const localized = indexes.locales[locale].regions.get(regionId);
  if (
    !region ||
    region.publication_status !== 'published' ||
    localized?.locale_status !== 'published'
  ) {
    return false;
  }
  if (!region.parent_region_id) return true;
  const nextVisited = new Set(visited);
  nextVisited.add(regionId);
  return regionIsPublishable(region.parent_region_id, locale, indexes, nextVisited);
}

function buildOrganization(core, localized) {
  const organization = {
    id: core.id,
    official_name: localized.official_name,
    name_kind: localized.name_kind
  };
  addOptional(organization, 'summary', localized.summary);
  return organization;
}

function buildDestination(source, localized, organization, locale) {
  const destination = {
    id: source.id,
    source_type: source.source_type,
    content_format: source.content_format,
    url: source.url,
    destination_locales: sortLocales(source.destination_locales)
  };
  addOptional(destination, 'platform', source.platform);
  addOptional(destination, 'account_id', source.account_id);
  destination.display_title = localized.display_title;
  destination.purpose = localized.purpose;
  addOptional(destination, 'public_note', localized.public_note);
  if (!source.destination_locales.includes(locale)) {
    addOptional(destination, 'destination_language_note', localized.destination_language_note);
  }
  destination.destination_checked_on = source.destination_checked_on;
  destination.official_information_checked_on = source.official_information_checked_on;
  destination.organization = organization;
  return destination;
}

function createIndexes(input) {
  return {
    core: Object.fromEntries(
      ['regions', 'organizations', 'sources', 'sections', 'cards', 'cardSourceLinks'].map(
        (unit) => [unit, indexById(input.core[unit])]
      )
    ),
    locales: Object.fromEntries(
      PUBLIC_LOCALES.map((locale) => [
        locale,
        Object.fromEntries(
          ['regions', 'organizations', 'sources', 'sections', 'cards', 'cardSourceLinks'].map(
            (unit) => [unit, indexById(input.locales[locale][unit])]
          )
        )
      ])
    )
  };
}

function buildLink(input, link, locale, indexes) {
  if (
    link.publication_status !== 'published' ||
    !link.display_locales.includes(locale) ||
    indexes.locales[locale].cardSourceLinks.get(link.id)?.locale_status !== 'published'
  ) {
    return undefined;
  }
  const source = indexes.core.sources.get(link.source_id);
  const sourceLocale = indexes.locales[locale].sources.get(link.source_id);
  const publisher = source
    ? indexes.core.organizations.get(source.publisher_organization_id)
    : undefined;
  const publisherLocale = publisher
    ? indexes.locales[locale].organizations.get(publisher.id)
    : undefined;
  if (
    !source ||
    !sourceLocale ||
    !publisher ||
    !publisherLocale ||
    sourceLocale.locale_status !== 'published' ||
    publisherLocale.locale_status !== 'published' ||
    !isStructurallyPublishableOfficialSource(input, {
      sourceId: source.id,
      displayLocales: [locale]
    })
  ) {
    return undefined;
  }
  const localized = indexes.locales[locale].cardSourceLinks.get(link.id);
  const output = {
    id: link.id,
    role: link.role,
    visibility_context: link.visibility_context,
    button_label: localized.button_label
  };
  addOptional(output, 'public_note', localized.public_note);
  output.destination = buildDestination(
    source,
    sourceLocale,
    buildOrganization(publisher, publisherLocale),
    locale
  );
  return output;
}

export function buildPublicNavigation(input, { locale, artifactType, asOf }) {
  const file = `<generated:${artifactType}:${locale}>`;
  const results = [];
  if (!PUBLIC_LOCALES.includes(locale) || !isValidDateOnly(asOf)) {
    results.push(
      publicationError(
        'PUB-E002',
        file,
        '対象言語または基準日を解決できません。',
        undefined,
        'locale'
      )
    );
    return { artifact: undefined, results };
  }
  const siteCore = input.site.core;
  const siteLocale = input.site.locales[locale];
  if (
    siteCore?.site_publication_status !== 'published' ||
    siteLocale?.locale_status !== 'published' ||
    !siteCore?.supported_locales?.includes(locale) ||
    !siteCore?.site_last_checked_on ||
    !siteCore?.contact_url
  ) {
    results.push(
      publicationError(
        'PUB-E001',
        file,
        `${locale}のsiteは公開可能な状態ではありません。`,
        siteCore?.site_id,
        'site_publication_status'
      )
    );
    return { artifact: undefined, results };
  }

  const indexes = createIndexes(input);
  const publicSections = sortByDisplayOrder(
    input.core.sections.filter(
      (section) =>
        section.publication_status === 'published' &&
        indexes.locales[locale].sections.get(section.id)?.locale_status === 'published'
    )
  );
  const sections = [];
  for (const section of publicSections) {
    const localizedSection = indexes.locales[locale].sections.get(section.id);
    const cards = [];
    const candidates = sortByDisplayOrder(
      input.core.cards.filter(
        (card) =>
          card.publication_status === 'published' &&
          card.section_id === section.id &&
          indexes.locales[locale].cards.get(card.id)?.locale_status === 'published'
      )
    );
    for (const card of candidates) {
      const invalidRegion = (card.region_ids ?? []).find(
        (regionId) => !regionIsPublishable(regionId, locale, indexes)
      );
      if (invalidRegion) {
        results.push(
          publicationError(
            'PUB-E002',
            file,
            `カードの公開可能な地域を解決できません: ${invalidRegion}`,
            card.id,
            'region_ids'
          )
        );
        continue;
      }
      const activeLinks = sortByDisplayOrder(
        input.core.cardSourceLinks.filter(
          (link) => link.card_id === card.id && isLinkActiveOn(link, asOf)
        )
      )
        .map((link) => ({ core: link, output: buildLink(input, link, locale, indexes) }))
        .filter(({ output }) => output);
      if (!activeLinks.some(({ core }) => core.role === 'primary')) {
        results.push(
          publicationError(
            'PUB-E003',
            file,
            '言語・表示期間の判定後に公開可能なprimary関連がありません。',
            card.id,
            'links'
          )
        );
        continue;
      }
      const localizedCard = indexes.locales[locale].cards.get(card.id);
      const outputCard = {
        id: card.id,
        title: localizedCard.title,
        summary: localizedCard.summary
      };
      addOptional(outputCard, 'region_label', localizedCard.region_label);
      addOptional(outputCard, 'emergency_note', localizedCard.emergency_note);
      addOptional(outputCard, 'details_label', localizedCard.details_label);
      outputCard.links = activeLinks.map(({ output }) => output);
      cards.push(outputCard);
    }
    const outputSection = {
      id: section.id,
      anchor_id: section.anchor_id,
      title: localizedSection.title
    };
    addOptional(outputSection, 'short_description', localizedSection.short_description);
    outputSection.cards = cards;
    sections.push(outputSection);
  }

  if (results.length > 0) return { artifact: undefined, results: sortResults(results) };
  return {
    artifact: {
      schema_version: '1.0.0',
      artifact_type: artifactType,
      locale,
      generated_for_date: asOf,
      site: {
        site_id: siteCore.site_id,
        default_locale: siteCore.default_locale,
        supported_locales: sortLocales(siteCore.supported_locales),
        site_name: siteLocale.site_name,
        subtitle: siteLocale.subtitle,
        short_description: siteLocale.short_description,
        purpose: siteLocale.purpose,
        free_use_notice: siteLocale.free_use_notice,
        external_site_notice: siteLocale.external_site_notice,
        disclaimer_summary: siteLocale.disclaimer_summary,
        contact_url: siteCore.contact_url
      },
      sections
    },
    results: []
  };
}

export function serializePublicArtifact(artifact) {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}
