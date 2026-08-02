# 0017: Node.js品質管理ツールチェーンを採用する

## 状況

品質管理工程では、JavaScript・JSON・Markdown、JSON Schema、ファイル間の意味、リポジトリ固有の文書規則をローカルで一括検証する必要があります。既存Markdownを一度に整形すると、品質基盤と無関係な大規模差分が混在します。

## 決定

Node.js 24 LTSとnpmを採用し、Node.js `24.18.0`とnpm `11.16.0`へ固定します。ES Modules形式のJavaScriptから開始し、初期工程ではTypeScriptを導入しません。

テストには`node:test`、JSON Schema Draft 2020-12検証にはAjvとajv-formatsを使用します。LintにはESLintの公式JavaScript・JSON・Markdownプラグイン、書式にはPrettierを使用し、`eslint-config-prettier`で規則競合を防ぎます。今回の要件と既存ノウハウを検討した結果、Markdownを含む基盤にはこの組合せを採用し、Biomeは採用しません。

Markdownの相対リンク、ADR連番、必須見出し、見出し階層は独自検証します。PrettierはJavaScript・JSON・Markdownへ適用しますが、大規模な無関係差分を避けるため、未変更の既存MarkdownだけをSHA-256付きベースラインで一時管理します。新規・変更MarkdownにはPrettierを必須とし、一般Markdownを`.prettierignore`へ追加しません。ベースラインは将来の文書整形専用PRで解消します。

依存バージョンを完全固定し、npm生成の`package-lock.json`をGit管理します。開発環境は`npm ci`で再現します。

## 理由

- Node.js標準APIと`node:test`で小さく開始できる
- AjvがDraft 2020-12を明示的に扱える
- ESLint公式言語プラグインでJavaScript・JSON・GFM Markdownを同じ入口から検査できる
- PrettierとLintの責務を分離できる
- 内容ハッシュにより、保留した既存Markdownの変更を確実に検出できる
- 固定バージョンとlockfileで依存解決を再現できる

## 検討した代替案

- TypeScriptから開始する
- Jest、Vitest、Mochaなどのテストランナーを追加する
- Biomeだけで今回のJavaScript・JSON・Markdown要件を扱う
- 既存Markdownを品質基盤PRで一括整形する
- 一般Markdownを`.prettierignore`へ追加する
- 依存バージョンに範囲指定を使用する

## 影響

新規・変更ファイルはLint、Format、テスト、fixture、文書検証を通す必要があります。ベースライン保留はPrettier正常を意味せず、ESLintと文書固有検証は保留文書にも実行します。既存Markdown全体の整形は別PRで行います。

Gitフック、GitHub Actions、E2E、カバレッジ強制は今回導入しません。AWSや外部URLへ接続するテストも導入しません。本番用Schema、実データ、公開生成、画面は後続工程で実装します。

## 関連文書

- [品質管理基盤](../QUALITY_TOOLING.md)
- [データ検証・公開生成方針](../DATA_VALIDATION_AND_PUBLICATION.md)
- [開発工程](../DEVELOPMENT_PHASES.md)

## 状態

採用

## 決定日

2026年8月2日
