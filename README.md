# まどぐちみまもり｜熊本県・熊本市の公式情報案内 (英語表記: Madoguchi Mimamori｜Official Information Guide for Kumamoto Prefecture and Kumamoto City)

「まどぐちみまもり」は、災害時などに確認したい内容から担当する公的機関・関係団体を見つけ、その団体自身の公式発表へ進むための案内サイトです。行政機関が運営する公式サイト、速報サイト、情報の真偽判定サービスではありません。

## 現在の開発状況

| 項目             | 状況                           |
| ---------------- | ------------------------------ |
| 開発段階         | 架空preview Web画面MVP実装済み |
| 第一版           | 本番画面・実在情報は未実装     |
| 対応言語         | 日本語・英語                   |
| 公開サイト       | まだ存在しない                 |
| ホスティング構成 | 未確定                         |

本リポジトリには、初期設計文書、ローカル品質管理基盤、本番用データとSchemaの枠組みを整備しています。掲載候補は設計上の対象であり、実在情報を含む本番データ・画面として実装済みまたは公開済みではありません。

現在登録されている地域・団体・案内先・確認根拠・案内カード・案内リンクは、データ構造と参照関係を確認するための架空データです。5分野はサイト自身の分類として登録しています。実在情報の掲載・更新・非公開化・削除手順は、公開用データ生成と架空データによる画面を確認した後に整備します。それまでは実在する団体、URL、災害情報を登録しないでください。

## 目的

> 災害時などに、熊本県内の状況を確認したい方や、地域外から支援したい方が、確認したい情報を担当する公的機関・関係団体を見つけ、その団体自身の公式発表へ速やかに到達できるよう支援する。

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

## 第一版の対象地域

- 熊本県全域に関係する主要情報
- 熊本県
- 熊本市
- 国が提供する主要な災害・気象・河川・道路情報
- 熊本県内の生活、安全、移動に直接関係する公共性の高い事業者

熊本市以外の各市町村は、第一版では個別情報を網羅しません。これは未掲載の市町村や団体を評価するものではなく、公式性の確認方法や更新方法を確立し、継続確認可能な範囲を守るための段階的な判断です。

## 提供するもの

- 知りたい目的から担当する公的機関・関係団体を探す導線
- 団体自身の公式サイト、確認できた公式SNSなどへの案内
- 公式性を確認した根拠、公式性確認日、案内先確認日
- 掲載基準、確認・更新方針、公開可能な更新履歴
- 人が有効性を確認した期間だけ表示する災害別の公式案内

## 提供しないもの

- 速報、現在の災害・避難・停電・断水・運行・道路・診療などの状況転載
- AIによる要約、真偽判定、団体の評価・ランキング・推奨順位
- 自動収集、外部API、クローリング、スクレイピング、RSS取得
- 非公式情報、目撃情報、行方不明者・安否不明者・被災者個人などの情報
- 個別制度の条件、金額、期限、口座番号や、非公式な寄付・募集への直接案内

状況の変化が速い情報を転載すると、古い情報が残り、公式発表と誤認されるおそれがあります。本サイトが継続的な正確性を保証することはできないため、リンク先の公式情報をご確認いただく設計とします。

## 主な情報分野

公開画面では、約17のまとまりを次の5分野に整理する予定です。

1. 公的機関・防災全般
2. 命・安全・医療
3. ライフライン
4. 道路・交通
5. 支援・復旧

支援・復旧は公開画面上で一つのまとまりとして扱います。第一版の掲載候補は[情報掲載方針](docs/INFORMATION_LISTING_POLICY.md)に記載しています。最終的なカード数は、この設計段階では固定しません。

## 第一版のページ構成

1. トップページ
2. 公式団体・公式アカウント一覧
3. このサイトについて・掲載方針
4. 確認・更新履歴
5. お問い合わせ・修正情報

情報設計と各ページの役割は[サイト構成](docs/SITE_STRUCTURE.md)を参照してください。

## 技術方針

第一版は静的HTML・CSS中心を想定し、JavaScriptへの依存を最小限にします。JavaScriptなしでも主要リンクを利用可能とし、AI、外部API、自動取得、新サイト内の入力フォームは使用しません。第一版から日本語・英語へ対応し、管理データの正本にはJSONを採用します。言語共通のcoreと日英localeを分離し、検証済みの公開対象だけから成果物を生成します。

工程3-2Aと工程3-2Bでは、地域・団体・案内先・確認根拠・分野・案内カード・カードと案内先の関連について、coreとlocaleに対応する14 Schemaと意味検証を実装しました。公開用データ生成MVPでは、published架空fixtureから日英の`navigation.json`を決定論的に生成します。Web画面preview MVPでは、その公開JSONだけからJavaScriptなしでも主要情報を利用できる日英静的HTMLを生成します。本番用`data/`は引き続きすべてdraftで、production画面、実在情報、災害・出来事、AWS、デプロイは未実装です。詳しくは[公開データ契約](docs/PUBLIC_DATA_CONTRACT.md)と[Web画面preview MVP](docs/WEB_UI_PREVIEW_MVP.md)を参照してください。

