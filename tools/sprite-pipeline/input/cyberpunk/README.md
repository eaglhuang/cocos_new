# Cyberpunk VFX 素材輸入資料夾

請將 Cyberpunk Demo 匯出的原始 PNG 放入此資料夾（保留原始檔名，不需改名）。

執行方式：
```bash
node tools/sprite-pipeline/import-cyberpunk-vfx.js
```

腳本會依 `config/cyberpunk-import.config.json` 自動重命名並複製到正確的 `vfx_core/textures/` 子資料夾。

## 目前使用的 CocosCyberpunk 實際來源檔案（前 8 項）

| 原始檔名 | 放入此資料夾後的完整路徑 |
|---|---|
| `spark31.png` | `input/cyberpunk/spark31.png` |
| `teleporting_lighting.png` | `input/cyberpunk/teleporting_lighting.png` |
| `flash11.png` | `input/cyberpunk/flash11.png` |
| `laser002.png` | `input/cyberpunk/laser002.png` |
| `explode001.png` | `input/cyberpunk/explode001.png` |
| `AxeParticle001.png` | `input/cyberpunk/AxeParticle001.png` |
| `teleporting_circle.png` | `input/cyberpunk/teleporting_circle.png` |
| `trail002.png` | `input/cyberpunk/trail002.png` |
