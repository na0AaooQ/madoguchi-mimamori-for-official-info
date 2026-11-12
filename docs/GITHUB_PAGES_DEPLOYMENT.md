# GitHub Pagesへの手動デプロイ・メンテナンス切り替えと公開後運用

## 目的

第一版の実在管理データから日本語・英語のproduction公開データと静的サイトを決定論的に生成し、GitHub Pagesへ手動デプロイする手順、初回公開記録、再実行・復旧方針を定めます。通常公開は指定コミットのGit管理済み成果物、メンテナンス公開は実行時mainのSorryページを使用します。PRマージだけでは本番公開されません。

2026-11-03の設計・実装方針として、詳細設計v0.6の手動切り替えとSHA指定復旧を採用します。既存のPages Source、カスタムドメイン、DNS、HTTPS、権限および同時実行制御を維持し、新しい外部サービスや復旧SHAの自動保存システムは追加しません。この記載は本番切り替え・復旧の実施記録ではありません。

## 現在状態

以下は既存の公開確認記録です。現在実際に公開されているコミットSHAは、成功したデプロイ実行と公開内容を照合して別途確認します。リポジトリのmain HEADを公開済みの証明として扱いません。

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
| 現在のproduction | 5分野、8カード、24案内先、JAリンク16件、ENリンク15件      |
| 最新公開反映     | PR #31を2026-08-09にマージし、手動Pagesデプロイ成功       |

GitHubの`Static HTML > Configure`は使用せず、本リポジトリの`.github/workflows/deploy-pages.yml`だけを使用します。`CNAME`ファイルも使用しません。

## 初回公開記録

2026年8月4日のworkflow実行 #2でbuildとdeployが成功しました。対象コミットは`cf033acd5034aa9163f9a8ba8d41f9e6a1ed66f4`です。公開後、正式URLでルート言語選択、日本語・英語トップ、日英の公開中2分野、3カード、14案内先、全団体・案内先一覧、プライバシーポリシー、問い合わせ導線、404、11 URLの`sitemap.xml`、CSS、文字サイズ、内部・外部リンク、HTTPS、カスタムドメインを手動確認しました。

PR #31は2026年8月9日にマージされ、BL-006-C第三公開単位とBL-006-A第一公開単位を含むproductionの手動Pagesデプロイと公開後確認が成功しました。現在は5分野、8カード、24案内先を公開しています。

## production成果物の生成

対象環境はNode.js `24.22.3`、npm `11.19.1`です。依存関係を準備し、本番用管理データを検証してから、基準日を明示して日英の公開データを生成します。

```sh
node --version
npm --version
npm ci
npm run validate:data
npm run generate:public -- --as-of 2026-08-09
npm run validate:public
npm run verify:public
```

`--as-of`は実行端末の現在日時ではなく、対象更新日に対応する基準日を人が明示します。PR #31のproduction生成では`2026-08-09`を指定しました。将来は更新内容に対応する基準日へ置き換えます。

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

将来別のドメインまたはパスへ変更する場合は、`site/production.json`の`base_url`だけを変更し、productionサイトを再生成して差分をPRで確認します。今回の切り替えでは公開先設定を変更しません。workflowは`actions/configure-pages`が返す`base_url`と制御用mainの設定を比較し、productionでは指定SHAの設定とも比較します。既存の`check:site:base-url`と同じ`baseUrlsMatch`を標準Node.jsだけで再利用し、不一致ならartifactのアップロード前に停止します。ローカルの既存確認コマンドも引き続き利用できます。

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

リポジトリ内で生成した5分野、8カード、全団体・24案内先、日英のプライバシーポリシー、言語別問い合わせリンク、内部リンク、外部リンク属性、CSS、文字サイズを確認します。production成果物は27ファイル、HTMLは通常19ページと404の計20件、sitemapは19 URLです。390px、768px、デスクトップ幅、キーボードフォーカス、JavaScript無効時の主要情報、ブラウザコンソールも確認します。外部の案内先へ自動アクセスする必要はありません。GitHub Pagesへの反映は、対象更新日に対応する基準日を明示した生成物を手動workflowでデプロイしてからです。

## 手動workflowの実行

