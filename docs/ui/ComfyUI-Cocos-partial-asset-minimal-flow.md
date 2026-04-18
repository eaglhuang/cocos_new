<!-- doc_id: doc_ui_0037 -->
# ComfyUI x Cocos Partial Asset Minimal Flow

這份文件不是要把 `ComfyUI` 變成 UI factory 主幹，而是定義一條最小可用的實戰線：

1. 用 `ComfyUI` 生成或微修一個 `partial asset`
2. 進既有 `postprocess` / `asset-task-manifest` 流程
3. 匯入 `Cocos Creator 3.8.8`
4. 交回既有 `layout / skin / screen / runtime verify` 主幹

## 先講結論

這條線值得學，但只建議先學會 5 種能力：

1. `img2img`：拿既有 UI reference 或切件母圖做局部變體
2. `inpaint`：只修 panel 邊角、badge 底板、ornament 缺口
3. `upscale / detail pass`：把已選定的局部件補細節，不重畫整頁
4. `checkpoint / LoRA / sampler / steps` 的最小控制面
5. `queue / history / logs`：讓 Agent 能重跑、追蹤與除錯

先不要碰 5 種東西：

1. 整頁 UI 生圖後直接當 runtime 真相
2. 沒有 family / task manifest 就先開大量生圖
3. 一次裝太多 custom nodes，把 workflow 變成不可維護黑盒
4. 把 `ControlNet + 多 LoRA + 多段 refine` 當預設起手式
5. 把 `ComfyUI` 產出的 PNG 直接丟進 Cocos，不經 postprocess / border 檢查

## 這條線在你們專案中的定位

跟 Unity 對照：

- `ComfyUI` 比較像一個可腳本化的「素材加工工站」，不是 Unity Editor 本體。
- `cocos-mcp-server` 比較像 Editor automation bridge，負責把素材接回場景、Prefab、SpriteFrame 與節點層級。
- 真正的主幹仍是你們既有的 `UItemplate + widget + content contract + skin fragment`。

所以 `ComfyUI` 在這個專案的正確角色是：

1. `reference exploration`
2. `partial asset generation`
3. `partial asset repair`

不是：

1. 整頁 UI 真相來源
2. 取代 `layout / skin / screen`
3. 取代 `asset-task-manifest` 與 `runtime-verdict`

## 前置條件

截至 2026-04-08，本機可用狀態如下：

1. `ComfyUI` backend：`http://127.0.0.1:8000`
2. `comfyui-mcp`：已註冊到全域 MCP 設定
3. `cocos-creator` MCP：`http://127.0.0.1:3000/mcp`
4. Cocos Editor asset-db：`http://localhost:7456`

若 `8000` 已有回應，就直接沿用現成的 `ComfyUI`，不要重啟。

## 最小實戰：以單一 partial asset 為例

這裡故意不用「整頁商城介面」當示範，而用單一局部件。原因很簡單：

1. 容易驗證
2. 容易替換
3. 不會把 AI 生圖誤用成整頁真相

### Step 1. 先選一個正式 task，不要先選 prompt

先從既有 `asset-task-manifest.json` 選一個 task，例如：

1. `GeneralDetailOverview` 的 `header cap`
2. `GachaMain` 的 `pool-tier-badge underlay`
3. 任何已存在 `outputName` 的 badge / panel / cap 類任務

原則：

1. 任務要已經存在於正式 manifest
2. `outputName` 要明確
3. 後處理規則要已知

這樣 `ComfyUI` 只是負責產 raw PNG，不負責決定 runtime 契約。

### Step 2. 用 ComfyUI 只生成 raw partial asset

建議的最小 prompt 心法：

1. 先描述用途：`UI badge underlay` / `ornate panel cap` / `header ornament`
2. 再描述材質語言：`aged bronze`, `deep ink`, `cold blue neon`, `parchment gold`
3. 最後描述限制：`isolated asset`, `transparent or plain background`, `not a full screen UI`

示意 prompt：

```text
an isolated fantasy UI badge underlay, aged bronze and dark enamel, subtle engraved border, centered composition, no full screen interface, no characters, suitable for game UI partial asset
```

建議起手參數只保留最少集合：

1. `checkpoint`
2. `lora` 與單一 `lora_strength`
3. `steps`
4. `cfg`
5. `width / height`

不要一開始就把 workflow 堆到過度複雜。

### Step 3. 讓 raw 檔名直接對齊正式 outputName

若這輪是單 task，最省事的做法是：

1. 把 `ComfyUI` 輸出檔改名成 manifest 裡的 `outputName`
2. 放到同一個 raw input 目錄

例如：

```text
artifacts/ui-generated/comfy-gacha-badge-raw/pool-tier-badge_badge_underlay.png
```

