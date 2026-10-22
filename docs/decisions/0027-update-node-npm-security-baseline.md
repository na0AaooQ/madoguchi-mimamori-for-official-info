# 0027: Node.js・npmのセキュリティ更新を採用する

## 状況

2026年8月2日の[ADR 0017](0017-adopt-node-quality-toolchain.md)では、品質管理ツールチェーンとしてNode.js `24.18.0`とnpm `11.16.0`を採用しました。継続運用に必要なセキュリティ修正版へ開発・検証・ビルド環境を更新し、設定、lockfile、workflow、開発・運用文書を整合させる必要があります。

工程Aの引き継ぎ結果では、Node.js `24.22.1`、npm `11.19.1`で既存634テストがPASSしています。これは実装依頼に記載されたローカル互換性確認結果であり、今回のPR-Aにおける再検証結果や、GitHub Actions上のBuild/Deploy成功を示すものではありません。PR-Aの完了は件数を固定せず、対象環境で必要な全テスト・検証が正常終了したことによって判断します。

## 決定

Node.js `24.22.1`、npm `11.19.1`を採用し、Node.js 24、npm 11のメジャーバージョンを維持します。

- `.nvmrc`とGitHub Pages workflowの`node-version`を`24.22.1`に固定する
- `package.json`の`engines.node`を`>=24.22.1 <25`、`engines.npm`を`>=11.19.1 <12`とする
- `packageManager`を`npm@11.19.1`とする
- npm `11.19.1`によるオフライン処理で、lockfileVersion 3を維持し、lockfileのルート`engines`だけを整合させる
- 既存の品質管理ツールチェーン、依存パッケージのバージョン、依存構造、`resolved`、`integrity`を維持し、一括更新や依存関係の追加・削除を行わない
- GitHub Pagesは`workflow_dispatch`だけの手動デプロイ方式を維持し、Actionのメジャーバージョン、権限、build/deploy構造、公開artifactのパスを変更しない

実行環境を選択・固定する設定と、互換性範囲を表す`engines`は役割を区別します。`engines`だけで旧バージョンの実行を完全に禁止できるとは扱わず、検証時には実際のNode.js・npmバージョンを確認します。

## 理由

- セキュリティ修正版を採用し、継続運用する開発・検証・ビルド環境を更新するため
- 工程Aで確認されたローカル互換性を踏まえ、同一メジャー内で影響範囲を限定するため
- 依存関係の更新と実行環境の更新を分け、lockfileによる再現性と差分の確認可能性を維持するため
- サイト表示、掲載情報、公開データ、URL構造および手動公開手順を維持するため

## ADR 0017との関係

ADR 0017の品質管理ツールチェーン採用判断を継承し、現在のNode.js・npm対象バージョンだけを本ADRで更新します。ADR 0017の当時のバージョン、採用状態、決定日は変更しません。初期開発の実績を記録した`DEVELOPMENT_PHASES.md`も保持します。

## 影響範囲と検証

変更対象は実行環境の指定、lockfileのルートメタデータ、既存workflow回帰テスト、現在有効な環境を記述する開発・運用文書およびADR索引です。

Node.js `24.22.1`、npm `11.19.1`で、既存の`node_modules`を再構築せず隔離した一時ディレクトリで`npm ci`を確認します。workflowの既存4テスト、文書検証、`npm run validate:data`、`npm run check`を実施し、依存情報と公開成果物に想定外の差分がないことを確認します。

## 対象外と未確認事項

- PR-Bのトップページ文言変更、サイト機能、管理データ、Schema、fixture、公開成果物の変更
- Node.js 25以降、npm 12以降への移行および依存ライブラリの一括更新
- GitHub Actionsの実行、productionデプロイ、公開後確認
- 既存依存パッケージのすべての脆弱性が解消したとの判断

GitHub Actions上の実行結果は、Phase 6で別途承認後に確認します。Node.js 20非推奨警告[BL-018](../POST_LAUNCH_BACKLOG.md#bl-018-github-actionsのnodejs-20非推奨警告)は`deferred`を維持し、実際の再検証前に解消済みとは扱いません。

## 関連文書

- [品質管理基盤](../QUALITY_TOOLING.md)
- [GitHub Pages手動デプロイ](../GITHUB_PAGES_DEPLOYMENT.md)
- [開発作業標準フロー](../DEVELOPMENT_STANDARD_FLOW.md)

## 状態

採用

## 決定日

2026年10月22日