## 品質管理

Node.js `24.18.0`とnpm `11.16.0`を対象環境として固定しています。依存関係を`npm ci`で準備した後、`npm run validate:data`で本番用データ基盤を検証でき、`npm run check`でLint、書式、テスト、fixture、文書、管理データ、公開データ、previewサイト、再現性をまとめて確認できます。詳しくは[品質管理基盤](docs/QUALITY_TOOLING.md)を参照してください。

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

正常時の最終行は`Summary: Error 0, Warning 0, Info 0, Total 0`です。Git管理中のpreview日英成果物が公開Schemaを満たし、禁止項目がなく、URL安全条件を満たし、現在はproduction成果物が存在しないことを読取専用で確認します。

### 再現性を確認する

```sh
npm run verify:public
```

preview fixtureからOSの一時領域へ日英成果物を再生成し、Git管理中のpreviewとバイト単位で比較します。tracked artifactは変更しません。正常時は`Summary: Error 0, Warning 0, Info 0, Total 0`です。手編集やfixture変更後の生成忘れは`PUB-E006`で停止します。

### 全体検証

```sh
npm run check
```

Lint、書式、全テスト、fixture、文書、管理データの検証に加え、`validate:public`と`verify:public`を順に実行します。生成系コマンドは書込処理のため`check`には含めません。

### production生成の現在の期待動作

```sh
npm run generate:public -- --as-of 2026-08-02
```

現在の正本siteは`draft`なので、`PUB-E001`、終了コード`1`で停止し、`dist/public-data/production/`を作りません。これはdraftを誤公開しないための安全動作で、架空fixtureを使うpreview生成とは別のコマンドです。基準日は必須で、現在日時を自動採用しません。

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

生成HTMLを直接編集してはいけません。画面変更時は、公開データの正本、`site/locales/`、テンプレート、`site/assets/`を修正し、生成・差分確認・validate・verifyを行います。生成元と`dist/site/preview/`を同じPRでGit管理します。実在情報、production、AWS、デプロイはこのMVPの対象外です。

## 運用方針

常設主リンクは原則週1回、補助リンクは原則月1回、表示中の期間限定リンクは原則週1回確認します。「案内先確認日」はURL、公式性、案内目的などを確認した日であり、リンク先の全内容や現在状況の正確性を保証する日ではありません。詳しくは[運用方針](docs/OPERATIONS_POLICY.md)を参照してください。

## お問い合わせとプライバシー

新サイト内に問い合わせフォームは設けず、既存の[ポートフォリオサイトのお問い合わせページ](https://portfolio.na0aaooq.com/contact.html)へ案内する予定です。問い合わせは任意であり、外部ページでは名前またはハンドルネーム、メールアドレス、問い合わせ本文などの入力が必要です。ポートフォリオサイト側のプライバシーポリシーが適用されます。

新サイトのホスティング、アクセスログ、アクセス解析、Cookieなどは未確定です。実装構成が決まった段階で、実際の構成に基づいてプライバシー説明を更新します。

## ドキュメント

- [ドキュメント目次](docs/README.md)
- [プロジェクト背景](docs/PROJECT_BACKGROUND.md)
- [設計原則](docs/DESIGN_PRINCIPLES.md)
- [情報掲載方針](docs/INFORMATION_LISTING_POLICY.md)
- [サイト構成](docs/SITE_STRUCTURE.md)
- [運用方針](docs/OPERATIONS_POLICY.md)
- [データモデル](docs/DATA_MODEL.md)
- [データフィールド定義](docs/DATA_FIELDS.md)
- [日英対応方針](docs/LOCALIZATION_POLICY.md)
- [データ検証・公開生成方針](docs/DATA_VALIDATION_AND_PUBLICATION.md)
- [公開データ契約](docs/PUBLIC_DATA_CONTRACT.md)
- [Web画面preview MVP](docs/WEB_UI_PREVIEW_MVP.md)
- [データSchema実装](docs/DATA_SCHEMA_IMPLEMENTATION.md)
- [品質管理基盤](docs/QUALITY_TOOLING.md)
- [開発工程](docs/DEVELOPMENT_PHASES.md)
- [設計判断記録](docs/decisions/README.md)

## ライセンス

本リポジトリは[MIT License](LICENSE)の下で提供されます。リンク先となる各団体の名称、情報、Webサイト等には、それぞれの権利・利用条件が適用されます。
