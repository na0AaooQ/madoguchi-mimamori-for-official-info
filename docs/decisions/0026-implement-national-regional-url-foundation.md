# ADR 0026: 全国版・地域別URL共通基盤を工程Aとして実装する

## 状況

ADR 0024で、同一サイトを全国へ拡張し、2県目追加前に地域別URLへ移行する上位方針を決めました。既存実装はlocaleごとに一つの大きな公開`navigation.json`と地域なしURLを前提としているため、2県目追加前に公開成果物、URL、地域抽出、検証の責務を分ける必要があります。

## 決定

- `/`は共通の言語選択入口として維持し、`/ja/`・`/en/`を全国トップ兼地域選択ページとする
- 都道府県をルーティング単位とし、地域URLは`/{locale}/regions/{region_slug}/`、分野・団体一覧はその配下にする
- `region_id`からslugを生成せず、prefectureのcoreに安定値として`region_slug`と`display_order`を明示する
- localeの`navigation_label`と既存`scope_note`を使い、`scope_description`は追加しない
- 全国トップ用公開成果物と、1 locale × 1 prefectureの自己完結型地域成果物を分離する
- 地域カードはprefecture自身と配下regionのsubtreeに交差する明示`cards.region_ids`だけを収録する。country/nationwideだけで全地域へ配信しない
- 旧地域なしURLは新基盤で生成せず、工程Aのpreview・fixtureで不在を検証する
- hreflangは同じregion・page type・section anchorのja/en相互対応だけとし、canonical・`x-default`は追加しない
- 工程Aはfixtureとpreviewを完成させる工程とし、既存熊本productionの正式移行は工程B、千葉の実データ追加は工程Cとする

## 境界

工程Aは複数prefecture相当のデータ構造、公開契約、抽出、URL、HTML、検証、文書を実装します。工程Bのproduction URL切替、工程Cの千葉県・千葉市実データ、デプロイ、Search Console操作は含めません。

## 理由

全国トップと地域ページの責務が分かれ、地域スコープをURL・公開データ・カード対象地域で明示できます。管理データの重複を避けながら、日英の論理ページ対応、再現性、旧URLの混入防止を機械検証できます。市町村URLや全国共通カード自動配信を先回りしないため、現在必要な範囲を超えて抽象化しません。

## 状態

採用

## 決定日

2026-08-18
