# 品質管理基盤

## 目的

本基盤は、JavaScript・JSON・Markdown、JSON Schema、ファイル間意味検証、日英のpreview・production公開成果物と静的サイト、リポジトリ固有の文書規則をローカルで再現可能に確認するための土台です。

## 採用ツールと責務

| ツール               | 責務                                        |
| -------------------- | ------------------------------------------- |
| Node.js・npm         | 実行環境と依存関係の再現                    |
| `node:test`          | 追加ライブラリを使わない単体・CLIテスト     |
| Ajv・ajv-formats     | JSON Schema Draft 2020-12とformatの検証     |
| ESLint・`@eslint/js` | ES Modules形式のJavaScript検査              |
| `@eslint/json`       | 通常JSONの構文・推奨規則検査                |
| `@eslint/markdown`   | GFM文書とJavaScriptコードブロックの検査     |
| Prettier             | JavaScript・JSON・Markdownの書式統一        |
| 独自検証             | fixture期待値、意味検証、文書固有規則の確認 |

ESLintの書式規則は`eslint-config-prettier`で無効化し、書式はPrettierへ集約します。BiomeとTypeScriptは初期工程では採用しません。

## 固定バージョン

- Node.js `24.18.0`
- npm `11.16.0`
- eslint `10.7.0`
- `@eslint/js` `10.0.1`
- `@eslint/json` `2.0.1`
- `@eslint/markdown` `8.0.3`
- globals `17.7.0`
- eslint-config-prettier `10.1.8`
- prettier `3.9.6`
- ajv `8.20.0`
- ajv-formats `3.0.1`

依存バージョンは完全固定し、更新は専用PRで行います。`package-lock.json`はnpmで生成してGit管理し、手作業やPrettierで編集しません。

## Node.jsとnpmの準備

`.nvmrc`にNode.js `24.18.0`を記録しています。nvmを利用できる環境では次を実行します。

```sh
nvm use
node --version
npm --version
```

期待値は`v24.18.0`と`11.16.0`です。依存関係は次のコマンドで再現します。

```sh
npm ci
```

## コマンド

```sh
npm run lint
npm run format
npm run format:check
npm test
npm run validate:fixtures
npm run validate:docs
npm run validate:data
npm run generate:public:preview
npm run generate:public -- --as-of 2026-08-04
npm run validate:public
npm run verify:public
npm run generate:site:preview
npm run generate:site:production
npm run validate:site
npm run verify:site
npm run check
```

- `npm run lint`はJavaScript・JSON・GFM Markdown・Markdown内の`js`または`javascript`コードブロックを検査します。
- `npm run format`だけが、選択されたファイルを書き換えます。
- `npm run format:check`は書式を確認しますが、ファイルを書き換えません。
- `npm test`は`node:test`の全テストを実行します。
- `npm run validate:fixtures`は正常・異常fixtureの実結果と期待値を比較します。
- `npm run validate:docs`は全Markdownへ文書固有検証を実行します。
- `npm run validate:data`は本番用の40データファイル、27 Schema、配置、構造、siteと工程3-2A・3-2Bデータの意味検証を実行します。
- `npm run generate:public:preview`はpublished架空fixtureから日英preview成果物を書き込みます。
- `npm run generate:public -- --as-of 2026-08-04`は本番用管理データから日英production成果物を書き込みます。
- `npm run validate:public`はtracked artifactの構造、禁止項目、URL、日英ペア、productionライフサイクルを読取専用で検証します。
- `npm run verify:public`は一時領域へ再生成し、tracked artifactとのバイト一致を読取専用で検証します。
- `npm run generate:site:preview`は日英preview公開JSONから静的サイトを一組として生成します。
- `npm run generate:site:production`は日英production公開JSONからカスタムドメイン用静的サイトを一組として生成します。
- `npm run validate:site`はGit管理中の静的サイトを読取専用で検証します。
- `npm run verify:site`はOS一時領域へ再生成し、Git管理成果物とのバイト一致を確認します。
- `npm run check`は既存検証後に`validate:site`と`verify:site`を実行します。書込を伴う生成コマンドは含めません。

## 段階的Prettierベースライン

