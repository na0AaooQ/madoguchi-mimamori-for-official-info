# データフィールド定義

## 文書の位置付け

この文書は、第一版の管理用JSONについて、項目名、型、必須条件、許可値、意味、主な整合性ルールを定めます。[データモデル](DATA_MODEL.md)が管理単位・責務・参照関係を定め、この文書が各ファイルのフィールド仕様を定めます。

工程3-2Aでは、`site.json`に加え、`regions.json`、`organizations.json`、`sources.json`、`evidence.json`のcore・localeに対応する8 Schemaの正式なitem定義を実装済みです。その他の管理単位の正式なitem Schemaは後続工程で実装します。JSON Schemaは、この文書で確定したフィールド名、型、必須条件、列挙値を表現します。変更が必要になった場合は、実装上の都合だけで変更せず、設計文書と必要なADRを先に更新します。

## 型の表記

| 表記       | 意味               |
| ---------- | ------------------ |
| `string`   | 文字列             |
| `integer`  | 整数               |
| `boolean`  | 真偽値             |
| `array`    | 配列               |
| `object[]` | オブジェクトの配列 |
| `string[]` | 文字列の配列       |

日付を表す`string`は`YYYY-MM-DD`形式、URLを表す`string`は原則HTTPSとします。

## ファイル共通構造

### 配列ファイルの外枠

`site.json`以外のcore・localeファイルは、次の外枠を持つ配列ファイルとします。

| 項目              | 型     | 必須 | 意味                               |
| ----------------- | ------ | ---- | ---------------------------------- |
| `schema_version`  | string | 必須 | データスキーマの版                 |
| `data_updated_on` | string | 必須 | `YYYY-MM-DD`形式の管理データ更新日 |
| `items`           | array  | 必須 | 対象レコード                       |

coreとlocaleの`site.json`は`items`を持たない単一オブジェクトとします。

### 共通ルール

- 日付は`YYYY-MM-DD`形式とする
- IDは小文字英数字とハイフンだけで構成する
- IDは作成後に変更せず、廃止後も別の対象へ再利用しない
- 空文字列を禁止する
- 不要な任意項目は`null`ではなく省略する
- 配列内で同じ値を重複させない
- 表示順は配列順ではなく`display_order`で管理する
- URLは原則HTTPSとする
- 追跡用クエリーパラメータを保存しない
- 各スキーマは`additionalProperties: false`を基本とする
- `internal_note`などの内部項目を公開成果物へ含めない

## 共通の状態値

### `publication_status`

- `draft`
- `under-review`
- `published`
- `hidden`
- `archived`

### `destination_status`

- `confirmed`
- `needs-review`
- `unavailable`
- `retired`

### `official_information_status`

- `confirmed`
- `needs-review`
- `unconfirmed`
- `invalid`

### `locale_status`

- `draft`
- `under-review`
- `published`
- `needs-update`
- `archived`

### `site_guidance_status`

- `active`
- `ending-review`
- `archived`

`site_guidance_status`は`disasters.json`と`events.json`のレコードだけが持ちます。個々の案内先や関連データの公開状態には使用しません。

## coreフィールド

### `data/core/site.json`

単一オブジェクトです。

| 項目                        | 型       | 必須条件           | 意味・許可値                         |
| --------------------------- | -------- | ------------------ | ------------------------------------ |
| `schema_version`            | string   | 必須               | データスキーマの版                   |
| `site_id`                   | string   | 必須               | `madoguchi-mimamori`                 |
| `default_locale`            | string   | 必須               | `ja`                                 |
| `supported_locales`         | string[] | 必須               | `ja`、`en`の2件                      |
| `site_publication_status`   | string   | 必須               | `publication_status`と同じ許可値     |
| `site_last_checked_on`      | string   | サイト公開時に必須 | サイト全体の最終点検日               |
| `contact_url`               | string   | サイト公開時に必須 | HTTPSの問い合わせ案内先              |
| `disaster_guidance_enabled` | boolean  | 必須               | 災害別案内機能を公開成果物へ含めるか |
| `data_updated_on`           | string   | 必須               | 管理データ更新日                     |

整合性ルール：

- `site_id`は`madoguchi-mimamori`から変更しない
- 第一版の`default_locale`は`ja`、`supported_locales`は`ja`と`en`に固定する
- `contact_url`が存在する場合は、公開状態にかかわらずHTTPS URLだけを許可する
- `site_publication_status: published`では`site_last_checked_on`と`contact_url`を必須とする
- `draft`、`under-review`、`hidden`、`archived`では、未確定の`contact_url`を省略できる
- `operator_name`の具体値は未確定であるため、第一版の必須項目にしない

### `data/core/regions.json`

| 項目                 | 型     | 必須条件             | 意味                    |
| -------------------- | ------ | -------------------- | ----------------------- |
| `id`                 | string | 必須                 | `region-`で始まる不変ID |
| `region_type`        | string | 必須                 | 地域区分                |
| `parent_region_id`   | string | 地域階層上必要な場合 | 親地域ID                |
| `official_code`      | string | 任意                 | 公的な地域コード        |
| `publication_status` | string | 必須                 | 公開状態                |
| `internal_note`      | string | 任意・内部専用       | 運用メモ                |

