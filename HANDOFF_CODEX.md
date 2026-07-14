# DotShot (crypto-peggle) — Codex への引き継ぎメモ

作成日: 2026-07-14（Opus 4.8 セッションより）。
目的: **#48-53 の起草・実装は完了**。#54-59 の起草も完了。**実装は Grok 4.5 へ引き継ぎ**（`HANDOFF_GROK.md` が正）。

---

## 0. まず読む順

1. `HANDOFF_GROK.md` — **#54-59 実装タスクの正**。作業サイクル・rng チェーン・各案クイックリファレンス。
2. `CLAUDE.md` — このリポジトリ専用ガイドライン。
3. `docs/COSMIC_GIMMICK_SPEC.md` — §5.54〜5.59 が実装仕様の正典。
4. `docs/GIMMICK_DESIGN_GUIDE.md` — Tier・色。
5. このファイル（配線アンカー・落とし穴・検証手順）。

---

## 1. ユーザーの標準指示

> 「ギミックを一つ実装するごとにプッシュしてどんどん実装していってください」

1実装 → tsc → レビュー → 検証（下記 §6）→ ログ更新 → commit → `git push origin master` → 次へ。
プッシュはユーザー承認済み運用（コミットごとに `git push origin master`）。

---

## 2. 現在の状態（2026-07-14）

- **#1-53 実装済み**（§4 採否ログが正）。
- **#54-59 起草完了・採用済み**（§5 詳細仕様）。**実装は Grok** — `HANDOFF_GROK.md` §1 参照。

### 末尾 rng チェーン（#54 追加前の現状）

```
cshRng (#48) → clsRng (#49) → silkRng (#50) → pdgRng (#51) → vcRng (#52) → ctcRng (#53)
```

#54-59 は `ctcRng` の直後に `causticRng → reionRng → neutrinoRng → gwMemRng → einCrossRng → zenoRng` を順次追加すること。

---

## 3. 絶対規則（破ると設計思想・決定論が壊れる）

`CLAUDE.md` §4・§7 が正典。要点のみ再掲:

1. **`computeTrajectory` は絶対に触らない**（現 L3360）。照準プレビューには引力・湾曲・押し出し・衝突を
   一切反映しない＝「読めない宇宙」がフェアな難しさの正体（§7.5）。新ギミックがどれだけ強くても不変。
2. **決定論**: レベル生成の乱数は専用ストリーム
   `const xxxRng = makeRng((rng() * 0x100000000) >>> 0);` を **`generateLevel` 内の既存の全乱数消費の後ろ**
   （現在は `vacRng` ブロック L2494 付近以降が最後尾）に追加。メイン `rng` の消費順を1ビットも変えないこと。
   実行時の毎フレーム挙動（ドリフト・パルス向き再抽選）は `Math.random()` でよい。
3. **詰み厳禁**: クリア条件（orange 全消し／ボス撃破）に無関係にする（玉を消す/押す/曲げるだけ）。
   減速・停留させる場合は freeze/mud と同じ per-ball タイマー方式で `effMinSpeed`（`dynMinSpeed`）を
   抑制しつつ時間上限を付ける。閉じ込めうる力（上向き・停留）は必ず周期的解放（ポップ/フェーズ消滅/移動）。
   stuck-rescue 220f は最終保険だが頼り切らない。
4. **クリーム地 `#ede9df` を塗り替えない**。宇宙感はハザード自身の彩度ドットで出す。
   canvas 内で紙色を参照するときは描画ループ冒頭の `paperColor` 定数を使う。
5. **描画ブロック末尾で必ず `ctx.globalAlpha = 1` に戻す**。
6. **新ハザード配列を追加したら、generateLevel 末尾のアノマリー空化リスト（現 L3253-3261 の
   `for (const arr of [...] ) arr.length = 0`）に必ず追加すること**。忘れると 5の倍数アノマリー
   レベルで新ハザードが残ってしまい、厳選構成が崩れる。単一 boolean 型ハザードは L3262-3264 の
   個別クリア（`cme.active = false` 等）に倣う。

---

## 4. 新ハザード配線 — 8タッチポイント（現行アンカー付き）

