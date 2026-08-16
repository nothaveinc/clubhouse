# CLUBHOUSE Web サイト — 専用運用ルール

このファイルは `/Users/keita/projects/clubhouse` 配下で作業する際の**専用ルール**。
親ディレクトリの `/Users/keita/projects/CLAUDE.md`（AI Web制作組織OS）を継承し、本ファイルの記述が優先する。

---

## 1. 絶対ルール（CEO指示・2026-08-09）

1. **指示された事以外は一切しない。** 気づいた不具合・改善点があっても、報告のみに留め、勝手に直さない。
2. **実装前に必ず実装内容をCEOに提示し、承認を得る。** 承認前にサイトのコード（`index.html` / `css/style.css`）を変更しない。
3. **実装（コーディング）はCodexに依頼する。** Claude Codeは要件整理・設計・タスク分解・レビューまで。
4. 変更範囲は依頼内容に限定する。関連箇所の修正が必要な場合は、理由と影響範囲を説明し**個別に**承認を得る。
5. 複数の変更をまとめて承認依頼しない。項目ごとに確認を取る。
6. 各タスク終了時に **COO SNAPSHOT** を出力する。

---

## 2. 作業フロー

```
CEO指示
  → Claude: 現状確認・影響範囲調査
  → Claude: 実装内容を項目別に提示（差分イメージ付き）
  → CEO: 項目ごとに承認 / 却下
  → Codex: 承認された項目のみ実装
  → Claude: 差分レビュー（スコープ外変更が無いか必ず確認）
  → CEO: 最終確認
  → OPS: commit / push（CEO承認後のみ）
```

- Codexへの委任は `delegate-to-codex` スキルを使用する。
- Codexが出した差分は**必ず全行レビュー**し、指示外の変更が混入していないか確認する。
- 1タスク完了ごとにコンテキストをクリアして次のタスクへ進む。

---

## 3. プロジェクト概要

| 項目 | 内容 |
| --- | --- |
| 店舗 | CLUBHOUSE（クラブハウス） |
| 業種 | カフェ |
| 所在地 | 福岡県福津市（JR福間駅 徒歩8分） |
| 営業 | 火・水・木曜 8:00–13:00 |
| Instagram | https://www.instagram.com/club_house_fukutsu |
| リポジトリ | https://github.com/nothaveinc/clubhouse.git （origin / branch: main） |
| コンセプト | 「部室みたいな、居場所がある」 |

---

## 4. 技術構成

- **静的サイト（ビルド不要）** — HTML + CSS + バニラJS のみ。フレームワーク・パッケージマネージャなし。
- 1ページ完結（ワンページ構成、アンカーリンクでセクション遷移）。

```
clubhouse/
├── index.html          # 全HTML + インラインJS（885行）
├── css/style.css       # 全スタイル（1166行、CSS変数でトークン管理）
├── images/
│   └── clubhouse photo/  # 店舗写真（JPG）
├── docs/               # 提案書PDF（.gitignore対象）
└── scripts/            # 提案書生成スクリプト（.gitignore対象）
```

### デザイントークン（`css/style.css` の `:root`）
- カラー：White × Light Yellow (`--yellow: #f2d84b`) × Warm Brown (`--brown: #2c2010`)
- フォント：Playfair Display（見出し英字）/ Noto Serif JP（本文）/ Montserrat（UI）
- アイコン：Font Awesome 6.5.0（CDN）

### セクション構成（`index.html`）
`header` → `hero` → `concept-bar` → `about` → `pillars` → `menu` → `instagram` → `shop` → `access` → `contact` → `footer`

### JS機能（`index.html` 末尾のIIFE）
ヘッダースクロール / ハンバーガーメニュー / fade-in（IntersectionObserver）/ スクロールスパイ / スムーススクロール / コンタクトフォーム（**送信処理なし・ダミー**）

---

## 5. 現状の申し送り（2026-08-09時点）

### 未コミット変更あり ＝ **CEO本人の作業。破棄禁止。**
`main` に未コミットの変更が存在するが、これは**CEO自身が行った作業**であり、正規の作業内容として保持する。
`git reset --hard` / `git checkout --` / `git clean` 等での破棄は**絶対に行わない**（2026-08-09 CEO指示）。

- `index.html` に HEAD比 +260/-55 行の変更（未コミット）
- `style.css` → `css/style.css`、写真 → `images/` へのファイル移動がステージ済み
- 写真の差し替えはCEOが実施済み。未追跡：`images/clubhouse photo/IMG_6636〜6643.JPG`、`clubhouse-about.jpg`

### 既知の課題（**CEO承認があるまで手を付けない**）
1. **画像リンク切れ** — 写真差し替えに伴い、Instagramセクションが参照する以下2ファイルが存在しない状態。
   - `images/clubhouse photo/616656046848737707.jpg`（1枚目）
   - `images/clubhouse photo/616656048996745732.jpg`（2枚目）
2. **仮データが本番に残っている** — 電話番号 `0940-12-3456`、住所 `中央1-2-3`、緯度経度 `33.778/130.492`、駐車場「3台」。JSON-LD・店舗情報・Googleマップ埋め込みの3箇所に波及。
3. **外部画像依存** — メニュー3点・Shop・OG画像が Unsplash の外部URL。店舗の実写に差し替えるかは未決。
4. **Instagram投稿はダミー** — 投稿日・キャプション・いいね数はすべて手書きの固定値。
5. **コンタクトフォームは送信されない** — `setTimeout` で成功メッセージを出すだけで、送信先が無い。
6. **SNSリンク** — Facebook / LINE がトップページURLのままでリンク先未設定。

---

## 6. 改修ログ

| 日付 | 依頼内容 | 実装 | 状態 |
| --- | --- | --- | --- |
| 2026-08-09 | 専用MD作成・作業リポジトリをclubhouseに設定 | Claude | 完了 |
| 2026-08-09 | THREE PILLARS（3つのこだわり）セクションを削除 | Codex | 完了・未コミット |

### 2026-08-09 THREE PILLARS 削除の詳細
- `index.html`：`<!-- THREE PILLARS -->` セクション 42行を削除（id無し・被リンク無しのためリンク切れなし）
- `css/style.css`：`/* ===== 11. PILLARS ===== */` ブロックと `@media (min-width: 768px)` 内の `.pillars__grid` 計40行を削除
- `css/style.css`：about → menu 間の余白を `11rem → 6rem` に調整（`.about.section` / `.menu.section` に個別指定。共通の `.section { padding-block: 5.5rem }` は変更せず）→ **CEO確認済み・6remで確定**
- CSSのセクション番号は 11 が欠番のまま（振り直しは未実施）
