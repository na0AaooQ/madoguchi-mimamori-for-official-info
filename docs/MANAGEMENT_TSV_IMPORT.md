# 管理TSVからJSONを生成する手順

## 目的

Googleスプレッドシート「まどぐちみまもり_掲載情報」で人が入力・確認した値を、既存Schemaに対応する管理JSONへ安全に変換する手順です。変換処理は型変換と検証だけを行い、掲載内容の公式性、公開可否、確認状態、確認日、翻訳内容を自動判断・自動変更しません。

実在TSVはGit管理せず、このリポジトリには架空名称と`example.invalid`だけを使用したテストfixtureを置きます。Google Sheets API、Google Drive API、外部API、Web検索、URLへのアクセス確認は行いません。

## 対象シートとファイル名

対象は次の6シートです。各シートを個別にTSV出力し、ダウンロード後に指定ファイル名へ変更します。

| Googleスプレッドシートのシート | 配置するファイル名         | 管理単位         |
| ------------------------------ | -------------------------- | ---------------- |
| `03_団体`                      | `03-organizations.tsv`     | 団体             |
| `04_案内先`                    | `04-sources.tsv`           | 案内先           |
| `05_確認根拠`                  | `05-evidence.tsv`          | 確認根拠         |
| `06_案内カード`                | `06-cards.tsv`             | 案内カード       |
| `07_カード案内先関連`          | `07-card-source-links.tsv` | カード案内先関連 |
| `08_地域`                      | `08-regions.tsv`           | 地域             |

## TSVを出力して配置する

各シートで次の操作を行います。

1. 対象シートを開く
2. Googleスプレッドシートの「ファイル」から「ダウンロード」を選ぶ
3. 「タブ区切り形式（.tsv、現在のシート）」を選ぶ
4. ダウンロードしたファイルを上表の名前へ変更する
5. リポジトリルートで`mkdir -p imports/management`を実行して入力ディレクトリを作る
6. `imports/management/`へ6ファイルを配置する

配置結果は次の構成です。

```text
imports/management/
  03-organizations.tsv
  04-sources.tsv
  05-evidence.tsv
  06-cards.tsv
  07-card-source-links.tsv
  08-regions.tsv
```

`imports/management/`は`.gitignore`でGit管理外にしています。実在する団体名、URL、SNS、確認根拠、内部メモを含むTSVをコミットしないでください。

Gitは空ディレクトリを管理しないため、clone直後には`imports/management/`が存在しません。上記コマンドで手動作成してください。TSVの内容を手作業でエスケープし直す必要はありません。

## 変換規則

6 TSVから、各管理単位のCore、日本語locale、英語localeを生成します。出力は合計18ファイルです。

- `data/core/{organizations,sources,evidence,cards,card-source-links,regions}.json`
- `data/locales/ja/`内の同じ6ファイル
- `data/locales/en/`内の同じ6ファイル

各JSONは`schema_version`、引数で指定した`data_updated_on`、`items`を持ちます。`data_updated_on`は、そのTSV一式の管理データ更新日です。実行日を自動設定しないため、人が内容を確認したうえで`YYYY-MM-DD`形式の実在日を指定します。

主な変換規則は次のとおりです。

| TSVの値・列                                     | JSONへの変換                                         |
| ----------------------------------------------- | ---------------------------------------------------- |
| 空欄                                            | 空文字や`null`を出力せず、キーを省略する             |
| 指定された配列列                                | 文字列要素だけのJSON配列として解析する               |
| `show_in_official_source_list`                  | 小文字の`true`または`false`をJSON booleanへ変換する  |
| 表示順・改訂番号                                | 安全なJSON integerへ変換する                         |
| 指定された日付列                                | `YYYY-MM-DD`形式の実在日であることを検証して保持する |
| `official_code`を含むその他の列                 | 文字列として保持し、先頭ゼロ、記号、空白を変更しない |
| `*_ja`、`*_en`                                  | 接尾辞を除き、それぞれ日本語・英語localeへ出力する   |
| ID列                                            | `id`へ変換し、Core・日本語・英語へ同じ値を出力する   |
| `No`、`source_category_label`、先頭の管理用空列 | JSONへ出力しない                                     |

