import { Faction } from '../../core/config/Constants';
import { SkillSourceType } from '../../shared/SkillRuntimeContract';

export interface BattleSkillPresentation {
  name: string;
  categoryTag: string;
  effectStatus: string;
}

const DEFAULT_PRESENTATION: BattleSkillPresentation = {
  name: '未命名技能',
  categoryTag: '戰術',
  effectStatus: '【戰術】技能效果生效',
};

const PRESENTATION_BY_SKILL_ID: Record<string, BattleSkillPresentation> = {
  'zhang-fei-roar': {
    name: '震軍怒喝',
    categoryTag: '控制',
    effectStatus: '【控制】震軍怒喝：敵軍全體暈眩，盾牆瓦解',
  },
  'cao-cao-tactics': {
    name: '兵不厭詐',
    categoryTag: '破陣',
    effectStatus: '【破陣】兵不厭詐：自動鎖定前線弱點',
  },
  'guan-yu-slash': {
    name: '月牙刀斬',
    categoryTag: '斬擊',
    effectStatus: '【斬擊】月牙刀斬：最佳直線斬擊展開',
  },
  'lu-bu-rampage': {
    name: '天下無雙',
    categoryTag: '爆發',
    effectStatus: '【爆發】天下無雙：最佳扇形壓制',
  },
  'zhao-yun-pierce': {
    name: '龍魂突刺',
    categoryTag: '突擊',
    effectStatus: '【突擊】龍魂突刺：自動貫穿最佳列',
  },
  'zhuge-liang-storm': {
    name: '諸葛風暴',
    categoryTag: '範圍',
    effectStatus: '【範圍】諸葛風暴：自動選最大範圍',
  },
  'zhou-yu-inferno': {
    name: '周瑜炎陣',
    categoryTag: '火攻',
    effectStatus: '【火攻】周瑜炎陣：點燃敵軍所在格',
  },
  'sun-quan-tide': {
    name: '江潮列陣',
    categoryTag: '陣列',
    effectStatus: '【陣列】江潮列陣：掃蕩中心周邊',
  },
  'liu-bei-rally': {
    name: '仁德號召',
    categoryTag: '支援',
    effectStatus: '【支援】仁德號召：全軍回復與士氣提振',
  },
  'diao-chan-charm': {
    name: '閉月傾城',
    categoryTag: '魅惑',
    effectStatus: '【魅惑】閉月傾城：敵軍全體受控',
  },
  'cao-zhi-verse': {
    name: '七步成章',
    categoryTag: '文擊',
    effectStatus: '【文擊】七步成章：最佳扇形文氣震擊',
  },
  'guo-jia-foresight': {
    name: '鬼謀先機',
    categoryTag: '奇策',
    effectStatus: '【奇策】鬼謀先機：最佳範圍崩解',
  },
  'sima-yi-shadow': {
    name: '司馬影策',
    categoryTag: '壓制',
    effectStatus: '【壓制】司馬影策：全敵範圍壓制',
  },
};

export function getBattleSkillPresentation(skillId: string): BattleSkillPresentation {
  return PRESENTATION_BY_SKILL_ID[skillId] ?? {
    ...DEFAULT_PRESENTATION,
    name: skillId,
    effectStatus: `【戰術】${skillId} 生效`,
  };
}

export function buildBattleSkillUsedMessage(
  skillId: string,
  faction: Faction,
  sourceType?: SkillSourceType,
): string {
  const presentation = getBattleSkillPresentation(skillId);
  const who = faction === Faction.Player ? '我方' : '敵方';
  const sourceLabel = sourceType === SkillSourceType.Ultimate ? '奧義' : '戰法';
  return `${who}${sourceLabel}【${presentation.categoryTag}】：${presentation.name}`;
}

export function buildBattleSkillAimingMessage(skillId: string, sourceType?: SkillSourceType): string {
  const presentation = getBattleSkillPresentation(skillId);
  const sourceLabel = sourceType === SkillSourceType.Ultimate ? '奧義' : '戰法';
  return `${sourceLabel}瞄準中：${presentation.name}`;
}

export function buildBattleSkillEffectMessage(skillId: string): string {
  return getBattleSkillPresentation(skillId).effectStatus;
}