這樣後面可以直接用 batch runner，不用再補 `selection-map`。

### Step 4. 接既有 postprocess，不要直接進 Cocos

若 raw 檔名已對齊 task：

```bash
npm run postprocess:ui-asset-batch -- \
  --manifest artifacts/ui-source/gacha-main/manifests/asset-task-manifest.json \
  --input-dir artifacts/ui-generated/comfy-gacha-badge-raw \
  --task-id gacha-main-pool-tier-badge-badge-underlay \
  --generated-root artifacts/ui-generated/comfy-gacha-badge-processed \
  --strict
```

若這輪是從整頁圖先切到 `selected`，再改走：

```bash
npm run postprocess:ui-asset-selected -- \
  --manifest artifacts/ui-source/<screen-id>/manifests/asset-task-manifest.json \
  --selected-dir artifacts/ui-generated/<slice-run>/selected/<bucket> \
  [--selection-map artifacts/ui-source/<screen-id>/manifests/<map>.json] \
  --generated-root artifacts/ui-generated/<run-id> \
  --strict
```

### Step 5. 匯入 Cocos，再做資產刷新

最小做法不是立刻自動畫節點，而是先把 processed asset 進 asset-db：

1. 確認 processed PNG 已落在專案資產策略允許的位置
2. 跑 asset refresh：

```bash
curl.exe http://localhost:7456/asset-db/refresh
```

你們 workspace 也已經有 `Cocos Creator compile` task 可直接用。

### Step 6. 再把 SpriteFrame 接回 UI 節點

這一步才是 `cocos-mcp-server` 該接手的地方。

建議順序：

1. 找到既有 UI 節點
2. 確認它是不是應該沿用既有 Prefab / Panel 結構
3. 再替換 `Sprite` / `SpriteFrame`
4. 需要時把 `spriteType` 設成 `SLICED`
5. 若 manifest 已定義 border，沿用 manifest，不要由 Agent 即興猜

對 Unity 使用者來說，這一步很像：

1. 不直接手改 GameObject tree 當真相
2. 而是先確認 prefab contract，再替換 Sprite asset reference

## 最小命名規則

若要讓 `ComfyUI -> postprocess -> Cocos` 這條線穩定，最少要守這 4 條：

1. raw 檔名優先對齊 `outputName`
2. 單 task 單輸出，避免一個 raw 目錄裡混太多 screen
3. run-id 要帶 screen 語意，例如 `comfy-gacha-badge-raw`
4. processed 輸出與 raw 輸出分開，不共用目錄

## 你們專案現在最該學的 ComfyUI 能力

### P0. 立刻可用

1. `txt2img` 做 reference exploration
2. `img2img` 做局部語言一致的 partial asset 變體
3. `inpaint` 修 panel 邊緣、ornament 缺口、徽章底板
4. `history / queue / logs` 讓 Agent 可回放與除錯
5. 基本模型管理：列 checkpoints、列 LoRAs、固定一組已驗證模型

### P1. 很快會用到

1. `upscale` / detail refine
2. 參數 sweep：只掃 `cfg / steps / sampler / seed`
3. 單一參考圖控制的 `ControlNet` 或 equivalent layout guidance

### P2. 先不要急

1. 多模型串接
2. 複雜 workflow 自動組圖
3. 大量 custom node pack
4. video / audio / 3D 相關支線

## 現在先不要碰的東西

1. 把整頁 UI 直接交給 `ComfyUI` 生完再切
2. 一次上很多 LoRA，最後不知道誰在主導風格
3. 每個 screen 都換 checkpoint
4. 沒有 `manifest / outputName / review` 就讓 Agent 自由生成
5. 讓 Agent 直接在 Cocos 裡大量建新節點，卻沒有對應 `layout / skin / screen` 契約

## 建議的 adoption 順序

### 第 1 階段

只做一件事：

1. 用 `ComfyUI` 生成單一 `badge / cap / panel fragment`
2. 接 `postprocess`
3. 匯入 Cocos 替換現有 SpriteFrame

### 第 2 階段

擴到一個 screen 的 2 到 3 個 partial asset：

1. underlay
2. badge plate
3. cap / ornament

### 第 3 階段

才考慮把 `ComfyUI` 接到：

1. reference prompt card
2. task manifest 批次 raw generation
3. Cocos MCP 自動替換多個 SpriteFrame

## 這條線的完成定義

最小完成，不是「看起來有圖了」，而是：

1. `ComfyUI` 產出的 raw asset 有明確 task 對應
2. 已跑既有 `postprocess`
3. Cocos asset-db 已 refresh
4. UI 節點已成功換上新 SpriteFrame
5. 至少補一份 `generated-review` 或 runtime 驗證結論

只要少一項，就還不算真正進到你們的量產主幹。
