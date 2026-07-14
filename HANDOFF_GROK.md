# DotShot (crypto-peggle) — Grok 4.5 への引き継ぎメモ

作成日: 2026-07-08。更新: 2026-07-14（#54-59 実装完了・#60-65 起草完了）。

このリポジトリを開いたら読む順:
1. `CLAUDE.md` — §1 North Star / §2 ビジュアル契約 / §4 進行原則 / §6 8タッチポイント / §7 物理
2. `docs/COSMIC_GIMMICK_SPEC.md` — §4 採否ログ / **§5 #54-59（実装済み）** / **§6 #60-65（次タスクの正典）**
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

- **カタログ #1-47**: ゾーンA〜E 完走
- **カタログ #48-53**: 2026-07-14 実装・push 済み
- **カタログ #54-59**: 2026-07-14 実装・push 済み

| # | ギミック | Lv | 末尾 rng | コミット |
|---|---|---|---|---|
| 48 | 宇宙せん断場 | 62 | `cshRng` | `8fbfa64` |
| 49 | 無衝突衝撃波 | 67 | `clsRng` | `20a07ac` |
| 50 | シルク減衰雲 | 72 | `silkRng` | `2564fbf` |
| 51 | プランク回折格子 | 82 | `pdgRng` | `54009f6` |
| 52 | 真空チェレンコフ領域 | 89 | `vcRng` | `094e5d6` |
| 53 | 閉じた時間的曲線 | 97 | `ctcRng` | `094e5d6` |
| 54 | 重力レンズ・コースティック | 65 | `causticRng` | `cbf573b` |
| 55 | 再電離前線 | 71 | `reionRng` | `4fa3063` |
| 56 | ニュートリノ振動 | 78 | `neutrinoRng` | `b7ff9d7` |
| 57 | 重力波記憶 | 85 | `gwMemRng` | `3b71f2f` |
| 58 | 愛因シュタイン十字 | 94 | `einCrossRng` | `ca68bdb` |
| 59 | 量子ゼノ観測域 | 98 | `zenoRng` | `bbbb84d` |

### 実装済み: **#60-65（ゾーンF）** — 次タスクはユーザー選定待ち

起草完了・§4 に **✅起草** 済み。**`docs/COSMIC_GIMMICK_SPEC.md` §6.60〜6.65 が実装の正典**。

実装順序（推奨・rng チェーン順）:
1. #60 超越太陽質量チャープ（Lv100）
2. #61 ぼんやり暗黒物ソリトン（Lv104）
3. #62 アクシオン星ミニクラスター（Lv108）
4. #63 宇宙論的视界エントロピー流（Lv112）
5. #64 ホログラフィックRGシート（Lv116）
6. #65 質量-视界エントロピー減速（Lv119）

---

## 2. 絶対規則（要約）

`HANDOFF_CODEX.md` §3 と同内容。破ると設計思想が壊れる:

1. **`computeTrajectory` は絶対に触らない**
2. **決定論**: 専用 `xxxRng` は `generateLevel` の**絶対末尾**（現状 `zenoRng` の後）に追加
3. **詰み厳禁** / **クリーム地不変** / **描画末尾 `ctx.globalAlpha = 1`**
4. **アノマリー空化リスト**に新配列を必ず追加（`anomalyKind !== null` 時に `arr.length = 0`）

### 現行 rng チェーン末尾

```
… → ctcRng → causticRng → reionRng → neutrinoRng → gwMemRng → einCrossRng → zenoRng → [ここから #60-65]
```

#60-65 追加後:

```
… → zenoRng → chirpRng → fdmRng → axionRng → horizonRng → holoRng → entropicRng
```

---

## 3. 8タッチポイント（シンボル名で検索）

| # | 内容 | 検索キーワード |
|---|---|---|
| 1 | interface | 近傍の `QuantumZenoSector` / `HolographicRGSheet` 追加位置 |
| 2 | GameState | `quantumZenoSectors:` |
| 3 | useRef 初期化 | `zenoSectors:` 近傍 |
| 4 | generateLevel | `const zenoRng = makeRng` ブロックの直後 |
| 5 | initLevel | `g.quantumZenoSectors =` |
| 6 | 連続フォース | 量子ゼノ scale ブロックの後が #60-65 の自然な挿入点 |
| 7 | サブステップ衝突 | #60-65 はすべて連続フォース型（衝突不要） |
| 8 | 描画 | 各 `// ──` ブロック末尾で alpha 復帰 |

### Ball フィールド追加が必要な案

- **#60-63, #65**: 原則不要
- **#64**: `Ball.rgLayer: number` 必須（interface + **3生成サイト** + useRef 初期化）

