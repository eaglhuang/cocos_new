import { BattleTactic } from '../assets/scripts/core/config/Constants';
import { BattleSkillSourceTranslator } from '../assets/scripts/battle/skills/adapters/BattleSkillSourceTranslator';
import { Faction } from '../assets/scripts/core/config/Constants';
import { GeneralUnit } from '../assets/scripts/core/models/GeneralUnit';
import {
    BattleSkillTargetMode,
    BattleSkillTiming,
    SkillSourceType,
    type CanonicalTacticDefinition,
} from '../shared/skill-runtime';
import { TestSuite, assert } from './TestRunner';
import { resolveBattleSkillProfile } from '../assets/scripts/battle/skills/BattleSkillProfiles';

function createGeneralWithTactics(tacticIds: string[]): GeneralUnit {
    return new GeneralUnit({
        id: 'test-general',
        name: '測試武將',
        faction: Faction.Player,
        hp: 1000,
        maxSp: 100,
        initialSp: 100,
        str: 100,
        int: 95,
        lea: 90,
        tacticSlots: tacticIds.map((tacticId, index) => ({
            slotId: `slot-${index + 1}`,
            tacticId,
            source: 'bloodline',
        })),
    });
}

function createTranslator(definitions: CanonicalTacticDefinition[]): BattleSkillSourceTranslator {
    const map = new Map(definitions.map((definition) => [definition.id, definition]));
    return new BattleSkillSourceTranslator(() => map);
}

