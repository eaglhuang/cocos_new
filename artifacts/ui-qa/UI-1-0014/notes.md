# UI-1-0014 QA Notes

## 基本資料
- task_id: `UI-1-0014`
- legacy_id: `D-1`
- preview_host: `assets/scenes/LoadingScene.scene` -> root `LoadingScene` 元件 -> `previewMode=true` -> `previewTarget=LobbyMain`
- screen: `lobby-main-screen`
- layout: `lobby-main-main`
- skin: `lobby-main-default`
- target_nodes:
  - `NavBar`
  - `BtnBattle`
  - `BtnGenerals`
  - `BtnSupportCard`
  - `BtnGacha`
  - `BtnShop`
- target_slots:
  - `lobby.nav.btn`
  - `lobby.navbar.shadow`
- reference_area:
  - `docs/UI參考圖品質分析.md` Phase D / D-1
  - 圖 1 / 圖 3 左側導覽

## 預期輸出
- `lobby-main-phone-16-9.png`
- `lobby-main-phone-19_5-9.png`

## Capture Log
- capture_time:
- captured_by: Agent2
- editor_status: `http://localhost:7456` reachable
- preview_host_ready: yes
- notes: Agent2 已確認 `7456` 可連線，並嘗試以 headless Chrome 走自動截圖，但目前尚未形成穩定可重現的 CLI capture pipeline

## Blocker
- status: blocked-by-tooling
- reason: `UI-2-0018` 已提供正式 preview host，且本機 Editor 已可連線；目前阻塞改為缺少可穩定產出 artifact 的 headless capture 流程，已補開 `UI-2-0023`

## 評分欄位
- 導覽按鈕層次:
- 主要導覽辨識度:
- group shadow 存在感:
- 與參考圖差距:
- 整體判定:

## 後續
- active button state:
- inactive button consistency:
- navbar group shadow:
- follow_up_for_agent1:

## 結論
- result: blocked
- human_review:
