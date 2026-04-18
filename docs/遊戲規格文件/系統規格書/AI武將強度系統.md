<!-- doc_id: doc_data_0002 -->
# AI 武將強度系統（AI General Strength System）

> 本文件定義 AI 對手武將的強度計算、難度縮放、隊伍組成與決策邏輯。
> 格式：A–J 標準規格

---

## A. 系統描述

AI 武將強度系統負責控制電腦對手武將的數值水準、兵種選擇、戰法使用時機與難度適應性。此系統不改變底層數值公式（統一由「數值系統」管理），而是透過 **Level Scaling（等級縮放）** 與 **AI Profile（行為模板）** 來調控 AI 武將的戰鬥表現。

**Unity 對照**：類似 Unity 中 `Difficulty Manager` + `AI Director` 的組合。AI Profile 類似 Behavior Tree 的頂層參數配置；Level Scaling 類似 `AnimationCurve` 驅動的敵人屬性縮放機制。

**核心職責**：
- 根據玩家當前進度與戰力動態縮放 AI 武將屬性
- 提供多種 AI Profile（性格模板）控制 AI 的戰鬥風格
- 管理 AI 兵種選擇、戰法施放、奧義使用的決策邏輯
- 定義各章節/關卡的 AI 武將池與可用資源上限
- 確保戰鬥的挑戰性隨玩家成長合理提升，避免一面倒

---

## B. 系統目的

| 目的 | 說明 |
|---|---|
| 動態挑戰性 | AI 強度隨玩家進度縮放，永遠保持適度挑戰感 |
| 戰鬥多樣性 | 不同 AI Profile 帶來截然不同的戰術體驗（防守龜縮 vs 全線進攻） |
| 策略激勵 | AI 會針對玩家弱點出招，迫使玩家思考兵種搭配與地形利用 |
| 平衡壓力 | 集中管理 AI 數值上限，防止某些關卡過強或過弱 |
| 新手保護 | 低難度 AI 故意留下破綻，讓新手也能體驗勝利感 |

---

## C. 商業套路

| 套路 | 付費轉化點 |
|---|---|
| 難度牆 | 章節 Boss AI 強度跳升 → 玩家需回去養成或付費加速突破 |
| AI 武將展示 | AI 使用稀有虎符兵種 / 高級戰法 → 玩家看到效果後產生「我也想擁有」的慾望 |
| 挑戰模式 | 高難度 AI 挑戰關卡 → 通關獎勵豐厚 → 付費道具可輔助 |
| 重複挑戰 | AI 性格隨機組合 → 同一關卡每次體驗不同 → 增加重玩性與留存 |
| 精力壓力 | AI 消耗戰 → 玩家精力不足 → 補元散需求提升 |

---

## D. 系統 TA

| 玩家類型 | AI 系統滿足點 |
|---|---|
| 策略核心 | AI Profile 多樣化 → 每場戰鬥都需要不同應對 |
| 挑戰追求者 | 高難度模式、終極 AI → 考驗極限操作 |
| 養成黨 | 能感受到「養強了」的滿足感（昨天打不過的 AI 今天輕鬆過） |
| 劇情玩家 | AI 武將使用史實兵種/戰法 → 增強沉浸感 |
| 輕度玩家 | 低難度 AI 確保全員能通關主線 |

---

## E. 製作功能清單

### E-1. 難度等級

| 難度 | 代號 | 屬性縮放 | AI IQ | 適用場景 |
|---|---|---|---|---|
| 新手 | EASY | ×0.7 | 低：隨機部署、不剋制 | 教學關、新手期 |
| 普通 | NORMAL | ×1.0 | 中：剋制優先、基本戰法 | 主線關卡 |
| 困難 | HARD | ×1.3 | 高：最優剋制、主動使用戰法 | 精英關 |
| 噩夢 | NIGHTMARE | ×1.6 | 極高：最優化部署、奧義連發 | 挑戰關 |
| 地獄 | HELL | ×2.0 | 完美：讀牌、預判、全套最優解 | 賽季排行、終極挑戰 |

### E-2. AI 武將屬性縮放