`region_type`：

- `country`
- `nationwide`
- `prefecture`
- `municipality`
- `service-area`

整合性ルール：

- 自己参照と親子関係の循環を禁止する
- `municipality`は原則として`prefecture`を親に持つ
- `prefecture`は原則として`country`を親に持つ
- `service-area`を行政区域として表示しない

### `data/core/organizations.json`

| 項目                     | 型       | 必須条件       | 意味                 |
| ------------------------ | -------- | -------------- | -------------------- |
| `id`                     | string   | 必須           | `org-`で始まる不変ID |
| `organization_type`      | string   | 必須           | 団体区分             |
| `region_ids`             | string[] | 必須           | 対象地域ID           |
| `parent_organization_id` | string   | 任意           | 親組織ID             |
| `publication_status`     | string   | 必須           | 公開状態             |
| `internal_note`          | string   | 任意・内部専用 | 運用メモ             |

`organization_type`：

- `national-government`
- `local-government`
- `police`
- `fire-service`
- `public-medical-service`
- `utility-operator`
- `telecommunications-operator`
- `transport-operator`
- `related-public-organization`
- `other-public-service-operator`

整合性ルール：

- 親組織の自己参照と循環を禁止する
- `parent_organization_id`は、公式な組織関係を確認できる場合だけ使用する
- 団体側に`official_home_source_id`を持たせない

### `data/core/sources.json`

| 項目                                | 型       | 必須条件                                 | 意味                               |
| ----------------------------------- | -------- | ---------------------------------------- | ---------------------------------- |
| `id`                                | string   | 必須                                     | `src-`で始まる不変ID               |
| `publisher_organization_id`         | string   | 必須                                     | 発信団体ID                         |
| `related_organization_ids`          | string[] | 任意                                     | 関係団体ID                         |
| `source_type`                       | string   | 必須                                     | 案内先種別                         |
| `content_format`                    | string   | 必須                                     | コンテンツ形式                     |
| `url`                               | string   | 必須                                     | 公式案内先URL                      |
| `destination_locales`               | string[] | 必須                                     | リンク先で利用可能な言語           |
| `equivalent_source_group_id`        | string   | 任意                                     | 言語違いなど同等案内先のグループID |
| `platform`                          | string   | SNS・メッセージサービス等で条件付き必須  | プラットフォーム                   |
| `account_id`                        | string   | アカウント識別子がある場合に条件付き必須 | アカウントID                       |
| `primary_official_home_for_locales` | string[] | 公式ホームページの場合に条件付き         | 主公式ホームとして扱う言語         |
| `lifecycle_type`                    | string   | 必須                                     | 常設・期間限定の区分               |
| `destination_status`                | string   | 必須                                     | 案内先確認状態                     |
| `destination_checked_on`            | string   | 公開時必須                               | 案内先確認日                       |
| `official_information_status`       | string   | 必須                                     | 公式情報確認状態                   |
| `official_information_checked_on`   | string   | 公開時必須                               | 公式情報確認日                     |
| `show_in_official_source_list`      | boolean  | 必須                                     | 公式情報源一覧へ表示するか         |
| `publication_status`                | string   | 必須                                     | 公開状態                           |
| `internal_note`                     | string   | 任意・内部専用                           | 運用メモ                           |

`source_type`：

- `official-homepage`
- `information-page`
- `disaster-page`
- `service-page`
- `social-account`
- `messaging-service`
- `email-service`
- `search-service`
- `consultation-guide`

`content_format`：

- `html`
- `pdf`
- `social-profile`
- `external-service`
- `other`

`platform`：

- `x`
- `line`
- `facebook`
- `youtube`
- `other`

`lifecycle_type`：

- `permanent`
- `temporary`

整合性ルール：

- 正規化後のURL重複を禁止する
- `destination_locales`は`ja`と`en`だけを許可し、1件以上とする
- `source_type: social-account`または`source_type: messaging-service`では`platform`を必須とする
- `source_type: social-account`では`account_id`を必須とする
- `source_type: social-account`の`content_format`は`social-profile`とする
- `primary_official_home_for_locales`は`source_type: official-homepage`だけが持てる
- 公開中の案内先は、確認日、確認済み状態、有効な公式情報の確認根拠を必要とする
- 団体の公式ホームページは、案内先側の`source_type`と`primary_official_home_for_locales`で表現する

### `data/core/evidence.json`

| 項目                 | 型     | 必須条件                   | 意味                      |
| -------------------- | ------ | -------------------------- | ------------------------- |
| `id`                 | string | 必須                       | `evidence-`で始まる不変ID |
| `target_type`        | string | 必須                       | 確認対象種別              |
| `target_id`          | string | 必須                       | 確認対象ID                |
| `target_aspect`      | string | 必須                       | 確認する側面              |
| `target_locale`      | string | 言語固有名称の確認時に必須 | `ja`または`en`            |
| `evidence_type`      | string | 必須                       | 根拠種別                  |
| `evidence_source_id` | string | 条件付き                   | 根拠となる案内先ID        |
| `evidence_url`       | string | 条件付き                   | 根拠URL                   |
| `checked_on`         | string | 必須                       | 根拠確認日                |
| `status`             | string | 必須                       | 根拠の確認状態            |
| `publication_status` | string | 必須                       | 公開状態                  |
| `internal_note`      | string | 任意・内部専用             | 運用メモ                  |

