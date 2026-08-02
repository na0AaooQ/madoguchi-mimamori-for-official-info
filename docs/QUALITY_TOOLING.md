# 品質管理基盤

## 目的

本基盤は、JavaScript・JSON・Markdown、JSON Schema、ファイル間意味検証、リポジトリ固有の文書規則をローカルで再現可能に確認するための土台です。工程3-2Aで地域・団体・案内先・確認根拠のSchemaと意味検証を追加しました。本番サイトと公開生成処理は実装しません。

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
npm run check
```

- `npm run lint`はJavaScript・JSON・GFM Markdown・Markdown内の`js`または`javascript`コードブロックを検査します。
- `npm run format`だけが、選択されたファイルを書き換えます。
- `npm run format:check`は書式を確認しますが、ファイルを書き換えません。
- `npm test`は`node:test`の全テストを実行します。
- `npm run validate:fixtures`は正常・異常fixtureの実結果と期待値を比較します。
- `npm run validate:docs`は全Markdownへ文書固有検証を実行します。
- `npm run validate:data`は本番用の40データファイル、27 Schema、配置、構造、siteと工程3-2Aデータの意味検証を実行します。
- `npm run check`は上記の読取専用検証を順に実行し、最後に`validate:data`も実行します。いずれも`data/`や`schemas/`を書き換えません。

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
| `W001` | 確認中locale                                   |
| `I001` | 下書きlocale                                   |

Schema違反は`E002`、ファイル間の意味違反は主に`E003`から`E005`および`E010`から`E016`で分けて報告します。Schemaや検証基盤の実行異常は`RUN-E001`から`RUN-E005`、文書固有検証は`DOC-E`系を使用します。

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

工程3-2B以降の管理単位のID・参照・循環、URL正規化後の重複、期限、表示期間、公開可能件数、公開生成後の内部項目除外などは未実装です。

本番用の架空itemは`draft`であることを正常状態とし、レコードごとの`I001`を出力しません。`npm run validate:data`の正常時はError 0、Warning 0、Info 2を想定します。2件のInfoは日本語・英語siteが下書きであることを示します。

## 文書固有検証

- queryとfragmentを除いた相対ファイルリンクの存在
- 外部URLへ通信しないリンク分類
- ADRファイル名の4桁番号、重複、`0001`からの欠番、索引との一致
- ADR必須見出し
- 先頭の唯一のH1と、2段階以上飛ばない見出し階層
- コードフェンス内の`#`を見出しとして扱わないこと

すべてのADRに共通する最小見出しとして「状況」「決定」「理由」「状態」「決定日」を必須にします。既存ADRへ新しい構成を遡及適用しません。

## 外部接続と未実装範囲

テストと検証は外部ネットワーク、AWS、GitHub API、実在する公式サイトへ接続しません。工程3-2Aのデータは架空名称と`example.invalid`だけを使い、URLへの疎通確認も行いません。実在情報、工程3-2B以降のitem、画面、公開生成、CI、Gitフック、デプロイは後続工程です。