```
// AI 武將屬性 = 模板基礎值 × 難度縮放 × 章節修正 × 年齡修正
AI_Stat = Template_Base_Stat
    × Difficulty_Scale     // EASY=0.7 ~ HELL=2.0
    × Chapter_Modifier     // 隨章節遞增：Ch1=1.0, Ch2=1.1, Ch3=1.2...
    × Age_Modifier         // 同玩家武將的年齡修正（壯年1.1最強）

// AI 武將 EP
AI_EP = Template_EP × Difficulty_Scale × Random(0.9, 1.1)

// AI 武將精力（簡化：永遠充足，但高精力消耗戰法仍受限制）
AI_Vitality = 100 × Difficulty_Scale

// AI 武將轉生次數（根據章節）
AI_Reincarnation = min(5, floor(Chapter / 3) + Difficulty_Bonus)
// Difficulty_Bonus: EASY=0, NORMAL=0, HARD=+1, NIGHTMARE=+1, HELL=+2
```

### E-2b. AI 虎符與特殊兵種戰力

> AI 武將也會使用自己退役後留下的虎符（或系統配發的虎符）參戰。特殊兵種的戰力直接受指揮武將的屬性影響。

```typescript
// === AI 特殊兵種戰力公式 ===
// 特殊兵種的攻防 = 兵種基礎值 × 虎符品質加成 × 虎符等級加成 × 武將屬性修正 × 適性效率

function AI_SpecialTroopPower(
    ai: AIGeneral,
    tally: TigerTally,
    troopDef: TroopDef
): { attack: number; defense: number } {

    // 1. 虎符品質加成
    const QUALITY_MOD = { UR: 1.5, SSR: 1.3, SR: 1.15, R: 1.0 };
    const qualityMod = QUALITY_MOD[tally.quality];

    // 2. 虎符星級加成（每★ +8%，最高 5★ = +40%）
    const starMod = 1 + tally.star * 0.08;

    // 3. 武將屬性對兵種的影響
    //    - 物理系兵種（騎/步/盾/槍）：受武將 STR 與 LEA 影響
    //    - 遠程系兵種（弓/機械）：受武將 INT 與 LEA 影響
    //    - 智將系兵種：受武將 INT 與 POL 影響
    //    - 水軍：受武將 LEA 與 CHA 影響
    const statBonus = getGeneralStatBonus(ai, troopDef.Base_Type);
    // statBonus = (主屬性 × 0.7 + 副屬性 × 0.3) / 1000
    // 範圍約 0.05 ~ 1.5（對應屬性 50 ~ 1500）

    // 4. 適性效率（S=1.2, A=1.1, B=1.0, C=0.9, D=0.8）
    const aptitude = APTITUDE_EFFICIENCY[ai.troopAptitude[troopDef.Base_Type]];

    // 5. 血脈共鳴加成（裝備者與虎符原名將有血脈/史實羈絆 → +10%）
    const resonanceMod = hasResonance(ai, tally) ? 1.1 : 1.0;

    const attack = troopDef.Stats.Attack
        * qualityMod * starMod * (1 + statBonus) * aptitude * resonanceMod;
    const defense = troopDef.Stats.Defense
        * qualityMod * starMod * (1 + statBonus * 0.5) * aptitude * resonanceMod;

    return { attack: Math.floor(attack), defense: Math.floor(defense) };
}

// === 武將屬性→兵種加成對照 ===
function getGeneralStatBonus(general: AIGeneral, baseType: string): number {
    const STAT_MAPPING: Record<string, [string, string]> = {
        CAVALRY:  ['STR', 'LEA'],   // 騎兵：武力 + 統率
        INFANTRY: ['STR', 'LEA'],   // 步兵：武力 + 統率
        SHIELD:   ['LEA', 'STR'],   // 盾兵：統率 + 武力
        PIKE:     ['STR', 'LEA'],   // 長槍兵：武力 + 統率
        ARCHER:   ['INT', 'LEA'],   // 弓兵：智力 + 統率
        SIEGE:    ['INT', 'LEA'],   // 機械：智力 + 統率
        SMART:    ['INT', 'POL'],   // 智將：智力 + 政治
        NAVY:     ['LEA', 'CHA'],   // 水軍：統率 + 魅力
    };
    const [primary, secondary] = STAT_MAPPING[baseType] || ['STR', 'LEA'];
    return (general[primary] * 0.7 + general[secondary] * 0.3) / 1000;
}
```

### E-3. AI Profile（行為模板）

