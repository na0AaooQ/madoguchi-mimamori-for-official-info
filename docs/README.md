# ドキュメント目次

「まどぐちみまもり｜熊本県・熊本市の公式情報案内」の初期設計文書をまとめています。第一版は未実装であり、掲載先や機能が公開済みであることを示す文書ではありません。

## 基本文書

| 文書 | 役割 |
| --- | --- |
| [プロジェクト背景](PROJECT_BACKGROUND.md) | 企画の背景、利用者の課題、対象範囲、名称決定の経緯 |
| [設計原則](DESIGN_PRINCIPLES.md) | 安全性、分かりやすさ、維持可能性、技術・UIの基本原則 |
| [情報掲載方針](INFORMATION_LISTING_POLICY.md) | 掲載対象、公式性確認、除外基準、リンク区分 |
| [サイト構成](SITE_STRUCTURE.md) | 5ページ、トップ導線、カード、画面上の情報設計 |
| [運用方針](OPERATIONS_POLICY.md) | 定期確認、期間限定リンク、更新履歴、情報量上限 |
| [設計判断記録](decisions/README.md) | 採用した重要な設計判断と再検討条件 |

## 設計判断記録

| 番号 | 決定 |
| --- | --- |
| [0001](decisions/0001-static-manual-information-navigation-site.md) | 静的・手動確認型の情報案内サイトとする |
| [0002](decisions/0002-do-not-copy-realtime-status.md) | 現在状況を転載しない |
| [0003](decisions/0003-verify-official-sources.md) | 公式性の根拠と確認日を記録する |
| [0004](decisions/0004-exclude-sensitive-personal-information.md) | センシティブな個人情報を扱わない |
| [0005](decisions/0005-limit-first-release-scope.md) | 第一版の対象と情報量を限定する |
| [0006](decisions/0006-purpose-first-navigation-and-official-source-list.md) | 目的別導線と公式情報源一覧を分ける |
| [0007](decisions/0007-free-no-ads-no-login.md) | 完全無料・広告なし・ログイン不要とする |
| [0008](decisions/0008-government-only-support-information.md) | 支援・生活再建は行政の公式情報に限定する |
| [0009](decisions/0009-adopt-madoguchi-mimamori-name.md) | 「まどぐちみまもり」の名称を採用する |

## 文書の読み方

- プロジェクトへ初めて参加する場合は、ルートの[README](../README.md)から読み始めてください。
- 実装や文書変更を行う開発エージェントは、ルートの[AGENTS.md](../AGENTS.md)を先に確認してください。
- 「決定済み」「暫定」「未確定」を区別し、未確定事項は実装構成が決まったときに更新してください。
- 設計方針を変更する場合は、関係する基本文書と設計判断記録の整合性を保ってください。
