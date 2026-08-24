# まどぐちみまもり｜公的機関・関係団体の公式情報案内 (英語表記: Madoguchi Mimamori｜Guide to Official Information from Public Institutions and Related Organizations)

「まどぐちみまもり」は、災害時などに確認したい内容から担当する公的機関・関係団体を見つけ、その団体自身の公式発表へ進むための案内サイトです。行政機関が運営する公式サイト、速報サイト、情報の真偽判定サービスではありません。

## 現在の開発・公開状況

| 項目               | 状況                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 開発段階           | 第一版を2026年8月4日に正式公開済み                                                                                                   |
| 正式URL            | <https://madoguchi.kokoromimamori.na0aaooq.com/>                                                                                     |
| 第一版公開時       | 日本語・英語、2分野、3カード、14案内先、production静的サイト18ファイル                                                               |
| リポジトリ内成果物 | production静的サイト39ファイル（通常31ページ、404 1ページ、HTML32件、CSS・JavaScript 2件、正式アイコン3件、OGP画像1件、sitemap 1件） |
| ホスティング構成   | GitHub Pages、カスタムドメイン、HTTPS有効                                                                                            |
| デプロイ           | GitHub Pagesの手動workflowで公開。PR #31を2026年8月9日にマージし、本番デプロイ・公開後確認済み                                       |

本リポジトリには、初期設計文書、ローカル品質管理基盤、架空preview Web画面MVP、TSV変換基盤、実在管理データを整備しています。管理JSONには、地域4件、団体9件、案内先40件、確認根拠67件、案内カード13件、カード案内先関連40件を登録しています。案内先と確認根拠は、人が確認した内容を管理JSONへ反映しています。

リポジトリ内では5分野と対象データをpublishedとし、実在管理データから日英のproduction公開データと39ファイルの静的サイトを生成します。production成果物は熊本県と千葉県の2地域、13カード、40案内先を扱い、全国トップから各地域へ進む構成です。正式URLで現在公開中なのは、PR #31で反映した熊本県地域の5分野、8カード、24案内先です。千葉第一公開単位はPRのマージ後に手動workflowで反映します。既存の架空preview成果物は、画面と生成基盤の確認専用として分離しています。

第一版公開後の改善、継続運用、将来構想は[公開後バックログ](docs/POST_LAUNCH_BACKLOG.md)で管理します。

## 目的

> 災害時などに、対象地域の状況を確認したい方や、地域外から支援したい方が、確認したい情報を担当する公的機関・関係団体を見つけ、その団体自身の公式発表へ速やかに到達できるよう支援する。

## 背景

令和8年熊本地震を契機として、災害時には公式情報を発信する機関が分散し、所管や公式SNSを見分けにくいこと、検索結果に非公式・古い・転載情報が混在することなどの課題を確認しました。情報量が多すぎる場合も、必要な情報へ到達しにくくなります。

本サイトは情報そのものを集約・転載するのではなく、利用目的と担当機関を結び付ける「案内地図」を目指します。詳しくは[プロジェクト背景](docs/PROJECT_BACKGROUND.md)を参照してください。

## 基本方針

- 完全無料、広告・アフィリエイトなし、ログイン・アカウント登録不要とする
- 閲覧だけで利用でき、新サイト内に利用者向け入力フォームを設けない
- 公式情報への入口を案内し、現在状況や公式発表を転載しない
- 情報の真偽判定、信頼度の採点、ランキング、AIによる要約や判断を行わない
- Web検索、クローリング、スクレイピング、RSS、外部APIなどによる自動取得を行わない
- 人による公式性確認と定期点検を前提とする
- スマートフォン・タブレットを優先し、JavaScriptなしでも主要な案内を利用できるようにする
- 網羅性よりも、迷わず到達できることと継続して確認できる範囲を優先する

掲載順や掲載可否が、広告料、協賛、寄付などによって変更されることはありません。詳細は[設計原則](docs/DESIGN_PRINCIPLES.md)と[情報掲載方針](docs/INFORMATION_LISTING_POLICY.md)に記録しています。

## 現在の対象地域

- 熊本県全域に関係する主要情報
- 熊本県
- 熊本市
- 国が提供する主要な災害・気象・河川・道路情報
- 熊本県内の生活、安全、移動に直接関係する公共性の高い事業者
- 千葉県
- 千葉市

