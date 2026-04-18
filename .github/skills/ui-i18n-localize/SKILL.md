---
doc_id: doc_agentskill_0026
name: ui-i18n-localize
description: 'UI 多語在地化 SKILL — 從 zh-TW 基礎語系延伸 zh-CN / en / ja 語系 JSON，保留變數格式並輸出寬度風險摘要。USE FOR: 新 UI 鍵值落地後補多語、批次更新某個畫面的翻譯、先做文字長度風險盤點。DO NOT USE FOR: 純 runtime layout polish、直接修改非 i18n 的顯示文案。'
argument-hint: '提供鍵值範圍、目標語系與畫面名稱，並說明要翻譯草稿、補檔、還是產出 overflow 風險摘要。'
---

# UI I18N Localize

把目前專案以 `zh-TW` 為基礎語系的 UI 字串，穩定擴到其他已支援語系。

Unity 對照：相當於先把 Localization Table 補齊，再檢查切換後是否擠壓 TextMeshPro 版位。

## 目前以 repo 為準的支援語系

以 `assets/scripts/core/systems/I18nSystem.ts` 為正式依據：

- `zh-TW`
- `zh-CN`
- `en`
- `ja`

未正式支援的語系不要直接擴，例如 `ko-KR`。

## 何時使用

- 新增一批 `ui.*` 鍵值後，要補對應 locale 檔
- 既有畫面要先做多語長度風險檢查
- 要整理術語一致性，例如武將、血脈、覺醒、虎符

## 必守規則

- `zh-TW` 是基礎真相來源
- 保留 `{0}`、`{1}` 等 placeholder，不翻譯也不改編號
- 不直接在元件內硬寫多語文案，仍以 `resources/i18n/<locale>.json` 為主
- 術語要前後一致，不要同一輪出現多套英譯

## 標準流程

### 1. 讀取基礎語系

以 `assets/resources/i18n/zh-TW.json` 為準，先限定這輪要處理的 scope。

### 2. 讀取 UI 限制

參考：

- `assets/resources/ui-spec/ui-design-tokens.json`
- 目標畫面的 layout / screen / canonical capture

先標記高風險欄位，例如：

- header title
- tab label
- CTA button
- 數值與稱號同排欄位

### 3. 產出 locale 檔

目標檔案：

- `assets/resources/i18n/zh-CN.json`
- `assets/resources/i18n/en.json`
- `assets/resources/i18n/ja.json`

若檔案不存在就建立，存在就只補這輪 scope。

### 4. 產出風險摘要

建議輸出到：

`artifacts/ui-i18n/<screen-or-scope>-overflow-report.md`

至少列出：

- 鍵值
- `zh-TW`
- 各語系譯文
- 風險等級：低 / 中 / 高
- 備註：是否建議縮句或改 layout

### 5. 視需要做 runtime 抽查

若目標畫面已有固定 preview route，再搭配 `ui-runtime-verify` 做語系切換後截圖驗證。

## 長度判斷原則

- `en` 通常是主要風險來源，先檢查按鈕、tab、短標題
- `ja` 容易在稱號、說明文產生密度問題
- 若翻譯長度已明顯超出既有欄寬，優先產出風險報告，不要硬塞進正式檔後才讓 runtime 爆版

## 與其他 skills 的銜接

- 畫面規格還沒整理好：先用 `ui-brief-generator`
- 需要看實際溢出版位：接 `ui-runtime-verify`