| Profile | 代號 | 部署傾向 | 戰法傾向 | 史實典型 |
|---|---|---|---|---|
| 軍事壓制 | AGGRESSIVE | 騎兵/步兵優先、全線推進 | 衝鋒/突擊類優先 | 曹操、呂布、張飛 |
| 防守反擊 | DEFENSIVE | 盾兵/槍兵優先、佔據地形 | 反擊/嘲諷/壁壘優先 | 司馬懿、陸遜 |
| 智謀策略 | STRATEGIC | 根據玩家兵種剋制部署 | 計策/控制類優先 | 諸葛亮、周瑜、龐統 |
| 騎兵突擊 | CAVALRY_RUSH | 大量騎兵、快速推進 | 衝鋒/閃避類 | 馬超、趙雲、呂布 |
| 弓兵壓制 | ARCHER_FOCUS | 弓兵為主、後排火力 | 箭雨/火攻類 | 黃忠、甘寧 |
| 人海戰術 | SWARM | 大量低品質兵種、數量碾壓 | 低 TP 戰法頻繁施放 | 袁紹、劉璋 |
| 精銳少兵 | ELITE_FEW | 少量高品質特殊兵種 | 高 TP 戰法、奧義優先 | 關羽、典韋 |
| 平衡型 | BALANCED | 均衡兵種、穩健推進 | 混合使用 | 劉備、孫權 |

### E-4. AI 決策邏輯

#### 部署決策

```
function AI_Deploy(state: BattleState, profile: AIProfile): DeployAction {
    // 1. 取得可部署兵種清單（含已裝備虎符的特殊兵種）
    const available = getAvailableTroops(state.ai_roster);
    const specialTroops = getEquippedTallyTroops(state.ai_roster);
    // 特殊兵種戰力受指揮武將屬性影響（參見 E-2b 公式）

    // 2. 根據 AI IQ 決定是否考慮剋制與虎符兵種優勢
    if (ai_iq >= NORMAL) {
        // 分析玩家場上兵種，選擇剋制兵種
        const playerTroops = analyzePlayerBoard(state);
        const counterPick = findBestCounter(playerTroops, available);
        if (counterPick) return deploy(counterPick, selectLane(profile));
    }

    // 3. 根據 Profile 選擇偏好兵種
    const preferred = filterByProfile(available, profile);
    return deploy(pickRandom(preferred), selectLane(profile));
}
```

#### 路線選擇

| Profile | 路線策略 |
|---|---|
| AGGRESSIVE | 集中 2~3 路全力推進 |
| DEFENSIVE | 分散 5 路防守 |
| STRATEGIC | 偵測玩家薄弱路線集中攻擊 |
| CAVALRY_RUSH | 集中 1 路騎兵衝鋒 |
| SWARM | 全 5 路同時部署 |
| ELITE_FEW | 選擇最空的 1~2 路 |

#### 戰法使用決策

```
function AI_UseTactic(state: BattleState, ai_iq: number): TacticAction | null {
    // 低 IQ：隨機使用
    if (ai_iq <= EASY) {
        return Math.random() < 0.3 ? useRandomTactic() : null;
    }

    // 中 IQ：TP 夠就用最高傷害戰法
    if (ai_iq <= NORMAL) {
        return useBestDamageTactic();
    }

    // 高 IQ：根據場上情況選最優戰法
    // - 多敵群聚 → 用 AOE
    // - 敵方高防 → 用控制技
    // - 我方低血 → 用治療/嘲諷
    return evaluateAndSelect(state);
}
```

#### 奧義使用決策

```
function AI_UseUltimate(state: BattleState, ai_iq: number): boolean {
    // 低 IQ：不會主動使用
    if (ai_iq <= EASY) return false;

    // 中 IQ：精力 > 50% 且場上敵方 > 3 時使用
    if (ai_iq <= NORMAL) {
        return ai.vitality > 50 && countEnemies(state) > 3;
    }

    // 高 IQ：目標是最大化 AOE 收益
    // - 等敵方群聚時施放
    // - 對方血量低於奧義傷害時施放（斬殺線）
    const killCount = estimateUltKills(state, ai.ultimate);
    return killCount >= 2 || (isLosing(state) && ai.vitality > 30);
}
```

### E-5. AI 武將池

