# DotShot (crypto-peggle) — Claude Code への引き継ぎ

更新: 2026-08-09。想定 HEAD: `58b8ca1` 以降（`master` = `origin/master`）。

Claude Code はこのリポジトリの **`CLAUDE.md` をプロジェクトルールの正**とする。  
Cursor / Claude Desktop の `/resume` や `~/.claude/.../memory/handoff.md` が無くても、**このファイルと `CLAUDE.md` だけで続行できる**。

---

## 0. まず読む順

1. `CLAUDE.md`（必須）
2. `docs/CONCEPT.md`
3. `docs/GIMMICK_DESIGN_GUIDE.md`
4. `docs/COSMIC_GIMMICK_SPEC.md` §4 採否ログ
5. このファイル
6. 相互: `HANDOFF_CODEX.md`（落とし穴の詳細）/ `HANDOFF_GROK.md`

親ディレクトリの `../CLAUDE.md`（Baseapp 共通・OG/Satori 等）も有効。DotShot 専用ルールは重複させずリポの `CLAUDE.md` を優先。

---

## 1. 現在地（2026-08-09）

- Zone AA #191 まで実装済み。**残タスクなし**（ユーザー新指示待ち）。
- earned skip: `skipgate` / クリア抽選+10 / 一撃ボレー+4 / `skiptriad`+6（`beginLevelSkip`）。課金深度ショートカットは禁止。
- 直近修正: 暗黒時代 HUD 可読性、器バンパー nest/dwell（`e101efe`）。

古い「#54〜#65 を実装せよ」系のメモは完了済み。再実行しない。

---

## 2. 作業サイクル

ユーザーがギミック実装を依頼したとき:

1. SPEC / ユーザー指定の1案だけ実装
2. `npx tsc --noEmit`
3. 必要なら孤立 sim
4. `CLAUDE.md` §5 ログ + GUIDE（+ SPEC 採否）を更新
5. commit → push（ユーザーが push を求めた場合。依頼がなければ commit のみ確認）

PowerShell: `git commit -m "$(@' ... '@)"`。

---

## 3. 絶対規則（要約）

`CLAUDE.md` §4・§7 が正典。

- `computeTrajectory` 不可侵
- 専用 `makeRng` を generateLevel 末尾に
- 詰み厳禁・クリーム地不変・描画末尾 `globalAlpha = 1`
- 新配列はアノマリー空化リストへ
- silent UI（宇宙をラベルで語らない）

配線は `CLAUDE.md` §6（8タッチポイント）。行番号は使わずシンボル検索。

---

## 4. Claude Code 固有メモ

- **memory handoff は任意の補助**。リポ外パスに依存しないこと。
- 大規模変更前に `git status` でクリーンを確認。
- レビュー依頼時は「CLAUDE.md §4 違反がないか」を観点に入れるとよい。

落とし穴の詳細は `HANDOFF_CODEX.md` §5（`drawDots` alphaMult、Ball 生成サイト、新ペグ作法）。
