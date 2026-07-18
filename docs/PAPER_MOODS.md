# Paper Moods — さりげない紙の癖

> クリーム地 `#ede9df` は不変。skybox 禁止。宇宙は UI で語らない。
> 実装: `src/components/CryptoPeggleGame.tsx`（`PaperMoodId` / `rollPaperMood` / bgDots ループ）

レベルごとに **主ムード1つ**（lv40+）と、稀に **レア層**（約 4.5%）を決定論ロールする。
レイアウト用 rng は消費しない（レベル番号由来の専用シード）。

## 主ムード

| id | 解禁 | 感触 |
|---|---|---|
| settleVeil | 40 | マリンスノーが一段静かに揃う |
| softLattice | 40 | ごく淡い水平格子寄せ |
| coldBreath | 40 | 上半分だけ薄く冷たい |
| rimAsh | 40 | 縁へ寄る灰 |
| warmColdMottle | 71 | 左右で暖冷の斑（超淡） |
| grainSnap | 71 | 粗い印刷粒 |
| centerAbsence | 71 | 中央の空白が少し深い |
| gridDew | 71 | プランク露（2px スナップ増） |
| layerShear | 100 | 層ずれオフセット |
| phaseSkip | 100 | 稀な1f欠落 |
| dualDrift | 100 | 1px 位相遅れ影 |
| quietRearrange | 100 | エイム中もごく稀な再配置 |
| edgeDoubleRuler | 140 | 縁の二重目盛り |
| densitySeam | 140 | 斜め密度の縫い目 |
| asymmetricAsh | 140 | 左右非対称の灰 |
| humCorners | 140 | 四隅の同相明滅 |
| signTicks | 200 | 欠けた目盛り |
| probeSplit | 200 | 上下で二密度 |
| wrongCadence | 200 | クラスタ周期の嘘 |
| blankStitch | 200 | 細い無描画の縫い目 |

## レア

| id | 解禁 | 感触 |
|---|---|---|
| antiSnowEcho | 90 | 逆マリンスノーの短い残響 |
| mirrorGrain | 100 | 右半分に鏡像ドリフトの気配 |
| totalStill | 120 | 一瞬ほぼ静止 |
| invertedHollow | 140 | 中央が濃く縁が空く |
| fourBeatBlink | 160 | 四隅が1拍消える |
| falseHorizon | 200 | 下端の偽地平線点列 |

## 抑制

霧・暗黒時代・静寂アノマリー時は既存の塵抑制が優先（ムードは物理に触れない）。
