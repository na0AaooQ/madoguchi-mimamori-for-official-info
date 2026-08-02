# データSchema実装

## 目的

本番用`data/`と`schemas/`の配置、正式なitem Schemaの実装範囲、意味検証との責務分担を記録します。工程3-2Aと工程3-2Bでは、実在情報を登録せず、地域から公式性確認根拠、分野、案内カード、カード関連までの最小縦切りを検証可能にします。画面と公開成果物はこの工程に含めません。

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

これらは空配列も受け入れます。本番用架空データの件数は配置・統合テストで別に保証します。

対象外の11 Schemaは引き続き`items.maxItems: 0`を持ちます。

- core: `disasters`、`events`、`disaster-source-links`、`event-source-links`、`check-history`、`update-history`
- locale: `disasters`、`events`、`disaster-source-links`、`event-source-links`、`update-history`

## 架空データ

core・日本語・英語の`regions`、`organizations`、`sources`、`evidence`、`sections`、`cards`、`card-source-links`の21ファイルに、5分野、架空の国と都道府県、架空団体、`example.invalid`配下の架空案内先、架空の公式性確認根拠、架空カード1件、架空のカード関連1件を登録しています。全coreレコードとlocaleレコードは`draft`です。

実在する団体、自治体、URL、災害、電話番号、個人情報は登録していません。検証とテストは`example.invalid`へ接続しません。

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

## 未実装範囲

災害・出来事・関連・履歴の正式Schemaと意味検証、URL正規化後の重複、確認期限の検証は後続工程で実装します。現在日時による表示期間判定、公開対象抽出、公開成果物生成、内部項目の生成物再検証、画面も未実装です。主案内先の最大件数、文字数制限、アイコン、色、レイアウトは固定していません。

## 関連文書

- [データモデル](DATA_MODEL.md)
- [データフィールド定義](DATA_FIELDS.md)
- [データ検証・公開生成方針](DATA_VALIDATION_AND_PUBLICATION.md)
- [工程3-2Aの最小縦切りを架空データで実装する決定](decisions/0020-implement-official-source-minimum-slice-with-fictional-data.md)
- [工程3-2Bの案内カード最小縦切りを実装する決定](decisions/0021-implement-navigation-card-minimum-slice-with-fictional-data.md)