`.github/workflows/deploy-pages.yml`のトリガーは`workflow_dispatch`だけです。push、pull request、scheduleによる自動デプロイはありません。workflowは次の公式Actionを使用します。

- `actions/checkout@v6`
- `actions/setup-node@v6`
- `actions/configure-pages@v6`
- `actions/upload-pages-artifact@v4`
- `actions/deploy-pages@v4`

制御側は実行時mainのSHAを`control/`へ、通常公開側は検証済みの指定SHAを`production-source/`へCheckoutします。両方の`actions/checkout@v6`には`fetch-depth: 0`を設定し、main履歴の検証と、過去SHAの`npm run check`が参照する既存MarkdownのPrettier基準コミットを含む全Git履歴を取得します。記載するActionバージョンは、現在のworkflowファイルと一致させます。

Node.jsは両モードとも`24.22.3`です。メンテナンス側を通常サイトのlockfileに依存させないためnpmキャッシュは使用しません。productionだけが指定SHAのディレクトリで`npm ci`と`npm run check`を実行します。制御側にはnpm依存関係を導入しません。

入力条件は次のとおりです。main以外のブランチやタグからの実行、表にないモード・組み合わせはアップロード前に拒否します。

| deploy_mode            | production_sha | 条件                                                          |
| ---------------------- | -------------- | ------------------------------------------------------------- |
| `production`（初期値） | 必須           | 40桁の16進コミットSHA。存在し、実行時mainの履歴に含まれること |
| `maintenance`          | 空欄のみ       | 実行時mainの`maintenance/sorry.html`を使用                    |

`production_sha`はworkflow画面上では任意入力ですが、productionモードでは条件付き必須です。短縮SHA、ブランチ名、SHA前後の空白は使いません。不正入力、指定SHAの検証失敗、公開先不一致、空の成果物では停止し、最新mainへフォールバックしません。

PRをマージした後、利用者が次を実行します。

1. Repository Settings > Pagesを開き、Sourceが`GitHub Actions`であることを確認する
2. Custom domainが`madoguchi.kokoromimamori.na0aaooq.com`、DNS checkがsuccessfulであることを確認する
3. HTTPS証明書が発行済みで、Enforce HTTPSが有効であることを確認する
4. Actionsを開く
5. `Deploy production site to GitHub Pages`を選ぶ
6. 公開する40桁のコミットSHAを確認する。新規更新時はPRマージ後の公開対象コミット、復旧時は事前記録した公開済みSHAを使用する
7. 前のPages実行が完了していることを確認し、`Run workflow`でブランチ`main`、`deploy_mode=production`、`production_sha=公開対象SHA`を指定して新規実行する
8. buildで指定SHAの`npm ci`、`npm run check`、Pages base URL・成果物の安全確認、artifact uploadが成功したことを確認する
9. deployジョブが成功したことを確認する
10. サマリーの制御SHAとコンテンツSHAを確認し、workflowに表示される`page_url`と正式URLで公開後確認を行う

通常公開のアップロード対象は指定SHAの`production-source/dist/site/production`だけです。Git管理済み成果物を上書き再生成しません。ファイル一覧と内容をGitと照合し、未追跡ファイル、変更済みファイル、空ファイル、シンボリックリンク等があれば停止します。メンテナンス公開の対象は`control/dist/site/maintenance`だけです。リポジトリ全体、管理用`data/`、Schema、テスト、文書、実在TSV、もう一方の公開成果物はPages artifactへ含めません。

サマリーとログに公開モード、制御SHA、コンテンツSHA、対象ディレクトリ、検証・アップロード・デプロイ結果を表示します。build成功はデプロイ成功ではありません。deployの結果と実URLの確認を分け、失敗・キャンセル・スキップを成功扱いしません。maintenanceのコンテンツSHAはSorryページを取得したmainのSHAです。

## 公開済みSHAの確認と復旧記録

メンテナンス開始前に、最後に正常公開した通常サイトの40桁SHAをローカルへ控え、対応する成功デプロイ実行と照合します。GitHub Actionsの実行履歴、サマリー、ログと正式URLの表示を確認してください。履歴は例えば次の読み取り専用コマンドで確認できます。

```sh
gh run list --workflow deploy-pages.yml --branch main --status success --limit 10
gh run view RUN_ID --log
```

