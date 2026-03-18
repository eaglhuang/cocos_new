# VFX Skills Bundle

> **請參閱 [`_MANIFEST.md`](./_MANIFEST.md)**——這是本 Bundle 的正式模組清單與治理文件。

本 Bundle 放置武將/兵種的**獨立技能特效**，每個特效為一個獨立模組資料夾。
因技能特效數量龐大且不會每場戰鬥都出現，可規劃為 Remote Bundle（動態下載）。

## 快速規則

- **資料夾名稱 = PoolSystem key**（例如 `boom/` → `PoolSystem.register("boom", prefab)`）
- **貼圖子資料夾使用 @SIZE 命名**（`@256/`、`@128/`、`@no-compress/`）
- **不用的特效** → 移至 `_archive/` 後整刪，不要留孤兒檔案
- **新增/刪除模組** → 必須同步更新 `_MANIFEST.md`

