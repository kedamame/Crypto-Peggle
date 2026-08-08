# DotShot (crypto-peggle) — Grok への引き継ぎ

更新: 2026-08-09。想定 HEAD: `58b8ca1` 以降（`master` = `origin/master`）。

**新規アカウント / 新しいチャットでも、リポジトリを clone（または pull）すればこのファイルが正本になる。**  
Claude memory や古い Cursor チャット履歴は不要。

---

## 起動プロンプト（新チャットの冒頭に貼る）

```
DotShot (crypto-peggle)。まず HANDOFF_GROK.md と CLAUDE.md を読め。
古い #54-65 タスクは完了済み。残タスクなし。ユーザーの新指示から始める。
computeTrajectory 不可侵・課金深度スキップ禁止。silent UI・クリーム地維持。
1ギミック実装ごとに tsc → ログ更新 → commit →（指示があれば）push。
```

---

## 0. 読む順

1. `CLAUDE.md`
2. `docs/CONCEPT.md`
3. `docs/GIMMICK_DESIGN_GUIDE.md`
4. `docs/COSMIC_GIMMICK_SPEC.md` §4
5. このファイル
6. `HANDOFF_CODEX.md`（配線落とし穴）/ `HANDOFF_CLAUDE.md`

行番号は書かない。`src/components/CryptoPeggleGame.tsx` はシンボル名で検索。

---

## 1. 現在地（2026-08-09）

| 項目 | 状態 |
|---|---|
| カタログ | Zone AA #186–#191 まで実装・封印済み |
| 残タスク | **なし**（ユーザー新指示待ち） |
| skipgate | lv35+ 時限ペグ — `b5da2cf` |
| クリア抽選 | ~0.7% 強ノイズ +10 — `b5da2cf` |
| 一撃ボレー | lv40+ → 弱ノイズ +4 — `e101efe` |
| skiptriad | lv48+ 同ボレー3星 → +6 — `048af5c` |
| 暗黒時代 HUD | クリームチップ — `e101efe` |
| 器バンパー | unique nest + 横主導 + dwell — `e101efe` |

スキップ入口: `beginLevelSkip`。課金で深度を買う機能は作らない（CONCEPT）。

---

## 2. 新規 Grok アカウントで消えるもの / 残るもの

| 残る（GitHub） | 消える |
|---|---|
| コード・`CLAUDE.md`・docs・この HANDOFF | 旧チャット履歴 |
| push 済みコミット | ローカル未 push・Smart Mode 履歴 |
| | Claude Desktop の `memory/handoff.md`（リポ外） |

同じ PC の Baseapp 配置なら親 `../CLAUDE.md`（OG/Satori 等）も有効。

---

## 3. 絶対規則（要約）

正典: `CLAUDE.md` §4・§7。

1. `computeTrajectory` 不可侵
2. 専用 `makeRng` を generateLevel **末尾**に（メイン rng 順を壊さない）
3. 詰み厳禁 / クリーム地不変 / 描画末尾 `globalAlpha = 1`
4. 新ハザード配列 → アノマリー空化リスト必須
5. silent — 宇宙を UI テキストで説明しない

8タッチポイント: `CLAUDE.md` §6。落とし穴: `HANDOFF_CODEX.md` §5。

---

## 4. 作業サイクル

ユーザーが「ギミックを一つ実装するごとにプッシュ」と言ったとき:

1. 実装
2. `npx tsc --noEmit`
3. 孤立 sim（推奨）
4. ログ3ファイル更新（CLAUDE / GUIDE / SPEC）
5. commit → `git push origin master`

PowerShell:

```powershell
git commit -m "$(@'
feat: short why message

'@)"
git push
```

push が Auto-review で止まる場合は、同じコマンドを Smart Mode 承認付きで再送。

---

## 5. 次のアクション

**ユーザーの新指示を待つ。**  
指示が来たら、まず `CLAUDE.md` と当該 SPEC 節を読み、1ギミックだけ実装する。
