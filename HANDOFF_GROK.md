# DotShot (crypto-peggle) — Grok 4.5 への引き継ぎメモ

作成日: 2026-07-08。更新: 2026-07-14（#54-59 起草完了・実装タスク開始）。

このリポジトリを開いたら読む順:
1. `CLAUDE.md` — §1 North Star / §2 ビジュアル契約 / §4 進行原則 / §6 8タッチポイント / §7 物理
2. `docs/COSMIC_GIMMICK_SPEC.md` — §1 共通レシピ / §4 採否ログ / **§5 新カタログ #54-59（実装仕様の正）**
3. `docs/GIMMICK_DESIGN_GUIDE.md` — Tier・色ファミリー・§5 改修ログ
4. `HANDOFF_CODEX.md` — 配線アンカー・落とし穴・検証手順（行番号はドリフトするのでシンボル名で検索）
5. このファイル

---

## 0. ユーザーの標準指示

> 「ギミックを一つ実装するごとにプッシュしてどんどん実装していってください」

**1ギミックごと**: 実装 → `npx tsc --noEmit` → 孤立 sim 検証 → **ログ3ファイル更新** → commit → `git push origin master` → 次へ（確認なし）。

PowerShell では commit message に here-string `@""@` を使う。master push は Smart Mode 承認が必要なことがある（`request_smart_mode_approval: true` で再送）。

---

## 1. 現在の状態（2026-07-14）

### 実装済み（origin/master）

- **カタログ #1-47**: ゾーンA〜E 完走（`COSMIC_GIMMICK_SPEC.md` §4）
- **カタログ #48-53**: 2026-07-14 実装・push 済み

| # | ギミック | Lv | 末尾 rng | コミット |
|---|---|---|---|---|
| 48 | 宇宙せん断場 | 62 | `cshRng` | `8fbfa64` |
| 49 | 無衝突衝撃波 | 67 | `clsRng` | `20a07ac` |
| 50 | シルク減衰雲 | 72 | `silkRng` | `2564fbf` |
| 51 | プランク回折格子 | 82 | `pdgRng` | `54009f6` |
| 52 | 真空チェレンコフ領域 | 89 | `vcRng` | `094e5d6` |
| 53 | 閉じた時間的曲線 | 97 | `ctcRng` | `094e5d6` |

### 次のタスク: **#54-59 を §5 どおり実装する**

起草は完了・§4 に **✅採用** 済み。現象の選定変更は不要。**`docs/COSMIC_GIMMICK_SPEC.md` §5.54〜5.59 が実装の正典**。

実装順序（推奨・rng チェーン順）:
1. #54 重力レンズ・コースティック（Lv65）
2. #55 再電離前線（Lv71）
3. #56 ニュートリノ振動（Lv78）
4. #57 重力波記憶（Lv85）
5. #58 愛因シュタイン十字（Lv94）
6. #59 量子ゼノ観測域（Lv98）

---

## 2. 絶対規則（要約）

`HANDOFF_CODEX.md` §3 と同内容。破ると設計思想が壊れる:

1. **`computeTrajectory` は絶対に触らない**
2. **決定論**: 専用 `xxxRng` は `generateLevel` の**絶対末尾**（現状 `ctcRng` の後）に追加
3. **詰み厳禁** / **クリーム地不変** / **描画末尾 `ctx.globalAlpha = 1`**
4. **アノマリー空化リスト**に新配列を必ず追加（`anomalyKind !== null` 時に `arr.length = 0`）

### 現行 rng チェーン末尾（#54 追加前）

```
cshRng → clsRng → silkRng → pdgRng → vcRng → ctcRng → [ここから #54-59]
```

#54-59 追加後:

```
… → ctcRng → causticRng → reionRng → neutrinoRng → gwMemRng → einCrossRng → zenoRng
```

---

## 3. 8タッチポイント（シンボル名で検索）

| # | 内容 | 検索キーワード |
|---|---|---|
| 1 | interface | 近傍の `ClosedTimelikeCurve` / `VacuumCherenkovDomain` |
| 2 | GameState | `closedTimelikeCurves:` |
| 3 | useRef 初期化 | `ctcStates: new WeakMap` |
| 4 | generateLevel | `const ctcRng = makeRng` ブロックの直後 |
| 5 | initLevel | `g.closedTimelikeCurves =` |
| 6 | 連続フォース | `// Neutrino` 挿入位置はレンズ/量子泡近傍 |
| 7 | サブステップ衝突 | `#54 コースティック` は `passingBalls` パターン（#49 参照） |
| 8 | 描画 | 各 `// ──` ブロック末尾で alpha 復帰 |

