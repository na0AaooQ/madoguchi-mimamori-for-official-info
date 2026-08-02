# データモデル

## 文書の位置付け

この文書は、第一版の管理データの正本と、各ファイルの責務・参照関係を定めます。各ファイルの確定フィールド仕様は[データフィールド定義](DATA_FIELDS.md)に記録します。本番用の40データファイルと27 Schemaを配置済みで、工程3-2Aでは地域・団体・案内先・確認根拠の8 Schemaと12データファイルを正式化しています。

架空の国・都道府県、団体、日本語のみの案内先、公式性確認根拠と日英localeを、参照関係の検証用に`draft`で登録しています。実在する団体、URL、災害情報などは未登録です。工程3-2B、公開対象抽出、公開成果物生成、画面も未実装です。

管理データの正本にはJSONを使用し、言語に依存しない`core`と、表示文言を持つ日本語・英語の`locale`を分離します。管理用の正本データをそのままWeb公開せず、検証済みの公開対象だけから利用者向け成果物を生成します。

## 設計目的

- 団体、URL、表示文言、確認根拠を重複管理しない
- 日本語・英語の公開条件と改訂関係を明示する
- 公式情報への案内と、現在状況の転載を分離する
- 内部確認履歴と利用者向け更新履歴を分離する
- ファイルごとの責務と参照先を明確にする
- JSON Schema検証とファイル間の意味検証を可能にする
- 内部専用項目を公開成果物から確実に除外する

## 正本と公開成果物

`data/`には管理用の正本データを配置しています。`data/core/`をブラウザから直接参照できる場所へ配置したり、そのまま公開成果物へコピーしたりしてはいけません。

将来の公開生成処理は、正本を検証し、`published`かつ表示期間内のデータだけを抽出し、内部専用項目を除外して日本語版・英語版を生成します。詳細は[データ検証・公開生成方針](DATA_VALIDATION_AND_PUBLICATION.md)を参照してください。

## ファイル構成

配置済みの管理単位は、`core`が14ファイル、各`locale`が13ファイルです。

- `data/core/`
  - `site.json`
  - `regions.json`
  - `organizations.json`
  - `sources.json`
  - `evidence.json`
  - `sections.json`
  - `cards.json`
  - `disasters.json`
  - `events.json`
  - `card-source-links.json`
  - `disaster-source-links.json`
  - `event-source-links.json`
  - `check-history.json`
  - `update-history.json`
- `data/locales/ja/`
  - `site.json`
  - `regions.json`
  - `organizations.json`
  - `sources.json`
  - `evidence.json`
  - `sections.json`
  - `cards.json`
  - `disasters.json`
  - `events.json`
  - `card-source-links.json`
  - `disaster-source-links.json`
  - `event-source-links.json`
  - `update-history.json`
- `data/locales/en/`
  - 日本語と同じ13ファイル

`check-history.json`は内部確認履歴であり、言語別ファイルを作りません。

## coreとlocaleの分担

### core

`core`には、主として次を保持します。

- ID、URL、列挙状態
- 確認日、表示順、表示期間
- ファイル間の参照関係
- 対象地域、公開対象言語
- 内部メモ、確認根拠の構造情報
- 公開対象かどうかを判定する情報

### locale

`locale`には、主として次を保持します。

- 表示名称、説明、案内目的
- ボタン文言、公開用補足、注意文
- 公開更新履歴の文章
- 文面状態と翻訳改訂情報

`core`と`locale`は同じ`id`で結合します。公開中の`core`について、`display_locales`で指定した言語の公開可能な`locale`が不足する場合はErrorとし、公開しません。日本語文を英語版へ暗黙に流用しません。

## 各coreファイルの責務

