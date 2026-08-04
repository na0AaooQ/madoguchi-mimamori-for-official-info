# 公開データ契約

## 目的

`navigation.json`は、管理用`data/`を画面へ直接渡さず、検証済みの公開可能情報だけを日英別に提供する公開成果物です。管理用の正規化データを公開カードからたどって非正規化し、画面が内部状態や確認根拠を読まなくても案内を構築できる形にします。

previewとproductionの静的サイト生成では、各modeの日英`navigation.json`を公開案内情報の唯一の入力として、ビルド時に完成済み静的HTMLを生成します。ブラウザは主要表示のために本ファイルをfetchせず、画面生成処理も管理用`data/`を直接参照しません。

## 成果物とトップレベル

正式なパスは次のとおりです。

- preview: `dist/public-data/preview/{ja,en}/navigation.json`
- production: `dist/public-data/production/{ja,en}/navigation.json`

トップレベルは次の6項目だけを持ちます。

| フィールド           | 内容                                                   |
| -------------------- | ------------------------------------------------------ |
| `schema_version`     | 初版は`1.0.0`                                          |
| `artifact_type`      | `fictional-preview`または`production`                  |
| `locale`             | `ja`または`en`                                         |
| `generated_for_date` | 表示期間判定に使った`YYYY-MM-DD`の基準日               |
| `site`               | 対象言語のサイト表示情報                               |
| `sections`           | 表示順に並べた公開分野と、その配下のカード・案内リンク |

生成日時、実行端末、作業者、コミットSHAは含めません。

## 公開フィールド

### site

`site_id`、`default_locale`、`supported_locales`、`site_name`、`subtitle`、`short_description`、`purpose`、`free_use_notice`、`external_site_notice`、`disclaimer_summary`、`contact_url`を公開します。`contact_url`は対象言語のsite Localeを優先し、省略時はCoreへフォールバックします。`site_last_checked_on`は公開可否判定だけに使い、成果物へ出力しません。

### sectionとcard

sectionは`id`、`anchor_id`、`title`、任意の`short_description`、`cards`を持ちます。publishedの分野はカードが0件でも残します。

cardは`id`、`title`、`summary`、任意の`region_label`、`emergency_note`、`details_label`、`links`を持ちます。管理用`region_ids`は参照・公開可否判定に使い、画面用にはlocaleの`region_label`だけを出力します。

### link、destination、organization

linkは`id`、`role`、`visibility_context`、`button_label`、任意の`public_note`、`destination`を持ちます。`role`は`primary`、`secondary`、`temporary-highlight`です。`visibility_context`は`always`、`normal`、`disaster`で、信頼度、重要度、推奨順位、現在の災害状況ではなく機械向けの表示場面だけを表します。

destinationは`id`、`source_type`、`content_format`、`url`、`destination_locales`、該当時だけ`platform`と`account_id`、`display_title`、`purpose`、任意の`public_note`、必要時だけ`destination_language_note`、`destination_checked_on`、`official_information_checked_on`、`organization`を持ちます。日本語だけの案内先を英語成果物へ出す場合は英語の`destination_language_note`が必須です。

organizationは`id`、`official_name`、`name_kind`、任意の`summary`を持ちます。`name_kind`は公式英語名称と日本語公式名称フォールバックを画面内部で区別するための項目です。

任意項目が存在しない場合は、`null`や空文字列を入れずキーごと省略します。

## 管理用dataとの境界

管理用Schema 27件は`schemas/`、公開成果物専用Schemaは`contracts/public/navigation.schema.json`に分離します。公開Schemaを`scripts/validation/data-layout.js`の`SCHEMA_LAYOUT`へ追加せず、日本語・英語で同じDraft 2020-12 Schemaを使います。全階層で`additionalProperties: false`を基本とします。

`internal_note`、公開状態、locale状態、改訂番号、`display_order`、案内先の管理状態、根拠、確認担当者などは公開しません。evidenceは団体・公式名称・案内先の公式性を確認する内部条件だけに使い、ID、説明、URL、確認日を含めて成果物へ一切出力しません。

stable IDはsection、card、link、source、organizationに残しますが、画面上へ文字列表示せず、認証、認可、アクセス制御、改ざん防止にも使用しません。`display_order`は管理データ上の並べ替えだけに使い、成果物から除外します。

## 抽出、期間、到達可能性

site、section、card、link、source、publisher organizationの順に、coreと対象localeがpublishedで、参照地域・根拠・確認状態が公開可能なものだけを抽出します。linkは対象言語が`display_locales`に含まれ、基準日が開始日以上かつ終了日以下の場合だけ有効です。開始日・終了日の境界日は含み、現在時刻、OSタイムゾーン、実行端末の日付は使いません。

言語・期間判定後に公開カードのprimaryが0件になる場合は、カードを黙って消さず`PUB-E003`で生成全体を停止します。公開カードから到達できないsource、organization、evidenceは出力しません。日英各1ファイルへ非正規化することで、画面側に管理データの結合・公開判定責務を持たせません。

sections、同一sectionのcards、同一cardのlinksは`display_order`昇順、同値時はstable ID昇順です。locale配列は`ja`、`en`の順に固定し、入力配列の物理順には依存しません。

## allowlist、禁止項目、URL安全条件

管理オブジェクトを複製してキーを削除せず、新しい公開オブジェクトへ許可項目だけを明示代入します。生成後は公開Schemaに加えて禁止キーを再帰検査します。

公開URLは文字列だけを検証し、外部通信やDNS解決を行いません。HTTPS、credentialsなし、fragmentなし、localhost・loopback・private・link-local IPではないことを確認します。previewでは予約ドメイン`example.invalid`を許可し、productionでは`.invalid`を禁止します。正当なクエリ文字列は一律禁止しませんが、追跡専用パラメーターを管理データへ保存しません。

## previewとproduction

previewはpublished架空fixtureを基準日`2026-08-02`で生成し、`artifact_type: fictional-preview`とします。実在する団体、制度、URL、個人情報を含みません。

productionは本番用`data/`から明示的な`--as-of`で生成します。正本siteはpublishedで、2026年8月4日を基準日とする日英成果物を一組としてGit管理します。正本が非公開へ戻ったのにproductionが残る場合は`PUB-E007`とし、自動削除せず削除差分を人が確認します。

## Git管理、直接編集禁止、鮮度検証

正式な日英`navigation.json`は、画面へ渡る内容の履歴とレビュー可能性のためGit管理します。previewとproductionを分け、その他の一般的な`dist`成果物、一時ファイル、ログ、バックアップは管理しません。

成果物は直接編集しません。`verify:public`はfixtureまたは正本からOSの一時領域へ再生成し、tracked artifactとバイト単位で比較します。同じ入力・同じ基準日は、2スペースインデント、固定キー順、固定配列順、末尾改行を含めて同一になります。不一致は`PUB-E006`です。

## 対象外

公開データ生成は災害、出来事、災害関連、出来事関連、確認・更新履歴を扱いません。previewとproductionの静的サイトは本契約を入力にしますが、公開JSON契約自体を画面都合で拡張しません。デプロイ手順は[GitHub Pages手動デプロイ](GITHUB_PAGES_DEPLOYMENT.md)に分離します。