`CLAUDE.md` §6 が正典。**行番号は Batch I/J/K 追加で +300 前後ドリフト済み**なので、近傍のシンボル名で
位置を確認すること。連続フォース型は**重力レンズ**、接触型は**彗星**をテンプレにコピーする。

| # | 内容 | 現行アンカー |
|---|---|---|
| 1 | interface 定義 | `interface Comet`(L328) / `interface Lens`(L329) / `interface Wormhole`(L614) 近傍 |
| 2 | `GameState` フィールド追加 | interface GameState（`frame`/`levelStartFrame` 付近、L714 前後） |
| 3 | `useRef` 初期 state | `lenses: []`(L3528) など初期化ブロック。**全フィールド初期化必須** |
| 4 | `generateLevel` 生成 | 専用 `makeRng` を **末尾**（`vacRng` L2494 以降）に。**戻り型(L2020) と最終 return の両方も更新** |
| 5 | `initLevel` 代入 | 分割代入 → `g.<field> = <field>`（`g.lenses = lenses` 等、L3520 付近の代入群） |
| 6 | per-ball 連続フォース | 物理セクション。レンズ接線力が最小例（`Gravitational lens: tangential` L8175） |
| 7 | サブステップ衝突 | 高速ハザードのトンネル防止。`const substeps = Math.max(1, Math.ceil(spd0 / BALL_R))`(L8811) 以降 |
| 8 | 描画ループ | 各ブロック末尾で `ctx.globalAlpha = 1` |

1フレームの処理順序（`CLAUDE.md` §7.2 が正典、`g.frame++` は L4127・phase 非依存で毎フレーム加算）:
freeze/mud減衰＋effMinSpeed算出 → stuck判定 → 重力 → **連続フォース群**（レンズ/磁石/BH/風/CME…ここに
「常時作用する場」型を追加）→ **サブステップ移動＋高速衝突**（壁/彗星/ワームホール…ここに「接触で
跳ね返す/消す/テレポート」型を追加）→ ペグ衝突。

`effMinSpeed` の ternary は現 L7945。減速系ハザードを足すなら freeze/mud/void/dilated/darkstar/neutron の
並びに1項追加（`ball.xxxTimer > 0 ? Math.min(dynMinSpeed, BALL_SPEED * XXX_SLOW) : …`）。

---

## 5. 今セッション（Batch I/J/K）で判明したコード固有の落とし穴

新ギミック実装で必ず踏むので先に共有する:

1. **`drawDots(ctx, dots, cx, cy, rot, frame, color, alphaMult)` は各ドットで `ctx.globalAlpha` を
   上書きする**（`d.alpha * alphaMult`）。透明度を出したいときは**事前に `ctx.globalAlpha=0.22` を立てても無視される**。
   必ず**第8引数 `alphaMult` で渡す**こと（例: 対生成ペグのゴースト双子で踏んだバグ）。
2. **`drawSolidCircle(ctx, x, y, r, color)` は内部で alpha を 1 に強制する**。フェード演出には使えない
   （リトル・レッド・ドット #34 で判明）。フェードは手動 `fillRect` で描く。
3. **Ball にフィールドを足すときは interface（L694 付近）＋ 生成サイト3箇所 ＋ useRef 初期化**を全部更新。
   生成サイトは `grep -n "bfSide: 0"` または `"stuckTimer:"` で洗い出す（現在ちょうど3箇所）。
   1つでも漏らすと `undefined` が混入する。Batch K の `neutronTimer` は
   `perl -i -pe 's/freezeTimer: 0, mudTimer: 0, dilated: false/…, neutronTimer: 0, …/g'` で3箇所一括追加した。
4. **GameState にフィールドを足すときは interface ＋ useRef 初期化 ＋ initLevel での代入**の3点セット
   （Batch K の `levelStartFrame` が実例）。
5. **新ペグ型を足す場合**（ハザードではなくペグ）: `PegType` union に追加、`makePegDots` にモチーフ分岐、
   `generateLevel` で **blue プールから変換**（mud 変換の**後ろ**に append すれば `gimmickRng` 末尾消費で
   既存ペグ選択に無影響）、衝突ハンドラ（現 L9213 `// Peg collision`）とドローブロックに分岐、
   `spawnPegBreak` の particle count は default(14) で可。**blue 相当にすれば orange クリア条件に無関係＝詰み厳禁**。
   カスケード（爆弾/雷）は新型を汎用10点で消すので、特殊効果は「直接ヒット時のみ」発火にする。
