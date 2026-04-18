import type { ContentContractRef } from '../../core/UISpecTypes';
import type { TabBindPathPolicy } from './TabBindPathPolicy';

export type OverviewBindPathTarget = 'shell' | 'unified';

export const OVERVIEW_CONTENT_REQUIRED_FIELDS = [
    'headerTitle',
    'headerName',
    'headerMeta',
    'rarityLabel',
    'rarityTier',
    'portraitModeHint',
    'coreStatsTitle',
    'coreStatsValue',
    'roleTitle',
    'roleValue',
    'traitTitle',
    'traitValue',
    'bloodlineTitle',
    'bloodlineName',
    'awakeningLabel',
    'awakeningProgress',
    'personalityLabel',
    'personalityValue',
    'bloodlineCardTitle',
    'bloodlineBody',
    'crestTitle',
    'crestHint',
    'crestState',
    'crestGlyphPrimary',
    'crestGlyphSecondary',
    'crestFaceResource',
    'storyCells',
    'dualLayerStats',
    'profilePresentation',
    'portraitResource',
] as const;

export const OVERVIEW_UNIFIED_CONTENT_REQUIRED_FIELDS = OVERVIEW_CONTENT_REQUIRED_FIELDS.filter(
    (field) => field !== 'portraitModeHint',
);

export const OVERVIEW_CONTENT_CONTRACT_REF: ContentContractRef = {
    schemaId: 'general-detail-overview-content',
    familyId: 'detail-split',
    requiredFields: [...OVERVIEW_CONTENT_REQUIRED_FIELDS],
};

export const OVERVIEW_UNIFIED_CONTENT_CONTRACT_REF: ContentContractRef = {
    schemaId: 'general-detail-overview-content',
    familyId: 'detail-split',
    requiredFields: [...OVERVIEW_UNIFIED_CONTENT_REQUIRED_FIELDS],
};

export const OVERVIEW_UNIFIED_BIND_PATH_ALIASES: Record<string, string> = {
    headerTitle: 'HeaderRow/NameTitleColumn/TitleLabel',
    headerName: 'HeaderRow/NameTitleColumn/NameLabel',
    headerMeta: 'HeaderRow/MetaColumn/MetaLabel',
    rarityLabel: 'HeaderRow/MetaColumn/RarityBadgeDock/RarityBadge/RarityBadgeLabel',
    coreStatsTitle: 'OverviewSummaryModules/CoreStatsCard/CoreStatsTitleBand/CoreStatsTitle',
    coreStatsValue: 'OverviewSummaryModules/CoreStatsCard/CoreStatsValue',
    roleTitle: 'OverviewSummaryModules/RoleCard/RoleTitleBand/RoleTitle',
    roleValue: 'OverviewSummaryModules/RoleCard/RoleValue',
    traitTitle: 'OverviewSummaryModules/TraitCard/TraitTitleBand/TraitTitle',
    traitValue: 'OverviewSummaryModules/TraitCard/TraitValue',
    bloodlineName: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineSummaryCard/BloodlineName',
    awakeningLabel: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineSummaryCard/AwakeningProgressGroup/AwakeningLabel',
    personalityValue: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineSummaryCard/PersonalityValue',
    bloodlineBody: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineSummaryCard/BloodlineBody',
    crestTitle: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineCrestCard/CrestTitle',
    crestHint: 'BloodlineOverviewModules/BloodlineUnifiedCard/BloodlineCrestCard/CrestHint',
};

export function resolveOverviewBindPathForTarget(
    fieldKey: string,
    bindPath: string,
    target: OverviewBindPathTarget,
): string {
    if (target === 'shell') {
        return bindPath;
    }

    return OVERVIEW_UNIFIED_BIND_PATH_ALIASES[fieldKey] ?? bindPath;
}

export const overviewBindPathPolicy: TabBindPathPolicy = {
    aliases: OVERVIEW_UNIFIED_BIND_PATH_ALIASES,
    resolveForTarget: resolveOverviewBindPathForTarget,
};