`target_type`：

- `organization`
- `source`
- `disaster`

`target_aspect`：

- `official-organization`
- `official-page`
- `official-account`
- `official-name`
- `organizational-relationship`

`evidence_type`：

- `official-site-link`
- `official-site-list`
- `official-announcement`
- `government-directory`
- `official-organization-page`
- `other-public-official-record`

`status`：

- `confirmed`
- `needs-review`
- `invalid`

整合性ルール：

- `evidence_source_id`または`evidence_url`の一方以上を必須とする
- `target_aspect: official-name`では`target_locale`を必須とする
- `target_locale`は第一版では`ja`または`en`だけを許可する
- `target_type`に応じて、`target_id`が既存の団体ID、案内先ID、災害IDを参照することを必須とする
- `target_type: disaster`では、`target_id`を既存の`disaster-`始まりの災害IDとし、`target_aspect: official-name`だけを使用する
- 第一版で`target_type: disaster`を使用する目的は、災害の公式名称の確認根拠に限定する
- 災害名称の根拠は、対象名称を実際に使用している公的機関・関係団体自身の公式ページなどで確認する
- 検索結果、SNS上の第三者投稿、報道記事だけを災害の公式名称の根拠にしない
- `evidence_url`は原則HTTPSとする
- 認証表示、フォロワー数、表示名だけを根拠にしない
- 災害の現在状況、安全性、被害規模を根拠データへ保存しない
- `occurred_on`の根拠を表す新しい`target_aspect`は第一版のこの設計へ追加せず、必要性が判明した場合は後続工程で検討する

#### 災害名称の確認根拠

災害の公式名称を確認する`evidence.json`レコードでは、既存フィールドを次のように使用します。

| 項目                 | 値・意味                               |
| -------------------- | -------------------------------------- |
| `target_type`        | `disaster`                             |
| `target_id`          | 対象となる`disaster-`始まりの災害ID    |
| `target_aspect`      | `official-name`                        |
| `target_locale`      | `ja`または`en`                         |
| `evidence_type`      | 既存の許可値から選択                   |
| `evidence_source_id` | 根拠となる公式案内先ID                 |
| `evidence_url`       | 必要に応じて根拠となる公式URL          |
| `checked_on`         | 根拠を確認した日                       |
| `status`             | `confirmed`、`needs-review`、`invalid` |
| `publication_status` | 根拠レコードの公開状態                 |

公開する災害名称の根拠条件は次のとおりです。

ここで「公開時点に有効な根拠」とは、少なくとも`status: confirmed`、`publication_status: published`、必要な`checked_on`を持ち、根拠となる公式案内先または公式URLを確認できるレコードを指します。

- 日本語localeの`name_kind: official-ja`には、同じ災害IDを`target_id`とし、`target_type: disaster`、`target_aspect: official-name`、`target_locale: ja`、`status: confirmed`で、公開時点に有効な根拠を必須とする
- 英語localeの`name_kind: official-en`には、同じ災害IDを`target_id`とし、`target_type: disaster`、`target_aspect: official-name`、`target_locale: en`、`status: confirmed`で、公開時点に有効な根拠を必須とする
- 英語localeの`name_kind: official-ja-fallback`では、対応する日本語localeを`name_kind: official-ja`とし、英語版の名称文字列を日本語公式名称と一致させ、同じ災害IDを対象とする`target_type: disaster`、`target_aspect: official-name`、`target_locale: ja`、`status: confirmed`の公開時点に有効な根拠を必須とする
- `name_kind: descriptive`には`official-name`の確認根拠を必須としない。公式名称であるかのように表示せず、本サイトによる公式認定を意味しない
- `descriptive`名称に現在の被害、安全性、規模、復旧状態を含めず、団体名称には使用しない

### `data/core/sections.json`

| 項目                 | 型      | 必須条件       | 意味                     |
| -------------------- | ------- | -------------- | ------------------------ |
| `id`                 | string  | 必須           | `section-`で始まる不変ID |
| `anchor_id`          | string  | 必須           | ページ内アンカーID       |
| `display_order`      | integer | 必須・1以上    | 表示順                   |
| `publication_status` | string  | 必須           | 公開状態                 |
| `internal_note`      | string  | 任意・内部専用 | 運用メモ                 |

整合性ルール：

- `anchor_id`を一意にする
- 第一版の基本分野は5件とする
- 表示順は日英共通とする
- 表示順を評価・信頼度・推奨順位として扱わない

### `data/core/cards.json`

| 項目                 | 型       | 必須条件       | 意味                  |
| -------------------- | -------- | -------------- | --------------------- |
| `id`                 | string   | 必須           | `card-`で始まる不変ID |
| `section_id`         | string   | 必須           | 所属分野ID            |
| `region_ids`         | string[] | 任意           | 対象地域ID            |
| `display_order`      | integer  | 必須・1以上    | 分野内の表示順        |
| `publication_status` | string   | 必須           | 公開状態              |
| `internal_note`      | string   | 任意・内部専用 | 運用メモ              |

