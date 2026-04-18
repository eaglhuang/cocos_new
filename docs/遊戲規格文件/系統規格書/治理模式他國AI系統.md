<!-- doc_id: doc_spec_0020 -->
# 治理模式他國 AI 系統（Governance Mode Rival AI System）

> 本文件定義非玩家勢力（他國 AI）在治理模式中的資源管理、擴張決策、外交行為與武將經營邏輯。
> 補充參考：SLG 遊戲養成與商業化討論.md (doc_spec_0129) 對 AI 掠奪、地窖保底與糧草壓力收斂提出商業化視角。
> 格式：A–J 標準規格

---

## A. 系統描述

治理模式他國 AI 系統負責模擬玩家以外的所有三國勢力的內政、經濟、軍事與外交行為。每個 AI 國家擁有獨立的武將池、資源儲量、領地版圖，並在每季結算時根據 **AI 國家性格（Nation Profile）** 自動執行治理任務、調兵遣將、外交斡旋。

**Unity 對照**：類似 `Total War` 系列的 Campaign AI。每個 AI 國家相當於一個獨立的 `FSM（有限狀態機）`，根據勢力狀態在「內政發展」「軍事擴張」「外交結盟」「防守收縮」四種大狀態間切換。與 Unity 中 `State Machine` + `Utility AI（效用函數）` 的組合概念接近。

**核心職責**：
- 管理每個 AI 國家的季度內政結算（五大治理任務：農耕/商業/外交/軍備/偵查）
- 驅動 AI 國家的擴張/防守決策（出征判定、目標選擇）
- 模擬多國外交關係（結盟/敵對/中立/背叛）
- 控制 AI 國家的武將招募、養成與退役流程
- 提供與玩家的互動介面（貿易、外交、宣戰）
- 確保 AI 國家的行為符合史實性格（曹操好戰、劉備仁義、孫權穩守）

---

## B. 系統目的

| 目的 | 說明 |
|---|---|
| 世界活力 | AI 國家持續變動，讓世界不是靜態的 NPC 佈景 |
| 戰略壓力 | AI 國家會擴張、搶資源、結盟對抗玩家 → 迫使玩家思考全局 |
| 歷史沉浸 | 各國 AI 性格參照史實 → 玩家體驗「如果歷史重來」的樂趣 |
| 外交博弈 | 合縱連橫、貿易封鎖、背叛反水 → 策略深度大幅提升 |
| 傭兵市場供給 | AI 國家是傭兵武將的來源（退役武將流入傭兵市場） |
| 長線目標 | 統一天下（征服/外交勝利）需要長期與 AI 國家互動 |

---

## C. 商業套路

| 套路 | 付費轉化點 |
|---|---|
| 情報解鎖 | 偵查 AI 國家的兵力/資源/外交需要情報點數 → 付費加速情報獲取 |
| 外交禮物 | 送 AI 國主禮物（精元購買）可快速提升邦交 → 避免戰爭 |
| 緊急軍備 | AI 國家宣戰前有「情報預警」→ 玩家可付費緊急徵兵 |
| 傭兵搶人 | 稀有退役武將進入傭兵市場 → 玩家與 AI 國家競標 → 結義點數/精元消耗 |
| 和平紅利 | 與 AI 結盟可打開貿易路線 → 資源兌換比率優惠 → 但維持結盟需持續投入 |
| 劇情分支 | AI 國家的滅亡/興起觸發獨特劇情 → 付費解鎖完整劇情線 |

---

## D. 系統 TA

| 玩家類型 | 他國 AI 系統滿足點 |
|---|---|
| 策略大師 | 多國博弈、合縱連橫、資源戰 → 高階策略需求 |
| 歷史愛好者 | 曹操/劉備/孫權各有鮮明性格 → 「如果我是諸葛亮」的體驗 |
| 養成黨 | AI 國家的退役武將進入傭兵市場 → 擠壓養成資源的壓力感 |
| 探索型 | AI 國家的領地、事件、劇情 → 世界探索內容 |
| 社交型 | 外交系統（結盟/貿易/聯姻）→ 擬社交互動 |

---

## E. 製作功能清單

### E-1. AI 國家定義

| 勢力 | 代號 | Nation Profile | 初始領地數 | 特色 |
|---|---|---|---|---|
| 魏 | WEI | MILITARIST | 5 | 曹操：軍事擴張優先，高品質騎兵 |
| 蜀 | SHU | DIPLOMAT | 3 | 劉備：仁義外交，防守為主 |
| 吳 | WU | GUARDIAN | 4 | 孫權：水軍優勢，穩健防守 |
| 群雄-呂布 | LVBU | WARLORD | 1 | 呂布：極端好戰，不結盟 |
| 群雄-袁紹 | YUAN | EXPANSIONIST | 4 | 袁紹：人海戰術，前期強勢 |
| 群雄-劉璋 | LIUZHANG | PASSIVE | 2 | 劉璋：幾乎不擴張，易被征服 |
| 群雄-馬騰 | MATENG | CAVALRY_LORD | 2 | 馬騰：西涼騎兵，局部強勢 |
| 南蠻 | NANMAN | RAIDER | 2 | 孟獲：掠奪型，週期性入侵 |

