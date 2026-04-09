# BattleScene Command Runtime Reference

- `UI-2-0035` 已明確指定：
  - `log.btn.auto/speed/setting/collapse` -> `F8`
  - `戰場附掛小 badge` 與 `戰場可點擊按鈕` 必須拆成兩套：`F7` 與 `F8`
- `UI-2-0053` 已明確指定：
  - `ActionCommand` 屬主 CTA / 指令層
  - `BattleLog` control rail 屬較低存在感的工具層，但仍需回到明確 family

建議目前的 canonical runtime 參考順序：

1. `assets/resources/ui-spec/layouts/action-command-main.json`
2. `assets/resources/ui-spec/layouts/battle-log-main.json`
3. `assets/resources/ui-spec/skins/action-command-default.json`
4. `assets/resources/ui-spec/skins/battle-log-default.json`
5. `artifacts/ui-qa/UI-2-0053/battle-main-ui-art-direction-audit.md`

備註：

- 這份 reference 先鎖 F8 的語言與層級，不代表 battle-log 與 action-command 一定共用同一組 underlay。
- 第一輪先產 glyph mother，再決定是嵌進現有 button surface，還是加 overlay image slot。