| 章節 | 可用武將等級 | 可用兵種 | 特殊兵種上限 | 轉生次數 |
|---|---|---|---|---|
| 序章 | C~B 級（POL/CHA 為主） | 騎兵、步兵、弓兵 | 0 | 0 |
| 第一章 | B~A 級 | 全基礎兵種 | 1（R 級虎符兵） | 0~1 |
| 第二章 | A 級 | 全基礎 + R 級特殊 | 2 | 1 |
| 第三章 | A~S 級 | 全基礎 + SR 級特殊 | 3 | 1~2 |
| 第四章 | S 級 | 全兵種 + SSR 級特殊 | 4 | 2~3 |
| 終章 | S+ 級 | 全兵種 + UR 級特殊 | 5+ | 3~5 |

> **裝備規則**：AI 武將也需裝備虎符才能使用特殊兵種，各章節的「特殊兵種上限」即為 AI 陣營配發虎符的數量上限。

### E-6. AI 武將模板示例

| 模板 ID | 武將 | Profile | 專屬戰法 | 專屬兵種 | 難度修正 |
|---|---|---|---|---|---|
| AI_CAOCAO | 曹操 | AGGRESSIVE | TAC_WEI_MIGHT | 虎豹騎 | ×1.1 |
| AI_LIUBEI | 劉備 | BALANCED | TAC_SWORN_FURY | — | ×1.0 |
| AI_SUNQUAN | 孫權 | DEFENSIVE | TAC_WATER_ATTACK | 吳國水師 | ×1.0 |
| AI_ZHUGE | 諸葛亮 | STRATEGIC | TAC_EIGHT_ARRAY / TAC_EMPTY_FORT | 元戎弩兵 | ×1.2 |
| AI_LVBU | 呂布 | CAVALRY_RUSH | TAC_SEVEN_IN_OUT | 并州狼騎(UR) | ×1.5 |
| AI_ZHOUYU | 周瑜 | STRATEGIC | TAC_RED_CLIFF | 都督禁衛 / 都督精弩 | ×1.2 |
| AI_GUANYU | 關羽 | ELITE_FEW | TAC_DRAGON_GALL | 忠義鐵衛 | ×1.3 |
| AI_YUANSHAO | 袁紹 | SWARM | TAC_ARROW_RAIN | 先登死士 | ×0.9 |
| AI_SIMAYI | 司馬懿 | DEFENSIVE | TAC_DISCORD | 冥影衛 | ×1.2 |

### E-6b. AI 虎符選擇邏輯

> AI 武將會優先裝備自己退役後留下的虎符（血脈共鳴 +10%），其次是與 Profile 匹配的虎符。

```typescript
function AI_SelectTally(ai: AIGeneral, availableTallies: TigerTally[]): TigerTally | null {
    // 1. 優先裝備自己名號的虎符（血脈共鳴）
    const resonanceTally = availableTallies.find(
        t => t.Resonance_Template === ai.Template_ID
    );
    if (resonanceTally) return resonanceTally;

    // 2. 根據兵種適性選擇最佳虎符
    const scored = availableTallies.map(t => ({
        tally: t,
        score: APTITUDE_EFFICIENCY[ai.troopAptitude[getTroopType(t)]] * QUALITY_MOD[t.quality] * (1 + t.star * 0.08)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.tally ?? null;
}
```

### E-7. 單挑 AI 決策

```
// 防守方接受判定（來自 keep.md (doc_index_0011)）
duel_score = 0.45 × (currentHP / maxHP)
           + 0.35 × (場上兵力比)
           + 0.20 × (總戰力比)

// 加入微抖動（避免 AI 完全理性）
duel_score += random(-0.05, +0.05)

if (duel_score >= 0.58): 接受單挑
else: 拒絕（全軍攻防與武將HP減半）

// AI IQ 影響：
// EASY: duel_score 閾值降低到 0.45（更容易接受，即使不利）
// HARD+: 真實評估，且會在有利時主動發起
```

### E-8. 難度自適應（選配）

```
// 若玩家連續 3 場勝利 → 難度自動上調 0.1
// 若玩家連續 3 場失敗 → 難度自動下調 0.1（最低不低於 EASY 的 0.7）
adaptive_scale = base_difficulty_scale
    + (consecutive_wins >= 3 ? +0.1 : 0)
    - (consecutive_losses >= 3 ? -0.1 : 0)
adaptive_scale = clamp(adaptive_scale, 0.7, 2.5)
```

### E-9. 回合結束全軍強度重算

> **Unity 對照**：類似 Unity ECS 中 `SystemGroup` 在 `LateUpdate` 階段批次重算所有 Entity 的 Stats Component。每個回合結束相當於一次 Simulation Tick，所有 AI 國家同步執行。

