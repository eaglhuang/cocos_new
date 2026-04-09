# BattleScene Troop Type Runtime Reference

- 主要落點:
  - `TigerTallyPanel` 的 `typeBadge`
  - `UnitInfoPanel` 的 `typeIcon`

- family / suite:
  - `iconFamilyId`: `battle-badge-icon-v1`
  - `suiteScope`: `battle-troop-type-suite`
  - `structureMode`: `underlay-glyph`

- 首批成員:
  - `cavalry`
  - `infantry`
  - `shield`
  - `archer`
  - `pikeman`
  - `engineer`
  - `medic`
  - `navy`

- 系統規格保留成員:
  - `siege`
  - `smart`

- runtime 原則:
  - underlay 與 glyph 分離，保留 runtime 組裝
  - 若要兵種縮寫，由 runtime label 疊加，不烘字進 PNG
  - 需同時適應 `32x32` TigerTally badge 與 `38x38` UnitInfo icon
  - family 正規化以 `battle-scene-non-hud-troop-type-logical-box-manifest.json` 的 `logical box` 為準；`alpha bounds` 只作技術觀測，不作最終縮放決策

- 視覺 guardrails:
  - 不做商業勳章、轉蛋 tier badge、reward medal
  - 不做完整矩形 frame 或 ribbon
  - 保持 BattleScene 深墨戰場、冷調 tactical、克制金屬語言