### E-2. Nation Profile（勢力性格模板）

| Profile | 內政偏好 | 軍事偏好 | 外交偏好 | 擴張傾向 |
|---|---|---|---|---|
| MILITARIST | 軍備 60%、農耕 30%、偵查 10% | 積極出征、騎兵/步兵主力 | 低外交、威脅為主 | 高（每 3~4 季嘗試出征） |
| DIPLOMAT | 農耕 40%、外交 30%、商業 20%、軍備 10% | 防守為主、結盟互助 | 高外交、主動結盟 | 低（除非被攻擊才反攻） |
| GUARDIAN | 軍備 40%、商業 30%、農耕 20%、偵查 10% | 水軍/盾兵防守、地形優勢 | 中等、選擇性結盟 | 中（時機成熟才出手） |
| WARLORD | 軍備 80%、農耕 20% | 全力攻擊、不留預備 | 不結盟、四面樹敵 | 極高（每季嘗試出征） |
| EXPANSIONIST | 軍備 50%、農耕 30%、商業 20% | 人海戰術、全線推進 | 買盟友（金錢外交） | 高（前期激進、中期衰退） |
| PASSIVE | 農耕 50%、商業 30%、軍備 10%、外交 10% | 幾乎不出征 | 被動接受結盟 | 極低（幾乎不擴張） |
| CAVALRY_LORD | 軍備 50%、農耕 40%、偵查 10% | 騎兵特化、快速突擊 | 低外交 | 中高（只對鄰國出征） |
| RAIDER | 軍備 70%、農耕 30% | 掠奪為主、不佔領 | 不外交 | 週期性（每 6 季侵襲一次） |

### E-3. AI 季度內政結算

```
// 每季度結算（與玩家同步）
function AI_GovernanceTick(nation: AINation): void {
    // 1. 根據 Nation Profile 分配武將到治理任務
    const assignments = allocateGenerals(nation.generals, nation.profile);

    // 2. 計算各任務產出（使用與玩家相同的公式）
    for (const task of assignments) {
        switch (task.type) {
            case 'FARMING':
                nation.food += Base(100) + task.general.POL * 2;
                break;
            case 'COMMERCE':
                nation.gold += Base(50) + task.general.CHA * 3;
                break;
            case 'DIPLOMACY':
                nation.fame += Base(20) + (task.general.INT + task.general.CHA) * 1;
                break;
            case 'MILITARY':
                nation.troops += Base(80) + task.general.STR * 2;
                break;
            case 'RECON':
                nation.intel += Base(30) + task.general.INT * 2;
                break;
        }
    }

    // 3. AI 效率修正（模擬 AI 國家管理能力差異）
    applyEfficiencyMod(nation);
    // MILITARIST: 軍備 ×1.2, 農耕 ×0.9
    // DIPLOMAT: 外交 ×1.3, 軍備 ×0.8
    // GUARDIAN: 全項 ×1.0（均衡）
    // PASSIVE: 農耕 ×1.1, 軍備 ×0.6

    // 4. 資源上限檢查（與玩家共用上限）
    nation.food = Math.min(nation.food, RESOURCE_CAP.Food);
    nation.gold = Math.min(nation.gold, RESOURCE_CAP.Gold);
    nation.troops = Math.min(nation.troops, RESOURCE_CAP.Troops);
    nation.fame = Math.min(nation.fame, RESOURCE_CAP.Fame);
}
```

### E-4. AI 擴張決策