每次玩家按下「回合結束」（季度結算），所有 AI 國家須觸發以下重算流程：

```typescript
// === 回合結束：AI 全軍強度重算 ===
function AI_TurnEndRecalculate(nation: AINation): void {

    // ────── Phase 1：武將屬性更新 ──────
    for (const gen of nation.generals) {
        // 1a. 年齡推進 → 重算年齡修正
        gen.age += 0.25;  // 每季 +0.25 歲
        gen.agePhase = getAgePhase(gen.age);
        gen.ageMod = AGE_MODIFIER[gen.agePhase];

        // 1b. 根據章節/難度重新縮放屬性
        gen.scaledStats = scaleStats(gen.baseStats, gen.ageMod,
            nation.difficulty, nation.chapter);

        // 1c. 精力回復（AI 也受精力規則約束）
        gen.vitality = Math.min(100 * nation.difficulty,
            gen.vitality + seasonalVitalityRecovery(gen));
    }

    // ────── Phase 2：虎符與兵種等級更新 ──────
    for (const tally of nation.tallies) {
        // 2a. AI 自動突破虎符（僅 3★→4★、4★→5★，若資源足夠）
        if (tally.star < QUALITY_STAR_CAP[tally.quality]) {
            if (tally.star < 3) {
                // 1~3★ 透過戰鬥經驗自動升星（AI 不需花費）
                tally.starExp += AI_TALLY_EXP_PER_TURN;
                if (tally.starExp >= TALLY_STAR_EXP[tally.star + 1]) {
                    tally.star++;
                    tally.starExp = 0;
                }
            } else if (nation.tallyEssence >= TALLY_BREAKTHROUGH_COST[tally.star + 1]?.essence) {
                // 4~5★ 消耗虎符精華突破
                nation.tallyEssence -= TALLY_BREAKTHROUGH_COST[tally.star + 1].essence;
                nation.gold -= TALLY_BREAKTHROUGH_COST[tally.star + 1].gold;
                tally.star++;
            }
        }

        // 2b. 重新分配虎符給最適合武將（按適性 S>A>B>C>D）
        const bestGeneral = findBestGeneralForTally(nation.generals, tally);
        if (bestGeneral && bestGeneral.uid !== tally.equippedGeneralUID) {
            unequipTally(tally);
            equipTally(tally, bestGeneral);
        }
    }

    // ────── Phase 3：部隊戰力重算 ──────
    for (const gen of nation.generals) {
        // 3a. 基礎兵種戰力
        gen.troopPower = calculateBaseTroopPower(gen);

        // 3b. 特殊兵種戰力（受虎符品質/等級 × 武將屬性影響）
        if (gen.equippedTally) {
            const specialPower = AI_SpecialTroopPower(gen, gen.equippedTally,
                getTroopDef(gen.equippedTally));
            gen.specialTroopPower = specialPower;
        }

        // 3c. 總戰力評估（用於 AI 決策排序）
        gen.totalPower = evaluateAIPower(gen);
    }

    // ────── Phase 4：國家軍力指數更新 ──────
    nation.militaryIndex = nation.generals.reduce(
        (sum, g) => sum + g.totalPower, 0);

    // ────── Phase 5：AI 策略調整 ──────
    // 依國力排名調整 Nation Profile 偏向（弱勢國家偏防守/外交）
    if (nation.militaryIndex < getAverageMilitaryIndex() * 0.7) {
        nation.profile = shiftTowardDefensive(nation.profile);
    }
}
```

---

## F. 公式相關

### F-1. AI 戰力評估公式（用於匹配與平衡檢測）

```typescript
function evaluateAIPower(ai: AIGeneral): number {
    const statSum = ai.STR + ai.INT + ai.LEA + ai.POL + ai.CHA + ai.LUK;

    // 虎符特殊兵種戰力（受武將屬性影響）
    let troopBonus = 0;
    if (ai.equippedTally) {
        const tallyPower = AI_SpecialTroopPower(ai, ai.equippedTally, getTroopDef(ai.equippedTally));
        troopBonus = (tallyPower.attack + tallyPower.defense) * 2;
    }

    const tacticBonus = ai.tactics.reduce((sum, t) => sum + t.tp_cost * 10, 0);
    const reincarnationBonus = ai.reincarnation * 2000;
    const ageBonus = AGE_MODIFIER[ai.agePhase] * 1000;

    return statSum + troopBonus + tacticBonus + reincarnationBonus + ageBonus;
}

// 難度匹配：AI 總戰力應在玩家戰力的 ±20% 內（NORMAL 難度）
// diff = abs(ai_power - player_power) / player_power
// if diff > 0.2: 調整 AI 縮放倍率
```