新方式では実行のHEADは制御SHAであり、復旧に必要なのはproductionの**コンテンツSHA**です。切り替え機能導入前の成功実行は、その実行でCheckoutされたSHAと公開内容を確認します。メンテナンス公開の成功SHAや、単に現在のmain HEADを復旧SHAにしないでください。

記録はリポジトリ外のローカルメモ等で管理し、次の項目を保存します。設計時点の参考SHAを固定値として採用しません。

- 通常公開コンテンツの40桁SHA
- 成功したGitHub Actions実行のURL・番号・日時
- 正式URLで通常サイトを確認した日時
- メンテナンス開始と復旧時の実行記録

これは運営者の手動記録を正本とする運用です。Actionsの実行履歴やサマリーは照合用であり、自動的な復旧先決定には使用しません。

## メンテナンス開始とSorryページ確認

1. 上記の公開済み通常サイトSHAと成功実行を記録・照合する
2. 必要に応じて利用者へ事前案内し、直前のPagesデプロイが完了していることを確認する
3. `Run workflow`でブランチ`main`、`deploy_mode=maintenance`を選び、`production_sha`を空欄にして新規実行する
4. Sorryページ専用検証、生成、公開先・成果物検証、アップロード、deployの各結果を確認する
5. 正式URLのルートで指定した日本語・英語のメンテナンス案内が表示されることを確認する
6. 存在しないURL（例：`/maintenance-check-not-found/`）でも同じ案内が表示されることを確認する
7. スマートフォン・PCで読みやすく、横スクロールや通常サイトの残存表示がないことを確認する
8. サマリーのコンテンツSHAが制御用mainのSHAであることを確認する

唯一の正本は`maintenance/sorry.html`です。`scripts/maintenance/prepare-pages.js`が標準Node.jsだけで文言、HTML・言語・見出し構造、禁止要素を検証し、一時ディレクトリで`index.html`と`404.html`を生成・照合してから`dist/site/maintenance/`へ置換します。過去の余計なファイルは残しません。生成失敗時は既存成果物を保持しますが、workflowは失敗してアップロードへ進みません。生成先は既存の`.gitignore`で除外され、Gitへ追加しません。

メンテナンス公開は通常サイトの`npm ci`・`npm run check`・ビルドを実行せず、通常サイトの依存関係やビルドの失敗から独立します。Sorryページの専用検証は省略しません。外部CSS・JavaScript・画像・フォント、GA4、API通信、Cookie・Web Storage、フォーム、自動転送は含めません。

ローカルでは次のように生成・テスト・表示確認できます。本番デプロイは実行しません。

```sh
node --test tests/unit/maintenance-pages.test.js tests/unit/deploy-pages-workflow.test.js
node --input-type=module -e 'import { prepareMaintenancePages } from "./scripts/maintenance/prepare-pages.js"; await prepareMaintenancePages();'
python3 -m http.server 4174 --bind 127.0.0.1 --directory dist/site/maintenance
```

`http://127.0.0.1:4174/`と`http://127.0.0.1:4174/404.html`を開き、390px・768px・PC幅、日本語・英語、横スクロール、JavaScript無効時、コンソールを確認します。この簡易ローカルサーバーはGitHub Pagesのカスタム404配信を再現しないため、`404.html`を直接確認します。

GitHub Pagesではルートの案内はHTTP 200、存在しないパスのカスタム404はHTTP 404となります。HTTP 503や`Retry-After`を返す仕組みは実装しません。GitHub Pages自体が停止している場合は、この方法でもSorryページを配信できません。切り替えのためにPages Source、カスタムドメイン、DNS、HTTPSの設定を変更しないでください。

## 重複実行と失敗時の扱い

`concurrency: group: pages`、`cancel-in-progress: false`を維持します。ただし、これだけですべての実行順序が厳密に保証されるとは扱いません。運営者1名が、前の実行のbuild・deployが完了してから次を手動実行します。途中の実行がある状態で切り替え・復旧を重ねないでください。

入力・検証・アップロード失敗時は新しいデプロイへ進みません。deployの失敗・キャンセル時は、画面とログで結果を確認し、実URLの公開状態も確認してください。未確認の状態を公開・復旧成功として記録せず、原因を解消して対象モードとSHAを再確認します。検証を省略したり、別のSHAへ自動的に差し替えたりしません。

