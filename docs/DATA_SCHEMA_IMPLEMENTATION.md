# データSchema実装

## BL-009工程AのSchema・公開契約

core `regions`へprefecture専用の`region_slug`と`display_order`、locale `regions`へ`navigation_label`を追加しました。publishedカードの`region_ids`必須、slug形式・一意性、prefectureのlocale整合、地域階層はJSON Schemaと意味検証を分担します。管理Schemaは`additionalProperties: false`を維持し、`scope_description`は追加しません。

公開成果物は、全国トップ用`contracts/public/national-navigation.schema.json`と地域用`contracts/public/regional-navigation.schema.json`へ分離します。全国成果物は公開地域の`region_id`・`region_slug`・`navigation_label`・任意の`scope_note`・生成`path`だけを持つ薄いインデックスで、カード、分野、団体、案内先、公開状態、根拠、内部情報を持ちません。地域成果物は`region_id`・`region_slug`・`region_name`・任意の`scope_note`・`path`と、既存契約を保った公開section/card/link/destinationを持ちます。

Schema検証後に意味検証、publication builder、公開成果物検証、site builder、HTML・URL・内部リンク・sitemap・hreflang検証を行います。previewとproductionは同じモデル・抽出・契約を利用できる構造とし、工程Aではproductionの正式URL切替を実行しません。

## 目的

本番用`data/`と`schemas/`の配置、正式なitem Schema、意味検証、公開成果物Schemaの責務分担を記録します。工程3-2Aと工程3-2Bで始めた管理データ縦切りを維持し、現在は第一版の実在管理データから日英`navigation.json`とproduction画面を検証・生成します。架空previewは本番用`data/`と分離します。

## 配置件数

- 本番用データ: 40ファイル（core 14、日本語13、英語13）
- Schema: 27ファイル（core 14、locale 13）
- 単一オブジェクトのsiteデータ: 3ファイル
- 工程3-2A・3-2Bでデータを登録した配列データ: 21ファイル
- `items: []`を維持する配列データ: 16ファイル

配列ファイルは`schema_version`、`data_updated_on`、`items`を持ちます。`site.json`は`items`を持たない単一オブジェクトです。

## 正式なitem Schema

工程3-2Aと工程3-2Bで正式化した14 Schemaは次のとおりです。

- `schemas/core/regions.schema.json`
- `schemas/core/organizations.schema.json`
- `schemas/core/sources.schema.json`
- `schemas/core/evidence.schema.json`
- `schemas/locales/regions.schema.json`
- `schemas/locales/organizations.schema.json`
- `schemas/locales/sources.schema.json`
- `schemas/locales/evidence.schema.json`
- `schemas/core/sections.schema.json`
- `schemas/core/cards.schema.json`
- `schemas/core/card-source-links.schema.json`
- `schemas/locales/sections.schema.json`
- `schemas/locales/cards.schema.json`
- `schemas/locales/card-source-links.schema.json`

これらは空配列も受け入れます。本番用実在管理データと架空preview fixtureの件数・公開条件は、配置・意味検証・統合テストで別に保証します。

対象外の11 Schemaは引き続き`items.maxItems: 0`を持ちます。

## 公開成果物Schema

`contracts/public/navigation.schema.json`は、管理用27 Schemaとは分離したDraft 2020-12の公開契約です。日本語・英語で同じSchemaを使い、全階層の想定外項目、ID、日付、URL、enum、SNS条件、日本語だけの案内先に対する英語注意文、cardのprimaryを検証します。`SCHEMA_LAYOUT`へ追加せず、管理用Schema件数27は変更しません。

`tests/fixtures/public-generation/preview/input.json`は既存管理Schemaの封筒構造を保ち、工程3-2A・3-2Bの意味検証も再利用します。生成側で管理契約を別実装せず、正規化後の共通内部形式だけを本番用`data/`と共有します。

- core: `disasters`、`events`、`disaster-source-links`、`event-source-links`、`check-history`、`update-history`
- locale: `disasters`、`events`、`disaster-source-links`、`event-source-links`、`update-history`

## 本番用管理データと架空preview

