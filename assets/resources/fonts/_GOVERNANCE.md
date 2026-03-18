# 字型資源治理規範

> **適用範圍**：`assets/resources/fonts/` 下所有字型資產
> **原則**：目錄即文件 — 看到資料夾名稱就能知道用途與管理方式

---

## 目錄結構與分類原則

```
resources/fonts/
├── _GOVERNANCE.md       ← 本文件
│
├── vfx/                 ← VFX 飄字 BMFont（語系無關，永遠載入，@no-compress）
│   ├── dmg_normal/      ← FloatTextType: 'dmg_player' / 'dmg_enemy'（普通傷害）
│   │   ├── dmg_normal.fnt
│   │   └── dmg_normal_0.png
│   ├── dmg_crit/        ← FloatTextType: 'dmg_crit'（暴擊）
│   │   ├── dmg_crit.fnt
│   │   └── dmg_crit_0.png
│   └── dmg_miss/        ← FloatTextType: 'dmg_miss'（閃避）
│       ├── dmg_miss.fnt
│       └── dmg_miss_0.png
│
└── locale/              ← 語系 UI 字型（隨語系切換懶載入/卸載）
    ├── _MANIFEST.md     ← 語系字型狀態清單
    ├── zh-TW/
    │   ├── body.ttf     ← FontRole: 'body'（內文）
    │   └── title.ttf    ← FontRole: 'title'（標題）
    ├── zh-CN/
    │   ├── body.ttf
    │   └── title.ttf
    └── en/
        ├── body.ttf
        └── title.ttf
```

---

## 兩大分類的核心差異

| 面向 | `vfx/`（VFX BMFont） | `locale/`（語系 UI 字型） |
|------|---------------------|------------------------|
| 語系相關 | ❌ 純視覺，數字 / Miss | ✅ 不同語言需不同字型 |
| 載入時機 | 遊戲初始化一次載入 | 切換語系時懶載入 |
| 卸載時機 | 遊戲結束時 | 切換語系後自動卸載前一語系 |
| 管理系統 | `FloatTextSystem.registerFont()` | `I18nSystem.setLocale()` 自動管理 |
| 壓縮格式 | **@no-compress（禁止有損壓縮）** | TTF / OTF 不壓縮 |
| 參照方式 | `FloatTextType` key | `FontRole` ('body' / 'title') |

---

## VFX BMFont 使用方式

```typescript
// 1. 由 ResourceManager 載入
const critFont = await services().resource.loadFont('fonts/vfx/dmg_crit/dmg_crit');

// 2. 註冊至 FloatTextSystem（在 BattleScene 初始化時做）
services().floatText.registerFont('dmg_crit', critFont);

// 3. 往後顯示暴擊傷害，自動套用 BMFont
services().floatText.show('dmg_crit', '999', worldPos);
```

> **注意**：BMFont `.fnt` 外的 atlas PNG 必須放在同一目錄，
> Cocos 才能自動找到 atlas 貼圖。`.fnt` 和 `_0.png` 是配對資源，一起移動或刪除。

---

## 語系字型使用方式

```typescript
// 切換語系（I18nSystem 自動載入字型）
await services().i18n.setLocale('en');

// 在 UI Label 中套用語系字型
const font = services().i18n.getFont('body');
if (font) nameLabel.font = font;

// 訂閱語系切換以即時更新 UI
this._unsubI18n = services().i18n.onLocaleChanged(() => {
    const f = services().i18n.getFont('body');
    if (f) nameLabel.font = f;
});
// onDestroy() { this._unsubI18n?.(); }
```

---

## 新增字型的 Checklist

**VFX BMFont（`vfx/[name]/`）**：
- [ ] 原始美術提供 `.fnt` + `_0.png`（@no-compress）
- [ ] 建立 `vfx/[name]/` 資料夾，放入這兩個檔案
- [ ] 在 `FloatTextSystem.ts` 的 `FloatTextType` 中新增類型（若是新類型）
- [ ] 在 `FLOAT_CONFIGS` 中新增對應設定（color / fontSize / durationMs 等）
- [ ] 在啟動時呼叫 `services().floatText.registerFont(type, font)`

**語系字型（`locale/{locale}/`）**：
- [ ] 確認字型涵蓋目標語言的完整字集
- [ ] 命名符合 FontRole：`body.ttf` 或 `title.ttf`
- [ ] 更新 `locale/_MANIFEST.md`
- [ ] `I18nSystem.setLocale()` 會自動載入，無需額外呼叫

---

## 禁止事項

- ❌ 不可在 `vfx/` 下放 `.ttf` 語系字型（兩類混放）
- ❌ 不可對 BMFont atlas（`_0.png`）套用有損壓縮（ETC2 / ASTC 會破壞字體邊緣）
- ❌ 不可在 `locale/` 下放只有特效用途的 BMFont
- ❌ 不可直接刪除 `.fnt` 而保留 `_0.png`（配對資源必須一起刪除）