値は勝手にtrim、正規化、置換、翻訳しません。完全一致する文字列「なし」はエラーです。配列のカンマ区切り文字列化、真偽値の`TRUE`や`1`への読み替え、日付やIDの補正も行いません。セル内タブ・改行は第一版では使用できません。

`No`は管理単位内で重複しない1以上の整数とし、生成する`items`は`No`の昇順に並びます。変換対象の件数は固定していないため、行の追加・削除に対応します。

## 検査する

最初に必ず`--check`を実行します。

```sh
npm run data:import:tsv -- \
  --input-dir imports/management \
  --data-updated-on YYYY-MM-DD \
  --check
```

`--check`は6 TSVを読み、構造・ヘッダー・行・型を検証して18候補JSONをメモリ上で生成します。その後、OSの一時ディレクトリへ現在の`data/`と`schemas/`をコピーし、対象18ファイルだけを候補へ置換して、既存の配置、Schema、意味、参照、locale、カード関連の全検証を実行します。リポジトリの`data/`は変更しません。

## JSONへ書き込む

`--check`が成功し、エラー内容を解消した後だけ`--write`を実行します。

```sh
npm run data:import:tsv -- \
  --input-dir imports/management \
  --data-updated-on YYYY-MM-DD \
  --write
```

`--write`も最初に`--check`と同じ全検証を実行します。全検証が成功した場合だけ、対象18ファイルを更新し、更新後にも既存の管理データ検証を実行します。`site.json`、sections、disasters、check-historyなど、対象外のJSONには書き込みません。

## 書込み安全性と保証範囲

18候補はすべて先に生成・検証します。書込み時は各対象JSONと同じディレクトリへ一時ファイルを書き、既存18ファイルを一時バックアップへ移した後、同一ファイルシステム内のrenameで1件ずつ置換します。途中失敗または書込み後検証失敗時は、新しい対象ファイルを除去してバックアップを戻すbest-effortロールバックを行います。正常終了時は一時ファイルとバックアップを削除します。

一般的なファイルシステムでは18ファイル全体を単一トランザクションにできません。プロセスの強制終了、OS停止、電源断、ディスク障害、権限変更が置換中に発生した場合は、完全な一括原状復帰を保証できません。ロールバックに失敗したバックアップは、追加のデータ損失を避けるため残し、エラーにパスを表示します。その場合は作業を続けず、`data/`内の`.backup-`付きファイルを保全して既存JSONと比較してください。

## エラーの読み方

入力エラーは次の情報を決定的な順序で表示します。

- severity
- 安定したエラーコード
- TSVファイル名または検証対象JSON
- 行番号
- 列名
- エラーメッセージ
- 修正方法

入力行全体や`internal_note`全体は表示しません。エラーがある場合はJSONを直接手修正せず、原則としてGoogleスプレッドシートを修正し、対象シートをTSVで再出力して`--check`からやり直してください。

## 実行後に確認する

書込み後は次を実行します。

```sh
npm run validate:data
npm run check
git status --short
git diff -- data/
```

18ファイル以外へ意図しない変更がないこと、各値・公開状態・確認状態・確認日・日英文面・内部メモがスプレッドシートの入力どおりであることを人が確認します。自動検証の成功だけで公式性や公開可否が確認済みになるわけではありません。

`site.json`とsectionsの更新、production用`navigation.json`生成、production静的HTML生成、サイト生成、デプロイは別工程です。このTSV変換だけで実在データが公開されたり、サイトが本番公開されたりすることはありません。

CSV、XLSX直接読込、Google Apps Script、Google Sheets API、Google Drive APIには対応しません。必要な値はスプレッドシートで人が確認し、6シートをTSVとして個別に出力してください。