JavaScriptとJSON、新規Markdown、このPR以降に変更したMarkdownは常にPrettier対象です。基準コミット`f9ea011`から変更されていない既存Markdownのうち、現在未整形の文書だけを`scripts/formatting/prettier-baseline.json`へ登録し、内容が同一の間だけ書式検査を保留します。

登録内容にはリポジトリ相対パスと内容のSHA-256を使用します。SHA-256により、登録後の変更をファイル名だけではなく内容で検出します。ハッシュが変わった文書はPrettier対象へ戻り、`npm run format`で整形した後に登録から削除されます。新しい未整形文書を検査回避のために登録してはいけません。

これは`.prettierignore`による一般Markdown除外ではなく、保留文書がPrettier正常であることも意味しません。ベースライン対象にもESLint、相対リンク、ADR、見出し検証を実行します。将来の文書整形専用PRで登録を段階的に減らし、最終的に空にします。

## 検証結果

共通結果は次の必須フィールドを持ちます。

- `severity`
- `code`
- `file`
- `message`

必要に応じて`item_id`、`field`、`suggested_action`を追加します。機械向けseverityは`error`、`warning`、`info`です。

- Errorは修正が必要な検証違反です。
- Warningは処理を停止しませんが、人による確認が必要です。
- Infoは対応必須ではない処理情報です。

データ検証コードは次のとおりです。

| コード | 意味                                           |
| ------ | ---------------------------------------------- |
| `E001` | JSON構文違反                                   |
| `E002` | JSON Schema違反                                |
| `E003` | 公開に必要な英語locale不足                     |
| `E004` | 日英改訂番号不一致                             |
| `E005` | 存在しないID参照                               |
| `E006` | 必須データ欠落                                 |
| `E007` | 配置対応表にないデータ                         |
| `E008` | 未対応locale                                   |
| `E009` | 禁止localeファイル                             |
| `E010` | site固有の意味不整合                           |
| `E011` | 同一管理単位内のID重複                         |
| `E012` | coreとlocaleの対応不整合                       |
| `E013` | locale固有ルール違反                           |
| `E014` | 公開状態・参照先公開状態・利用可能言語の不整合 |
| `E015` | 公式性確認根拠の不足・不整合                   |
| `E016` | 親子関係の自己参照・地域循環                   |
| `E017` | アンカー・表示順の重複                         |
| `E018` | 関連組み合わせの重複・表示期間の矛盾           |
| `E019` | 公開カードに構造上公開可能な主案内先がない     |
| `W001` | 確認中locale                                   |
| `I001` | 下書きlocale                                   |

Schema違反は`E002`、ファイル間の意味違反は主に`E003`から`E005`および`E010`から`E019`で分けて報告します。Schemaや検証基盤の実行異常は`RUN-E001`から`RUN-E005`、文書固有検証は`DOC-E`系を使用します。

公開生成固有コードは次のとおりです。

| コード         | 意味                                               |
| -------------- | -------------------------------------------------- |
| `PUB-E001`     | siteまたは対象localeが公開可能でない               |
| `PUB-E002`     | 必要な公開フィールド、locale、参照先を解決できない |
| `PUB-E003`     | 言語・期間判定後に公開カードのprimaryが0件         |
| `PUB-E004`     | 公開Schema、公開意味規則、URL安全条件への違反      |
| `PUB-E005`     | 内部項目または禁止項目の混入                       |
| `PUB-E006`     | 再生成結果とGit管理中成果物のバイト不一致          |
| `PUB-E007`     | 正本の公開状態とproduction成果物の有無が不整合     |
| `PUB-E008`     | 必須成果物の欠落、片言語だけの存在、想定外ファイル |
| `PUB-RUN-E001` | CLI引数、基準日、modeの異常                        |
| `PUB-RUN-E002` | 入力、fixture、公開Schemaの読込異常                |
| `PUB-RUN-E003` | 固定出力先への安全な書込・置換異常                 |
| `PUB-RUN-E004` | 想定外の内部例外                                   |

サイト生成固有コードは、入力・locale違反`SITE-E001`、パス安全性`SITE-E002`、未対応変換`SITE-E003`、成果物集合`SITE-E004`、HTML契約`SITE-E005`、バイト不一致`SITE-E006`です。実行異常は`SITE-RUN-E001`から`SITE-RUN-E004`を使用します。