### F-2. AI 部署節奏公式

```typescript
// AI 每回合部署數量（根據難度）
function getAIDeployCount(difficulty: Difficulty, turn: number): number {
    const base = 1;
    const turnBonus = Math.floor(turn / 5); // 每 5 回合增加 1
    const difficultyBonus = { EASY: 0, NORMAL: 0, HARD: 1, NIGHTMARE: 1, HELL: 2 };
    return Math.min(3, base + turnBonus + difficultyBonus[difficulty]);
}
```

### F-3. AI SP 充能（公平修正）

```typescript
// AI 的 SP 充能速率可根據難度微調，確保 AI 也能施放技能
AI_SP_Gain_Per_Kill = SP_PER_KILL × Difficulty_SP_Mod;
// EASY: ×0.8, NORMAL: ×1.0, HARD: ×1.2, NIGHTMARE: ×1.3, HELL: ×1.5
```

---

## G. 劇本相關

### G-1. AI 武將出場台詞

| AI 模板 | 出場台詞 |
|---|---|
| AI_CAOCAO | 「寧教我負天下人，休教天下人負我！」 |
| AI_LIUBEI | 「仁義為先，但犯我疆界者，勿怪刀劍無情。」 |
| AI_ZHUGE | 「吾已洞察你的佈陣，一切盡在掌握。」 |
| AI_LVBU | 「天下誰敢一戰！」 |
| AI_ZHOUYU | 「此戰不過借東風一場。」 |
| AI_GUANYU | 「關某豈懼宵小之輩。」 |
| AI_SIMAYI | 「善守者，藏於九地之下。」 |
| AI_YUANSHAO | 「以吾百萬雄師，何人能擋？」 |

### G-2. 難度提示文案

| 場景 | 文案 |
|---|---|
| 進入困難關卡 | 「此戰敵軍精銳盡出，務必謹慎！」 |
| AI 使用戰法 | 「敵將 {名} 發動戰法——{戰法名}！」 |
| AI 使用奧義 | 「危急！敵將 {名} 發動奧義——{奧義名}！全軍戒備！」 |
| 難度自適應上調 | 「敵軍增援抵達，敵方士氣高漲！」 |
| 難度自適應下調 | 「敵軍糧草不濟，士氣低落。」 |

---

## H. 字串內容相關

| Key | 繁中 | 英文 |
|---|---|---|
| AI_THINKING | 敵軍思考中... | Enemy Thinking... |
| AI_DEPLOY | 敵方部署 | Enemy Deploy |
| AI_DIFFICULTY_EASY | 新手 | Easy |
| AI_DIFFICULTY_NORMAL | 普通 | Normal |
| AI_DIFFICULTY_HARD | 困難 | Hard |
| AI_DIFFICULTY_NIGHTMARE | 噩夢 | Nightmare |
| AI_DIFFICULTY_HELL | 地獄 | Hell |
| AI_PROFILE_AGGRESSIVE | 軍事壓制 | Aggressive |
| AI_PROFILE_DEFENSIVE | 防守反擊 | Defensive |
| AI_PROFILE_STRATEGIC | 智謀策略 | Strategic |
| AI_PROFILE_BALANCED | 平衡型 | Balanced |
| AI_DUEL_ACCEPT | {名} 接受了單挑！ | {name} accepted the duel! |
| AI_DUEL_REFUSE | {名} 拒絕了單挑，全軍士氣崩潰！ | {name} refused! Army morale shattered! |

---

## I. Data Schema 需求

### 本機端 (Client)

```json
{
  "AIDifficultyConfig": {
    "Difficulty_ID": "string (EASY | NORMAL | HARD | NIGHTMARE | HELL)",
    "Stat_Scale": "number (0.7 ~ 2.0)",
    "AI_IQ": "string (LOW | MEDIUM | HIGH | EXTREME | PERFECT)",
    "Deploy_Limit_Per_Turn": "number",
    "Can_Use_Tactics": "boolean",
    "Can_Use_Ultimate": "boolean",
    "SP_Gain_Modifier": "number (0.8 ~ 1.5)",
    "Duel_Accept_Threshold": "number (0.45 ~ 0.58)"
  }
}
```