6. **決定論を保つ変種の作法**（Batch I/J）: 既存ハザードに変種フラグを足すときは、**対象ハザードの
   spawn 分岐の内側**で `hazChance(そのハザードのrng, 0.4)` を引く（spawn しなかったレベルでは消費しない）。
   ただしストリーム途中挿入は同レベル帯の盤面を版間で変える（同一ビルド内決定論とメイン rng 消費順は
   不変なので許容・レビューで blocking にしない）。**新規ハザードを丸ごと足す場合は §3-2 の末尾専用 rng が正道**。
7. 力の距離減衰は `t = 1 - dist/range; f = BASE * t * t`（二乗減衰）で全ハザード統一。無限加速する力は
   `BALL_SPEED * 2`（=22）でクランプ。

---

## 6. preview 実機検証の実態と推奨手順

**preview 環境の rAF は不安定**（タブが hidden だと `requestAnimationFrame` が止まる・秒間数千フレームまで
加速することもある）。`computer{action:"screenshot"}` は **hidden タブだとタイムアウトする**。
このため screenshot ベースの目視検証は当てにできない。今セッションは以下で代替した:

- **物理ロジックの検証は「孤立シミュレーション」**: 物理ブロックのロジックを厳密に複製した単体 JS を
  ローカルで走らせ、速度保存・脱出・詰み無し・発火回数などを数値で確認する（rAF に依存しない）。
- **実機の状態確認は React Fiber 経由**: `preview_start`(name:"dev") → canvas の `__reactFiber$…` を辿って
  `GameState`（`phase`/`level`/各ハザード配列を持つ ref.current）とゲームループ関数を取得。
  `window.requestAnimationFrame` を hidden 時 `setTimeout(cb,16)` にパッチしてループを回す。
  レベルジャンプは `g.level = lv-1; g.phase='levelclear'; g.levelClearTimer=1;` で次レベル生成を踏ませる。
  `g.rng` が未初期化なら mulberry32（`makeRng` と同式）を注入。**HMR 後は必ずリロード**。
  制御弾は Ball リテラル（`neutronTimer:0` 含む全フィールド）を作り `g.balls=[ball]; g.phase='firing'` で発射。
  盤面を対象ペグ/ハザードだけに絞る（`g.pegs=[target]; g.orangeLeft=0`）とスコア/挙動を隔離検証できる。
- `?debug=1` で `DEBUG_FORCE_HAZARDS=true`（解禁レベルでそのハザードを確定 spawn）＋レベルジャンプ UI。

---

## 7. 標準作業サイクル（1ギミックごと）

1. 現象を決める（`COSMIC_GIMMICK_SPEC.md` §1.1 で連続フォース型／接触衝突型／パルス型／場の修飾型を分類）。
2. §4 の8タッチポイントを配線（テンプレ: 連続=レンズ、接触=彗星）。定数はファイル冒頭 `// Constants` 帯へ。
3. `npx tsc --noEmit` が無出力（クリーン）になるまで直す。
4. **レビュー**: このリポジトリには `/codex-review` 運用がある（`.claude/skills/codex-review`）。
   codex 本体で作業するなら self-review でよい。決定論・詰み・computeTrajectory 不可侵・globalAlpha 戻し・
   アノマリー空化リスト追加を必ずチェック。
5. **検証**: §6 の孤立シミュレーション＋ React Fiber 実機で、発火/脱出/詰み無し/速度保存を確認。
6. **ログ3ファイル更新**（§2 記入先）。
7. `git add -A && git commit`（コミットメッセージ末尾に
   `Co-Authored-By: …`）→ `git push origin master`。
8. 次のギミックへ（確認なしで進めてよい）。

### 環境メモ
- OS: Windows 11 / シェル: PowerShell（主）＋ Git Bash（POSIX スクリプト用）。
- `git` の `LF will be replaced by CRLF` 警告は無害。
- ここまでの全作業は origin/master に push 済み。`git log --oneline -8` で
  `be6f7e3`(revert) → `473301f`(draft・打ち消し済) → `51d9ad2`(K) → `b011a9e`(J) → `64cbf13`(I) が見える。