```
// 每季結算後評估是否出征
function AI_EvaluateExpansion(nation: AINation): ExpansionDecision {
    // 1. 檢查資源門檻
    if (nation.troops < MIN_TROOPS_FOR_ATTACK) return HOLD;  // 兵力不足
    if (nation.food < FOOD_FOR_CAMPAIGN) return HOLD;        // 糧草不足

    // 2. 根據 Profile 判斷出征意願
    const willingness = EXPANSION_WILLINGNESS[nation.profile];
    // WARLORD=0.9, MILITARIST=0.7, EXPANSIONIST=0.7, CAVALRY_LORD=0.5
    // GUARDIAN=0.3, DIPLOMAT=0.2, PASSIVE=0.05, RAIDER=special

    if (Math.random() > willingness) return HOLD;

    // 3. 選擇目標（效用函數）
    const targets = getAdjacentNations(nation);
    const scored = targets.map(t => ({
        nation: t,
        score: evaluateTarget(nation, t)
    }));

    // 效用函數：
    // score = 0.3 × (我方兵力 / 敵方兵力)
    //       + 0.2 × (敵方資源價值 / 10000)    // 搶資源動機
    //       + 0.2 × (歷史仇恨值 / 100)         // 宿敵加分
    //       + 0.15 × (1 - 邦交值 / 100)         // 邦交越差越想打
    //       + 0.15 × (我方情報 / 100)            // 情報越多越有信心

    const best = scored.sort((a, b) => b.score - a.score)[0];
    if (best.score >= 0.6) return ATTACK(best.nation);
    return HOLD;
}

// 出征資源門檻
const MIN_TROOPS_FOR_ATTACK = 1500;
const FOOD_FOR_CAMPAIGN = 3000;
```

### E-5. AI 外交系統

#### 邦交值（-100 ~ +100）

| 範圍 | 關係 | 效果 |
|---|---|---|
| +80 ~ +100 | 同盟 | 互不攻擊、貿易打折、侵略共同敵人 |
| +40 ~ +79 | 友好 | 可貿易、不主動攻擊 |
| 0 ~ +39 | 中立 | 無特殊互動 |
| -39 ~ -1 | 冷淡 | 拒絕貿易 |
| -79 ~ -40 | 敵對 | 可能被攻擊 |
| -100 ~ -80 | 宿敵 | 優先攻擊目標、拒絕一切外交 |

#### 邦交值變動

| 事件 | 變動 |
|---|---|
| 結盟 | +30 |
| 貿易完成 | +5/次 |
| 送禮 | +10 ~ +30（依禮物價值） |
| 共同擊敗宿敵 | +20 |
| 攻擊對方 | -50 |
| 背叛結盟 | -80 |
| 拒絕貿易 | -5 |
| 入侵對方領地 | -30 |
| 時間流逝（每季） | 向 0 回歸 ±2 |
| 史實宿敵初始值 | -30（如曹操←→劉備） |
| 史實盟友初始值 | +20（如劉備←→孫權早期） |

#### AI 外交決策

```
function AI_DiplomacyTick(nation: AINation, allNations: AINation[]): void {
    for (const other of allNations) {
        if (other === nation) continue;
        const relation = getRelation(nation, other);

        // 主動結盟（DIPLOMAT Profile 偏好）
        if (relation.value > 30 && nation.profile === 'DIPLOMAT') {
            if (!relation.isAllied && Math.random() < 0.3) {
                proposeAlliance(nation, other);
            }
        }

        // 主動貿易
        if (relation.value > 0 && nation.gold > 3000 && other.food < 3000) {
            proposeTrade(nation, other, { give: 'Gold', receive: 'Food' });
        }

        // 背叛判定（WARLORD Profile）
        if (relation.isAllied && nation.profile === 'WARLORD') {
            // 呂布型：盟友弱了就背叛
            if (other.troops < nation.troops * 0.5 && Math.random() < 0.4) {
                betrayAlliance(nation, other);  // 邦交 -80
            }
        }

        // 合縱連橫（當某國過於強大）
        const strongest = findStrongestNation(allNations);
        if (strongest !== nation && strongest.troops > nation.troops * 2) {
            // 主動向其他弱國提議結盟對抗強國
            if (relation.value > -20 && !relation.isAllied) {
                proposeAntiHegemonyAlliance(nation, other, strongest);
            }
        }
    }
}
```

### E-6. AI 貿易系統

| 貿易類型 | 交換比率 | 條件 |
|---|---|---|
| 糧草 ↔ 黃金 | 2:1 | 雙方邦交 ≥ 0 |
| 糧草 ↔ 兵力 | 3:1 | 雙方邦交 ≥ 20 |
| 黃金 ↔ 名聲 | 5:1 | 雙方邦交 ≥ 40 |
| 情報交換 | 1:1 | 雙方結盟 |

```
// 貿易冷卻：同一對國家每季最多交易 2 次
// 結盟國家交換比率優惠 20%
// 玩家參與的貿易在 UI 上需要手動確認
```

### E-7. AI 武將經營

