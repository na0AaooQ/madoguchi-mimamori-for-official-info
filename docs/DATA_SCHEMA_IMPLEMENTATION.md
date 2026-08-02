# データSchema実装

## 目的

工程3-1では、確定済みの管理単位に対応する本番用`data/`と`schemas/`の枠組みを配置し、ローカルで構造・配置・最小限の整合性を検証できる状態にします。画面、公開成果物、実在情報はこの工程に含めません。

## データファイル

`data/core/`には言語共通の14ファイル、`data/locales/ja/`と`data/locales/en/`にはそれぞれ13ファイルを置きます。合計は40ファイルです。内部確認履歴である`check-history.json`はcoreだけに置き、locale版は作りません。

3つの`site.json`だけは単一オブジェクトです。coreはサイトID、対応locale、公開状態、災害別案内の有効状態を持ち、日本語・英語はサイト表示文言と文面改訂情報を持ちます。初期状態はいずれも`draft`です。確定済みの問い合わせURLはないため、coreの初期データに`contact_url`は登録しません。

`site.json`以外の37ファイルは、次の配列エンベロープで開始します。

```json
{
  "schema_version": "1.0.0",
  "data_updated_on": "2026-08-02",
  "items": []
}
```

工程3-1では実在する団体、公式URL、災害、案内先、連絡先などを登録しません。

## Schema

`schemas/core/`にはcore 14管理単位、`schemas/locales/`にはlocale 13管理単位のSchemaを置きます。合計は27 Schemaです。日本語と英語は同じlocale Schemaを利用します。

Schemaは管理単位ごとに分け、変更範囲と責務を追跡しやすくします。構造が安定していない初期段階では、重複を許容して各Schemaを単独で理解できることを優先し、複数Schemaから参照する共通Schemaは作りません。外部Schemaへの`$ref`やリモート取得も使用しません。

全SchemaはJSON Schema Draft 2020-12、Schema版`1.0.0`を使用し、`$id`を次のURN形式で一意に付与します。

- core: `urn:madoguchi-mimamori:schema:core:{管理単位}:1.0.0`
- locale: `urn:madoguchi-mimamori:schema:locale:{管理単位}:1.0.0`

`site.json`以外の25 Schemaは、未実装の`items`へデータが入らないよう`maxItems: 0`を指定します。正式なitem Schemaは工程3-2以降で、実装対象となる管理単位から段階的に追加します。

coreの`contact_url`は、値が存在する場合は公開状態にかかわらずHTTPS URLだけを許可します。`site_publication_status: published`では、`site_last_checked_on`と`contact_url`の両方を必須とします。その他の公開状態では、未確定URLを推測して登録せず省略できます。

## dataとSchemaの対応

`scripts/validation/data-layout.js`がcore管理単位、locale管理単位、対応locale、データパス、Schemaパス、siteか配列エンベロープかを一元管理します。CLI、検証処理、テストはこの一覧を参照し、同じファイル一覧を重複定義しません。

coreデータは同名の`schemas/core/*.schema.json`へ対応します。日本語と英語のlocaleデータは、言語にかかわらず同名の`schemas/locales/*.schema.json`へ対応します。

## 検証

次のコマンドは`data/`と`schemas/`を読み取り専用で検証し、ファイルを書き換えません。

```sh
npm run validate:data
```

検証内容は次のとおりです。

- 必須40データファイルと27 Schemaの存在
- `data/`と`schemas/`配下の全JSONの走査と、配置対応表にないJSONファイル、未対応locale、locale版check-historyの検出
- JSON構文
- Schemaの`$id`重複
- Ajv strictモードでのSchemaコンパイル
- 各データファイルと対応Schemaの検証
- 英語siteの`based_on_ja_revision`の存在と日本語改訂番号との一致
- 日本語siteへの`based_on_ja_revision`混入禁止
- core・日本語・英語siteの`site_id`一致
- `default_locale`と`supported_locales`の整合
- localeファイル自身の`locale`との一致

データの不備は既存の`E001`から`E004`と、新規の`E006`から`E010`で報告し、終了コード`1`とします。Schema配置、Schema JSON、`$id`、コンパイル、配置対応表、読込環境の異常は`RUN-E001`から`RUN-E005`で区別し、終了コード`2`とします。`data/`または`schemas/`の正本配下では、`tmp`や`dist`などのディレクトリ名を理由にJSONを除外しません。複数の問題は可能な範囲で収集し、結果を決定論的に並べます。

`npm run check`には`validate:data`が含まれます。データを更新した場合は、コミット前に`npm run check`を実行します。

## 未実装範囲と次工程

工程3-1では、37空ファイル間のID参照、ID・URL重複、組織階層、公式性根拠、災害名称根拠、表示期間、確認期限、公開可能件数、内部項目除外などの全意味検証を実装していません。公開対象抽出、公開成果物生成、画面も未実装です。

工程3-2では、予約用途ドメインと明確な架空名称だけを用いて最小縦切りデータを追加し、必要なitem Schemaと意味検証を段階的に実装します。実在情報はさらに後の確認工程で扱います。検証とテストは外部ネットワークへ接続しません。
