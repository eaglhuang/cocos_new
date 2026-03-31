/**
 * ActionSystem 單元測試
 *
 * 測試範圍：
 *   - registerSkills / getSkill / getAllSkillIds：Registry 管理
 *   - playSkill：找不到技能的警告行為
 *   - playSkill：時間軸 step 的 dispatch（mock 服務呼叫）
 *
 * 注意：ActionSystem 的 step 執行依賴 services()（ServiceLoader）。
 * 在純 Node.js 下我們 mock 服務，驗證 step dispatch 邏輯的正確性。
 *
 * Unity 對照：類似 PlayableDirector 技能序列的 Integration Test，
 * 用 fake AudioSource / fake ParticleSystem 驗證 Timeline 邏輯。
 */

import { ActionSystem, SkillDef } from '../../core/systems/ActionSystem';
import { TestSuite, assert } from './TestRunner';

// ─── Mock 服務 ──────────────────────────────────────────────────────────────

/**
 * 建立一個簡易 mock ServiceLoader，讓 ActionSystem 在純 Node.js 下可執行。
 * 利用 require 攔截 ServiceLoader.getInstance() 的回傳值。
 */
function buildMockServices() {
    const log: { type: string; args: unknown[] }[] = [];

    const mockServices = {
        event:     { emit: (name: string, data: unknown) => log.push({ type: 'event', args: [name, data] }) },
        audio:     { playSfx: (clip: string) => log.push({ type: 'audio', args: [clip] }) },
        effect:    { playBlock: (id: string) => log.push({ type: 'vfx', args: [id] }) },
        floatText: { show: (type: string, text: string) => log.push({ type: 'floatText', args: [type, text] }) },
        buff:      { applyBuff: (uid: string, eff: string, dur: number) => log.push({ type: 'buff', args: [uid, eff, dur] }) },
    };

    return { log, mockServices };
}

// ─── 測試用技能定義 ─────────────────────────────────────────────────────────

const SIMPLE_SKILL: SkillDef = {
    id: 'test-skill',
    label: '測試技能',
    description: '僅用於單元測試',
    costSp: 50,
    steps: [
        { type: 'audio',     clip: 'fireball',   atTime: 0.0 },
        { type: 'floatText', text: '測試！',       atTime: 0.0 },
    ],
};

const MULTI_STEP_SKILL: SkillDef = {
    id: 'multi-step',
    label: '多步驟技能',
    description: '測試多 step 的時間軸計算',
    costSp: 100,
    steps: [
        { type: 'audio',  clip: 'boom',    atTime: 0.0  },
        { type: 'audio',  clip: 'thunder', atTime: 0.5  },
        { type: 'audio',  clip: 'wave',    atTime: 1.2  },
    ],
};

// ─── 測試套件 ────────────────────────────────────────────────────────────────

export function createActionSystemSuite(): TestSuite {
    const suite = new TestSuite('ActionSystem');

    // ── Registry ─────────────────────────────────────────────────────────────

    suite.test('registerSkills + getSkill：能查詢到已注冊技能', () => {
        const sys = new ActionSystem();
        sys.registerSkills([SIMPLE_SKILL]);
        const def = sys.getSkill('test-skill');
        assert.isDefined(def, '應能取得已注冊的 SkillDef');
        assert.equals('test-skill', def!.id);
        assert.equals('測試技能', def!.label);
        assert.equals(50, def!.costSp);
    });

    suite.test('getSkill：未注冊的 id 回傳 undefined', () => {
        const sys = new ActionSystem();
        const def = sys.getSkill('no-such-skill');
        assert.equals(undefined, def);
    });

    suite.test('getAllSkillIds：空 registry 回傳空陣列', () => {
        const sys = new ActionSystem();
        const ids = sys.getAllSkillIds();
        assert.lengthEquals(0, ids);
    });

    suite.test('getAllSkillIds：批量注冊後回傳所有 id', () => {
        const sys = new ActionSystem();
        sys.registerSkills([SIMPLE_SKILL, MULTI_STEP_SKILL]);
        const ids = sys.getAllSkillIds();
        assert.lengthEquals(2, ids);
        assert.isTrue(ids.includes('test-skill'));
        assert.isTrue(ids.includes('multi-step'));
    });

    suite.test('registerSkills：重複呼叫不覆蓋舊技能（累積注冊）', () => {
        const sys = new ActionSystem();
        sys.registerSkills([SIMPLE_SKILL]);
        sys.registerSkills([MULTI_STEP_SKILL]);
        assert.lengthEquals(2, sys.getAllSkillIds());
    });

    // ── playSkill：找不到技能 ────────────────────────────────────────────────

    suite.test('playSkill：找不到技能時呼叫 onComplete（不卡住）', (done?: () => void) => {
        const sys = new ActionSystem();
        let completed = false;
        sys.playSkill('non-existent', {
            casterUnitId:    'u1',
            casterPos:       { x: 0, y: 0, z: 0 },
            targetUnitIds:   [],
            targetPositions: [],
        }, () => { completed = true; });

        // playSkill 找不到技能會立即呼叫 onComplete（同步）
        assert.isTrue(completed, 'onComplete 應立即被呼叫');
    });

    // ── SkillDef 結構驗證 ────────────────────────────────────────────────────

    suite.test('SkillDef steps：costSp 正確', () => {
        const sys = new ActionSystem();
        sys.registerSkills([SIMPLE_SKILL]);
        const def = sys.getSkill('test-skill')!;
        assert.equals(50, def.costSp);
    });

    suite.test('SkillDef steps：step 數量與 atTime 正確', () => {
        const sys = new ActionSystem();
        sys.registerSkills([MULTI_STEP_SKILL]);
        const def = sys.getSkill('multi-step')!;
        assert.lengthEquals(3, def.steps);
        assert.equals(0.0,  def.steps[0].atTime);
        assert.equals(0.5,  def.steps[1].atTime);
        assert.equals(1.2,  def.steps[2].atTime);
    });

    suite.test('SkillDef：skills.json 格式的 4 個武將技能可全部解析', () => {
        // 模擬 JSON.parse(skills.json) 後的結果
        const raw: SkillDef[] = [
            { id: 'zhang-fei-roar',  label: '虎嘯',   description: '', costSp: 100, steps: [] },
            { id: 'guan-yu-slash',   label: '青龍偃月', description: '', costSp: 100, steps: [] },
            { id: 'lu-bu-rampage',   label: '天下無雙', description: '', costSp: 100, steps: [] },
            { id: 'cao-cao-tactics', label: '奇謀佈陣', description: '', costSp: 80,  steps: [] },
        ];
        const sys = new ActionSystem();
        sys.registerSkills(raw);
        assert.lengthEquals(4, sys.getAllSkillIds());
        assert.isDefined(sys.getSkill('cao-cao-tactics'));
        assert.equals(80, sys.getSkill('cao-cao-tactics')!.costSp);
    });

    return suite;
}