カードには、URL、団体名、案内先確認日、ボタン文言を直接持たせません。

### `data/core/disasters.json`

| 項目                   | 型       | 必須条件                           | 意味                      |
| ---------------------- | -------- | ---------------------------------- | ------------------------- |
| `id`                   | string   | 必須                               | `disaster-`で始まる不変ID |
| `disaster_type`        | string   | 必須                               | 災害種別                  |
| `occurred_on`          | string   | 公式情報から確認できる場合のみ任意 | 発生日                    |
| `target_region_ids`    | string[] | 必須                               | 対象地域ID                |
| `display_order`        | integer  | 必須・1以上                        | 災害案内の表示順          |
| `site_guidance_status` | string   | 必須                               | 本サイト上の災害案内状態  |
| `publication_status`   | string   | 必須                               | 公開状態                  |
| `internal_note`        | string   | 任意・内部専用                     | 運用メモ                  |

`disaster_type`：

- `earthquake`
- `tsunami`
- `heavy-rain`
- `typhoon`
- `flood`
- `landslide`
- `volcanic`
- `storm-surge`
- `heavy-snow`
- `wildfire`
- `other`

整合性ルール：

- `site_guidance_status`は災害そのものの終了、安全、復旧を表さない
- 現在の被害、断水、停電、運行、診療、復旧状況を保存しない
- 個々の案内先の公開状態と表示期間は関連データで管理する
- `publication_status: published`の災害は、公開可能な`disaster-source-links.json`を1件以上持ち、そのうち最低1件の`role`を`overview`または`government-response`とする

### `data/core/events.json`

| 項目                   | 型       | 必須条件       | 意味                       |
| ---------------------- | -------- | -------------- | -------------------------- |
| `id`                   | string   | 必須           | `event-`で始まる不変ID     |
| `disaster_id`          | string   | 必須           | 所属災害ID                 |
| `event_type`           | string   | 必須           | 案内目的種別               |
| `target_region_ids`    | string[] | 任意           | 対象地域ID                 |
| `display_order`        | integer  | 必須・1以上    | 災害内の表示順             |
| `site_guidance_status` | string   | 必須           | 本サイト上の出来事案内状態 |
| `publication_status`   | string   | 必須           | 公開状態                   |
| `internal_note`        | string   | 任意・内部専用 | 運用メモ                   |

`event_type`：

- `government-response`
- `evacuation`
- `shelter`
- `water-supply`
- `sewerage`
- `electricity`
- `gas`
- `communications`
- `roads`
- `rail`
- `bus`
- `airport`
- `medical`
- `safety`
- `housing`
- `public-support`
- `business-support`
- `donation`
- `other`

整合性ルール：

- 出来事は必ず一つの災害へ属する
- `target_region_ids`を省略した場合は親災害の対象地域を引き継ぐ
- `site_guidance_status`は出来事そのものの終了、安全、復旧を表さない
- 現在状況、個別被害、ニュース記事を保存しない
- 個々の案内先の公開状態と表示期間は関連データで管理する
- `publication_status: published`の出来事は、公開可能な`event-source-links.json`を1件以上持つ
- 公開中の出来事が参照する親災害は存在し、`publication_status: published`でなければならない
- 親災害の`site_guidance_status: archived`に対して、子出来事を`site_guidance_status: active`として公開しない

### 3種類の関連データに共通する項目

対象：

- `data/core/card-source-links.json`
- `data/core/disaster-source-links.json`
- `data/core/event-source-links.json`

| 項目                    | 型       | 必須条件             | 意味                         |
| ----------------------- | -------- | -------------------- | ---------------------------- |
| `id`                    | string   | 必須                 | 関連レコードの不変ID         |
| `source_id`             | string   | 必須                 | 案内先ID                     |
| `display_order`         | integer  | 必須・1以上          | 参照元内の表示順             |
| `display_locales`       | string[] | 必須・1件以上        | 本サイトで表示する言語       |
| `site_display_start_on` | string   | 期間限定表示では必須 | 本サイトでの表示開始日       |
| `site_display_end_on`   | string   | 任意                 | 本サイトでの表示終了日       |
| `publication_status`    | string   | 必須                 | 個々の関連・リンクの公開状態 |
| `internal_note`         | string   | 任意・内部専用       | 運用メモ                     |

整合性ルール：

- `display_locales`は第一版では`ja`と`en`だけを許可する
- `site_display_end_on`を`site_display_start_on`より前にできない
- 同じ参照元と`source_id`の組み合わせを重複させない
- 表示期間は本サイト上の掲載期間であり、外部制度の受付期間ではない
- 表示期間外または`publication_status: published`以外の関連データを公開成果物へ含めない

#### 公開可能な関連データ

災害・出来事の最低件数へ数える「公開可能な関連データ」は、単に関連レコードが存在するだけではなく、次をすべて満たし、公開成果物へ実際に含められる関連レコードです。