## 公開後の確認

`page_url`と正式URLで最低限次を確認します。初回公開時の確認に加え、PR #31の本番デプロイ後にも確認済みです。

1. ルートの言語選択ページ
2. 日本語・英語トップ
3. 日英それぞれの全国トップ、熊本県地域トップ、公開中5分野
4. 8カードと24案内先
5. 全団体・案内先一覧
6. 日英プライバシーポリシー
7. 日本語問い合わせURLと英語問い合わせURLの分離
8. 外部リンクの新しいタブと安全な`rel`
9. 存在しないパスで日本語・英語併記の404が表示されること
10. `https://madoguchi.kokoromimamori.na0aaooq.com/sitemap.xml`に19 URLがあること
11. CSS、文字サイズ、内部リンク、モバイル表示、キーボード操作

公開後確認済みの代表URLは次のとおりです。

- `/`
- `/ja/`
- `/en/`
- `/ja/regions/kumamoto/`
- `/en/regions/kumamoto/`
- `/ja/regions/kumamoto/sections/life-safety-medical/`
- `/en/regions/kumamoto/sections/life-safety-medical/`
- `/ja/regions/kumamoto/organizations/`
- `/en/regions/kumamoto/organizations/`
- `/sitemap.xml`

Google Analytics 4を含む変更を公開した場合は、運営者だけがGA4管理画面で次も確認します。ローカル生成・自動テストではGoogle AnalyticsやGoogle公式URLへ接続しません。

1. リアルタイムレポートのpage_view
2. 外部公式リンクのclickイベント、`link_url`、`link_domain`
3. production 404のpage_view
4. `_ga`等のCookie
5. 無効にした拡張イベントが送信されていないこと
6. タグの二重送信がないこと

## 初回失敗と修正

2026年8月4日のworkflow実行 #1は、`npm run check`内の`format:check`で失敗しました。Prettierの既存Markdown基準コミット`f9ea011`を`git ls-tree`で参照できず、`actions/checkout`の浅い履歴によって必要な過去コミットを取得していなかったことが原因です。

[PR #13](https://github.com/na0AaooQ/madoguchi-mimamori-for-official-info/pull/13)で`actions/checkout@v6`へ`fetch-depth: 0`を追加し、全Git履歴を取得する回帰テストを追加しました。修正を含む最新`main`からworkflow実行 #2を新規実行し、buildとdeployが成功しました。

## workflowの新規実行とRe-run

- コードや文書を修正して`main`へ新しいコミットをマージした場合は、最新`main`を選び、新しい`Run workflow`を実行する
- 同じコミットを、一時的なGitHub側障害などを理由に再試行する場合は、`Re-run`を使用してよい
- 古い失敗実行を`Re-run`しても、新しい`main`の修正は取り込まれない

## 再デプロイと復旧

メンテナンス終了後は、前の実行の完了を確認し、最新`main`から新しい`Run workflow`を開きます。`deploy_mode=production`、`production_sha=メンテナンス開始前に記録した公開済みSHA`を指定します。指定SHAのGit管理済み成果物だけを検証・再公開するため、最新mainの未公開変更は混入しません。過去SHAに切り替え機能がなくても、現在の制御用mainが処理します。過去SHAの`npm ci`や`npm run check`に失敗した場合は復旧デプロイを停止し、最新mainへフォールバックしません。

deploy成功後、通常サイトのルート、日本語・英語、主要ページ、静的資産、404等を「公開後の確認」に従って確認し、記録したコンテンツSHAと一致する復旧であることを記録します。現在のNode.jsで検証できないほど古いSHAについても検証を回避せず、原因と対応を確認します。

修正を伴う更新では、生成成果物を直接編集せず、管理データ・Locale・生成処理を修正するPRを作成します。修正PRをマージ後、最新`main`から新しい`Run workflow`を実行し、公開対象SHAを明示します。

ソースの変更自体を取り消す場合は、対象PRをrevertするPRを作成してマージし、その公開対象SHAを指定してworkflowを実行します。公開済みの通常サイトへ戻すだけなら、revertせず記録済みSHAを指定できます。PRマージ、本番切り替え、本番復旧テストはそれぞれ利用者の別途承認後に実施します。

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