```
function AI_ManageGenerals(nation: AINation): void {
    // 1. 武將招募（每 2 季生成 1 名新武將）
    if (nation.season % 2 === 0) {
        const quality = rollGeneralQuality(nation.fame);
        // fame > 1500: 30% A級, 60% B級, 10% S級
        // fame > 800: 20% A級, 70% B級, 10% C級
        // else: 10% A級, 60% B級, 30% C級
        nation.generals.push(generateGeneral(quality, nation));
    }

    // 2. 結緣養成（AI 自動配對）
    const eligiblePairs = findEligiblePairs(nation.generals);
    if (eligiblePairs.length > 0 && nation.food > 2000) {
        const pair = selectBestPair(eligiblePairs); // 基於因子互補
        startBonding(pair);
    }

    // 3. 退役處理（只轉教官 / 傳承路徑，不直接產卡）
    for (const gen of nation.generals) {
        if (gen.age >= 65 && gen.status === 'ACTIVE' && shouldRetireGeneral(gen, nation)) {
            retireToMentorTrack(gen, nation);
        }
    }

    // 4. 死亡結算（依正式共識，死亡時才產出英靈卡與虎符卡）
    for (const gen of nation.generals) {
        if (gen.age > gen.lifespanMax || gen.vitality <= 0) {
            settleGeneralDeath(gen, nation);
            // 死亡同步產出英靈卡與虎符卡（同玩家規則）
            // 虎符卡由 AI 評估後裝備給最適合的現役武將
            // 英靈卡進入勢力英靈庫，用於國家性格 / 祭祀 / 傳承加成掛載
            if (Math.random() < 0.3) {
                addToMercenaryMarket(gen);
            }
        }
    }

    // 5. 俘虜處理
    for (const pow of nation.prisoners) {
        // AI 嘗試招降
        if (pow.loyalty < 30 && Math.random() < 0.5) {
            recruitPrisoner(pow, nation);
        } else if (pow.captive_seasons > 4) {
            releasePrisoner(pow); // 超過 4 季未招降就釋放
        }
    }
}
```

### E-8. 霸權反制與橡皮筋同盟

> **來源**：策略養成遊戲平衡與營運探討.md (doc_spec_0081)、遊戲機制優化與戰略閉環.md (doc_spec_0088)

1. 當任一勢力的領土佔比超過 30%，其他勢力應提高結盟與共同出征意願。
2. 該機制的目標是維持天下局勢動態，而不是讓領先者必然敗北。
3. 玩家若不是霸主，必須被自動捲入反霸權聯盟，不提供拒絕選項。

```typescript
function evaluateCoalitionPressure(nation: AINation, allNations: AINation[]): void {
    const hegemon = findNationByDomainRatio(allNations, 0.30);
    nation.domainRatio = nation.territories / getTotalTerritories(allNations);

    if (!hegemon || hegemon.id === nation.id) {
        nation.isPartOfCoalition = false;
        nation.relationDecayRate = 2;
        return;
    }

    nation.isPartOfCoalition = true;
    nation.coalitionState = 'FORCED_MEMBER';
    nation.relationDecayRate = 4;
}
```

### E-9. AI 勢力興衰

```
// 每年（4季）評估一次勢力狀態
function evaluateNationState(nation: AINation): NationState {
    const power = nation.troops + nation.generals.length * 200
                + nation.territories * 500 + nation.fame;

    if (power > 10000) return 'HEGEMONY';      // 霸主（觸發合縱連橫）
    if (power > 6000)  return 'STRONG';         // 強勢
    if (power > 3000)  return 'STABLE';         // 穩定
    if (power > 1000)  return 'DECLINING';      // 衰退
    return 'COLLAPSING';                         // 崩潰（即將被征服）
}

// 狀態影響：
// HEGEMONY: 其他國家自動提升敵對值 +10/季、觸發包圍網事件
// COLLAPSING: 武將叛逃率 +20%、鄰國入侵機率 +50%
```

### E-10. 時代更迭與地圖重組

> **來源**：策略養成遊戲平衡與營運探討.md (doc_spec_0081)

1. 當單一勢力接近統一天下，或世界局勢長期失衡時，可觸發「天下大亂」重組事件。
2. 重組時保留玩家核心養成資產，且保留大廳世界沙盤已解鎖階段，只重洗世界版圖與 AI 起始布局。
3. 該機制是長線賽季化保鮮，不是傳統失敗重開。

```typescript
function shouldTriggerEraShift(world: WorldState): boolean {
    if (world.strongestNation.domainRatio >= 0.90) return true;
    if (world.playerTerritories <= 2 && world.playerCollapseSeasons >= 3) return true;
    return false;
}
```

### E-10.1 全球遠征外敵壓力源

> **來源**：三國傳承：遊戲設計大綱.md

1. 世界沙盤 `S3 全球遠征` 的外敵壓力源，正式定位為 `External_Power`，不是每一個都要套用本土三國勢力的完整治理迴圈。
2. `External_Power` 可代表草原霸權、海上商盟、西方遠征軍等異域勢力，用於提供高壓戰線、特殊戰法與稀有戰利品動機。
3. 這些外敵應優先透過大廳世界沙盤的 `Expedition_Dossier` 曝光，再逐步解鎖具體戰役與互動。
4. 只有真的進入常態化世界博弈的異域勢力，才需要升格成完整 `AINation`。

