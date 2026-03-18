# 語系字型清單

> 管理所有語系字型的存在狀態與載入時機。
> **每次新增或刪除語系字型，必須同步更新本清單。**

---

## 語系字型狀態

| 語系 | FontRole | 檔案路徑 | 使用狀態 | 字集覆蓋 |
|------|---------|---------|---------|---------|
| zh-TW | body | `zh-TW/body.ttf` | 🚧 WIP（尚未放入字型檔） | 繁體中文 + ASCII |
| zh-TW | title | `zh-TW/title.ttf` | 🚧 WIP | 繁體中文 + ASCII |
| zh-CN | body | `zh-CN/body.ttf` | 🚧 WIP | 簡體中文 + ASCII |
| en | body | `en/body.ttf` | 🚧 WIP | ASCII + Latin |

---

## 說明

- **body** — 主要內文字型：對話框、工具提示、戰鬥紀錄
- **title** — 標題字型：UI 面板標題、武將名稱（允許與 body 使用同一個字型）

---

## 語系字型不存在時的行為

`I18nSystem.setLocale()` 在找不到字型時會**靜默略過**，使用 Cocos 系統預設字型。
這意味著多語系功能（`t(key)` 字串查詢）可以在沒有字型時正常運作。
字型的存在與否只影響 UI 視覺，不影響功能。

---

## 新增語系步驟

1. 建立 `locale/{locale}/` 資料夾（例如 `ja/`）
2. 放入 `body.ttf` 和 `title.ttf`（命名必須固定）
3. 在 `I18nSystem.ts` 的 `LocaleCode` 類型中新增 `'ja'`
4. 建立 `resources/i18n/ja.json`（字串翻譯檔）
5. 在本清單新增一行，狀態標為 🚧 WIP
6. 呼叫 `services().i18n.setLocale('ja')` 測試載入
7. 確認後狀態更新為 ✅ Active