熊本市以外の各市町村は、第一版では個別情報を網羅しません。これは未掲載の市町村や団体を評価するものではなく、公式性の確認方法や更新方法を確立し、継続確認可能な範囲を守るための段階的な判断です。

## 現在提供するもの

- 知りたい目的から担当する公的機関・関係団体を探す導線
- 団体自身の公式サイト、確認できた公式SNSなどへの案内
- 案内先確認日と公式情報確認日の表示
- サイトの目的、利用上の注意、免責事項、掲載・表示順に関する注意の説明

公式性の確認根拠は管理データと内部検証に使用し、現在のproduction HTMLには根拠の説明や根拠URLを表示しません。災害・出来事データを使う専用の期間限定案内機能は未実装です。一方、個別Sourceとして期間限定の公式案内を人が確認して掲載する場合があり、自動終了・自動判定は行いません。確認・更新履歴の利用者向け公開は将来検討です。

## 提供しないもの

- 速報、現在の災害・避難・停電・断水・運行・道路・診療などの状況転載
- AIによる要約、真偽判定、団体の評価・ランキング・推奨順位
- 自動収集、外部API、クローリング、スクレイピング、RSS取得
- 非公式情報、目撃情報、行方不明者・安否不明者・被災者個人などの情報
- 個別制度の条件、金額、期限、口座番号や、非公式な寄付・募集への直接案内

状況の変化が速い情報を転載すると、古い情報が残り、公式発表と誤認されるおそれがあります。本サイトが継続的な正確性を保証することはできないため、リンク先の公式情報をご確認いただく設計とします。

## 主な情報分野

将来は、約17のまとまりを次の5分野に整理する設計です。5分野そのものは現在のproductionで公開済みで、未公開の分野はありません。

1. 公的機関・防災全般
2. 命・安全・医療
3. ライフライン
4. 道路・交通
5. 支援・復旧

BL-006-B「道路・交通」は2026年8月7日に公開済みです。BL-006-C「支援・復旧」は、第一公開単位の熊本市「住家のり災証明書」を2026年8月8日、第二公開単位の熊本県「令和8年熊本地震に係る義援金」と第三公開単位の防衛省・自衛隊「災害派遣について」を2026年8月9日に公開済みです。BL-006-A「命・安全・医療」は、熊本市「救急医療体制」日英と「救急安心センター事業（#7119）」日本語を2026年8月9日に公開済みです。第一版以降の掲載候補は[情報掲載方針](docs/INFORMATION_LISTING_POLICY.md)に記載しています。今後のカード数は固定しません。

## 現在のproductionページ構成

1. ルートの言語選択ページ
2. 日本語・英語トップページ
3. 日本語・英語の地域トップ、地域別分野ページ、地域別の全団体・案内先一覧
4. 日本語・英語のプライバシーポリシー
5. 404ページ
6. `sitemap.xml`

全国トップは公開中の都道府県一覧を表示し、地域トップ以下の分野・団体一覧は対応する地域成果物から動的に生成します。リポジトリ内のproduction成果物では、熊本県地域の5分野と千葉県地域の4分野を公開対象としています。千葉第一公開単位は、手動workflowによるproduction反映前です。

今後production成果物の変更をGitHub Pagesへ反映する場合は、PRのマージ後に手動デプロイが必要です。
サイトの目的、利用上の注意、免責事項はトップページなどの`details`内で案内します。問い合わせは独立したサイト内ページを設けず、言語別の外部ポートフォリオ問い合わせページへ案内します。掲載方針と確認・更新履歴の独立HTMLページは将来検討であり、現在のproductionには存在しません。

情報設計と各ページの役割は[サイト構成](docs/SITE_STRUCTURE.md)を参照してください。

## 技術方針

第一版は静的HTML・CSS中心を想定し、JavaScriptへの依存を最小限にします。JavaScriptなしでも主要リンクを利用可能とし、AI、外部API、自動取得、新サイト内の入力フォームは使用しません。第一版から日本語・英語へ対応し、管理データの正本にはJSONを採用します。言語共通のcoreと日英localeを分離し、検証済みの公開対象だけから成果物を生成します。

