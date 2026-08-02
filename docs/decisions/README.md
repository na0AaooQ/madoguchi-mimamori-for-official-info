# 設計判断記録

重要な設計判断を、背景、理由、見送った案、再検討条件とともに記録します。工程3-1の空データ基盤を除き、実在情報を含む第一版の本番データと画面は未実装です。

| 番号                                                              | 状態 | 決定日       | 概要                                     |
| ----------------------------------------------------------------- | ---- | ------------ | ---------------------------------------- |
| [0001](0001-static-manual-information-navigation-site.md)         | 採用 | 2026年8月1日 | 静的・手動確認型の案内サイトとする       |
| [0002](0002-do-not-copy-realtime-status.md)                       | 採用 | 2026年8月1日 | 現在状況を転載しない                     |
| [0003](0003-verify-official-sources.md)                           | 採用 | 2026年8月1日 | 公式性の根拠と確認日を記録する           |
| [0004](0004-exclude-sensitive-personal-information.md)            | 採用 | 2026年8月1日 | センシティブな個人情報を扱わない         |
| [0005](0005-limit-first-release-scope.md)                         | 採用 | 2026年8月1日 | 第一版の対象と情報量を限定する           |
| [0006](0006-purpose-first-navigation-and-official-source-list.md) | 採用 | 2026年8月1日 | 目的別導線と公式情報源一覧を分ける       |
| [0007](0007-free-no-ads-no-login.md)                              | 採用 | 2026年8月1日 | 完全無料・広告なし・ログイン不要とする   |
| [0008](0008-government-only-support-information.md)               | 採用 | 2026年8月1日 | 支援・復旧は行政の公式情報に限定する     |
| [0009](0009-adopt-madoguchi-mimamori-name.md)                     | 採用 | 2026年8月1日 | 「まどぐちみまもり」の名称を採用する     |
| [0010](0010-support-japanese-and-english-in-first-release.md)     | 採用 | 2026年8月2日 | 第一版から日本語・英語へ対応する         |
| [0011](0011-use-json-as-canonical-data-format.md)                 | 採用 | 2026年8月2日 | 管理データの正本にJSONを採用する         |
| [0012](0012-separate-core-and-locale-data.md)                     | 採用 | 2026年8月2日 | 言語共通のcoreと日英localeを分離する     |
| [0013](0013-separate-disasters-and-guidance-events.md)            | 採用 | 2026年8月2日 | 災害と案内目的の出来事を分離する         |
| [0014](0014-separate-internal-and-public-history.md)              | 採用 | 2026年8月2日 | 内部確認履歴と公開更新履歴を分離する     |
| [0015](0015-validate-data-before-public-generation.md)            | 採用 | 2026年8月2日 | データを検証してから公開成果物を生成する |
| [0016](0016-develop-and-test-in-incremental-phases.md)            | 採用 | 2026年8月2日 | 小さな縦切りから段階的に開発・検証する   |
| [0017](0017-adopt-node-quality-toolchain.md)                      | 採用 | 2026年8月2日 | Node.js品質管理ツールチェーンを採用する  |
| [0018](0018-adopt-per-file-json-schemas.md)                       | 採用 | 2026年8月2日 | 管理単位ごとのJSON Schemaを採用する      |

設計判断を変更する場合は、元の記録を消去せず、変更理由と影響範囲が追跡できる記録を追加します。
