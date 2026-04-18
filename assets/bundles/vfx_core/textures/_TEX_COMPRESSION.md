# VFX Core — 貼圖壓縮規格

> 現有資料夾以語義命名（`icons/` / `rings/` / `shapes/`），因 Cocos meta UUID 依賴不可直接重命名。
> 本文件說明各資料夾的壓縮預算，與 `@SIZE` 命名規範等效對照（見 `/docs/keep.md (doc_index_0011)` (doc_index_0011) 條目 40）。
> **新建資料夾請直接使用 `@SIZE` 命名**，不存在此歷史包袱。

---

## 現有資料夾對照

| 資料夾 | 等效 @SIZE | 目標尺寸 | 建議壓縮格式 | 命名前綴 | 備註 |
|--------|-----------|---------|------------|---------|------|
| `icons/` | `@128` | ≤128×128 | ASTC 8×8 / ETC2 | `tex_icon_` | Buff / 技能圖示 |
| `rings/` | `@256` | ≤256×256 | ASTC 4×4 / ETC2 | `tex_ring_` | 環形光圈，需保留邊緣清晰 |
| `shapes/` | `@128` | ≤128×128 | ASTC 8×8 / ETC2 | `tex_shape_` | 箭頭、形狀輔助貼圖 |

---

## 新增貼圖規則

1. **`icons/` 新增**：確認原始圖為 128×128，命名 `tex_icon_[名稱].png`
2. **`rings/` 新增**：確認原始圖為 128×128 或 256×256，命名 `tex_ring_[名稱].png`
3. **`shapes/` 新增**：確認原始圖為 128×128，命名 `tex_shape_[名稱].png`
4. **更高精度需求**（BMFont atlas / 漸層 LUT / UI 主圖）：新建 `@no-compress/` 子資料夾

---

## Auto Atlas 設定

- 檔案：`textures/auto-atlas.pac`
- 最大尺寸：**2048×2048**
- 填充 (padding)：**2px**（防止 UV bleeding）
- 建議：`icons/` + `rings/` + `shapes/` 的所有 .png 均納入此 Atlas，減少 Draw Call

---

## 為何不直接重命名為 @SIZE？

Cocos Creator 的 `.meta` 檔案以 UUID 綁定每個資料夾。直接在磁碟重命名後，
引用這些貼圖的所有材質（`.mtl`）和場景（`.scene`）會失去連結，
需要在 IDE 中逐一重新指定（成本遠高於效益）。

**解法**：保留現有命名，以本文件作為壓縮規格說明。
新建的任何資料夾請直接使用 `@128` / `@256` / `@512` / `@no-compress` 命名。
