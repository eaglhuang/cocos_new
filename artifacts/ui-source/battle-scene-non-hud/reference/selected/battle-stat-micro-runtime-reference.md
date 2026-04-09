# BattleScene Stat Micro Runtime Reference

- 首批成員：
  - `atk`: 攻擊
  - `hp`: 生命
  - `cost`: 軍糧 / 補給
- 第二批保留：
  - `def`: 防禦
  - `spd`: 速度

- 目前 docking target：
  - `TigerTallyPanel`
    - `AtkLabel`
    - `HpLabel`
    - `CostBadge`
  - `UnitInfoPanel`
    - `AtkRow`
    - `HpRow`
    - `CostRow`
    - `DefRow` / `SpdRow` 保留到第二批

- cost 語意約束：
  - 視為軍糧、補給、出征消耗
  - 不可視為金幣、元寶、抽卡券、商城貨幣

- 尺寸與可讀性：
  - `16px ~ 24px` 仍需辨識
  - 需適應深色半透明 drawer / battle card 背景
  - 不得依賴厚重底牌或高亮外框才看得清楚

- 禁止內容：
  - 文字 / 字母 / 數字
  - 貨幣 coin / gem / ticket
  - full badge / button frame / ornate medal
