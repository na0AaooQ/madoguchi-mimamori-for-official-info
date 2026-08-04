# GitHub Pagesへのproductionサイト手動デプロイと公開後運用

## 目的

第一版の実在管理データから日本語・英語のproduction公開データと静的サイトを決定論的に生成し、GitHub Pagesへ手動デプロイする手順、初回公開記録、再実行・復旧方針を定めます。公開後も修正PRまたはrevertをマージし、同じworkflowを手動実行して更新・復旧できます。

## 現在状態

| 項目             | 状態                                                      |
| ---------------- | --------------------------------------------------------- |
| 公開日           | 2026-08-04                                                |
| 正式URL          | <https://madoguchi.kokoromimamori.na0aaooq.com/>          |
| Source           | GitHub Actions                                            |
| Custom domain    | `madoguchi.kokoromimamori.na0aaooq.com`                   |
| DNS check        | successful                                                |
| HTTPS証明書      | 発行済み                                                  |
| Enforce HTTPS    | 有効                                                      |
| workflow         | `Deploy production site to GitHub Pages`                  |
| トリガー         | `workflow_dispatch`のみ                                   |
| 初回成功実行     | 2026-08-04のworkflow実行 #2                               |
| 公開対象コミット | `cf033acd5034aa9163f9a8ba8d41f9e6a1ed66f4`                |
| 公開後の手動確認 | 正式URLで画面、リンク、アセット、404、sitemap等を確認済み |

GitHubの`Static HTML > Configure`は使用せず、本リポジトリの`.github/workflows/deploy-pages.yml`だけを使用します。`CNAME`ファイルも使用しません。

## 初回公開記録

2026年8月4日のworkflow実行 #2でbuildとdeployが成功しました。対象コミットは`cf033acd5034aa9163f9a8ba8d41f9e6a1ed66f4`です。公開後、正式URLでルート言語選択、日本語・英語トップ、日英の公開中2分野、3カード、14案内先、全団体・案内先一覧、プライバシーポリシー、問い合わせ導線、404、11 URLの`sitemap.xml`、CSS、文字サイズ、内部・外部リンク、HTTPS、カスタムドメインを手動確認しました。

## production成果物の生成

対象環境はNode.js `24.18.0`、npm `11.16.0`です。依存関係を準備し、本番用管理データを検証してから、基準日を明示して日英の公開データを生成します。

```sh
node --version
npm --version
npm ci
npm run validate:data
npm run generate:public -- --as-of 2026-08-04
npm run validate:public
npm run verify:public
```

公開データは次の2ファイルです。日英を一組として生成し、直接編集しません。

- `dist/public-data/production/ja/navigation.json`
- `dist/public-data/production/en/navigation.json`

続けてproduction静的サイトを生成します。

```sh
npm run generate:site:production
npm run validate:site
npm run verify:site
npm run check
```

生成先は`dist/site/production/`です。生成処理は一時ディレクトリで全ファイルを生成・検証し、成功後だけディレクトリ単位で置換します。失敗時は既存成果物を保持し、古いファイルを残しません。

## 正式URLとbase path

正式なproduction base URLは次のカスタムドメインです。

```text
https://madoguchi.kokoromimamori.na0aaooq.com
```

base pathはURLのルート`/`です。設定は`site/production.json`へ集約しています。HTMLの内部リンク、CSS・JavaScript、ルートページ、404、sitemapはこの設定から生成します。GitHub Pages標準プロジェクトURLは正式base URLとして使用しません。

将来別のドメインまたはパスへ変更する場合は、`site/production.json`の`base_url`だけを変更し、productionサイトを再生成して差分をPRで確認します。workflowは`actions/configure-pages`が返す`base_url`とGit管理中の設定を末尾スラッシュだけ正規化して比較し、不一致ならartifactのアップロード前に停止します。

## ローカル確認

```sh
npm run generate:site:production
npm run serve:site:production
```

ブラウザで次を確認します。

- ルート言語選択: <http://127.0.0.1:4173/>
- 日本語トップ: <http://127.0.0.1:4173/ja/>
- 英語トップ: <http://127.0.0.1:4173/en/>
- 404: <http://127.0.0.1:4173/404.html>
- sitemap: <http://127.0.0.1:4173/sitemap.xml>

公開中の2分野、3カード、全団体・14案内先、日英のプライバシーポリシー、言語別問い合わせリンク、内部リンク、外部リンク属性、CSS、文字サイズを確認します。390px、768px、デスクトップ幅、キーボードフォーカス、JavaScript無効時の主要情報、ブラウザコンソールも確認します。外部の案内先へ自動アクセスする必要はありません。

## 手動workflowの実行

`.github/workflows/deploy-pages.yml`のトリガーは`workflow_dispatch`だけです。push、pull request、scheduleによる自動デプロイはありません。workflowは次の公式Actionを使用します。