### E-11. 軍師智力與軍事任務偵知

> **來源**：遊戲玩法：幕府議事廳設計.md、遊戲設計規格書：三國傳承.md

1. 軍事任務的品質應與軍師或主導武將的 INT 掛鉤。
2. 高智力勢力更容易提前發現高價值突襲、斷糧與埋伏任務。
3. 玩家與 AI 應共用同一套「高智力勢力更會先出手」的世界規則。

```typescript
function getMilitaryMissionTier(intValue: number): 'BASIC' | 'ADVANCED' | 'MASTER' {
    if (intValue >= 90) return 'MASTER';
    if (intValue >= 70) return 'ADVANCED';
    return 'BASIC';
}
```

### E-12. 玩家與 AI 國家互動介面

| 互動 | 條件 | 效果 |
|---|---|---|
| 貿易 | 邦交 ≥ 0 | 資源交換 |
| 結盟 | 邦交 ≥ 40 | 互不攻擊、貿易優惠 |
| 宣戰 | 無限制 | 邦交歸 -100、進入戰爭狀態 |
| 送禮 | 邦交 > -80 | 提升邦交（精元/黃金/糧草） |
| 情報偵查 | 需情報點數 | 查看 AI 國家兵力/資源/武將 |
| 勸降 | 戰爭中、對方 COLLAPSING | 直接征服（花費名聲） |
| 索要俘虜 | 邦交 ≥ 60 | 要求 AI 歸還我方被俘武將 |

---

## F. 公式相關

### F-1. AI 國家資源產出（與玩家共用基礎公式）

```typescript
// 五大治理任務產出（與 領地治理系統.md (doc_spec_0037) 一致）
const GOVERNANCE_OUTPUT = {
    FARMING:   (gen: General) => 100 + gen.POL * 2,     // → Food
    COMMERCE:  (gen: General) => 50  + gen.CHA * 3,     // → Gold
    DIPLOMACY: (gen: General) => 20  + (gen.INT + gen.CHA) * 1, // → Fame
    MILITARY:  (gen: General) => 80  + gen.STR * 2,     // → Troops
    RECON:     (gen: General) => 30  + gen.INT * 2,     // → Intel
};

// AI 效率修正（依 Nation Profile）
const AI_EFFICIENCY_MOD: Record<Profile, Record<Task, number>> = {
    MILITARIST:   { FARMING: 0.9, COMMERCE: 0.8, DIPLOMACY: 0.7, MILITARY: 1.2, RECON: 1.0 },
    DIPLOMAT:     { FARMING: 1.0, COMMERCE: 1.1, DIPLOMACY: 1.3, MILITARY: 0.8, RECON: 0.9 },
    GUARDIAN:     { FARMING: 1.0, COMMERCE: 1.0, DIPLOMACY: 1.0, MILITARY: 1.0, RECON: 1.1 },
    WARLORD:      { FARMING: 0.8, COMMERCE: 0.6, DIPLOMACY: 0.3, MILITARY: 1.4, RECON: 0.8 },
    EXPANSIONIST: { FARMING: 0.9, COMMERCE: 0.9, DIPLOMACY: 0.8, MILITARY: 1.1, RECON: 0.9 },
    PASSIVE:      { FARMING: 1.1, COMMERCE: 1.1, DIPLOMACY: 0.9, MILITARY: 0.6, RECON: 0.7 },
    CAVALRY_LORD: { FARMING: 0.9, COMMERCE: 0.7, DIPLOMACY: 0.6, MILITARY: 1.3, RECON: 1.0 },
    RAIDER:       { FARMING: 0.7, COMMERCE: 0.5, DIPLOMACY: 0.3, MILITARY: 1.5, RECON: 0.8 },
};
```

### F-2. 擴張效用函數

```typescript
function evaluateTarget(attacker: AINation, target: AINation): number {
    const militaryRatio = attacker.troops / Math.max(1, target.troops);
    const resourceValue = (target.food + target.gold * 2) / 10000;
    const hatred = getHistoricalHatred(attacker, target) / 100;
    const diplomaticGap = (100 - getRelation(attacker, target).value) / 200;
    const intelConfidence = attacker.intel / 100;

    return 0.30 * Math.min(2, militaryRatio)
         + 0.20 * Math.min(1, resourceValue)
         + 0.20 * Math.min(1, hatred)
         + 0.15 * diplomaticGap
         + 0.15 * Math.min(1, intelConfidence);
}
```

### F-3. 武將招募品質消耗