### 同レベル排他（generateLevel 内ガード）

| 新ギミック | 排他条件 |
|---|---|
| #63 视界エントロピー流 | `greatAttractor === null` |
| #65 エントロピー減速 | `bigRip === null` |

---

## 4. 各案の実装クイックリファレンス（#60-65）

### #60 超越太陽質量チャープ
- **テンプレ**: パルサー timer + 双星軌道描画
- **GameState**: `chirpBinary: TransSolarChirp | null`
- **定数**: `CHIRP_PERIOD=180`, `CHIRP_AMP=0.08`, `CHIRP_HARM=8`, `CHIRP_ORB_R=38`, `CHIRP_ORB_SPEED=0.045`
- **色**: 深緑青 `#1a8898`（白禁止）
- **検証**: 方向保存・平均 speed≈1

### #61 ぼんやり暗黒物ソリトン
- **テンプレ**: `neutrinoOscillations` 楕円 + 接線 sin 力
- **定数**: `FDM_RX=95`, `FDM_RY=68`, `FDM_BEAT_AMP=0.12`, `FDM_BEAT_FREQ=0.07`, `FDM_K=2.4`
- **色**: ソリトンミント `#5eb89a`
- **検証**: 500f speed diff≈0

### #62 アクシオン星ミニクラスター
- **テンプレ**: `primordialBHs` 配置 + 接線 sin 力（引力ではない）
- **定数**: `AXION_RANGE=75`, `AXION_FORCE=0.11`, `AXION_SHIMMER_PERIOD=160`, `AXION_SHIMMER_DUR=4`
- **色**: 幻影藍 `#5868c0`（Tier 4）
- **検証**: ラジアル力≈0

### #63 宇宙論的视界エントロピー流
- **テンプレ**: `greatAttractor` 反転（四辺内向き斥力）
- **GameState**: `horizonEntropyActive: boolean`
- **定数**: `HORIZON_BAND=28`, `HORIZON_PUSH=0.09`
- **色**: 熵錆 `#b86048`、流線 `#e8dcd0`
- **排他**: `!greatAttractor`

### #64 ホログラフィックRGシート
- **テンプレ**: `cosmicBirefringences` OBB + `Ball.rgLayer`
- **定数**: `HOLO_LEN=200`, `HOLO_THICK=85`, `HOLO_SCALE_STEP=0.04`, `HOLO_FLASH=10`
- **色**: 真珠 `#d0d4e0`
- **検証**: round-trip scale・layer リセット

### #65 質量-视界エントロピー減速
- **テンプレ**: 量子ゼノ scale の全域連続版
- **GameState**: `entropicDragActive: boolean`
- **定数**: `ENTROPIC_H0=0.0015`, `ENTROPIC_H_MAX=0.004`, `ENTROPIC_FLOOR=0.92`
- **色**: 深葡萄酒 `#8a3848`
- **排他**: `!bigRip`

### ゾーンF 共通色（新色族）

深緑青 `#1a8898` / ソリトンミント `#5eb89a` / 幻影藍 `#5868c0` / 熵錆 `#b86048` / 真珠 `#d0d4e0` / 深葡萄酒 `#8a3848`

---

## 5. ログ更新（各ギミック実装後に必須）

1. `docs/COSMIC_GIMMICK_SPEC.md` §4 — `✅起草` → `✅実装` + 検証メモ + コミットID
2. `CLAUDE.md` §5 進行表 — 1行追加
3. `docs/GIMMICK_DESIGN_GUIDE.md` §5 — Tier・色・コミットID

---

## 6. 検証（HANDOFF_CODEX §6 準拠）

- **孤立 sim 必須**（rAF 不安定のため）
- 各案の §6 末尾「検証」節のチェックリストを満たすこと
- 実機は `?debug=1` + レベルジャンプ UI が使える

---

## 7. 既知の落とし穴（全ギミック共通）

1. `drawDots` の alpha は第8引数 `alphaMult` で渡す（事前 `globalAlpha` は無視される）
2. `drawSolidCircle` はフェード不可（手動 `fillRect`）
3. Ball フィールド追加時は **interface + 3生成サイト + useRef** を grep で漏れチェック
4. `generateLevel` の**戻り型と return の両方**を更新
5. アノマリー空化リスト忘れ → 5の倍数レベルで厳選構成が壊れる

---

## 8. 標準作業サイクル（1ギミック）

```
実装 → tsc → 孤立sim → ログ3ファイル → git commit → git push origin master → 次の#
```

コミットメッセージ例:
`feat: add trans-solar chirp binary hazard (catalog #60)`
