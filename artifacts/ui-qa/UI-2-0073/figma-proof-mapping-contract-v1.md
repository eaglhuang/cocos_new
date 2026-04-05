# Figma 09 Proof Mapping Contract v1

日期: `2026-04-04`

## 目的

把 Figma `09_Proof Mapping` 的欄位，收斂成 `tools_node/scaffold-ui-spec-family.js --config <json>` 可直接吃的輸入契約。

這樣 `proof -> wireframe -> slot-map -> ui-spec skeleton` 不再只是人看得懂，而是機器也能直接接手。

## 欄位

以下欄位建議作為 `09_Proof Mapping` 每一列的固定欄位：

| 欄位 | 必填 | 說明 | 範例 |
| --- | --- | --- | --- |
| `familyId` | 是 | kebab-case family id，也是三層 JSON 的命名根 | `bloodline-awakening` |
| `uiId` | 否 | UIManager 使用的 UI ID，預設由 `familyId` 轉 PascalCase | `BloodlineAwakening` |
| `template` | 是 | 目前支援 `detail-split`、`dialog-card`、`rail-list` | `dialog-card` |
| `layer` | 否 | Screen layer，預設 `Popup` | `Popup` |
| `bundle` | 否 | bundle 名稱，預設 `lobby_ui` | `lobby_ui` |
| `atlasPolicy` | 否 | skin atlas policy，預設 `lobby` | `lobby` |
| `titleKey` | 否 | 標題 i18n key | `ui.bloodline-awakening.title` |
| `bodyKey` | 否 | 內文 i18n key，特別適合 `dialog-card` | `ui.bloodline-awakening.body` |
| `primaryKey` | 否 | 主要 CTA i18n key | `ui.confirm` |
| `secondaryKey` | 否 | 次要 CTA i18n key | `ui.cancel` |
| `tabs` | 條件式 | `detail-split` 使用的 tab 陣列 | `["overview","lineage","ritual"]` |
| `railItems` | 條件式 | `rail-list` 使用的左側 rail item 陣列 | `["entry-alpha","entry-beta","entry-gamma"]` |
| `proofVersion` | 建議 | 對應 proof / select 版本 | `v3` |
| `figmaFrame` | 建議 | Figma frame 名稱或 URL | `Screen/BloodlineMirror/AwakeningDialog` |
| `wireframeRef` | 建議 | wireframe frame 名稱 | `Wireframe/BloodlineMirror/Dialog` |
| `slotMapRef` | 建議 | slot-map frame 名稱 | `SlotMap/BloodlineMirror/Dialog` |
| `notes` | 否 | 供人看懂的上下文，不參與生碼 | `命鏡覺醒前的確認彈窗` |

## 命名規範

- `familyId` 一律使用 kebab-case。
- `layout` 固定輸出為 `<familyId>-main.json`
- `skin` 固定輸出為 `<familyId>-default.json`
- `screen` 固定輸出為 `<familyId>-screen.json`
- slot prefix 固定由 `familyId` 的 `-` 轉成 `.`。

例：

- `familyId = bloodline-awakening`
- slot prefix = `bloodline.awakening`
- 產出：
  - `bloodline-awakening-main.json`
  - `bloodline-awakening-default.json`
  - `bloodline-awakening-screen.json`

## 對應 CLI

```bash
node tools_node/scaffold-ui-spec-family.js --config artifacts/ui-qa/UI-2-0073/proof-mapping-template.detail-split.json
```

```bash
node tools_node/scaffold-ui-spec-family.js --config artifacts/ui-qa/UI-2-0073/proof-mapping-template.dialog-card.json --dry-run
```

```bash
node tools_node/scaffold-ui-spec-family.js --config artifacts/ui-qa/UI-2-0073/proof-mapping-template.rail-list.json --dry-run
```

## 建議版面

Figma `09_Proof Mapping` 每個 family 建議固定出現兩層：

1. 人讀層
   - proof image
   - selected proof
   - wireframe
   - slot-map
   - 備註

2. 機器層
   - `familyId`
   - `template`
   - `uiId`
   - `bundle`
   - `atlasPolicy`
   - `titleKey`
   - `bodyKey`
   - `primaryKey`
   - `secondaryKey`
   - `tabs`

## Unity 對照

- `familyId` 類似 Prefab family / Variant family 的主鍵
- `template` 類似套用哪種母型 Prefab
- `bundle / atlasPolicy / skin` 類似資源包與 Theme 映射設定
- `09_Proof Mapping` 這整張表，等同 concept board 與實作契約之間的中介層
