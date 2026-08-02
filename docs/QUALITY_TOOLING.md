# 品質管理基盤

## 目的

本基盤は、JavaScript・JSON・Markdown、テスト用JSON Schema、最小のファイル間意味検証、リポジトリ固有の文書規則をローカルで再現可能に確認するための土台です。本番サイト、本番用`data/`、本番用`schemas/`、公開生成処理は実装しません。

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
npm run check
```

- `npm run lint`はJavaScript・JSON・GFM Markdown・Markdown内の`js`または`javascript`コードブロックを検査します。
- `npm run format`だけが、選択されたファイルを書き換えます。
- `npm run format:check`は書式を確認しますが、ファイルを書き換えません。
- `npm test`は`node:test`の全テストを実行します。
- `npm run validate:fixtures`は正常・異常fixtureの実結果と期待値を比較します。
- `npm run validate:docs`は全Markdownへ文書固有検証を実行します。
- `npm run check`は上記の読取専用検証を順に実行し、ファイルを書き換えません。

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

今回のデータ検証コードは、JSON構文`E001`、Schema違反`E002`、英語locale不足`E003`、改訂不一致`E004`、存在しない参照`E005`、確認中locale`W001`、下書きlocale`I001`です。文書固有検証はデータ検証と区別する`DOC-E`系を使用します。

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

## 今回実装する意味検証

- 日本語localeがあり、表示に必要な英語localeがないこと
- 英語の`based_on_ja_revision`と日本語の`content_revision`の不一致
- 存在しないID参照
- `under-review`をWarning、`draft`をInfoとして分類する最小機構

ID重複、URL重複、循環参照、公式性根拠、期限、公開可能件数、内部項目除外などの全意味検証は未実装です。本番データ基盤とともに後続工程で実装します。

## 文書固有検証

- queryとfragmentを除いた相対ファイルリンクの存在
- 外部URLへ通信しないリンク分類
- ADRファイル名の4桁番号、重複、`0001`からの欠番、索引との一致
- ADR必須見出し
- 先頭の唯一のH1と、2段階以上飛ばない見出し階層
- コードフェンス内の`#`を見出しとして扱わないこと

ADR 0001から0016に共通する最小見出しとして「状況」「決定」「理由」「状態」「決定日」を必須にします。既存ADRへ新しい構成を遡及適用しません。

## 外部接続と未実装範囲

テストと検証は外部ネットワーク、AWS、GitHub API、実在する公式サイトへ接続しません。本番用`data/`、本番用`schemas/`、全意味検証、画面、公開生成、CI、Gitフック、デプロイは後続工程です。存在しない本番対象を成功扱いする`validate:data`は追加しません。