| ファイル                     | 責務                                                                |
| ---------------------------- | ------------------------------------------------------------------- |
| `site.json`                  | サイト共通の構造設定、標準言語、対応言語、公開状態などを管理する    |
| `regions.json`               | 行政区域と事業者の提供範囲を含む地域参照データを管理する            |
| `organizations.json`         | 団体の識別、種別、対象地域などURLに依存しない情報を管理する         |
| `sources.json`               | 公式サイト、案内ページ、SNSなどの案内先と、その確認状態を管理する   |
| `evidence.json`              | 団体・ページ・SNS・公式英語名称・組織関係の公式性確認根拠を管理する |
| `sections.json`              | 第一版の5分野と表示順を管理する                                     |
| `cards.json`                 | 利用者が「何を確認したいか」から探す通常カードを管理する            |
| `disasters.json`             | 地震、豪雨、台風など、災害別公式案内をまとめる識別単位を管理する    |
| `events.json`                | 災害に属する水道、道路、住宅、医療、支援などの案内目的を管理する    |
| `card-source-links.json`     | 通常カードと案内先の関連を管理する                                  |
| `disaster-source-links.json` | 災害全体と総合案内、行政対応、支援案内などの関連を管理する          |
| `event-source-links.json`    | 出来事の案内目的と案内先の関連を管理する                            |
| `check-history.json`         | 運用者向けの追記型内部確認履歴を管理する                            |
| `update-history.json`        | 利用者へ公開する更新履歴の構造情報と内部確認履歴との関係を管理する  |

## 各localeファイルの責務

同名の`core`レコードに対応する日本語・英語の表示文言を管理します。関連データのlocaleにはボタン文言と公開用補足を置きます。`update-history.json`には利用者向けの更新見出し・本文を置きます。

`organizations.json`では名称と説明を分離し、公式名称の種別を明示します。`evidence.json`では、根拠の構造情報ではなく、公開してよい利用者向け説明だけを管理します。

## JSON共通ルール

- 日付は`YYYY-MM-DD`とする
- IDは小文字英数字とハイフンだけで構成し、作成後は変更しない
- 空文字列を登録しない
- 不要な任意項目は`null`ではなく省略する
- 配列内で同じ値を重複させない
- 表示順を配列順に依存させず、`display_order`で管理する
- URLは原則HTTPSとし、追跡用クエリーパラメータを保存しない
- 内部専用項目を公開用データへ含めない
- 配列ファイルは`schema_version`、`data_updated_on`、`items`を基本の外枠とする
- `site.json`は単一オブジェクトとする
- 各スキーマは`additionalProperties: false`を基本とする

## ID接頭辞

| 管理対象           | 接頭辞             |
| ------------------ | ------------------ |
| 団体               | `org-`             |
| 案内先             | `src-`             |
| 公式情報の確認根拠 | `evidence-`        |
| 地域               | `region-`          |
| 分野               | `section-`         |
| カード             | `card-`            |
| 災害               | `disaster-`        |
| 出来事             | `event-`           |
| カード関連         | `card-source-`     |
| 災害関連           | `disaster-source-` |
| 出来事関連         | `event-source-`    |
| 内部確認履歴       | `check-`           |
| 公開更新履歴       | `update-`          |

IDは表示名称やURLの変更に合わせて変更しません。廃止後も別の対象へ再利用しません。

## 共通状態値

### 公開状態

`publication_status`は次の値を使用します。

- `draft`
- `under-review`
- `published`
- `hidden`
- `archived`

### 案内先確認状態

`destination_status`は次の値を使用します。

- `confirmed`
- `needs-review`
- `unavailable`
- `retired`

### 公式情報確認状態

`official_information_status`は次の値を使用します。

- `confirmed`
- `needs-review`
- `unconfirmed`
- `invalid`

### 言語別文面状態

項目名は`locale_status`とし、`translation_status`は使用しません。

- `draft`
- `under-review`
- `published`
- `needs-update`
- `archived`

## 翻訳・改訂管理

localeレコードは、少なくとも次を持ちます。

- `id`
- `locale_status`
- `content_revision`
- `content_reviewed_on`
- 英語では`based_on_ja_revision`

日本語の意味を変更した場合は`content_revision`を増やします。英語の`based_on_ja_revision`が対応する日本語の`content_revision`と一致しない場合、英語レコードを公開できません。誤字修正などで改訂番号を増やす詳細運用は後続工程で定めます。

## 団体と案内先

団体とURLを分離し、URLの責務を`sources.json`へ集約します。`organizations.json`に`official_home_source_id`を持たせません。

案内先には主として次を管理します。