- 関連レコードの`publication_status`が`published`である
- 参照元の災害または出来事が`publication_status: published`である
- 参照する案内先が`publication_status: published`であり、`hidden`または`archived`ではない
- 案内先の`destination_status`が`confirmed`である
- 案内先の`official_information_status`が`confirmed`である
- 案内先に`destination_checked_on`と`official_information_checked_on`がある
- 案内先に有効な公式情報の確認根拠がある
- `site_display_start_on`または`site_display_end_on`が設定されている場合、関連レコードがその表示期間内である
- `display_locales`で指定された言語について、参照元、案内先、関連データの必要なlocaleが`locale_status: published`である
- 対応する関連localeに必要な`button_label`がある
- 英語版から日本語のみの案内先へ進む場合、言語別`sources.json`に必要な`destination_language_note`がある

#### `card-source-links.json`の固有項目

| 項目                 | 型     | 必須条件 | 意味             |
| -------------------- | ------ | -------- | ---------------- |
| `card_id`            | string | 必須     | カードID         |
| `role`               | string | 必須     | カード内での役割 |
| `visibility_context` | string | 必須     | 表示場面         |

`role`：

- `primary`
- `secondary`
- `temporary-highlight`

`visibility_context`：

| 値         | 意味                               |
| ---------- | ---------------------------------- |
| `always`   | 通常時・災害対応時の両方で表示する |
| `normal`   | 通常時に表示する                   |
| `disaster` | 災害対応時に表示する               |

整合性ルール：

- `visibility_context`は表示場面を表し、信頼度や優先順位を表さない
- `visibility_context: disaster`でも特定の災害IDを直接参照しない
- 特定災害との関係は`disaster-source-links.json`で管理する

#### `disaster-source-links.json`の固有項目

| 項目                   | 型      | 必須条件                                        | 意味                   |
| ---------------------- | ------- | ----------------------------------------------- | ---------------------- |
| `disaster_id`          | string  | 必須                                            | 災害ID                 |
| `role`                 | string  | 必須                                            | 災害案内内での役割     |
| `show_in_top_guidance` | boolean | 必須                                            | トップ案内へ表示するか |
| `top_display_order`    | integer | `show_in_top_guidance: true`の場合に必須・1以上 | トップ案内の表示順     |

`role`：

- `overview`
- `government-response`
- `support`
- `supplementary`

整合性ルール：

- トップ案内は最大5件とし、運用上は3件程度を優先する
- `top-highlight`という`role`を作らない
- `show_in_top_guidance: true`では、親災害の`site_guidance_status`を`active`とする
- `publication_status: published`の災害は、公開可能な災害関連を1件以上持ち、そのうち最低1件を`role: overview`または`role: government-response`とする
- `support`または`supplementary`だけでは、公開中の災害に必要な総合的案内先を満たしたことにしない
- 非公開、表示期間外、確認不十分、根拠不足、または必要なlocale・`button_label`がない災害関連を最低件数へ含めない

#### `event-source-links.json`の固有項目

| 項目       | 型     | 必須条件 | 意味                 |
| ---------- | ------ | -------- | -------------------- |
| `event_id` | string | 必須     | 出来事ID             |
| `role`     | string | 必須     | 出来事案内内での役割 |

`role`：

- `primary`
- `supplementary`
- `support`
- `safety-guidance`

整合性ルール：

- `publication_status: published`の出来事は、公開可能な出来事関連を1件以上持つ
- 最低件数を満たす関連の`role`は`primary`、`supplementary`、`support`、`safety-guidance`のいずれでもよい
- 通常は`primary`を優先し、補助的な案内先だけで構成してよいかは人が確認する。`primary`を必須にするかは後続の実運用結果を踏まえて再検討できる
- 非公開、表示期間外、確認不十分、根拠不足、または必要なlocale・`button_label`がない出来事関連を最低件数へ含めない
- 出来事をトップ上部へ直接表示しない。トップへ掲載する案内先は、`disaster-source-links.json`にも明示的に登録する

### `data/core/check-history.json`

| 項目                  | 型       | 必須条件                               | 意味                   |
| --------------------- | -------- | -------------------------------------- | ---------------------- |
| `id`                  | string   | 必須                                   | `check-`で始まる不変ID |
| `target_type`         | string   | 必須                                   | 確認対象種別           |
| `target_id`           | string   | 必須                                   | 確認対象ID             |
| `target_locale`       | string   | 言語別文面の確認時に条件付き必須       | `ja`または`en`         |
| `check_type`          | string   | 必須                                   | 確認種別               |
| `checked_on`          | string   | 必須                                   | 確認日                 |
| `result`              | string   | 必須                                   | 確認結果               |
| `summary`             | string   | 必須・内部専用                         | 確認内容の要約         |
| `changed_fields`      | string[] | 任意                                   | 変更を確認した項目名   |
| `follow_up_required`  | boolean  | 必須                                   | 再確認が必要か         |
| `follow_up_due_on`    | string   | `follow_up_required: true`の場合に必須 | 再確認期限             |
| `checked_by`          | string   | 任意・内部専用                         | 確認者識別子           |
| `supersedes_check_id` | string   | 任意                                   | 訂正対象の確認履歴ID   |
| `internal_note`       | string   | 任意・内部専用                         | 運用メモ               |