core・日本語・英語の`regions`、`organizations`、`sources`、`evidence`、`sections`、`cards`、`card-source-links`の21ファイルには、実在管理データを登録しています。現在は地域3件、団体5件、案内先24件、確認根拠40件、5分野、案内カード8件、カード案内先関連24件です。5分野とその対象データをすべてpublishedとしています。

架空previewは`tests/fixtures/`配下へ分離し、予約ドメイン`example.invalid`と明確な架空名称だけを使用します。テストと検証は`example.invalid`や実在する公式サイトへ接続しません。

## 配置対応表

`scripts/validation/data-layout.js`は、データパス、Schemaパス、scope、管理単位、localeを一元管理し、次の3区分を公開します。

- `SITE_DATA_LAYOUT`: 3ファイル
- `IMPLEMENTED_ARRAY_DATA_LAYOUT`: 21ファイル
- `EMPTY_DATA_LAYOUT`: 16ファイル

`DATA_LAYOUT`は40件、`SCHEMA_LAYOUT`は27件を維持します。テストは重複、欠落、データとSchemaの対応不整合を検出します。

## Schemaと意味検証の責務

JSON Schema Draft 2020-12とAjv strictモードを使い、各Schemaは一意の`$id`、`schema_version: 1.0.0`、`additionalProperties: false`を持ちます。単一ファイル内の型、必須項目、列挙値、ID接頭辞、日付、HTTPS URL、空文字列、配列重複、公開時条件はSchemaが担当します。

工程3-2Bの6 Schemaは、`section-`・`card-`・`card-source-`のID接頭辞、アンカー形式、1以上の表示順、地域・表示言語配列の最小件数と重複禁止、`role`、`visibility_context`、表示期間の日付形式、終了日指定時の開始日必須、locale共通項目、公開localeの確認日、公開関連localeの`button_label`を検証します。ファイルの`items`自体は空配列も受け入れます。

`scripts/validation/official-source-semantic-validator.js`は、次のファイル間条件を担当します。

- 管理単位内のID重複と参照整合性
- 地域階層の自己参照・循環と団体階層の自己参照
- coreと日英localeの対応、日英改訂番号、団体公式名称のフォールバック
- 公開状態と参照先公開状態の整合
- 日本語のみの案内先に対する英語注意文
- 公開団体・公開案内先の有効な公式性確認根拠

`scripts/validation/navigation-card-semantic-validator.js`は、次のファイル間条件を担当します。

- `sections`、`cards`、`card-source-links`のID重複と参照整合性
- coreと日英localeの対応、日英改訂番号、公開状態
- アンカー、分野内・カード内の表示順の重複
- カードと案内先の関連組み合わせ、表示開始日と終了日の矛盾
- 公開カードに必要な、工程3-2Aの公開条件まで満たす`role: primary`の関連

意味検証は一部データがSchema違反していても例外終了せず、可能な問題を収集し、決定論的に並べます。Schemaや配置対応表の異常は`RUN-E`系としてデータErrorから分離します。

## 現在の未実装範囲

災害・出来事・関連・履歴のitem Schemaと意味検証、URL正規化後の重複、確認期限の検証は未実装です。該当する本番用管理データは空で、現在のproductionへ災害別・期間限定案内や確認・更新履歴を表示しません。

通常カードのnavigation、全団体・案内先一覧、日英の静的画面は実装済みです。主案内先の最大件数、文字数制限、アイコン、色、レイアウトの将来変更は固定せず、必要性を確認して個別に設計します。公開後の未実装項目は[公開後バックログ](POST_LAUNCH_BACKLOG.md)で管理します。

## 関連文書

- [データモデル](DATA_MODEL.md)
- [データフィールド定義](DATA_FIELDS.md)
- [データ検証・公開生成方針](DATA_VALIDATION_AND_PUBLICATION.md)
- [公開後バックログ](POST_LAUNCH_BACKLOG.md)
- [工程3-2Aの最小縦切りを架空データで実装する決定](decisions/0020-implement-official-source-minimum-slice-with-fictional-data.md)
- [工程3-2Bの案内カード最小縦切りを実装する決定](decisions/0021-implement-navigation-card-minimum-slice-with-fictional-data.md)
- [公開用navigation成果物を生成してGit管理する決定](decisions/0022-generate-and-track-public-navigation-artifacts.md)