- `publisher_organization_id`
- `related_organization_ids`
- `source_type`
- `content_format`
- `url`
- `destination_locales`
- `equivalent_source_group_id`
- `platform`
- `account_id`
- `primary_official_home_for_locales`
- `lifecycle_type`
- `destination_status`
- `destination_checked_on`
- `official_information_status`
- `official_information_checked_on`
- `show_in_official_source_list`
- `publication_status`
- `internal_note`

団体の公式ホームページは、`source_type`と`primary_official_home_for_locales`で表現します。日本語ページと英語ページでURLが異なる場合は別々の案内先レコードとし、必要に応じて`equivalent_source_group_id`で言語違いを関連付けます。

`display_locales`は本サイトのどの言語版に表示するか、`destination_locales`は外部リンク先で利用できる言語を表します。両者を混同しません。

## 公式名称

### 団体名称

言語別`organizations.json`の`name_kind`は、次の3種類に限定します。

- `official-ja`
- `official-en`
- `official-ja-fallback`

`official-en`は、団体自身が使用する公式英語名称を根拠から確認できる場合だけ使用します。確認できない場合は、英語版でも日本語の正式名称を`official-ja-fallback`として表示します。独自訳を公式英語名称として扱わず、団体名称に`descriptive`を使用しません。

### 災害名称

言語別`disasters.json`の`name_kind`は、次の4種類です。

- `official-ja`
- `official-en`
- `official-ja-fallback`
- `descriptive`

`official-ja`と`official-en`は、`evidence.json`で対象災害、名称言語、公式名称の確認根拠を明示的に関連付けられる場合だけ使用します。`official-ja-fallback`は、確認済みの日本語公式名称と同じ文字列を英語版で使用します。

`descriptive`は、公式名称が確認できない災害を識別するための説明的名称に限定し、`official-name`の確認根拠を必須としません。本サイトによる公式認定を意味せず、現在の被害状況、安全性、規模、復旧状態を名称へ含めません。団体の独自英訳を許可する目的にも使用しません。

## 公式情報の確認根拠

`evidence.json`は次の確認根拠を、団体や案内先とは別に管理します。

- 団体が公式組織であること
- ページが公式ページであること
- SNSアカウントが公式であること
- 英語名称が公式名称であること
- 災害の日本語名称または英語名称が公式名称であること
- 組織間の関係

`evidence.json`の`target_type`は`organization`、`source`、`disaster`です。災害名称の根拠は、`target_type: disaster`、対象災害ID、`target_aspect: official-name`、`target_locale: ja`または`en`で関連付けます。第一版の`target_type: disaster`は災害名称の確認だけに使用し、`occurred_on`用の新しい`target_aspect`は追加しません。

公式サイトからのリンク、国・自治体の公式SNS一覧、公式のお知らせ、公式組織ページでの名称使用などを根拠とします。災害名称は、対象名称を実際に使用している公的機関・関係団体自身の公式ページなどで確認します。検索結果、第三者のSNS投稿、報道記事だけを根拠とせず、認証表示、フォロワー数、表示名だけも根拠にしません。根拠データへ災害の現在状況、安全性、被害規模を保存しません。構造情報は`core`へ、利用者向け説明は`locale`へ置きます。

## 地域

`regions.json`は、次の地域区分を扱える設計とします。

- `country`
- `nationwide`
- `prefecture`
- `municipality`
- `service-area`

行政区域と、電気・ガス・水道・交通など事業者の提供範囲を混同しません。親地域の参照は自己参照と循環を禁止します。

## 分野とカード

第一版の基本分野は次の5つです。

1. 公的機関・防災全般
2. 命・安全・医療
3. ライフライン
4. 道路・交通
5. 支援・復旧

`cards.json`は利用者が「何を確認したいか」から探す表示単位です。カード自体にURL、団体名、案内先確認日、ボタン文言を直接持たせません。これらは団体、案内先、関連データ、localeから組み立てます。

第一版はおおむね17分類を想定しますが、この設計段階で最終掲載数を固定しません。

## 災害と出来事

`disasters.json`は地震、豪雨、台風などを識別し、災害別の公式案内をまとめる単位です。`events.json`は一つの災害に属し、水道、道路、住宅、医療、支援など利用者が確認したい案内目的を表します。出来事はニュース記事、個別被害、個別事故の単位ではありません。