`target_type`：

- `site`
- `region`
- `organization`
- `source`
- `evidence`
- `section`
- `card`
- `disaster`
- `event`
- `card-source-link`
- `disaster-source-link`
- `event-source-link`

`check_type`：

- `destination`
- `official-information`
- `official-name`
- `organizational-relationship`
- `content-purpose`
- `locale-content`
- `temporary-guidance`
- `publication-readiness`
- `full-site-review`
- `other`

`result`：

- `confirmed`
- `changed`
- `needs-review`
- `unavailable`
- `retired`
- `invalid`
- `ended`

整合性ルール：

- 履歴は原則追記型とする
- 訂正時は元記録を残し、必要に応じて`supersedes_check_id`で関連付ける
- 個人情報、認証情報、非公開連絡先、問い合わせメール本文を保存しない
- ファイル全体を公開成果物へ含めない

### `data/core/update-history.json`

| 項目                        | 型       | 必須条件       | 意味                    |
| --------------------------- | -------- | -------------- | ----------------------- |
| `id`                        | string   | 必須           | `update-`で始まる不変ID |
| `published_on`              | string   | 必須           | 利用者向け公開日        |
| `sequence`                  | integer  | 必須・1以上    | 同一日内などの表示順    |
| `update_type`               | string   | 必須           | 更新種別                |
| `related_targets`           | object[] | 任意           | 関連対象                |
| `related_check_history_ids` | string[] | 任意           | 対応する内部確認履歴ID  |
| `publication_status`        | string   | 必須           | 公開状態                |
| `internal_note`             | string   | 任意・内部専用 | 運用メモ                |

`update_type`：

- `initial-release`
- `routine-check`
- `source-added`
- `source-updated`
- `source-removed`
- `temporary-guidance-started`
- `temporary-guidance-ended`
- `policy-updated`
- `translation-updated`
- `accessibility-updated`
- `other`

`related_targets`の各要素：

| 項目          | 型     | 必須条件 | 意味                                            |
| ------------- | ------ | -------- | ----------------------------------------------- |
| `target_type` | string | 必須     | `check-history.json`の`target_type`と同じ許可値 |
| `target_id`   | string | 必須     | 対象ID                                          |

内部メモや調査途中の推測を、公開更新履歴の文面へ流用しません。

## localeフィールド

### localeレコードの共通項目

`site.json`以外の全localeレコードは、ファイル固有項目に加えて次を持ちます。

| 項目                   | 型      | 必須条件            | 意味                   |
| ---------------------- | ------- | ------------------- | ---------------------- |
| `id`                   | string  | 必須                | 対応するcoreと同じID   |
| `locale_status`        | string  | 必須                | 言語別文面状態         |
| `content_revision`     | integer | 必須・1以上         | 文面改訂番号           |
| `based_on_ja_revision` | integer | 英語では必須・1以上 | 基にした日本語改訂番号 |
| `content_reviewed_on`  | string  | 公開時必須          | 文面確認日             |

日本語レコードには`based_on_ja_revision`を持たせません。英語の`based_on_ja_revision`が対応する日本語の`content_revision`と一致しない場合は公開できません。

### 言語別`site.json`

日本語・英語それぞれの単一オブジェクトです。

| 項目                   | 型      | 必須条件            | 意味                               |
| ---------------------- | ------- | ------------------- | ---------------------------------- |
| `schema_version`       | string  | 必須                | データスキーマの版                 |
| `data_updated_on`      | string  | 必須                | 管理データ更新日                   |
| `locale`               | string  | 必須                | 対象ファイルに応じて`ja`または`en` |
| `site_id`              | string  | 必須                | `madoguchi-mimamori`               |
| `site_name`            | string  | 必須                | サイト名                           |
| `subtitle`             | string  | 必須                | 副題                               |
| `short_description`    | string  | 必須                | 短い説明                           |
| `purpose`              | string  | 必須                | サイトの目的                       |
| `free_use_notice`      | string  | 必須                | 無料・広告なし等の案内             |
| `external_site_notice` | string  | 必須                | 外部公式サイトへ移動する案内       |
| `disclaimer_summary`   | string  | 必須                | 役割と非保証事項の要約             |
| `locale_status`        | string  | 必須                | 言語別文面状態                     |
| `content_revision`     | integer | 必須・1以上         | 文面改訂番号                       |
| `based_on_ja_revision` | integer | 英語のみ必須・1以上 | 基にした日本語改訂番号             |
| `content_reviewed_on`  | string  | 公開時必須          | 文面確認日                         |

日本語の`site.json`に`based_on_ja_revision`を持たせません。

### 言語別`regions.json`

| 項目           | 型     | 必須条件                 | 意味                            |
| -------------- | ------ | ------------------------ | ------------------------------- |
| `id`           | string | 必須                     | 対応する地域ID                  |
| `name`         | string | 必須                     | 表示名称                        |
| `short_name`   | string | 任意                     | 短縮表示名                      |
| `scope_note`   | string | 任意                     | 範囲の公開用補足                |
| locale共通項目 | -      | 必須条件は共通定義に従う | `locale_status`、改訂・確認情報 |

