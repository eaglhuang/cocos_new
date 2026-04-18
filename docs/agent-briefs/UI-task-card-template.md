<!-- doc_id: doc_task_0132 -->
# UI Task Card Template

這份模板用來建立新的 UI 任務卡，目的不是增加文書，而是強制把量產路徑寫清楚，避免每張卡都重新發明 workflow。

## Frontmatter 範例

```yaml
---
id: UI-2-XXXX
priority: P1
phase: D
created: 2026-04-05
created_by_agent: AgentX
owner: AgentX
status: open
type: template-integration
related_cards:
  - UI-2-YYYY
depends:
  - UI-2-ZZZZ
template_family: detail-split
content_contract:
  - storyStripCells
  - crestState
skin_fragments:
  - general_detail/detail_summary_card_bg
  - common-parchment/card_body
smoke_route: LobbyScene.onClickGeneralDetailOverviewSmoke
docs_backwritten:
  - docs/keep.md (doc_index_0011)
  - docs/UI 規格書.md (doc_ui_0027)
  - docs/cross-reference-index.md (doc_index_0005)
notes: "YYYY-MM-DD | 狀態: open | 驗證: pending | 變更: 待開始 | 阻塞: none"
---
```

## 必填檢查

每張新 UI 卡至少要明確寫出：

1. `template_family`
2. `content_contract`
3. `skin_fragments`
4. `smoke_route`
5. `docs_backwritten`

若其中任一項無法填，代表這張卡還沒進入正式量產入口，應先補 family / contract / fragment / preview 定義。

## 開卡順序

1. 先讀 [keep.md](C:\Users\User\3KLife\docs\keep.md (doc_index_0011)) (doc_index_0011) §19
2. 再讀 [UI 規格書.md (doc_ui_0027)](C:\Users\User\3KLife\docs\UI 規格書.md (doc_ui_0027)) §8.2
3. 再對照對應系統正式規格書
4. 最後才建立或接手任務卡

## 任務卡內容原則

- `template_family` 描述這張 UI 屬於哪個既有母型，不是填畫面名稱。
- `content_contract` 描述角色或資料差異，不是列 runtime workaround。
- `skin_fragments` 描述實際要重用或新增的視覺 fragment。
- `smoke_route` 描述最小可驗證路徑，沒有 smoke route 的 UI 任務不算真正可驗。
- `docs_backwritten` 描述完成後要同步的正式文件，不可只寫補遺。

## 結案檢查

- 任務卡 frontmatter、`docs/ui-quality-todo.json`、`tasks_index.md` (doc_task_0002) 狀態一致
- 正式規格已回寫
- `cross-reference-index.md` (doc_index_0005) 已同步
- 已跑過至少一條 smoke / preview / acceptance 驗證
