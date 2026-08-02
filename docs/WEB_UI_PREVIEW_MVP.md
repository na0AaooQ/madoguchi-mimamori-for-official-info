# Web画面preview MVP

## 目的と範囲

Git管理中の`fictional-preview`公開データから、日本語・英語の完成済み静的HTMLを生成します。実在情報、production画面、AWS、ホスティング、デプロイは対象外です。ブラウザは主要表示のために`navigation.json`を取得せず、JavaScriptが無効でも説明、分野、カード、団体、案内先を利用できます。

## 入力と生成元

公開案内情報の唯一の入力は次の2ファイルです。管理用`data/`を画面生成から直接参照しません。

- `dist/public-data/preview/ja/navigation.json`
- `dist/public-data/preview/en/navigation.json`

画面固有文言は`site/locales/{ja,en}.json`、共通CSSと補助JavaScriptは`site/assets/`で管理します。画面用localeは固定構造、日英同一キー、必須文言、想定外キー、生HTML禁止を検証します。団体名、カード、案内先は画面用localeへ重複させません。

`dist/site/preview/`は生成成果物であり、直接編集しません。入力、画面用locale、テンプレート、CSSソース、JavaScriptソースを変更して再生成します。

## URLと成果物

- `/preview/{ja,en}/`
- `/preview/{ja,en}/sections/{anchor_id}/`
- `/preview/{ja,en}/organizations/`
- `/preview/{ja,en}/privacy/`
- `/preview/assets/styles.css`
- `/preview/assets/font-size.js`

section数は固定せず、日英`navigation.json`の対応する`sections`から期待ページを導出します。現在は日本語8ページ、英語8ページ、共通アセット2件の合計18ファイルです。

## データ変換

分野画面の`role`は`primary`、`temporary-highlight`、`secondary`の順に、画面用localeの利用者向け見出しへ変換します。`visibility_context`は`always`、`normal`、`disaster`を利用者向けの利用場面へ変換し、現在状況の判定には使用しません。

全団体一覧では、団体を`organization.id`、案内先を`destination.id`で初出順に重複排除します。対象地域も初出順に重複排除し、同じ案内先の利用場面は規定の集合規則で集約します。`role`は一覧へ表示しません。

案内先の3分類は次の明示的な変換表を使用します。未対応値は生成を停止し、その他へ推測分類したり黙って除外したりしません。

| 利用者向け分類                   | `source_type`                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| 公式サイト                       | `official-homepage`                                                                         |
| 公式情報ページ                   | `information-page`、`disaster-page`、`service-page`、`search-service`、`consultation-guide` |
| 公式発信元アカウント・チャンネル | `social-account`、`messaging-service`、`email-service`                                      |

英語版の`official-ja-fallback`は日本語正式名称を変更せず`lang="ja"`で表示し、公式英語名称を本サイトで確認できていない旨を添えます。画面言語が`destination_locales`にない場合は、公開データの`destination_language_note`を表示します。必要な注意文がない場合は生成を停止します。

## preview安全性

すべての画面で主要コンテンツより前に架空preview注意を表示します。`artifact_type`が`fictional-preview`でなければ生成しません。架空の案内先URLと問い合わせURLはコピー可能な通常テキストとし、リンクにしません。例外として、プライバシーポリシーの運営者名だけを、許可された`portfolio.na0aaooq.com`のプロフィールへ別タブで移動する外部リンクにします。

すべてのHTMLに`noindex, nofollow, noarchive`を設定します。これは検索エンジンへの指示であり、アクセス制御や非公開を保証するものではありません。

## 文字サイズとプライバシー

標準本文は`1.125rem`、大サイズはルート文字サイズを125%にします。操作領域はJavaScript初期化後だけ表示し、標準HTMLのボタン、`aria-pressed`、枠、背景、フォーカス表示で状態を示します。

補助JavaScriptが`sessionStorage`へ保存するのは`standard`または`large`だけです。Cookieと`localStorage`を使用せず、団体名、閲覧ページ、URL、検索内容、閲覧履歴、個人情報を保存・送信しません。保存機能が例外を投げても標準表示を維持します。

プライバシーポリシー本文は画面用localeで管理し、制定日は日英とも2026年8月3日の固定文言です。公開環境が未決定のため、アクセスログが一切記録されないとは断定しません。本番前にログ項目、目的、保存期間、閲覧可能者を確認してproduction用文面へ反映します。

## 生成・検証

```sh
npm run generate:site:preview
npm run validate:site
npm run verify:site
```

生成は日英入力と全成果物を一時ディレクトリで検証してから一組として置換します。失敗時は既存成果物を維持し、古いsectionページを残しません。`validate:site`はファイル集合、基本HTML契約、内部リンク、preview注意、robots、外部リンクの許可範囲を読取専用で確認します。`verify:site`はOS一時領域へ再生成し、Git管理成果物とのバイト一致を確認します。

サイト固有の内容違反は`SITE-E001`から`SITE-E006`、引数・読込・書込・内部実行異常は`SITE-RUN-E001`から`SITE-RUN-E004`で報告します。終了コードは既存方針と同じく、正常`0`、内容違反`1`、実行異常`2`です。

## 手動確認

```sh
npm run serve:site:preview
```

`http://127.0.0.1:4173/preview/ja/`と`/preview/en/`を開き、320、360、390、480、768、1024、1280px以上で確認します。日本語・英語のトップ、カードあり・なし分野、全団体一覧、プライバシーポリシーを確認します。

- 標準・大文字、ブラウザ文字200%、ページ400%、長い英語とURLの折返し、横スクロール
- CSS無効、JavaScript無効でも主要内容、内部リンク、`details`と`summary`が利用できること
- Tab順、フォーカス、本本文への移動、Enter・Space、複数カード同時展開、上下の戻る導線
- 同一内容の日英切替、同一タブでの文字サイズ維持、ブラウザ内検索による団体名検索
- 架空URLがクリックできず、運営者名だけが指定プロフィールを別タブで開き、外部フォント、外部ライブラリ、意図しない外部通信がないこと
- 架空preview注意、現在状況を判定しない説明、表示順を推奨としない説明

macOSではVoiceOverを有効にし、ページタイトル、見出し、ランドマーク、本文への移動、言語切替、文字サイズ、`details`と`summary`、日本語名称の言語指定を確認します。これらの確認だけで「WCAG 2.2 AA準拠済み」とは表記しません。