災害・出来事に、現在の断水地域、停電戸数、負傷者数、道路・運休状況、復旧見込み、施設の受入能力、安全性判断、目撃情報、個人情報を保存しません。

`site_guidance_status`は`disasters.json`と`events.json`のレコードに属し、災害または出来事について本サイト上で案内を表示している状態を示します。災害・出来事そのものの終了、安全、復旧を判定する項目ではありません。

- `active`
- `ending-review`
- `archived`

## 3種類の関連データ

柔軟すぎる`target_type`・`target_id`形式へ統合せず、参照先が明確な3ファイルへ分けます。共通項目は次のとおりです。

- `id`
- `source_id`
- `display_order`
- `display_locales`
- `site_display_start_on`
- `site_display_end_on`
- `publication_status`
- `internal_note`

表示期間は案内先そのものではなく、案内先をどこへ掲載するかを表す関連データ側で管理します。ボタン文言と公開用補足は対応するlocaleへ置きます。

個々の関連・リンクの掲載状態は`publication_status`、表示期間は`site_display_start_on`と`site_display_end_on`で管理します。表示期間外または非公開状態の関連データは公開成果物へ含めません。`site_guidance_status`を個々の関連・リンクへ持たせません。

災害・出来事の最低件数へ数える公開可能な関連データは、関連、参照元、案内先、必要なlocaleが公開可能で、表示期間内にあり、案内先の確認状態・確認日・公式情報の根拠、関連localeの`button_label`、必要な`destination_language_note`が揃ったものに限定します。単に関連レコードが存在するだけでは件数へ含めません。詳細条件は[データフィールド定義](DATA_FIELDS.md)を参照してください。

### カード関連

`card-source-links.json`は通常カードと案内先を結びます。

- `role`: `primary`、`secondary`、`temporary-highlight`
- `visibility_context`: `always`、`normal`、`disaster`

`visibility_context`は必須のstringであり、表示場面を表します。信頼度や優先順位を表しません。`visibility_context: disaster`でも特定の災害IDを直接参照せず、特定災害との関係は`disaster-source-links.json`で管理します。

| 値         | 意味                               |
| ---------- | ---------------------------------- |
| `always`   | 通常時・災害対応時の両方で表示する |
| `normal`   | 通常時に表示する                   |
| `disaster` | 災害対応時に表示する               |

### 災害関連

`disaster-source-links.json`は災害全体と総合案内、行政対応、支援案内などを結びます。

- `role`: `overview`、`government-response`、`support`、`supplementary`
- トップ表示: `show_in_top_guidance`と`top_display_order`

`publication_status: published`の災害は、公開可能な災害関連を1件以上持ち、そのうち最低1件を`overview`または`government-response`とします。`support`または`supplementary`だけでは公開条件を満たしません。

トップ案内は最大5件とし、運用上は3件程度を優先します。`top-highlight`という`role`は作成しません。

### 出来事関連

`event-source-links.json`は、水道、道路、住宅、医療などの案内目的と案内先を結びます。

- `role`: `primary`、`supplementary`、`support`、`safety-guidance`

`publication_status: published`の出来事は、いずれかの`role`を持つ公開可能な出来事関連を1件以上必要とします。通常は`primary`を優先し、補助的な案内先だけで構成してよいかは人が確認します。

公開中の出来事が参照する親災害も`publication_status: published`でなければなりません。存在しない災害、非公開・非表示・アーカイブ済みの親災害を参照する出来事は公開せず、親災害が`site_guidance_status: archived`の場合に子出来事を`active`として公開しません。

出来事をトップ上部へ直接表示しません。トップへ必要な案内先は、災害関連にも明示的に登録します。

## 内部確認履歴

`data/core/check-history.json`は運用者向けであり、ブラウザや公開成果物へ含めません。

`target_type`の許可値は、`site`、`region`、`organization`、`source`、`evidence`、`section`、`card`、`disaster`、`event`、`card-source-link`、`disaster-source-link`、`event-source-link`です。

