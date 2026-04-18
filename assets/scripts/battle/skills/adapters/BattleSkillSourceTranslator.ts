import { BattleTactic } from '../../../core/config/Constants';
import type { GeneralUnit } from '../../../core/models/GeneralUnit';
import {
  type BattleSkillRequest,
  type BattleSkillTargetMode,
  type CanonicalTacticDefinition,
} from '../../../shared/SkillRuntimeContract';
import { BloodlineTacticAdapter } from './BloodlineTacticAdapter';
import { MentorTacticAdapter } from './MentorTacticAdapter';
import { SceneGambitAdapter } from './SceneGambitAdapter';
import { SeedTacticAdapter, type SeedTacticRequestOptions } from './SeedTacticAdapter';
import { TigerTallyTacticAdapter, type TigerTallySkillCarrier, type TigerTallyTacticRequestOptions } from './TigerTallyTacticAdapter';

export interface ResolvedSeedTacticDescriptor {
  tacticId: string;
  battleSkillId: string;
  targetMode: BattleSkillTargetMode;
}

export class BattleSkillSourceTranslator {
  private readonly sceneGambitAdapter = new SceneGambitAdapter();
  private readonly tigerTallyAdapter = new TigerTallyTacticAdapter();

  constructor(
    private readonly getTacticDefinitionsById: () => Map<string, CanonicalTacticDefinition>,
  ) {}

  public buildSeedTacticRequest(
    general: GeneralUnit,
    ownerUid: string,
    options: SeedTacticRequestOptions = {},
  ): BattleSkillRequest | null {
    return this.createSeedAdapter().buildRequest(general, ownerUid, options);
  }

  public resolvePrimarySeedTacticDescriptor(general: GeneralUnit): ResolvedSeedTacticDescriptor | null {
    const request = this.createSeedAdapter().buildRequest(general, general.faction);
    if (!request || !request.tacticId) {
      return null;
    }

    return {
      tacticId: request.tacticId,
      battleSkillId: request.battleSkillId,
      targetMode: request.targetMode,
    };
  }

  public buildBloodlineTacticRequest(
    general: GeneralUnit,
    ownerUid: string,
    options: SeedTacticRequestOptions = {},
  ): BattleSkillRequest | null {
    return new BloodlineTacticAdapter(this.getTacticDefinitionsById()).buildRequest(general, ownerUid, options);
  }

  public buildMentorTacticRequest(
    general: GeneralUnit,
    ownerUid: string,
    options: SeedTacticRequestOptions = {},
  ): BattleSkillRequest | null {
    return new MentorTacticAdapter(this.getTacticDefinitionsById()).buildRequest(general, ownerUid, options);
  }

  public buildSceneGambitRequest(battleTactic: BattleTactic, ownerUid?: string): BattleSkillRequest | null {
    return this.sceneGambitAdapter.buildRequest(battleTactic, ownerUid);
  }

  public buildTigerTallyRequest(
    tallyCard: TigerTallySkillCarrier,
    ownerUid: string,
    options: TigerTallyTacticRequestOptions,
  ): BattleSkillRequest | null {
    return this.tigerTallyAdapter.buildRequest(tallyCard, ownerUid, options);
  }

  private createSeedAdapter(): SeedTacticAdapter {
    return new SeedTacticAdapter(this.getTacticDefinitionsById());
  }
}