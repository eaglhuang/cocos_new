---
title: UI Quality Tasks Index
generated: 2026-03-31
manifest: ../ui-quality-todo.json
---

# Tasks Index / UI Quality

> 任務狀態以 `docs/ui-quality-todo.json` 為準。
> 詳細說明與背景請參考 [CheckList.md](CheckList.md)。

| ID | Owner | Status | Link | 摘要 |
|---|---|---|---|---|
| UI-1-0001 | Agent2 | done | [UI-1-0001](tasks/UI-1-0001.md) | 將 `nav_ink` family 搬到 runtime 正式路徑 |
| UI-1-0002 | Agent2 | done | [UI-1-0002](tasks/UI-1-0002.md) | 將 `paper_utility` family 搬到 runtime 正式路徑 |
| UI-1-0003 | Agent2 | done | [UI-1-0003](tasks/UI-1-0003.md) | 將 `warning` family 搬到 runtime 正式路徑 |
| UI-1-0004 | Agent2 | done | [UI-1-0004](tasks/UI-1-0004.md) | 補齊 shadow / noise 家族素材 |
| UI-1-0014 | Agent2 | in-progress | [UI-1-0014](tasks/UI-1-0014.md) | 已開始 D-1 QA；`7456` 可連線，但仍缺少可重現的 headless capture 流程 |
| UI-1-0015 | Agent2 | in-progress | [UI-1-0015](tasks/UI-1-0015.md) | `ShopMain` / `Gacha` 都已可 headless capture，下一步是補 D-2 QA notes |
| UI-1-0016 | Agent2 | in-progress | [UI-1-0016](tasks/UI-1-0016.md) | `DuelChallenge.png` 已可輸出，下一步是補正式 QA notes |
| UI-2-0001 | Agent1 | done | [UI-2-0001](tasks/UI-2-0001.md) | `lobby-main-default` 接入 `nav_ink` |
| UI-2-0002 | Agent1 | done | [UI-2-0002](tasks/UI-2-0002.md) | `duel-challenge-default` 接入 `paper_utility` |
| UI-2-0003 | Agent1 | done | [UI-2-0003](tasks/UI-2-0003.md) | 新增 parchment 設計 token |
| UI-2-0004 | Agent1 | done | [UI-2-0004](tasks/UI-2-0004.md) | 新增淺底專用 label-style |
| UI-2-0005 | Agent1 | done | [UI-2-0005](tasks/UI-2-0005.md) | `button-skin` 支援 `selected` 第四態 |
| UI-2-0006 | Agent1 | done | [UI-2-0006](tasks/UI-2-0006.md) | 驗證 shared button family 的 border 20px 契約 |
| UI-2-0007 | Agent1 | done | [UI-2-0007](tasks/UI-2-0007.md) | shadow slot rollout umbrella task |
| UI-2-0008 | Agent1 | done | [UI-2-0008](tasks/UI-2-0008.md) | 建立 `item-cell` 標準 skin fragment |
| UI-2-0009 | Agent1 | done | [UI-2-0009](tasks/UI-2-0009.md) | 建立 `common-parchment` skin fragment |
| UI-2-0010 | Agent1 | done | [UI-2-0010](tasks/UI-2-0010.md) | `UIPreviewBuilder` 支援 shadow layer runtime |
| UI-2-0011 | Agent1 | done | [UI-2-0011](tasks/UI-2-0011.md) | `UIPreviewBuilder` 支援 noise overlay |
| UI-2-0012 | Agent1 | done | [UI-2-0012](tasks/UI-2-0012.md) | `duel.btn.accept` 接上 `equipment.primary` |
| UI-2-0013 | Agent1 | done | [UI-2-0013](tasks/UI-2-0013.md) | 首波 lobby / popup / duel shadow slot rollout |
| UI-2-0014 | Agent1 | done | [UI-2-0014](tasks/UI-2-0014.md) | 第二波 general / support / shop / gacha shadow slot rollout |
| UI-2-0015 | Agent1 | done | [UI-2-0015](tasks/UI-2-0015.md) | 第三波 battle / system shadow slot rollout |
| UI-2-0016 | Agent1 | done | [UI-2-0016](tasks/UI-2-0016.md) | 補齊 popup / Layout / legacy shadow 缺口 |
| UI-2-0017 | Agent1 | done | [UI-2-0017](tasks/UI-2-0017.md) | 修補 `general-detail-default` 缺失的 5 個 bleed slot |
| UI-2-0018 | Agent1 | done | [UI-2-0018](tasks/UI-2-0018.md) | 建立 D 階段 screen-driven preview harness |
| UI-2-0019 | Agent1 | done | [UI-2-0019](tasks/UI-2-0019.md) | 將 D-2 目標對齊到 `common-parchment / light-surface` |
| UI-2-0020 | Agent1 | done | [UI-2-0020](tasks/UI-2-0020.md) | 為 `shop-main` / `gacha` 補上 shared light-surface QA anchor |
| UI-2-0021 | Agent1 | done | [UI-2-0021](tasks/UI-2-0021.md) | 修復 PreviewInEditor 的 SpriteFrame 索引斷鏈 |
| UI-2-0022 | Agent1 | done | [UI-2-0022](tasks/UI-2-0022.md) | 升級 `general-list` 的 header/list/row 視覺皮膚 |
| UI-2-0023 | Agent1 | done | [UI-2-0023](tasks/UI-2-0023.md) | headless capture CLI 已可穩定輸出 `LobbyMain` / `ShopMain` / `DuelChallenge` |
| UI-2-0024 | Agent1 | completed | [UI-2-0024](tasks/UI-2-0024.md) | `UIPreviewBuilder.ts` 已完成第一階段拆分，診斷與文字目錄已抽離 |
| UI-2-0025 | Agent1 | done | [UI-2-0025](tasks/UI-2-0025.md) | `Gacha` preview 已對齊為 `gacha-main-screen` + `gacha-preview-main`，可成功輸出 `Gacha.png` |

補充說明
- 詳細狀態、owner 與依賴一律以 `docs/ui-quality-todo.json` 為主。
- 任務卡 frontmatter 若與索引不同，請同步修正任務卡與 manifest，避免 Agent 協作時讀到舊狀態。
