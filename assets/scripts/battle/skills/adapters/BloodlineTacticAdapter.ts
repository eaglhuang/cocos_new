import type { GeneralUnit } from '../../../core/models/GeneralUnit';
import { SkillSourceType, type CanonicalTacticDefinition } from '../../../shared/SkillRuntimeContract';
import { SeedTacticAdapter, type SeedTacticRequestOptions } from './SeedTacticAdapter';

export class BloodlineTacticAdapter extends SeedTacticAdapter {
  constructor(tacticDefinitionsById: Map<string, CanonicalTacticDefinition>) {
    super(tacticDefinitionsById);
  }

  public override buildRequest(general: GeneralUnit, ownerUid: string, options: SeedTacticRequestOptions = {}) {
    const request = super.buildRequest(general, ownerUid, options);
    if (!request) {
      return null;
    }

    if (request.sourceType !== SkillSourceType.Bloodline && !this.isBloodlineSlot(general, request.tacticId)) {
      return null;
    }

    return {
      ...request,
      sourceType: SkillSourceType.Bloodline,
    };
  }

  private isBloodlineSlot(general: GeneralUnit, tacticId?: string | null): boolean {
    return (general.tacticSlots ?? []).some((slot) => slot.tacticId === tacticId && slot.source === 'bloodline');
  }
}