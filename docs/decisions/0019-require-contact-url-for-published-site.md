# 0019: 問い合わせURLをサイト公開時に必須とする

## 状況

問い合わせ先として利用する予定の外部フォームはリポジトリ内に記載されていますが、`data/core/site.json`へ登録する確定済みの問い合わせURLはありません。未確定のURLを下書きデータへ推測して登録せず、サイト公開時には問い合わせ先が欠けない制約が必要です。

## 決定

`contact_url`は、`site_publication_status: published`のときに必須とします。`draft`、`under-review`、`hidden`、`archived`では省略できます。値が存在する場合は公開状態にかかわらずHTTPS URLだけを許可し、HTTP、FTP、`mailto`などは許可しません。

`site_publication_status: published`では、サイト全体の確認記録として`site_last_checked_on`も必須とします。確定済みURLがない工程3-1の初期データには、プレースホルダーや予約用途ドメインのURLを追加しません。

## 理由

- 未確定の問い合わせ先を正本データとして扱わずに済む
- 下書きや確認中の段階では、URL確定前でも構造と文面を検証できる
- 公開時には、点検日と問い合わせ先の両方が存在することをSchemaで保証できる
- HTTPS以外のURIを拒否し、問い合わせ導線の制約を明確にできる

## 影響

工程3-1の`data/core/site.json`は`draft`のまま`contact_url`を省略します。公開状態へ変更する際は、確定したHTTPSの問い合わせURLと`site_last_checked_on`を同時に登録する必要があります。既存の下書き、確認中、非表示、アーカイブ済みデータにはURL追加を要求しません。

## 関連文書

- [データフィールド定義](../DATA_FIELDS.md)
- [データSchema実装](../DATA_SCHEMA_IMPLEMENTATION.md)
- [データ検証・公開生成方針](../DATA_VALIDATION_AND_PUBLICATION.md)
- [完全無料・広告なし・ログイン不要とする決定](0007-free-no-ads-no-login.md)

## 状態

採用

## 決定日

2026年8月2日