地域・団体・案内先・確認根拠・分野・案内カード・カードと案内先の関連について、coreとlocaleに対応するSchemaと意味検証を実装しています。公開生成は、架空fixtureからのpreviewと、第一版の実在管理データからのproductionを分離し、日英の`navigation.json`を決定論的に生成します。静的サイト生成もpreview・productionを分離し、JavaScriptなしでも主要情報とリンクを利用できます。productionの正式URLは<https://madoguchi.kokoromimamori.na0aaooq.com/>です。GitHub Pagesの手動workflowから公開し、カスタムドメインとHTTPSを使用しています。詳しくは[公開データ契約](docs/PUBLIC_DATA_CONTRACT.md)、[Web画面preview MVP](docs/WEB_UI_PREVIEW_MVP.md)、[GitHub Pages手動デプロイ](docs/GITHUB_PAGES_DEPLOYMENT.md)を参照してください。

## 品質管理

Node.js `24.18.0`とnpm `11.16.0`を対象環境として固定しています。依存関係を`npm ci`で準備した後、`npm run validate:data`で本番用データ基盤を検証できます。
`npm run check`でLint、書式、629件のテスト、fixture、文書、管理データ、公開データ、preview・productionサイト、再現性をまとめて確認できます。
2026年8月4日の第一版公開時、2026年8月7日のBL-006-B公開後、2026年8月8日のBL-006-C第一公開単位公開後、および2026年8月9日のBL-006-C第二・第三公開単位とBL-006-A第一公開単位公開後の確認で`npm run check`は成功しています。
詳しくは[品質管理基盤](docs/QUALITY_TOOLING.md)を参照してください。

## Development

開発作業を行う場合は、以下の開発ルールを確認してください。

- [開発作業標準フロー 管理ルール](docs/DEVELOPMENT_PROCESS_RULES.md)

## サイト公開データの作成手順

Googleスプレッドシートの`03_団体`から`08_地域`までの6シートを個別にTSV出力し、指定名へ変更します。Gitは空ディレクトリを管理しないため、リポジトリルートで入力ディレクトリを作成して6ファイルを配置します。

```sh
mkdir -p imports/management
```

配置後、最初に検査だけを行います。Googleスプレッドシートから出力したTSVの引用符を手作業で変更する必要はありません。

```sh
npm run data:import:tsv -- \
  --input-dir imports/management \
  --data-updated-on YYYY-MM-DD \
  --check
```

検査が成功した後だけ、Core、日本語locale、英語localeの管理JSON 18ファイルへ書き込みます。

```sh
npm run data:import:tsv -- \
  --input-dir imports/management \
  --data-updated-on YYYY-MM-DD \
  --write
```

書込み後は検証と差分確認を行います。

```sh
npm run validate:data
npm run check
git status --short
git diff -- data/
```

この処理は、スプレッドシートに人が入力した値の型変換と検証だけを行います。公式性、公開可否、確認状態、確認日を自動判断・自動変更しません。実在TSVはGit管理しないでください。出力方法、ファイル名、変換規則、エラー、書込み安全性の詳細は[管理TSVからJSONを生成する手順](docs/MANAGEMENT_TSV_IMPORT.md)を参照してください。この手順だけでproduction生成やデプロイが行われることはありません。

## 公開用ナビゲーションデータ生成MVPの確認手順

### 前提環境

対象環境はNode.js `24.18.0`、npm `11.16.0`です。nvmを利用できる場合は、リポジトリルートで次を実行します。

```sh
nvm use
node --version
npm --version
npm ci
```

`.nvmrc`から対象Node.jsを選び、`node --version`が`v24.18.0`、`npm --version`が`11.16.0`であることを確認してください。対象外のバージョンでは`npm ci`などで`engines`警告が出る可能性があります。警告が出た場合は対象環境での検証済みとは扱わず、実使用バージョンを記録してください。

### preview成果物を生成する

```sh
npm run generate:public:preview
```

このコマンドは`tests/fixtures/public-generation/preview/`のpublished架空fixtureだけを入力にし、manifestの基準日`2026-08-02`で次の2ファイルを生成します。

- `dist/public-data/preview/ja/navigation.json`
- `dist/public-data/preview/en/navigation.json`

本番用`data/`は読み込みも変更もせず、日英2ファイルを一組として生成します。成果物は`fictional-preview`であり実在情報ではありません。`navigation.json`を直接編集してはいけません。

### 生成内容を確認する

macOSのFinderまたは任意のテキストエディタで日英JSONを開き、次を確認します。ターミナルでは次の差分確認も利用できます。

```sh
git status --short
git diff -- dist/public-data/preview/ja/navigation.json
git diff -- dist/public-data/preview/en/navigation.json
```