export function createBattleSkillSourceTranslatorSuite(): TestSuite {
    const suite = new TestSuite('BattleSkillSourceTranslator');

    suite.test('buildSeedTacticRequest：8 條初始庫 canonical tactics 都能轉成自動施放 request', () => {
        const translator = createTranslator([
            {
                id: 'tactic-cavalry-shock',
                displayName: '騎軍衝鋒',
                battleSkillId: 'zhao-yun-pierce',
                sourceType: SkillSourceType.SeedTactic,
                targetMode: BattleSkillTargetMode.Line,
                timing: BattleSkillTiming.ActiveCast,
                manualTargeting: false,
                autoAimMode: 'densest-line',
            },
            {
                id: 'tactic-spear-phalanx',
                displayName: '長槍列陣',
                battleSkillId: 'sun-quan-tide',
                sourceType: SkillSourceType.SeedTactic,
                targetMode: BattleSkillTargetMode.AdjacentTiles,
                timing: BattleSkillTiming.ActiveCast,
                manualTargeting: false,
                autoAimMode: 'adjacent-ring',
            },
            {
                id: 'tactic-archer-volley',
                displayName: '箭雨齊發',
                battleSkillId: 'guan-yu-slash',
                sourceType: SkillSourceType.SeedTactic,
                targetMode: BattleSkillTargetMode.Line,
                timing: BattleSkillTiming.ActiveCast,
                manualTargeting: false,
                autoAimMode: 'densest-line',
            },
            {
                id: 'tactic-fire-scheme',
                displayName: '火計佈陣',
                battleSkillId: 'zhou-yu-inferno',
                sourceType: SkillSourceType.SeedTactic,
                targetMode: BattleSkillTargetMode.Tile,
                timing: BattleSkillTiming.ActiveCast,
                manualTargeting: false,
                autoAimMode: 'occupied-tile',
            },
            {
                id: 'tactic-morale-rally',
                displayName: '軍心鼓舞',
                battleSkillId: 'liu-bei-rally',
                sourceType: SkillSourceType.SeedTactic,
                targetMode: BattleSkillTargetMode.AllyAll,
                timing: BattleSkillTiming.ActiveCast,
                manualTargeting: false,
                autoAimMode: 'all-allies',
            },
            {
                id: 'tactic-river-ambush',
                displayName: '水路伏擊',
                battleSkillId: 'sun-quan-tide',
                sourceType: SkillSourceType.SeedTactic,
                targetMode: BattleSkillTargetMode.AdjacentTiles,
                timing: BattleSkillTiming.ActiveCast,
                manualTargeting: false,
                autoAimMode: 'adjacent-ring',
            },
            {
                id: 'tactic-battle-roar',
                displayName: '震軍怒喝',
                battleSkillId: 'zhang-fei-roar',
                sourceType: SkillSourceType.SeedTactic,
                targetMode: BattleSkillTargetMode.EnemyAll,
                timing: BattleSkillTiming.ActiveCast,
                manualTargeting: false,
                autoAimMode: 'all-enemies',
            },
            {
                id: 'tactic-dragon-pierce',
                displayName: '龍魂突刺',
                battleSkillId: 'zhao-yun-pierce',
                sourceType: SkillSourceType.SeedTactic,
                targetMode: BattleSkillTargetMode.Line,
                timing: BattleSkillTiming.ActiveCast,
                manualTargeting: false,
                autoAimMode: 'densest-line',
            },
        ]);

        const general = createGeneralWithTactics([
            'tactic-cavalry-shock',
            'tactic-spear-phalanx',
            'tactic-archer-volley',
            'tactic-fire-scheme',
            'tactic-morale-rally',
            'tactic-river-ambush',
            'tactic-battle-roar',
            'tactic-dragon-pierce',
        ]);

        const cases = [
            ['tactic-cavalry-shock', 'zhao-yun-pierce', BattleSkillTargetMode.Line],
            ['tactic-spear-phalanx', 'sun-quan-tide', BattleSkillTargetMode.AdjacentTiles],
            ['tactic-archer-volley', 'guan-yu-slash', BattleSkillTargetMode.Line],
            ['tactic-fire-scheme', 'zhou-yu-inferno', BattleSkillTargetMode.Tile],
            ['tactic-morale-rally', 'liu-bei-rally', BattleSkillTargetMode.AllyAll],
            ['tactic-river-ambush', 'sun-quan-tide', BattleSkillTargetMode.AdjacentTiles],
            ['tactic-battle-roar', 'zhang-fei-roar', BattleSkillTargetMode.EnemyAll],
            ['tactic-dragon-pierce', 'zhao-yun-pierce', BattleSkillTargetMode.Line],
        ] as const;

        for (const [tacticId, battleSkillId, targetMode] of cases) {
            const request = translator.buildSeedTacticRequest(general, Faction.Player, { tacticId });
            assert.isDefined(request, `Expected request for ${tacticId}`);
            assert.equals(tacticId, request!.tacticId!);
            assert.equals(battleSkillId, request!.battleSkillId);
            assert.equals(targetMode, request!.targetMode);
            assert.equals(BattleSkillTiming.ActiveCast, request!.timing);
            assert.isFalse(resolveBattleSkillProfile(battleSkillId)?.manualTargeting ?? false, `Expected ${tacticId} manualTargeting to stay false`);
        }
    });

    suite.test('buildSeedTacticRequest：可將 tacticSlots 轉成 canonical seed tactic request', () => {
        const translator = createTranslator([
            {
                id: 'tactic-cavalry-shock',
                displayName: '騎軍衝鋒',
                battleSkillId: 'zhao-yun-pierce',
                sourceType: SkillSourceType.SeedTactic,
                targetMode: BattleSkillTargetMode.Line,
                timing: BattleSkillTiming.ActiveCast,
            },
        ]);
        const general = createGeneralWithTactics(['tactic-cavalry-shock']);

        const request = translator.buildSeedTacticRequest(general, Faction.Player);
        assert.isDefined(request);
        assert.equals('tactic-cavalry-shock', request!.tacticId!);
        assert.equals('zhao-yun-pierce', request!.battleSkillId);
        assert.equals(BattleSkillTargetMode.Line, request!.targetMode);
        assert.equals(BattleSkillTiming.ActiveCast, request!.timing);
    });

    suite.test('buildSeedTacticRequest：可依 battleSkillId 選到對應 tactic slot', () => {
        const translator = createTranslator([
            {
                id: 'tactic-cavalry-shock',
                displayName: '騎軍衝鋒',
                battleSkillId: 'zhao-yun-pierce',
                sourceType: SkillSourceType.SeedTactic,
                targetMode: BattleSkillTargetMode.Line,
                timing: BattleSkillTiming.ActiveCast,
            },
            {
                id: 'tactic-morale-rally',
                displayName: '軍心鼓舞',
                battleSkillId: 'liu-bei-rally',
                sourceType: SkillSourceType.SeedTactic,
                targetMode: BattleSkillTargetMode.AllyAll,
                timing: BattleSkillTiming.ActiveCast,
            },
        ]);
        const general = createGeneralWithTactics(['tactic-cavalry-shock', 'tactic-morale-rally']);

        const request = translator.buildSeedTacticRequest(general, Faction.Player, {
            battleSkillId: 'liu-bei-rally',
        });
        assert.isDefined(request);
        assert.equals('tactic-morale-rally', request!.tacticId!);
        assert.equals(BattleSkillTargetMode.AllyAll, request!.targetMode);
    });

    suite.test('buildBloodlineTacticRequest：可從 bloodline source tactic slot 轉譯', () => {
        const translator = createTranslator([
            {
                id: 'tactic-dragon-pierce',
                displayName: '龍魂突刺',
                battleSkillId: 'zhao-yun-pierce',
                sourceType: SkillSourceType.Bloodline,
                targetMode: BattleSkillTargetMode.Line,
                timing: BattleSkillTiming.ActiveCast,
            },
        ]);
        const general = new GeneralUnit({
            id: 'bloodline-general',
            name: '血統武將',
            faction: Faction.Player,
            hp: 1000,
            maxSp: 100,
            initialSp: 100,
            tacticSlots: [{ slotId: 'slot-1', tacticId: 'tactic-dragon-pierce', source: 'bloodline' }],
        });

        const request = translator.buildBloodlineTacticRequest(general, Faction.Player);
        assert.isDefined(request);
        assert.equals(SkillSourceType.Bloodline, request!.sourceType);
        assert.equals('tactic-dragon-pierce', request!.tacticId!);
    });

    suite.test('buildSceneGambitRequest：可將 battle tactic enum 轉成 global-stage request', () => {
        const translator = createTranslator([]);
        const request = translator.buildSceneGambitRequest(BattleTactic.FloodAttack);
        assert.isDefined(request);
        assert.equals(SkillSourceType.SceneGambit, request!.sourceType);
        assert.equals(BattleSkillTargetMode.GlobalStage, request!.targetMode);
        assert.equals(BattleSkillTiming.StartOfBattle, request!.timing);
        assert.equals('scene-flood-attack', request!.battleSkillId);
    });

    suite.test('buildTigerTallyRequest：可將虎符卡戰技 metadata 壓成 request seam', () => {
        const translator = createTranslator([]);
        const request = translator.buildTigerTallyRequest(
            {
                unitName: '虎豹騎',
                unitType: 'cavalry',
                tacticId: 'tiger-tally-cavalry-shock',
                battleSkillId: 'tiger-charge',
                targetMode: BattleSkillTargetMode.EnemySingle,
                timing: BattleSkillTiming.ActiveCast,
                abilities: ['奔襲突破'],
                source: { sourceType: '名將遺贈虎符' },
            },
            Faction.Player,
            {},
        );

        assert.isDefined(request);
        assert.equals(SkillSourceType.TigerTally, request.sourceType);
        assert.equals('tiger-charge', request.battleSkillId);
        assert.equals(BattleSkillTargetMode.EnemySingle, request.targetMode);
        assert.equals('tiger-tally-cavalry-shock', request.tacticId!);
        assert.contains(request.notes ?? '', '虎豹騎');
    });

    return suite;
}