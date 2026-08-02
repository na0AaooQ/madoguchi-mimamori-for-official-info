# ドキュメント目次

「まどぐちみまもり｜熊本県・熊本市の公式情報案内」の初期設計文書をまとめています。工程3-2Aで架空の地域・団体・案内先・確認根拠の最小縦切りを実装していますが、実在情報、公開生成、画面は未実装であり、掲載先や機能が公開済みであることを示す文書ではありません。

## 基本文書

| 文書                                                           | 役割                                                            |
| -------------------------------------------------------------- | --------------------------------------------------------------- |
| [プロジェクト背景](PROJECT_BACKGROUND.md)                      | 企画の背景、利用者の課題、対象範囲、名称決定の経緯              |
| [設計原則](DESIGN_PRINCIPLES.md)                               | 安全性、分かりやすさ、維持可能性、技術・UIの基本原則            |
| [情報掲載方針](INFORMATION_LISTING_POLICY.md)                  | 掲載対象、公式性確認、除外基準、リンク区分                      |
| [サイト構成](SITE_STRUCTURE.md)                                | 5ページ、トップ導線、カード、画面上の情報設計                   |
| [運用方針](OPERATIONS_POLICY.md)                               | 定期確認、期間限定リンク、更新履歴、情報量上限                  |
| [データモデル](DATA_MODEL.md)                                  | JSON正本、core・locale、管理単位、参照関係、内部・公開履歴      |
| [データフィールド定義](DATA_FIELDS.md)                         | 各core・locale JSONの項目名、型、必須条件、許可値、整合性ルール |
| [日英対応方針](LOCALIZATION_POLICY.md)                         | 第一版の日英対応、公式名称、リンク先言語、翻訳改訂              |
| [データ検証・公開生成方針](DATA_VALIDATION_AND_PUBLICATION.md) | JSON Schema、意味検証、公開停止条件、内部項目除外               |
| [データSchema実装](DATA_SCHEMA_IMPLEMENTATION.md)              | データ・Schema配置、工程3-2Aの実装範囲、責務分担                |
| [品質管理基盤](QUALITY_TOOLING.md)                             | Node.js、Lint、Format、テスト、fixture、文書検証の実行方法      |
| [開発工程](DEVELOPMENT_PHASES.md)                              | 工程1から工程13までの目的、成果物、完了条件                     |
| [設計判断記録](decisions/README.md)                            | 採用した重要な設計判断と再検討条件                              |

## 設計判断記録

| 番号                                                                                  | 決定                                       |
| ------------------------------------------------------------------------------------- | ------------------------------------------ |
| [0001](decisions/0001-static-manual-information-navigation-site.md)                   | 静的・手動確認型の情報案内サイトとする     |
| [0002](decisions/0002-do-not-copy-realtime-status.md)                                 | 現在状況を転載しない                       |
| [0003](decisions/0003-verify-official-sources.md)                                     | 公式性の根拠と確認日を記録する             |
| [0004](decisions/0004-exclude-sensitive-personal-information.md)                      | センシティブな個人情報を扱わない           |
| [0005](decisions/0005-limit-first-release-scope.md)                                   | 第一版の対象と情報量を限定する             |
| [0006](decisions/0006-purpose-first-navigation-and-official-source-list.md)           | 目的別導線と公式情報源一覧を分ける         |
| [0007](decisions/0007-free-no-ads-no-login.md)                                        | 完全無料・広告なし・ログイン不要とする     |
| [0008](decisions/0008-government-only-support-information.md)                         | 支援・復旧は行政の公式情報に限定する       |
| [0009](decisions/0009-adopt-madoguchi-mimamori-name.md)                               | 「まどぐちみまもり」の名称を採用する       |
| [0010](decisions/0010-support-japanese-and-english-in-first-release.md)               | 第一版から日本語・英語へ対応する           |
| [0011](decisions/0011-use-json-as-canonical-data-format.md)                           | 管理データの正本にJSONを採用する           |
| [0012](decisions/0012-separate-core-and-locale-data.md)                               | 言語共通のcoreと日英localeを分離する       |
| [0013](decisions/0013-separate-disasters-and-guidance-events.md)                      | 災害と案内目的の出来事を分離する           |
| [0014](decisions/0014-separate-internal-and-public-history.md)                        | 内部確認履歴と公開更新履歴を分離する       |
| [0015](decisions/0015-validate-data-before-public-generation.md)                      | データを検証してから公開成果物を生成する   |
| [0016](decisions/0016-develop-and-test-in-incremental-phases.md)                      | 小さな縦切りから段階的に開発・検証する     |
| [0017](decisions/0017-adopt-node-quality-toolchain.md)                                | Node.js品質管理ツールチェーンを採用する    |
| [0018](decisions/0018-adopt-per-file-json-schemas.md)                                 | 管理単位ごとのJSON Schemaを採用する        |
| [0019](decisions/0019-require-contact-url-for-published-site.md)                      | 問い合わせURLをサイト公開時に必須とする    |
| [0020](decisions/0020-implement-official-source-minimum-slice-with-fictional-data.md) | 工程3-2Aの最小縦切りを架空データで実装する |

## 文書の読み方

- プロジェクトへ初めて参加する場合は、ルートの[README](../README.md)から読み始めてください。
- 実装や文書変更を行う開発エージェントは、ルートの[AGENTS.md](../AGENTS.md)を先に確認してください。
- 「決定済み」「暫定」「未確定」を区別し、未確定事項は実装構成が決まったときに更新してください。
- 設計方針を変更する場合は、関係する基本文書と設計判断記録の整合性を保ってください。