- `artifact_type`が`fictional-preview`である
- `locale`がファイルの`ja`または`en`と一致する
- `generated_for_date`が`2026-08-02`である
- 5分野があり、最初の分野だけに架空カード1件がある
- 残り4分野の`cards`が空配列である
- `display_order`、`evidence`、`internal_note`、公開状態などの管理項目がない
- `visibility_context`は存在するが、画面へそのまま表示する文言ではない
- URLは予約ドメイン`example.invalid`の架空URLである

### 公開成果物を検証する

```sh
npm run validate:public
```

正常時の最終行は`Summary: Error 0, Warning 0, Info 0, Total 0`です。Git管理中のpreview・production日英成果物が公開Schemaを満たし、禁止項目がなく、それぞれのURL安全条件を満たすことを読取専用で確認します。

### 再現性を確認する

```sh
npm run verify:public
```

preview fixtureとproduction管理データからOSの一時領域へ日英成果物を再生成し、Git管理中の各成果物とバイト単位で比較します。tracked artifactは変更しません。正常時は`Summary: Error 0, Warning 0, Info 0, Total 0`です。手編集や入力変更後の生成忘れは`PUB-E006`で停止します。

### 全体検証

```sh
npm run check
```

Lint、書式、全テスト、fixture、文書、管理データの検証に加え、`validate:public`と`verify:public`を順に実行します。生成系コマンドは書込処理のため`check`には含めません。

### production公開データを生成する

```sh
npm run generate:public -- --as-of 2026-08-09
```

正本siteは`published`です。このコマンドは実在管理データから全国トップと地域別の日英`dist/public-data/production/{ja,en}/navigation.json`、`regions/{region_slug}/navigation.json`を生成します。基準日は必須で、現在日時を自動採用しません。生成後は`npm run validate:public`と`npm run verify:public`を実行してください。

### 成果物を変更するときの基本手順

1. 正本データ、fixture、生成処理の必要箇所を修正する
2. `navigation.json`は直接編集しない
3. `npm run generate:public:preview`を実行する
4. `git diff`で日英成果物を確認する
5. `npm run validate:public`を実行する
6. `npm run verify:public`を実行する
7. `npm run check`を実行する
8. 正本と生成成果物を同じPRでレビューする

`dist/public-data/`内では正式な日英`navigation.json`だけをGit管理し、履歴、透明性、画面へ渡る内容のレビューに利用します。previewとproductionは分離し、その他の一般的な`dist`成果物、一時生成物、ログ、バックアップは管理しません。差分が不正な場合は、成果物を手編集せず正本・fixture・生成処理を修正して再生成してください。

## 架空preview Web画面MVPの確認手順

前提環境と`npm ci`は上記と同じです。公開案内情報は`dist/public-data/preview/{ja,en}/navigation.json`、画面生成元は`site/`、生成成果物は`dist/site/preview/`にあります。

### ローカルで画面を表示する

リポジトリのルートディレクトリで、画面を生成してローカルHTTPサーバーを起動します。

```sh
npm run generate:site:preview
npm run serve:site:preview
```

`Preview site: http://127.0.0.1:4173/preview/ja/`と表示されたら、サーバーを起動したターミナルはそのままにして、ブラウザで次のURLを開きます。

- 日本語：<http://127.0.0.1:4173/preview/ja/>
- 英語：<http://127.0.0.1:4173/preview/en/>

確認を終了するときは、サーバーを起動したターミナルで`Control+C`を押します。

生成HTMLは`/preview/`から始まるルート相対パスでCSSとJavaScriptを参照します。そのため、`dist/site/preview/ja/index.html`などを`file://`で直接開かず、必ず上記のローカルHTTPサーバー経由で確認してください。

### 生成成果物を検証する

別のターミナルをリポジトリのルートディレクトリで開き、次を実行します。

```sh
npm run validate:site
npm run verify:site
npm run check
```

ブラウザでは、320pxから1280px以上、標準・大文字、文字200%・ページ400%、CSS・JavaScript無効、キーボード、日英切替、カードあり・なし、全団体一覧、プライバシーポリシー、長いURLを確認してください。詳細は[Web画面preview MVP](docs/WEB_UI_PREVIEW_MVP.md)に記載しています。

