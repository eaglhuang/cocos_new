# VFX Skills Bundle — 特效模組清單

> **規範版本**：2026-03-18
> 本清單是「特效與素材治理規範」的實踐（見 `/docs/keep.md` 條目 39–45）。
> **每次新增或刪除模組時，必須同步更新本清單。**

---

## 模組清單

| 資料夾 | PoolSystem Key | 使用狀態 | 呼叫位置 | 回收時間 |
|--------|---------------|---------|---------|---------|
| _(尚未建立特效模組)_ | — | — | — | — |

---

## 狀態說明

| 圖示 | 含義 | 行動 |
|------|------|------|
| ✅ Active | 程式碼已引用，會被打包進 Bundle | 維持 |
| 🚧 WIP | 開發中，暫不刪除 | 等待程式接入 |
| 📦 Archive | 準備廢棄，移至 `_archive/` | 待確認後整資料夾刪除 |

---

## 清理流程

1. **確認未被引用**：VS Code 全域搜尋 PoolSystem key 字串（如 `"Boom"`）
2. **移入暫存區**：整個模組資料夾移至 `_archive/[YYYY-MM-DD]-[effect-key]/`
3. **更新本清單**：狀態改為 📦 Archive
4. **Sprint Review 時審查** `_archive/`：確認可刪除後整資料夾刪除，並從本清單移除
5. **禁止**：只刪貼圖保留 Prefab（Cocos meta 殘留會汙染 library/）

---

## 新增模組規範

每個特效獨立一個資料夾，**資料夾名稱即為 PoolSystem 的 `key`**：

```
[effect-key]/
├── @256/          # 主貼圖 ≤256×256（粒子主貼圖）→ ETC2 / ASTC 4×4
├── @128/          # 輔助貼圖 ≤128×128（火星/煙霧輔助）→ ASTC 8×8
├── @no-compress/  # 禁壓縮（BMFont atlas / 漸層 LUT）→ 保持 PNG
├── prefabs/       # .prefab 特效預製體
└── README.md      # 一行說明：用途 | 關聯技能/事件 | 回收時間(秒)
```

刪除 `[effect-key]/` 整個資料夾 = 完整移除此特效，無殘留孤兒檔案。

---

## 搬移外部素材 Checklist（快速參考）

- [ ] `.png`：確認尺寸 → 放入 `[effect-key]/@256/` 或 `[effect-key]/@128/`
- [ ] `.prefab`：確認引用的腳本已在新專案中存在
- [ ] `.mtl`：更新 Shader 引用路徑
- [ ] 本清單新增一行，狀態標為 🚧 WIP
- [ ] `PoolSystem.register(key, prefab)` 接入後 → 狀態改為 ✅ Active
