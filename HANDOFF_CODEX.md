# DotShot (crypto-peggle) — Codex への引き継ぎ

更新: 2026-08-09。想定 HEAD: `b4032bb`（`master` = `origin/master`）。

**このファイルはタスクキューではない。** 古い rng チェーン表や「次は #54〜」は破棄済み。次のギミックはユーザーが指定するまで着手しない。

---

## 0. まず読む順

1. `CLAUDE.md` — North Star / ビジュアル契約 / 進行原則 / §6 8タッチポイント / §7 物理
2. `docs/CONCEPT.md` — 柱とアンチゴール（課金深度ショートカット禁止）
3. `docs/GIMMICK_DESIGN_GUIDE.md` — Tier・色・改修ログ
4. `docs/COSMIC_GIMMICK_SPEC.md` — §4 採否ログ（実装済みの正）
5. このファイル（落とし穴・サイクル）
6. 相互: `HANDOFF_CLAUDE.md` / `HANDOFF_GROK.md`（同内容のエージェント別注意）

行番号は書かない。シンボル名で `CryptoPeggleGame.tsx` を検索すること。

---

## 1. 現在地（2026-08-09）

- カタログは **Zone AA #191 まで実装済み**（採否ログ参照）。
- **残タスクなし** — ユーザーの新指示待ち。
- earned 深度ジャンプ（課金スキップではない）:
  - `skipgate`（lv35+）— `b5da2cf`
  - クリア時 0.7% 強ノイズ +10 — 同上
  - lv40+ 1ボレークリア → 弱ノイズ +4 — `e101efe`
  - `skiptriad`（lv48+ 同ボレー3星）→ +6 — `048af5c`
- その他直近: 暗黒時代 HUD チップ / 器バンパー nest・dwell 修正 — `e101efe`

スキップ実装の入口: `beginLevelSkip`。

---

## 2. ユーザーの標準サイクル

ユーザーが「1つずつ実装してプッシュ」と指示したとき:

1. 実装（`CLAUDE.md` §4・§6・§7）
2. `npx tsc --noEmit`
3. 孤立 sim（必要なら）
4. `CLAUDE.md` / `GIMMICK_DESIGN_GUIDE.md` /（カタログなら）`COSMIC_GIMMICK_SPEC.md` 更新
5. commit → `git push origin master`

PowerShell の commit は here-string `@'...'@`。push は環境により承認 UI が必要なことがある。

---

## 3. 絶対規則（要約）

正典は `CLAUDE.md` §4・§7。

1. **`computeTrajectory` は絶対に触らない**
2. **決定論**: 生成乱数は `makeRng((rng()*0x100000000)>>>0)` の専用ストリームを `generateLevel` の**既存消費の末尾**に足す。メイン `rng` の順をずらさない
3. **詰み厳禁** — クリア条件（橙／ボス）に干渉しない
4. **クリーム地 `#ede9df` 不変** — 宇宙感はハザードの彩度ドット
5. 描画ブロック末尾で **`ctx.globalAlpha = 1`**
6. 新ハザード配列は generateLevel 末尾の **アノマリー空化リスト**に必ず追加（単一 boolean も同様にクリア）

---

## 4. 配線（8タッチポイント）

`CLAUDE.md` §6。連続フォースは重力レンズ、接触は彗星をテンプレにコピー。

| # | 内容 | 探し方 |
|---|---|---|
| 1 | interface | `interface Lens` / `interface Comet` 近傍 |
| 2 | `GameState` | `interface GameState` |
| 3 | useRef 初期化 | `lenses: []` 等の初期 state |
| 4 | `generateLevel` | 専用 rng・戻り型・最終 return |
| 5 | `initLevel` | 分割代入 → `g.<field> =` |
| 6 | 連続フォース | `Gravitational lens` コメント近傍 |
| 7 | サブステップ衝突 | `substeps` / `BALL_R` |
| 8 | 描画 | 各ブロック末尾 `globalAlpha = 1` |

---

## 5. コード固有の落とし穴

1. **`drawDots` の透明度は第8引数 `alphaMult`**（事前の `globalAlpha` は上書きされる）
2. **`drawSolidCircle` は alpha を 1 固定** — フェードは `fillRect` で
3. **Ball 新フィールド** = interface + 生成サイト全部（`grep stuckTimer:`）+ 必要なら useRef
4. **GameState 新フィールド** = interface + useRef 初期化 + initLevel
5. **新ペグ** = `PegType` + `makePegDots` + blue プール変換（mud の後）+ 衝突/描画。特殊効果は直接ヒットのみ。カスケード除外が必要なら `skipgate` / `skiptriad` を参照
6. 力の減衰は `t*t`。無限加速は `BALL_SPEED * 2` クランプ

---

## 6. 検証

- preview の rAF / screenshot は不安定 → **孤立 JS sim** を優先
- `?debug=1` で `DEBUG_FORCE_HAZARDS`
- レベルジャンプは既存 debug UI または `levelclear` 経路を利用

---

## 7. やらないこと

- このファイルの古い版や `HANDOFF_GROK.md` の 2026-07 タスクを再実行すること
- 課金でレベルスキップ／深部スタートを売ること
- UI で宇宙ギミックを説明する文言を足すこと（silent）
