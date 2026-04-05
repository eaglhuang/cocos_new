# UI Spec Skeleton Scaffolder

日期: `2026-04-04`

## 目的

把 `Figma / slot-map / family naming` 直接落成 repo 內的三層 JSON 骨架：

- `assets/resources/ui-spec/layouts/<family>-main.json`
- `assets/resources/ui-spec/skins/<family>-default.json`
- `assets/resources/ui-spec/screens/<family>-screen.json`

這一步對照 Unity，比較像先從母型規格自動產出第一版 `Prefab hierarchy + Theme mapping + screen route contract`，再進入後續細修，而不是每次都從空白 Prefab 開始拼。

## 命令

```bash
node tools_node/scaffold-ui-spec-family.js --family-id spirit-tally-proto
```

可搭配常用參數：

```bash
node tools_node/scaffold-ui-spec-family.js ^
  --family-id bloodline-awakening ^
  --ui-id BloodlineAwakening ^
  --tabs overview,lineage,ritual ^
  --bundle lobby_ui ^
  --atlas-policy lobby ^
  --dry-run
```

也可以直接吃 proof mapping JSON：

```bash
node tools_node/scaffold-ui-spec-family.js --config artifacts/ui-qa/UI-2-0073/proof-mapping-template.detail-split.json
```

## 目前模板

- `detail-split`
- `dialog-card`
- `rail-list`

特徵：

- 全螢幕背景
- Shell frame / fill / bleed
- 左側角色卡 + 故事卡
- 右側 summary + tab bar + tab content
- footer CTA

這個模板就是為了接目前母板裡最常見的 `General Detail / Bloodline Mirror / Spirit Tally` 這種 family 起手式。

`dialog-card` 則是補 popup / confirm / reward / awaken 這類中央彈窗 family 的量產入口。

`rail-list` 則是補 codex / roster / selector / left-rail detail 這類列表導向 family 的量產入口。

## 驗證

本輪已確認：

- `node tools_node/scaffold-ui-spec-family.js --family-id automation-demo --tabs overview,lineage,ritual --dry-run`
- `node tools_node/check-encoding-touched.js --files package.json tools_node/scaffold-ui-spec-family.js`
- `node tools_node/scaffold-ui-spec-family.js --config artifacts/ui-qa/UI-2-0073/proof-mapping-template.dialog-card.json --dry-run`
- `node tools_node/scaffold-ui-spec-family.js --config artifacts/ui-qa/UI-2-0073/proof-mapping-template.rail-list.json --dry-run`
- `node tools_node/validate-ui-specs.js`

皆通過。

## 下一步

- 讓 Figma `09_Proof Mapping` 裡的 family naming 與 [figma-proof-mapping-contract-v1.md](C:/Users/User/3KLife/artifacts/ui-qa/UI-2-0073/figma-proof-mapping-contract-v1.md) 完全對齊
- 補第四種模板，例如 `story-strip-board`
- 把 slot-map 匯出格式收斂成能直接餵這支工具的中介 JSON