- `actions/checkout@v6`
- `actions/setup-node@v6`
- `actions/configure-pages@v6`
- `actions/upload-pages-artifact@v4`
- `actions/deploy-pages@v4`

`actions/checkout@v6`には`fetch-depth: 0`を設定し、`npm run check`が参照する既存MarkdownのPrettier基準コミットを含む全Git履歴を取得します。記載するActionバージョンは、現在のworkflowファイルと一致させます。

PRをマージした後、利用者が次を実行します。

1. Repository Settings > Pagesを開き、Sourceが`GitHub Actions`であることを確認する
2. Custom domainが`madoguchi.kokoromimamori.na0aaooq.com`、DNS checkがsuccessfulであることを確認する
3. HTTPS証明書が発行済みで、Enforce HTTPSが有効であることを確認する
4. Actionsを開く
5. `Deploy production site to GitHub Pages`を選ぶ
6. `Run workflow`から`main`を手動実行する
7. buildで`npm ci`、`npm run check`、Pages base URL一致確認、artifact uploadが成功したことを確認する
8. deployジョブが成功したことを確認する
9. workflowに表示される`page_url`を開く

アップロード対象は`dist/site/production`だけです。リポジトリ全体、管理用`data/`、Schema、テスト、文書、実在TSVはPages artifactへ含めません。

## 公開後の確認

`page_url`と正式URLで最低限次を確認します。初回公開時はすべて確認済みです。

1. ルートの言語選択ページ
2. 日本語・英語トップ
3. 日英それぞれの公開中2分野
4. 3カードと14案内先
5. 全団体・案内先一覧
6. 日英プライバシーポリシー
7. 日本語問い合わせURLと英語問い合わせURLの分離
8. 外部リンクの新しいタブと安全な`rel`
9. 存在しないパスで日本語・英語併記の404が表示されること
10. `https://madoguchi.kokoromimamori.na0aaooq.com/sitemap.xml`に11 URLがあること
11. CSS、文字サイズ、内部リンク、モバイル表示、キーボード操作

## 初回失敗と修正

2026年8月4日のworkflow実行 #1は、`npm run check`内の`format:check`で失敗しました。Prettierの既存Markdown基準コミット`f9ea011`を`git ls-tree`で参照できず、`actions/checkout`の浅い履歴によって必要な過去コミットを取得していなかったことが原因です。

[PR #13](https://github.com/na0AaooQ/madoguchi-mimamori-for-official-info/pull/13)で`actions/checkout@v6`へ`fetch-depth: 0`を追加し、全Git履歴を取得する回帰テストを追加しました。修正を含む最新`main`からworkflow実行 #2を新規実行し、buildとdeployが成功しました。

## workflowの新規実行とRe-run

- コードや文書を修正して`main`へ新しいコミットをマージした場合は、最新`main`を選び、新しい`Run workflow`を実行する
- 同じコミットを、一時的なGitHub側障害などを理由に再試行する場合は、`Re-run`を使用してよい
- 古い失敗実行を`Re-run`しても、新しい`main`の修正は取り込まれない

## 再デプロイと復旧

問題がある場合は、生成成果物を直接編集せず、管理データ・Locale・生成処理を修正するPRを作成します。修正PRをマージ後、最新`main`から新しい`Run workflow`を実行します。

直前の変更を取り消す場合は、対象PRをrevertするPRを作成してマージし、workflowを再実行します。workflow失敗時はGitHub Pagesへ新しいartifactがデプロイされないため、エラーを修正してから再実行します。

## Node.js 20非推奨警告

workflow実行 #2では、GitHub Actions画面にNode.js 20非推奨に関する非ブロッキング警告が2件表示されました。build、deploy、production公開は成功し、workflowでアプリを実行するNode.jsは`24.18.0`です。警告元のActionは確認できていないため推測で断定せず、今回Actionバージョンは変更しません。

この対応は`deferred`です。再検討条件は[公開後バックログのBL-018](POST_LAUNCH_BACKLOG.md#bl-018-github-actionsのnodejs-20非推奨警告)を参照してください。

## CNAMEとDNS

リポジトリへ`CNAME`ファイルを追加しません。カスタムドメインはRepository Settings側で管理します。GitHubのStatic HTMLテンプレートworkflowも追加しません。

別のカスタムドメインへ変更する場合は、GitHub Pages側の設定、`site/production.json`、DNS、再生成成果物を同じ公開先として整合させます。DNSのCNAME値は`na0aaooq.github.io`であり、リポジトリ名を含めません。DNS変更やカスタムドメイン設定はコード変更とは別工程です。

## 関連文書

- [公開後バックログ](POST_LAUNCH_BACKLOG.md)
- [サイト構成](SITE_STRUCTURE.md)
- [運用方針](OPERATIONS_POLICY.md)
