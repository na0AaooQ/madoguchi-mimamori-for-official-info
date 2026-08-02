import {
  createDraftOfficialSourceData,
  createPublishedOfficialSourceData
} from './official-source-data.js';

const TODAY = '2026-08-02';

const sections = [
  ['section-public-institutions-disaster', 'public-institutions-disaster', 1],
  ['section-life-safety-medical', 'life-safety-medical', 2],
  ['section-lifelines', 'lifelines', 3],
  ['section-roads-transportation', 'roads-transportation', 4],
  ['section-support-recovery', 'support-recovery', 5]
];

const japaneseSectionTitles = [
  ['公的機関・防災全般', '国・自治体の防災情報、避難、河川、行政対応や支援の公式案内を探します。'],
  ['命・安全・医療', '警察、消防・救急、医療機関や救急相談の公式案内を探します。'],
  ['ライフライン', '水道・下水道、電気、ガス、通信の公式案内を探します。'],
  ['道路・交通', '道路、高速道路、鉄道、市電、バス、空港・航空便の公式案内を探します。'],
  ['支援・復旧', 'り災証明、住まい、福祉、事業者支援、義援金などの公式案内を探します。']
];

const englishSectionTitles = [
  [
    'Public Institutions and General Disaster Information',
    'Find official guidance from governments and public bodies.'
  ],
  ['Life, Safety, and Medical Care', 'Find official guidance on safety and medical care.'],
  ['Lifelines', 'Find official guidance on lifelines.'],
  ['Roads and Transportation', 'Find official guidance on roads and transportation.'],
  ['Support and Recovery', 'Find official guidance on support and recovery.']
];

function localeRecord(id, fields, { english = false } = {}) {
  return {
    id,
    ...fields,
    locale_status: 'draft',
    content_revision: 1,
    ...(english ? { based_on_ja_revision: 1 } : {})
  };
}

function addNavigationData(input) {
  input.core.sections = sections.map(([id, anchorId, displayOrder]) => ({
    id,
    anchor_id: anchorId,
    display_order: displayOrder,
    publication_status: 'draft'
  }));
  input.core.cards = [
    {
      id: 'card-example-disaster-information',
      section_id: 'section-public-institutions-disaster',
      region_ids: ['region-example-prefecture'],
      display_order: 1,
      publication_status: 'draft'
    }
  ];
  input.core.cardSourceLinks = [
    {
      id: 'card-source-example-disaster-information-primary',
      card_id: 'card-example-disaster-information',
      source_id: 'src-example-prefecture-official-home',
      display_order: 1,
      display_locales: ['ja', 'en'],
      role: 'primary',
      visibility_context: 'always',
      publication_status: 'draft'
    }
  ];

  input.locales.ja.sections = sections.map(([id], index) =>
    localeRecord(id, {
      title: japaneseSectionTitles[index][0],
      short_description: japaneseSectionTitles[index][1]
    })
  );
  input.locales.en.sections = sections.map(([id], index) =>
    localeRecord(
      id,
      {
        title: englishSectionTitles[index][0],
        short_description: englishSectionTitles[index][1]
      },
      { english: true }
    )
  );
  input.locales.ja.cards = [
    localeRecord('card-example-disaster-information', {
      title: '防災情報を確認する（架空データ）',
      summary: '架空データ構造を確認するカードです。',
      region_label: '架空県',
      details_label: '案内先の詳細を見る'
    })
  ];
  input.locales.en.cards = [
    localeRecord(
      'card-example-disaster-information',
      {
        title: 'Check disaster information (fictional data)',
        summary: 'A fictional card used to verify the data structure.',
        region_label: 'Example Prefecture',
        details_label: 'View destination details'
      },
      { english: true }
    )
  ];
  input.locales.ja.cardSourceLinks = [
    localeRecord('card-source-example-disaster-information-primary', {
      button_label: '架空県の防災情報案内を確認する（架空リンク）'
    })
  ];
  input.locales.en.cardSourceLinks = [
    localeRecord(
      'card-source-example-disaster-information-primary',
      { button_label: 'View the fictional disaster information guide' },
      { english: true }
    )
  ];
  return input;
}

export function createDraftNavigationCardData() {
  return addNavigationData(createDraftOfficialSourceData());
}

export function createPublishedNavigationCardData() {
  const input = addNavigationData(createPublishedOfficialSourceData());
  for (const unit of ['sections', 'cards', 'cardSourceLinks']) {
    for (const record of input.core[unit]) record.publication_status = 'published';
    for (const locale of ['ja', 'en']) {
      for (const record of input.locales[locale][unit]) {
        record.locale_status = 'published';
        record.content_reviewed_on = TODAY;
      }
    }
  }
  return input;
}