### 言語別`organizations.json`

| 項目            | 型     | 必須条件                 | 意味                            |
| --------------- | ------ | ------------------------ | ------------------------------- |
| `id`            | string | 必須                     | 対応する団体ID                  |
| `official_name` | string | 必須                     | 表示する正式名称                |
| `display_name`  | string | 任意                     | 補助的な表示名                  |
| `name_kind`     | string | 必須                     | 団体名称種別                    |
| `summary`       | string | 任意                     | 団体の役割説明                  |
| locale共通項目  | -      | 必須条件は共通定義に従う | `locale_status`、改訂・確認情報 |

団体の`name_kind`：

| 値                     | 意味                                                             |
| ---------------------- | ---------------------------------------------------------------- |
| `official-ja`          | 日本語の公式名称                                                 |
| `official-en`          | 根拠を確認できた団体自身の公式英語名称                           |
| `official-ja-fallback` | 公式英語名称を確認できないため、英語版でも使用する日本語正式名称 |

団体名称に`descriptive`を使用してはいけません。

### 言語別`sources.json`

| 項目                        | 型     | 必須条件                                         | 意味                            |
| --------------------------- | ------ | ------------------------------------------------ | ------------------------------- |
| `id`                        | string | 必須                                             | 対応する案内先ID                |
| `display_title`             | string | 必須                                             | 案内先の表示名                  |
| `purpose`                   | string | 必須                                             | 案内目的                        |
| `target_audience_note`      | string | 任意                                             | 対象利用者の補足                |
| `destination_language_note` | string | 英語版から日本語のみのページへ案内する場合に必須 | リンク先言語の注意              |
| `public_note`               | string | 任意                                             | 公開用補足                      |
| locale共通項目              | -      | 必須条件は共通定義に従う                         | `locale_status`、改訂・確認情報 |

`destination_language_note`は言語別の関連データへ重複させず、言語別`sources.json`だけで管理します。

### 言語別`evidence.json`

| 項目           | 型     | 必須条件                 | 意味                            |
| -------------- | ------ | ------------------------ | ------------------------------- |
| `id`           | string | 必須                     | 対応する根拠ID                  |
| `description`  | string | 必須                     | 利用者向けの根拠説明            |
| locale共通項目 | -      | 必須条件は共通定義に従う | `locale_status`、改訂・確認情報 |

### 言語別`sections.json`

| 項目                | 型     | 必須条件                 | 意味                            |
| ------------------- | ------ | ------------------------ | ------------------------------- |
| `id`                | string | 必須                     | 対応する分野ID                  |
| `title`             | string | 必須                     | 分野名                          |
| `short_description` | string | 任意                     | 分野の短い説明                  |
| locale共通項目      | -      | 必須条件は共通定義に従う | `locale_status`、改訂・確認情報 |

### 言語別`cards.json`

| 項目             | 型     | 必須条件                 | 意味                            |
| ---------------- | ------ | ------------------------ | ------------------------------- |
| `id`             | string | 必須                     | 対応するカードID                |
| `title`          | string | 必須                     | カード名                        |
| `summary`        | string | 必須                     | 短い説明                        |
| `region_label`   | string | 任意                     | 対象地域表示                    |
| `emergency_note` | string | 任意                     | 緊急時の注意                    |
| `details_label`  | string | 任意                     | 詳細表示の文言                  |
| locale共通項目   | -      | 必須条件は共通定義に従う | `locale_status`、改訂・確認情報 |

### 言語別`disasters.json`

| 項目           | 型     | 必須条件                 | 意味                            |
| -------------- | ------ | ------------------------ | ------------------------------- |
| `id`           | string | 必須                     | 対応する災害ID                  |
| `display_name` | string | 必須                     | 災害の表示名称                  |
| `name_kind`    | string | 必須                     | 災害名称種別                    |
| `summary`      | string | 公開時必須               | 災害案内の説明                  |
| locale共通項目 | -      | 必須条件は共通定義に従う | `locale_status`、改訂・確認情報 |

災害の`name_kind`：

| 値                     | 意味                                                           |
| ---------------------- | -------------------------------------------------------------- |
| `official-ja`          | 日本語の公式災害名称                                           |
| `official-en`          | 公的機関が使用する公式英語名称                                 |
| `official-ja-fallback` | 公式英語名称を確認できないため英語版でも使用する日本語公式名称 |
| `descriptive`          | 公式名称が確認できない災害を識別するための説明的名称           |

整合性ルール：

- `official-ja`には、対象災害の`target_type: disaster`、`target_aspect: official-name`、`target_locale: ja`、`status: confirmed`の有効な根拠を必要とする
- `official-en`には、対象災害の`target_type: disaster`、`target_aspect: official-name`、`target_locale: en`、`status: confirmed`の有効な根拠を必要とする
- `official-ja-fallback`は、対応する日本語localeの`name_kind: official-ja`と、同じ災害IDを対象とする`target_type: disaster`、`target_aspect: official-name`、`target_locale: ja`、`status: confirmed`の有効な根拠を必要とし、名称文字列を日本語公式名称と一致させる
- `descriptive`は、公式名称が確認できない災害名称に限定し、`official-name`の根拠を必須としない
- `descriptive`を団体の独自英訳を許可する目的に使用せず、本サイトによる公式認定を意味しない
- 現在の被害状況、安全性、規模、復旧状態などを`descriptive`名称へ含めない