生成HTMLを直接編集してはいけません。画面変更時は、公開データの正本、`site/locales/`、テンプレート、`site/assets/`を修正し、生成・差分確認・validate・verifyを行います。生成元と`dist/site/preview/`を同じPRでGit管理します。このpreview成果物は架空データ専用であり、実在管理データを入力とするproduction成果物とは分離します。

## production静的サイトの確認手順

```sh
npm run generate:site:production
npm run validate:site
npm run verify:site
npm run serve:site:production
```

ローカルでは<http://127.0.0.1:4173/>を開きます。production成果物は`dist/site/production/`にあり、ルート言語選択、日英全国トップ、熊本県・千葉県の地域トップ・published分野・全団体・案内先一覧、プライバシーポリシー、`404.html`、`sitemap.xml`を含みます。GitHub Pagesへの反映は、対象更新日に対応する基準日を明示して生成・確認した後、手動workflowで行います。正式base URL、手動workflow、公開後確認、再デプロイは[GitHub Pages手動デプロイ](docs/GITHUB_PAGES_DEPLOYMENT.md)を参照してください。

## 運用方針

常設主リンクは原則週1回、補助リンクは原則月1回、人が確認します。災害・出来事データを使う専用の期間限定案内機能は未実装ですが、個別Sourceとして期間限定の公式案内を人手確認のうえ掲載する場合があります。自動終了・自動判定は行いません。「案内先確認日」はURL、公式性、案内目的などを確認した日であり、リンク先の全内容や現在状況の正確性を保証する日ではありません。詳しくは[運用方針](docs/OPERATIONS_POLICY.md)を参照してください。

## お問い合わせとプライバシー

新サイト内に問い合わせフォームは設けず、既存の[ポートフォリオサイトのお問い合わせページ](https://portfolio.na0aaooq.com/contact.html)へ案内します。問い合わせは任意であり、外部ページでは名前またはハンドルネーム、メールアドレス、問い合わせ本文などの入力が必要です。ポートフォリオサイト側のプライバシーポリシーが適用されます。

新サイトのホスティングにはGitHub Pagesを使用し、カスタムドメインとHTTPSを有効にしています。productionではGoogle Analytics 4の標準的な静的`gtag.js`タグを使用し、測定IDは`site/production.json`で一元管理します。ページビューと外部サイトへの離脱クリックだけを利用し、独自イベント、Googleタグマネージャー、広告関連機能、Googleシグナル、User-IDは追加しません。previewにはタグを出力しません。Google Analytics 4はCookieを使用しますが、運営者独自のアクセス解析システムとlocalStorageは使用しません。文字サイズは`sessionStorage`へ`standard`または`large`だけを保存します。詳細と計測を希望しない場合の方法は日英のプライバシーポリシーおよび[ADR 0025](docs/decisions/0025-adopt-minimal-ga4-analytics-for-production.md)を参照してください。

## ドキュメント

- [ドキュメント目次](docs/README.md)
- [プロジェクト背景](docs/PROJECT_BACKGROUND.md)
- [設計原則](docs/DESIGN_PRINCIPLES.md)
- [情報掲載方針](docs/INFORMATION_LISTING_POLICY.md)
- [サイト構成](docs/SITE_STRUCTURE.md)
- [運用方針](docs/OPERATIONS_POLICY.md)
- [公開後バックログ](docs/POST_LAUNCH_BACKLOG.md)
- [データモデル](docs/DATA_MODEL.md)
- [データフィールド定義](docs/DATA_FIELDS.md)
- [日英対応方針](docs/LOCALIZATION_POLICY.md)
- [データ検証・公開生成方針](docs/DATA_VALIDATION_AND_PUBLICATION.md)
- [公開データ契約](docs/PUBLIC_DATA_CONTRACT.md)
- [Web画面preview MVP](docs/WEB_UI_PREVIEW_MVP.md)
- [GitHub Pages手動デプロイ](docs/GITHUB_PAGES_DEPLOYMENT.md)
- [データSchema実装](docs/DATA_SCHEMA_IMPLEMENTATION.md)
- [管理TSVからJSONを生成する手順](docs/MANAGEMENT_TSV_IMPORT.md)
- [品質管理基盤](docs/QUALITY_TOOLING.md)
- [開発工程](docs/DEVELOPMENT_PHASES.md)
- [設計判断記録](docs/decisions/README.md)

## ライセンス

本リポジトリは[MIT License](LICENSE)の下で提供されます。リンク先となる各団体の名称、情報、Webサイト等には、それぞれの権利・利用条件が適用されます。
