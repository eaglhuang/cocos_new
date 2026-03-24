import {
    DEFAULT_BUFF_PARTICLE_PROFILES,
    normalizeBuffParticleProfileTable,
} from '../../battle/views/effects/BuffParticleProfileConfig';
import { TestSuite, assert } from './TestRunner';

export function createBuffParticleProfileConfigSuite(): TestSuite {
    const suite = new TestSuite('BuffParticleProfileConfig');

    suite.test('normalize：缺欄位時回填 fallback 預設值', () => {
        const table = normalizeBuffParticleProfileTable({
            version: 2,
            variants: {
                AtkGain: {
                    spark: {
                        rateOverTime: 99,
                    },
                },
            },
        });

        assert.equals(2, table.version);
        assert.equals(99, table.variants.AtkGain.spark.rateOverTime);
        assert.equals(
            DEFAULT_BUFF_PARTICLE_PROFILES.AtkGain.spark.startSize,
            table.variants.AtkGain.spark.startSize,
        );
        assert.equals(
            DEFAULT_BUFF_PARTICLE_PROFILES.HpGain.accent.startSpeed,
            table.variants.HpGain.accent.startSpeed,
        );
    });

    suite.test('normalize：顏色會被限制在 0 到 255', () => {
        const table = normalizeBuffParticleProfileTable({
            variants: {
                HpLoss: {
                    spark: {
                        color: [-10, 999, 12.6, 500],
                    },
                },
            },
        });

        assert.equals(0, table.variants.HpLoss.spark.color[0]);
        assert.equals(255, table.variants.HpLoss.spark.color[1]);
        assert.equals(13, table.variants.HpLoss.spark.color[2]);
        assert.equals(255, table.variants.HpLoss.spark.color[3]);
    });

    suite.test('normalize：不合法 root 仍能退回完整預設表', () => {
        const table = normalizeBuffParticleProfileTable(null);

        assert.equals(
            DEFAULT_BUFF_PARTICLE_PROFILES.AtkLoss.spark.capacity,
            table.variants.AtkLoss.spark.capacity,
        );
        assert.equals(
            DEFAULT_BUFF_PARTICLE_PROFILES.HpGain.accent.quadCount,
            table.variants.HpGain.accent.quadCount,
        );
    });

    return suite;
}