```typescript
const RECRUIT_FAME_THRESHOLD = {
    S: { fame: 1500, chance: 0.10 },
    A: { fame: 800,  chance: 0.30 },
    B: { fame: 0,    chance: 0.60 },
    C: { fame: 0,    chance: 0.30 },  // fame < 800 時分配
};
```

### F-4. 邦交值衰減

```typescript
function decayRelation(relation: Relation): void {
    // 每季邦交值向 0 回歸，預設 ±2；反霸權聯盟或霸權壓力下可加速
    const decayRate = relation.decayRate ?? 2;
    if (relation.value > 0) relation.value = Math.max(0, relation.value - decayRate);
    if (relation.value < 0) relation.value = Math.min(0, relation.value + decayRate);
}
```

### F-5. 反霸權同盟觸發

```typescript
function shouldStartCoalition(nation: AINation): boolean {
    return nation.domainRatio >= 0.30;
}

function shouldApplyRebellionPressure(nation: AINation): boolean {
    return nation.domainRatio >= 0.40;
}
```

### F-6. 軍事任務品質分段

```typescript
function getMissionIntelBand(intValue: number): number {
    if (intValue >= 90) return 3;
    if (intValue >= 70) return 2;
    if (intValue >= 50) return 1;
    return 0;
}
```

---

## G. 劇本相關

### G-1. AI 國家事件文案

| 事件 | 文案 |
|---|---|
| AI 宣戰 | 「{國名} 的 {君主名} 向你宣戰！『{宣戰台詞}』準備迎戰吧！」 |
| AI 結盟提議 | 「{國名} 派遣使者求盟：『{外交台詞}』接受 / 拒絕？」 |
| AI 貿易提議 | 「{國名} 商隊抵達：願以 {給出資源} 換取 {索取資源}。同意 / 拒絕？」 |
| AI 國滅亡 | 「{國名} 已覆滅。{君主名} 下落不明... 殘餘武將流入各地傭兵市場。」 |
| AI 稱霸 | 「{國名} 勢力空前強大！天下諸侯密謀結盟對抗霸主。」 |
| AI 背叛 | 「{國名} 撕毀盟約！{君主名}：『{背叛台詞}』邦交驟降！」 |
| AI 掠奪 | 「南蠻蠻族再次入侵邊境！失去 {資源量} 糧草與 {兵力} 兵力！」 |
| 天下大亂 | 「天下大亂，諸侯版圖重整，新的霸權競逐再次開始。」 |

### G-2. 各勢力君主台詞

| 勢力 | 宣戰 | 結盟 | 背叛 |
|---|---|---|---|
| 魏（曹操） | 「識時務者為俊傑，你已錯失良機。」 | 「暫且合作，日後再論高下。」 | 「此乃亂世，何必拘泥小節。」 |
| 蜀（劉備） | 「吾不得已而為之，望閣下理解。」 | 「義結金蘭，共抗強敵！」 | （不會主動背叛） |
| 吳（孫權） | 「侵我江東者，必遭覆滅。」 | 「長江南北，共享太平。」 | 「形勢所迫，非吾本意。」 |
| 呂布 | 「天下第一，有何不服？」 | （不結盟） | （隨時可能攻擊） |
| 袁紹 | 「四世三公，豈容小輩放肆！」 | 「吾家門高貴，結盟自有分寸。」 | 「勢不如人，自當另尋出路。」 |

---

## H. 字串內容相關

| Key | 繁中 | 英文 |
|---|---|---|
| NATION_WEI | 魏 | Wei |
| NATION_SHU | 蜀 | Shu |
| NATION_WU | 吳 | Wu |
| NATION_LVBU | 呂布勢力 | Lu Bu Forces |
| NATION_YUAN | 袁紹勢力 | Yuan Shao Forces |
| NATION_NANMAN | 南蠻 | Nanman |
| RELATION_ALLY | 同盟 | Alliance |
| RELATION_FRIENDLY | 友好 | Friendly |
| RELATION_NEUTRAL | 中立 | Neutral |
| RELATION_COLD | 冷淡 | Cold |
| RELATION_HOSTILE | 敵對 | Hostile |
| RELATION_NEMESIS | 宿敵 | Nemesis |
| ACTION_TRADE | 貿易 | Trade |
| ACTION_ALLY | 結盟 | Form Alliance |
| ACTION_WAR | 宣戰 | Declare War |
| ACTION_GIFT | 送禮 | Send Gift |
| ACTION_RECON | 偵查 | Reconnaissance |
| ACTION_SURRENDER | 勸降 | Demand Surrender |
| ACTION_COALITION | 反霸權聯盟 | Coalition |
| STATE_HEGEMONY | 霸主 | Hegemony |
| STATE_STRONG | 強勢 | Strong |
| STATE_STABLE | 穩定 | Stable |
| STATE_DECLINING | 衰退 | Declining |
| STATE_COLLAPSING | 崩潰 | Collapsing |
| WORLD_ERA_SHIFT | 天下大亂 | Era Shift |