### 言語別`events.json`

| 項目           | 型     | 必須条件                 | 意味                            |
| -------------- | ------ | ------------------------ | ------------------------------- |
| `id`           | string | 必須                     | 対応する出来事ID                |
| `title`        | string | 必須                     | 案内目的の名称                  |
| `purpose`      | string | 公開時必須               | 案内目的                        |
| `public_note`  | string | 任意                     | 公開用補足                      |
| locale共通項目 | -      | 必須条件は共通定義に従う | `locale_status`、改訂・確認情報 |

### 言語別の3種類の関連データ

対象：

- `card-source-links.json`
- `disaster-source-links.json`
- `event-source-links.json`

| 項目           | 型     | 必須条件                 | 意味                            |
| -------------- | ------ | ------------------------ | ------------------------------- |
| `id`           | string | 必須                     | 対応する関連ID                  |
| `button_label` | string | 公開時必須               | ボタン文言                      |
| `public_note`  | string | 任意                     | 公開用補足                      |
| locale共通項目 | -      | 必須条件は共通定義に従う | `locale_status`、改訂・確認情報 |

`destination_language_note`は関連localeへ置かず、言語別`sources.json`へ置きます。

### 言語別`update-history.json`

| 項目           | 型       | 必須条件                 | 意味                            |
| -------------- | -------- | ------------------------ | ------------------------------- |
| `id`           | string   | 必須                     | 対応する公開更新履歴ID          |
| `title`        | string   | 必須                     | 更新見出し                      |
| `summary`      | string   | 必須                     | 更新内容の要約                  |
| `details`      | string[] | 任意                     | 更新内容の詳細                  |
| locale共通項目 | -        | 必須条件は共通定義に従う | `locale_status`、改訂・確認情報 |

`check-history.json`のlocaleファイルは作りません。

## 公開条件と意味検証

工程3-2Aで正式化した管理単位では、単一レコード内で確認できる型、列挙値、日付・HTTPS URL、配列重複、公開時必須項目、案内先種別ごとの条件、根拠対象の構造条件をJSON Schemaが担当します。ID重複、参照先の存在、階層循環、coreとlocaleの対応、公開状態の整合、公式名称フォールバック、有効な公式性確認根拠はファイル間の意味検証が担当します。

- 公開対象のcoreレコードは`publication_status: published`とする
- 対応localeは`locale_status: published`とする
- 英語の`based_on_ja_revision`を日本語の`content_revision`と一致させる
- 公開中の案内先は`destination_status: confirmed`とする
- 公開中の案内先は`official_information_status: confirmed`とする
- 公開中の案内先に必要な確認日を持たせる
- 公開中の案内先に有効な公式情報の確認根拠を関連付ける
- 団体の`official-en`に公式英語名称の根拠を関連付ける
- 団体の`official-ja-fallback`を対応する日本語正式名称と一致させる
- 災害の`official-ja`に対象災害と`target_locale: ja`を指定した確認済み根拠を関連付ける
- 災害の`official-en`に対象災害と`target_locale: en`を指定した確認済み根拠を関連付ける
- 災害の`official-ja-fallback`に対応する日本語公式名称の確認済み根拠を関連付け、名称を日本語公式名称と一致させる
- 災害の`descriptive`に公式名称の根拠を必須としない
- 日本語のみの案内先を英語版へ表示する場合は`destination_language_note`を必須とする
- 関連データの表示期間を矛盾させない
- 表示期間外または非公開状態の関連データを公開成果物から除外する
- 公開中の災害に、`overview`または`government-response`を含む公開可能な災害関連を1件以上持たせる
- 公開中の出来事に公開可能な出来事関連を1件以上持たせ、親災害も`publication_status: published`とする
- 親災害の`site_guidance_status: archived`に対して、子出来事を`active`として公開しない
- 非公開・アーカイブ済みの参照先を公開データから参照しない
- 内部専用項目を公開成果物へ含めない
- 現在状況、個人情報、センシティブ情報を保存しない

## 後続工程で決定する事項

- 工程3-2B以降の管理単位の正式なitem Schemaと意味検証
- CI/CD
- 公開成果物の具体的なディレクトリ
- URLパス
- 英語版を`/en/`へ配置するか
- ホスティング、WAF、ドメイン、SSL
- 実際に掲載する全団体・全URL
- `operator_name`の具体値

この文書で定めたフィールド名、型、必須条件、列挙値は、後続工程の未確定事項として扱いません。

## 関連文書

- [データモデル](DATA_MODEL.md)
- [日英対応方針](LOCALIZATION_POLICY.md)
- [データ検証・公開生成方針](DATA_VALIDATION_AND_PUBLICATION.md)
- [運用方針](OPERATIONS_POLICY.md)