```json
{
  "AIProfile": {
    "Profile_ID": "string (AGGRESSIVE | DEFENSIVE | STRATEGIC | ...)",
    "Troop_Preference": ["string (TroopType)"],
    "Lane_Strategy": "string (CONCENTRATE | SPREAD | TARGET_WEAK)",
    "Tactic_Priority": ["string (TacticType ID)"],
    "Deploy_Style": "string (ALL_IN | STEADY | REACTIVE)",
    "Special_Troop_Ratio": "number (0~1, 特殊兵種使用比例)"
  }
}
```

```json
{
  "AIGeneralTemplate": {
    "Template_ID": "string",
    "Name": "string",
    "Profile_ID": "string",
    "Base_Stats": {
      "STR": "number", "INT": "number", "LEA": "number",
      "POL": "number", "CHA": "number", "LUK": "number"
    },
    "Exclusive_Tactics": ["string (Tactic_ID)"],
    "Exclusive_Troops": ["string (Troop_ID)"],
    "Equipped_Tally": {
      "Tally_ID": "string | null",
      "Quality": "UR | SSR | SR | R | null",
      "Star": "number (1~5)"
    },
    "Custom_Difficulty_Mod": "number (個體難度乘數)",
    "Dialogue": {
      "Appear": "string",
      "Duel_Accept": "string",
      "Duel_Refuse": "string",
      "Defeat": "string"
    },
    "Chapter_Available": "number (最早出現章節)"
  }
}
```

```json
{
  "ChapterAIConfig": {
    "Chapter_ID": "number",
    "Chapter_Modifier": "number (章節屬性修正, 1.0~)",
    "AI_Pool": ["string (AIGeneralTemplate ID)"],
    "Max_Special_Troops": "number",
    "Max_Reincarnation": "number",
    "Difficulty_Range": {
      "Min": "string (Difficulty_ID)",
      "Max": "string (Difficulty_ID)"
    }
  }
}
```

### Server 端

| 欄位 | 型別 | 說明 |
|---|---|---|
| battle_ai_log_id | VARCHAR(32) PK | AI 戰鬥記錄 ID |
| player_id | VARCHAR(32) FK | 玩家 |
| chapter_id | INT | 章節 |
| difficulty | ENUM | EASY/NORMAL/HARD/NIGHTMARE/HELL |
| ai_template_id | VARCHAR(32) | AI 武將模板 |
| ai_power_score | INT | AI 戰力評估值 |
| player_power_score | INT | 玩家戰力評估值 |
| result | ENUM | WIN/LOSE/DRAW |
| adaptive_scale | DECIMAL(4,2) | 自適應縮放倍率 |
| turns | INT | 回合數 |
| created_at | DATETIME | 記錄時間 |

---

## J. 名詞定義

| 名詞 | 定義 |
|---|---|
| AI Profile | AI 武將的行為模板，決定兵種偏好、路線策略、戰法優先順序 |
| AI IQ | AI 的智能等級（LOW~PERFECT），決定 AI 是否會做剋制分析、最優選擇 |
| 難度縮放 | 根據難度等級對 AI 武將屬性的倍率修正（EASY=×0.7 ~ HELL=×2.0） |
| 章節修正 | 隨主線章節遞增的 AI 屬性加成倍率 |
| AI 武將池 | 每個章節可用的 AI 武將模板清單與數量上限 |
| 自適應難度 | 根據玩家連勝/連敗自動微調 AI 強度的機制 |
| 戰力評估值 | 綜合屬性、兵種、戰法、轉生計算的 AI 武將總實力值 |
| 單挑接受閾值 | AI 判斷是否接受玩家單挑挑戰的分數門檻（預設 0.58） |
| 部署節奏 | AI 每回合可部署的兵種數量，隨回合與難度遞增 |
| 回合結束重算 | 每季結束時批次重算所有 AI 武將屬性、虎符等級、兵種戰力、國力指數的流程 |
| AI 特殊兵種戰力 | AI 裝備虎符後的特殊兵種攻防，受武將屬性（STR/INT/LEA 等）、虎符品質/星級、適性效率、地形/家族/性別適性共同影響 |
| EnemyAI | 當前 Demo 版的 AI 控制器（`assets/scripts/battle/controllers/EnemyAI.ts`），負責互剋策略與路線部署 |
