import {
    CURRENT_VFX_EFFECT_TABLE_VERSION,
    DEFAULT_VFX_EFFECTS,
    normalizeVfxEffectTable,
} from '../../core/config/VfxEffectConfig';
import { TestSuite, assert } from './TestRunner';

export function createVfxEffectConfigSuite(): TestSuite {
    const suite = new TestSuite('VfxEffectConfig');

    suite.test('normalize：legacy v0 裸表可自動升級到目前 schema', () => {
        const table = normalizeVfxEffectTable({
            custom_hit: {
                blockId: 'impact_ring',
                lifetime: 3.2,
            },
        });

        assert.equals(CURRENT_VFX_EFFECT_TABLE_VERSION, table.version);
        assert.equals('impact_ring', table.effects.custom_hit.blockId);
        assert.equals(3.2, table.effects.custom_hit.lifetime);
    });

    suite.test('normalize：已知效果缺欄位時回填 fallback', () => {
        const table = normalizeVfxEffectTable({
            version: 1,
            effects: {
                hit_enemy: {
                    blockId: 'impact_shock',
                },
            },
        });

        assert.equals(DEFAULT_VFX_EFFECTS.hit_enemy.audio, table.effects.hit_enemy.audio);
        assert.equals(
            DEFAULT_VFX_EFFECTS.hit_enemy.notify?.textKey,
            table.effects.hit_enemy.notify?.textKey,
        );
        assert.equals(DEFAULT_VFX_EFFECTS.hit_enemy.lifetime, table.effects.hit_enemy.lifetime);
    });

    suite.test('normalize：較新的未知 schema 版本保守退回 fallback', () => {
        const table = normalizeVfxEffectTable({
            version: 999,
            effects: {
                hit_enemy: {
                    blockId: 'glow_soft',
                },
            },
        });

        assert.equals(CURRENT_VFX_EFFECT_TABLE_VERSION, table.version);
        assert.equals(DEFAULT_VFX_EFFECTS.hit_enemy.blockId, table.effects.hit_enemy.blockId);
        assert.equals(DEFAULT_VFX_EFFECTS.skill_lu_bu.audio, table.effects.skill_lu_bu.audio);
    });

    return suite;
}