## 終了コード

| 終了コード | 意味                                                         |
| ---------- | ------------------------------------------------------------ |
| `0`        | Errorなし。WarningまたはInfoだけの場合を含む                 |
| `1`        | 検証対象のデータ、文書、または書式にErrorがある              |
| `2`        | 引数、設定、読込、Schemaコンパイル、内部処理に実行異常がある |

JSON構文エラーは検証対象の不正として終了コード`1`にします。存在しない対象や内部例外は終了コード`2`にします。ライブラリ層では`process.exit`を呼ばず、CLI層が`process.exitCode`を設定します。

## fixture

`tests/fixtures/schemas/`には接続確認用の小さなDraft 2020-12 Schemaだけを置きます。`valid/`は正常データ、`invalid/`は期待するSchema・意味違反、`manifest.json`は期待コード件数を管理します。

異常fixtureもJSON構文としては正常に保ちます。壊れたJSONやMarkdownはテスト中に一時ディレクトリへ作成し、終了後に削除します。実在する団体、災害、個人、公式URLは使用せず、URLが必要な場合は`example.invalid`を使用します。

## 実装済みの最小意味検証

- テストfixture内で、日本語localeがあり、表示に必要な英語localeがないこと
- テストfixture内で、英語の`based_on_ja_revision`と日本語の`content_revision`が一致しないこと
- テストfixture内で、存在しないIDを参照すること
- `under-review`をWarning、`draft`をInfoとして分類する最小機構
- 英語siteの`based_on_ja_revision`の存在と、日本語siteの`content_revision`との一致
- 日本語siteへの`based_on_ja_revision`混入禁止
- core・日本語・英語siteの`site_id`、対応locale設定の整合
- 工程3-2Aの4管理単位のID重複、参照整合性、地域階層、団体の自己参照
- coreと日英localeの対応、改訂番号、団体名称フォールバック
- 公開状態と参照先公開状態の整合、日本語のみの案内先の英語注意文
- 公開団体と公開案内先に必要な有効な公式性確認根拠
- 工程3-2Bの3管理単位のID重複、参照、core・locale、改訂、公開状態
- 分野アンカーと表示範囲ごとの表示順の重複
- カードと案内先の関連組み合わせ、表示開始日と終了日の矛盾
- 公開カードに必要な構造上公開可能な`role: primary`の関連

`IMPLEMENTED_ARRAY_DATA_LAYOUT`は21件、`EMPTY_DATA_LAYOUT`は16件です。管理用`SCHEMA_LAYOUT`は27件を維持し、公開成果物Schemaは`contracts/public/`へ分離します。通常カードの基準日による期間判定と公開後検証は実装済みです。災害・出来事・履歴のID・参照、URL正規化後の重複、確認期限は未実装です。

本番用管理データには人が確認した実在情報を登録し、Core・日本語・英語のsiteと公開対象データを`published`にしています。「命・安全・医療」と「支援・復旧」の2分野は`draft`でproduction対象外です。`npm run validate:data`の現在の正常時はError 0、Warning 0、Info 0です。架空itemは本番用`data/`ではなくfixtureへ分離します。

## 文書固有検証

- queryとfragmentを除いた相対ファイルリンクの存在
- 外部URLへ通信しないリンク分類
- ADRファイル名の4桁番号、重複、`0001`からの欠番、索引との一致
- ADR必須見出し
- 先頭の唯一のH1と、2段階以上飛ばない見出し階層
- コードフェンス内の`#`を見出しとして扱わないこと

すべてのADRに共通する最小見出しとして「状況」「決定」「理由」「状態」「決定日」を必須にします。既存ADRへ新しい構成を遡及適用しません。

## 外部接続と未実装範囲

テスト、生成、検証は外部ネットワーク、DNS、GitHub API、実在する公式サイトへ接続しません。productionでもURLは文字列として検証し、疎通確認しません。災害・出来事・履歴のitem Schema、意味検証、利用者向け表示は未実装で、該当する本番用管理データは空です。GitHub Pagesへの公開は`workflow_dispatch`による手動実行だけとし、ローカルの`npm run check`はデプロイしません。正式URLの到達性や外部リンク先は、自動検証と分けて人が確認します。