---

## I. Data Schema 需求

### 本機端 (Client)

```json
{
  "AINationDef": {
    "Nation_ID": "string (WEI | SHU | WU | LVBU | YUAN | ...)",
    "Name": "string",
    "Ruler_Template_ID": "string (君主武將模板)",
    "Profile": "string (MILITARIST | DIPLOMAT | GUARDIAN | ...)",
    "Initial_Territories": "number",
    "Initial_Resources": {
      "Food": "number",
      "Gold": "number",
      "Troops": "number",
      "Fame": "number"
    },
    "Efficiency_Mod": {
      "FARMING": "number",
      "COMMERCE": "number",
      "DIPLOMACY": "number",
      "MILITARY": "number",
      "RECON": "number"
    },
    "Expansion_Willingness": "number (0~1)",
    "Dialogue": {
      "Declare_War": "string",
      "Propose_Alliance": "string",
      "Betray": "string",
      "Defeated": "string"
    }
  }
}
```

```json
{
  "AINationState": {
    "Nation_ID": "string",
    "Season": "number",
    "Resources": {
      "Food": "number",
      "Gold": "number",
      "Troops": "number",
      "Fame": "number",
      "Intel": "number"
    },
    "Territories": "number",
        "Domain_Ratio": "number (0~1)",
    "Generals": ["string (General_UID)"],
        "Retired_Mentors": ["string (General_UID)"],
        "Spirit_Vault": ["string (Spirit_ID)"],
        "Tiger_Tally_Vault": ["string (Tally_ID)"],
    "Prisoners": ["string (General_UID)"],
    "State": "string (HEGEMONY | STRONG | STABLE | DECLINING | COLLAPSING)",
        "Is_Part_Of_Coalition": "boolean",
        "Coalition_State": "string (NONE | FORCED_MEMBER | HEGEMON)",
        "Rebellion_Risk": "number (0~100)",
        "Relation_Decay_Rate": "number",
    "Active_Wars": ["string (Nation_ID)"],
    "Active_Alliances": ["string (Nation_ID)"]
  }
}
```

```json
{
  "DiplomaticRelation": {
    "Nation_A": "string",
    "Nation_B": "string",
    "Value": "number (-100 ~ +100)",
    "Is_Allied": "boolean",
    "Is_At_War": "boolean",
    "Historical_Hatred": "number (史實仇恨初始值)",
        "Decay_Rate": "number (預設 2，霸權壓力時提高)",
    "Trade_Cooldown": "number (剩餘貿易冷卻季數)"
  }
}
```

```json
{
  "TradeOffer": {
    "Offer_ID": "string",
    "From_Nation": "string",
    "To_Nation": "string",
    "Give_Resource": "string (Food | Gold | Troops | Fame)",
    "Give_Amount": "number",
    "Want_Resource": "string",
    "Want_Amount": "number",
    "Exchange_Rate": "number",
    "Alliance_Discount": "boolean"
  }
}
```

### Server 端

| 欄位 | 型別 | 說明 |
|---|---|---|
| nation_state_id | VARCHAR(32) PK | AI 國家狀態記錄 ID |
| player_id | VARCHAR(32) FK | 所屬存檔的玩家 |
| nation_id | VARCHAR(16) | 國家代號 |
| season | INT | 當前季度 |
| food | INT | 糧草 |
| gold | INT | 黃金 |
| troops | INT | 兵力 |
| fame | INT | 名聲 |
| territories | INT | 領地數 |
| domain_ratio | DECIMAL(5,4) | 領土佔比 |
| state | ENUM | HEGEMONY/STRONG/STABLE/DECLINING/COLLAPSING |
| is_part_of_coalition | BOOLEAN | 是否位於反霸權聯盟 |
| coalition_state | VARCHAR(24) | NONE/FORCED_MEMBER/HEGEMON |
| rebellion_risk | SMALLINT | 霸權下的異心叛亂風險 |
| updated_at | DATETIME | 最後更新 |

| 欄位 | 型別 | 說明 |
|---|---|---|
| external_power_id | VARCHAR(32) PK | 異域壓力源 ID |
| frontier | VARCHAR(16) | 壓力來源方位（NORTHWEST / SEA / WEST 等） |
| pressure_level | SMALLINT | 世界沙盤上的威脅等級 |
| dossier_state | ENUM | LOCKED_TEASER / REVEALED / ACTIVE |