### Ball フィールド追加が必要な案

- **#54-56, #58-59**: 原則不要（WeakSet / WeakMap / GameState フィールドで足りる）
- **#57**: `GameState.gwMemories: WeakMap<Ball, { remain; bx; by }>` を推奨（Ball 型変更回避）

### 同レベル排他（generateLevel 内ガード）

| 新ギミック | 排他条件 |
|---|---|
| #57 重力波記憶 | `gravWaves.length === 0`（生成前に既存 gravWaves を確認） |
| #59 量子ゼノ | `theNothings.length === 0` |

---

## 4. 各案の実装クイックリファレンス

### #54 コースティック
- **テンプレ**: `collisionlessShocks` + `closestOnPolyline` + `WeakSet`
- **定数**: `CAUSTIC_HALFW=5`, `CAUSTIC_AMP=1.35`, `CAUSTIC_FLASH=6`
- **色**: 金 `#d4b85a`、ハイライト `#fff8e0`
- **検証**: 接線保存・法線1.35倍・1横断1発火

### #55 再電離前線
- **テンプレ**: CME（`cmeY` / `cmeTimer` / `cmePeriod`）
- **GameState**: `reionActive`, `reionY`, `reionTimer`, `reionPeriod`
- **定数**: `REION_PERIOD=300`, `REION_BAND=36`, `REION_DRAG_X=0.97`, `REION_PUSH_Y=0.06`
- **色**: 紫 `#7b5cff`

### #56 ニュートリノ振動
- **テンプレ**: `quantumFoams` の回転式を楕円内に限定
- **定数**: `NEUT_AMP=0.065`, `NEUT_FREQ=0.09`, `NEUT_RX=100`, `NEUT_RY=72`
- **色**: 藍鼠 `#a8b8c8` 3層ハロー

### #57 重力波記憶
- **テンプレ**: `gravWaves` 膨張リング + WeakMap 残滓
- **定数**: `GWM_PERIOD=480`, `GWM_KICK=0.10`, `GWM_BIAS=0.004`, `GWM_MEM_DUR=90`
- **色**: 銀 `#9aa8c0`

### #58 愛因シュタイン十字
- **テンプレ**: `primordialBHs` の多点引力（可視4像+核）
- **定数**: `ECROSS_R=58`, `ECROSS_PULL=0.14`, `ECROSS_RANGE=85`
- **色**: 琥珀 `#c8a030`、核 `#6a5830`

### #59 量子ゼノ
- **テンプレ**: 楕円ゲート + duty 判定（時間膨張とは別）
- **定数**: `ZENO_SCALE=0.93`, `ZENO_DUTY_FREQ=0.16`, `ZENO_RX=108`, `ZENO_RY=76`
- **色**: 青緑 `#2a9a8a`、スポーク `#1a4a44`

---

## 5. ログ更新（各ギミック実装後に必須）

1. `docs/COSMIC_GIMMICK_SPEC.md` §4 — `✅採用` → `✅実装` + 検証メモ + コミットID
2. `CLAUDE.md` §5 進行表 — 1行追加
3. `docs/GIMMICK_DESIGN_GUIDE.md` §5 — Tier・色・コミットID

§5.54-59 のドラフト本文は実装完了後も残してよい（#48-53 と同様、完了後に §5 ヘッダーを「完了」に更新可）。

---

## 6. 検証（HANDOFF_CODEX §6 準拠）

- **孤立 sim 必須**（rAF 不安定のため）
- 各案の §5 末尾「検証」節のチェックリストを満たすこと
- 実機は `?debug=1` + レベルジャンプ UI が使える

---

## 7. 既知の落とし穴（全ギミック共通）

1. `drawDots` の alpha は第8引数 `alphaMult` で渡す（事前 `globalAlpha` は無視される）
2. `drawSolidCircle` はフェード不可（手動 `fillRect`）
3. Ball フィールド追加時は **interface + 3生成サイト + useRef** を grep で漏れチェック
4. `generateLevel` の**戻り型と return の両方**を更新
5. アノマリー空化リスト忘れ → 5の倍数レベルで厳選構成が壊れる

### #39 暗黒時代の教訓（参照）
- canvas `alpha:false` / punch 前に `globalAlpha=1`
- The Nothing の stuck 凍結は `inNothing` で stuck ブロック全体スキップ

---

## 8. 標準作業サイクル（1ギミック）

```
実装 → tsc → 孤立sim → ログ3ファイル → git commit → git push origin master → 次の#
```

コミットメッセージ例:
`feat: add gravitational lensing caustic hazard (catalog #54)`