`check_type`の許可値は、`destination`、`official-information`、`official-name`、`organizational-relationship`、`content-purpose`、`locale-content`、`temporary-guidance`、`publication-readiness`、`full-site-review`、`other`です。

`result`の許可値は、`confirmed`、`changed`、`needs-review`、`unavailable`、`retired`、`invalid`、`ended`です。

履歴は原則追記型とし、過去の記録を現在状態に合わせて書き換えません。誤記訂正では元記録を消さず、必要に応じて`supersedes_check_id`で関連付けます。個人情報、認証情報、非公開連絡先、問い合わせメール本文を保存しません。

## 公開更新履歴

公開更新履歴は、内部確認履歴と分離します。

- 構造情報: `data/core/update-history.json`
- 日本語文面: `data/locales/ja/update-history.json`
- 英語文面: `data/locales/en/update-history.json`

利用者に必要な変更だけを掲載し、すべての内部確認作業を公開しません。一つの公開更新履歴が複数の内部確認履歴をまとめても構いません。

`update_type`の許可値は、`initial-release`、`routine-check`、`source-added`、`source-updated`、`source-removed`、`temporary-guidance-started`、`temporary-guidance-ended`、`policy-updated`、`translation-updated`、`accessibility-updated`、`other`です。

内部メモや調査途中の推測を公開更新履歴へ流用しません。

## 参照関係の基本

- `organizations`、`sources`、`evidence`は一方向の責務を保ち、団体から公式ホーム案内先への循環参照を作らない
- `cards`、`disasters`、`events`は関連ファイル経由で`sources`を参照する
- `events`は必ず一つの`disaster`を参照する
- 関連データは対応する対象IDと`source_id`を明示する
- 公開更新履歴は必要に応じて複数の内部確認履歴IDを参照できる
- localeは対応するcoreと同一IDを使用する

参照先の存在、循環、重複、公開状態、表示期間は意味検証で確認します。

## 内部専用項目

`internal_note`、`checked_by`、内部確認履歴の`summary`、非公開URL、調査途中の記録などは公開成果物へ含めません。管理用ファイル全体を静的配信対象へ置かず、公開生成後にも内部項目の混入を再検証します。

## 現在の実装状態と後続工程

工程3-1の配置・site検証基盤に加え、工程3-2Aで次を実装済みです。

- `regions`、`organizations`、`sources`、`evidence`のcore・locale 8 Schema
- 上記4管理単位のcore・日本語・英語の12データファイル
- 架空国から架空県、架空団体、架空案内先、架空根拠への参照関係
- ID重複、参照、地域階層、core・locale、日英改訂、公開状態、公式性確認根拠の意味検証

次は後続工程で実装・具体化します。

- 工程3-2Bの分野・案内カード・カードと案内先の関連
- 災害・出来事・履歴を含む後続管理単位のSchemaと意味検証
- 公開対象の抽出と日英成果物の生成
- 画面
- 改訂番号を増やす変更の詳細運用

実在する団体、URL、災害情報などは、公開用データ生成と画面仕様の確定後に掲載・更新・削除手順を整備するまで登録しません。

フィールド名、型、必須条件、列挙値は[データフィールド定義](DATA_FIELDS.md)で確定済みであり、後続工程の未確定事項として扱いません。

この文書は、`operator_name`の具体値、本番URL、URLパス構成、英語版を`/en/`へ置くか、ホスティング方式、実際の掲載団体・URLを決定しません。

## 関連文書

- [データフィールド定義](DATA_FIELDS.md)
- [日英対応方針](LOCALIZATION_POLICY.md)
- [データ検証・公開生成方針](DATA_VALIDATION_AND_PUBLICATION.md)
- [情報掲載方針](INFORMATION_LISTING_POLICY.md)
- [運用方針](OPERATIONS_POLICY.md)
- [データSchema実装](DATA_SCHEMA_IMPLEMENTATION.md)
- [coreとlocaleを分離する決定](decisions/0012-separate-core-and-locale-data.md)
- [災害と出来事を分離する決定](decisions/0013-separate-disasters-and-guidance-events.md)
- [内部確認履歴と公開更新履歴を分離する決定](decisions/0014-separate-internal-and-public-history.md)