| 欄位 | 型別 | 說明 |
|---|---|---|
| relation_id | VARCHAR(32) PK | 外交關係 ID |
| player_id | VARCHAR(32) FK | 所屬存檔 |
| nation_a | VARCHAR(16) | 國家 A |
| nation_b | VARCHAR(16) | 國家 B |
| relation_value | SMALLINT | 邦交值 (-100~+100) |
| is_allied | BOOLEAN | 是否結盟 |
| is_at_war | BOOLEAN | 是否交戰中 |
| decay_rate | SMALLINT | 邦交衰退速度 |
| last_trade_season | INT | 上次貿易季度 |

---

## J. 名詞定義

| 名詞 | 定義 |
|---|---|
| Nation Profile | AI 國家的性格模板，決定內政偏好、軍事傾向、外交策略與擴張意願 |
| 邦交值 | 兩國之間的關係數值（-100 仇敵 ~ +100 同盟），影響貿易、戰爭、結盟的可能性 |
| 擴張意願 | AI 國家嘗試出征鄰國的機率，由 Nation Profile 與當前資源決定 |
| 效用函數 | AI 評估攻擊目標的加權評分公式，綜合軍事比、資源、仇恨、邦交、情報 |
| AI 效率修正 | 各 Nation Profile 對五大治理任務產出的乘數修正（模擬管理能力差異） |
| 合縱連橫 | 多國外交中，弱國聯合對抗霸主的機制 |
| 反霸權聯盟 | 霸主領土佔比過高時，由其他勢力與非霸主玩家強制組成的動態圍堵同盟 |
| 勢力狀態 | AI 國家的整體實力評級（霸主→強勢→穩定→衰退→崩潰），影響 AI 行為與他國反應 |
| 傭兵市場供給 | AI 國家退役武將有 30% 機率進入傭兵市場，成為玩家可僱用的傭兵 |
| 掠奪型 | 南蠻等勢力的特殊行為：不佔領領地，只搶奪資源後撤退 |
| 背叛 | 打破盟約的外交行為，邦交值 -80，WARLORD Profile 的國家有較高背叛機率 |
| 貿易冷卻 | 同一對國家每季最多交易 2 次的限制 |
| 時代更迭 | 世界局勢失衡後重洗版圖並保留核心養成資產與世界沙盤解鎖歷史的長線賽季化機制 |
| 軍事任務偵知 | AI 依據軍師智力提前發現高價值軍事提案的能力層級 |
| 異域壓力源 | External_Power | S3 全球遠征階段的外敵檔案，不一定等同完整本土 AI 國家 |


---
## 🗳 MCQ 決策記錄（Q37）

- **問題**：全服排行榜 AI 投影模式
- **衝突說明**：排行榜AI投影有Ghost快照、異步回放、動態映射三種架構，對伺服器同步需求截然不同，不拍板則挑戰賽與排行榜後端架構選型無法確定。
- **裁決**：**選項 C** — 鏡像試煉（動態抓取全服強者配置，即時生成AI，動態縮放難度）
- **回寫時間**：2026-04-12 13:16
- **來源**：由 `consolidation-doubt-mcq.js rewrite-all` 自動寫入

---


---
## 🗳 MCQ 決策記錄（Q49）

- **問題**：監獄容量與關押成本
- **衝突說明**：轉蛋處置系統(doc_spec_0155)提及俘虜判無期徒刑可拿寶物，並「佔用監獄空間」。但治理系統(doc_spec_0020)中並未定義監獄容量與維護成本。若不拍板，程式實作時玩家可能無限卡押全地圖武將，破壞經濟循環與他國AI重生邏輯。
- **裁決**：**選項 B** — 依附主城等級有固定關押上限
- **回寫時間**：2026-04-12 16:16
- **來源**：由 `consolidation-doubt-mcq.js rewrite-all` 自動寫入

---


---
## 🗳 MCQ 決策記錄（Q51）

- **問題**：幼兒未滿15歲的參與度
- **衝突說明**：結緣系統(doc_spec_0028)產下幼兒後，若不定義「未滿15歲」的武將實體能否被指派工作，治理系統(doc_spec_0020)的選角池將會混入大量嬰幼兒，造成美術立繪與數值計算的異常。
- **裁決**：**選項 B** — 可指派特定低效內政
- **回寫時間**：2026-04-12 16:16
- **來源**：由 `consolidation-doubt-mcq.js rewrite-all` 自動寫入

---


## 敵軍基礎兵種 AI 傾向表
- **盾兵 AI**：強烈傾向「相鄰站位」與「抱團」，以獲得陣型加成，但也因此容易被玩家的【火燒連環】計策剋制。
- **騎兵 AI**：強烈傾向「直線衝鋒」切入後排，玩家可利用【水淹圍堵】計策的強制退後功能破壞其衝擊力。