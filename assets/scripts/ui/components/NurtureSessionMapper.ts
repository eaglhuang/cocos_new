import type {
    GeneralDetailCrestState,
    GeneralDetailDefaultTab,
    GeneralDetailStorySlot,
    GeneralStatsConfig,
    GeneralTalentRevealLevel,
} from '../../core/models/GeneralUnit';

type NurtureDualLayerStatRecord = Record<keyof GeneralStatsConfig, {
    talent: {
        base: number | null;
        current: number | null;
        maxPotential: number | null;
        revelationLevel: GeneralTalentRevealLevel;
    };
    prowess: number | null;
}>;

type NurtureProfilePresentation = {
    defaultTab: GeneralDetailDefaultTab;
    crestState: GeneralDetailCrestState;
    storyStripCells: Record<GeneralDetailStorySlot, string>;
};

type NurtureTrainingProfile = {
    sourceSessionId?: string;
    phaseBlock: string;
    mentorModeLabel: string;
    recommendedFocus: string[];
    graduationTags: string[];
};

type NurtureSessionInfo = {
    title: string;
    subtitle: string;
    turnLabel: string;
};

type NurtureSupportPlan = {
    title?: string;
    mentors: string[];
    lineageBoundary: string;
    supportSummary?: string;
};

type NurtureRiskPlan = {
    title?: string;
    pressureTags: string[];
    recoveryHint: string;
    concealExactYield?: boolean;
};

export interface NurtureSessionCanonicalContentState {
    sessionInfo: NurtureSessionInfo;
    dualLayerStats: NurtureDualLayerStatRecord;
    profilePresentation: NurtureProfilePresentation;
    trainingProfile: NurtureTrainingProfile;
    supportPlan: NurtureSupportPlan;
    riskPlan: NurtureRiskPlan;
}

export interface NurtureSessionContentState extends NurtureSessionCanonicalContentState {
    sessionTitle: string;
    sessionSubtitle: string;
    turnLabel: string;
    sessionSummary: string;
    phaseBlockTitle: string;
    phaseBlockBody: string;
    mentorModeLabel: string;
    mainCourseTitle: string;
    mainCourseBody: string;
    supportWindowTitle: string;
    supportWindowBody: string;
    riskWindowTitle: string;
    riskWindowBody: string;
    graduationTagsTitle: string;
    graduationTagsBody: string;
}

const STAT_KEYS: Array<keyof GeneralStatsConfig> = ['str', 'int', 'lea', 'pol', 'cha', 'luk'];

const STAT_LABEL: Record<keyof GeneralStatsConfig, string> = {
    str: '武力',
    int: '智略',
    lea: '統率',
    pol: '政略',
    cha: '魅力',
    luk: '氣運',
};

const PHASE_LABEL: Record<string, string> = {
    BEGIN: '前期啟蒙',
    MID: '中盤磨合',
    LATE: '後期定型',
    GRADUATION: '畢業總結',
};

export function normalizeNurtureSessionContentState(raw: Record<string, unknown>): NurtureSessionContentState {
    const canonical = buildCanonicalState(raw);
    return buildNurtureSessionContentState(canonical);
}

export function buildNurtureSessionContentState(
    canonical: NurtureSessionCanonicalContentState,
): NurtureSessionContentState {
    const phaseLabel = formatPhaseBlock(canonical.trainingProfile.phaseBlock);
    const revealSummary = buildRevealSummary(canonical.dualLayerStats);
    const focusSummary = buildFocusSummary(canonical.trainingProfile.recommendedFocus);
    const topStatsSummary = buildTopStatsSummary(canonical.dualLayerStats);
    const graduationTagsSummary = buildGraduationTagsSummary(canonical.trainingProfile.graduationTags);

    return {
        ...canonical,
        sessionTitle: canonical.sessionInfo.title,
        sessionSubtitle: canonical.sessionInfo.subtitle,
        turnLabel: canonical.sessionInfo.turnLabel,
        sessionSummary: `本學年以${phaseLabel}為主，${revealSummary}，並為${graduationTagsSummary}做準備。`,
        phaseBlockTitle: `Phase_Block：${phaseLabel}`,
        phaseBlockBody: `本階段重點是${focusSummary}與隊伍磨合。${revealSummary}。`,
        mentorModeLabel: `教官模式：${canonical.trainingProfile.mentorModeLabel}`,
        mainCourseTitle: '本回合主修',
        mainCourseBody: `${focusSummary}，優先拉高${topStatsSummary}的穩定表現，暫不以畫面預告精確收益。`,
        supportWindowTitle: canonical.supportPlan.title ?? '支援窗口',
        supportWindowBody: buildSupportWindowBody(canonical.supportPlan),
        riskWindowTitle: canonical.riskPlan.title ?? '風險提醒',
        riskWindowBody: buildRiskWindowBody(canonical.riskPlan),
        graduationTagsTitle: 'Graduation_Tags',
        graduationTagsBody: `候選標籤：${canonical.trainingProfile.graduationTags.join(' / ')}。正式標籤於畢業前後摘要帶顯示。`,
    };
}

function buildCanonicalState(raw: Record<string, unknown>): NurtureSessionCanonicalContentState {
    const typed = raw as Partial<NurtureSessionContentState>;
    return {
        sessionInfo: typed.sessionInfo ?? {
            title: typed.sessionTitle ?? '培育行程',
            subtitle: typed.sessionSubtitle ?? '第三學年 / 中盤磨合',
            turnLabel: typed.turnLabel ?? '第 13 回合',
        },
        dualLayerStats: normalizeDualLayerStats(typed.dualLayerStats),
        profilePresentation: typed.profilePresentation ?? {
            defaultTab: 'Overview',
            crestState: 'revealed',
            storyStripCells: {
                origin: '',
                faction: '',
                role: '',
                awakening: '',
                bloodline: '',
                future: '',
            },
        },
        trainingProfile: typed.trainingProfile ?? {
            sourceSessionId: undefined,
            phaseBlock: extractPhaseBlock(typed.phaseBlockTitle),
            mentorModeLabel: extractMentorModeLabel(typed.mentorModeLabel),
            recommendedFocus: extractRecommendedFocus(typed.mainCourseBody),
            graduationTags: extractGraduationTags(typed.graduationTagsBody),
        },
        supportPlan: typed.supportPlan ?? {
            title: typed.supportWindowTitle,
            mentors: ['黃月英教官'],
            lineageBoundary: '英靈傳道屬教學支援，不會轉回血脈親傳',
            supportSummary: typed.supportWindowBody,
        },
        riskPlan: typed.riskPlan ?? {
            title: typed.riskWindowTitle,
            pressureTags: ['高壓事件', '疲勞累積'],
            recoveryHint: '畫面只以戰術標籤與恢復提示呈現',
            concealExactYield: true,
        },
    };
}

function normalizeDualLayerStats(
    raw: Partial<NurtureDualLayerStatRecord> | undefined,
): NurtureDualLayerStatRecord {
    const entries = STAT_KEYS.map((key) => {
        const current = raw?.[key];
        const base = current?.talent?.base ?? null;
        return [
            key,
            {
                talent: {
                    base,
                    current: current?.talent?.current ?? base,
                    maxPotential: current?.talent?.maxPotential ?? base,
                    revelationLevel: current?.talent?.revelationLevel ?? (base === null ? 'HIDDEN' : 'RANGE'),
                },
                prowess: current?.prowess ?? null,
            },
        ] as const;
    });

    return Object.fromEntries(entries) as NurtureDualLayerStatRecord;
}

function buildRevealSummary(dualLayerStats: NurtureDualLayerStatRecord): string {
    let exactCount = 0;
    let rangeCount = 0;
    let tendencyCount = 0;

    for (const key of STAT_KEYS) {
        const level = dualLayerStats[key].talent.revelationLevel;
        if (level === 'EXACT') {
            exactCount += 1;
        } else if (level === 'RANGE') {
            rangeCount += 1;
        } else if (level === 'TENDENCY') {
            tendencyCount += 1;
        }
    }

    if (exactCount >= 3) {
        return '目前已有多項屬性進入精確揭露，其餘欄位仍保留區間與傾向';
    }
    if (rangeCount >= 2) {
        return '揭露規則以區間與標籤為主，不在中盤提前開精確值';
    }
    if (tendencyCount > 0) {
        return '目前只公開傾向與訓練方向，不直接暴露完整數值';
    }
    return '此階段仍以封存資訊為主，暫不公開精確值';
}

function buildFocusSummary(recommendedFocus: string[]): string {
    if (recommendedFocus.length === 0) {
        return '基礎磨課';
    }
    if (recommendedFocus.length === 1) {
        return recommendedFocus[0];
    }
    return `${recommendedFocus[0]} + ${recommendedFocus[1]}`;
}

function buildTopStatsSummary(dualLayerStats: NurtureDualLayerStatRecord): string {
    const ranked = STAT_KEYS
        .map((key) => ({
            key,
            score: dualLayerStats[key].prowess ?? dualLayerStats[key].talent.current ?? -1,
        }))
        .sort((left, right) => right.score - left.score)
        .filter((entry) => entry.score >= 0)
        .slice(0, 2)
        .map((entry) => STAT_LABEL[entry.key]);

    return ranked.length > 0 ? ranked.join(' / ') : '主修軸';
}

function buildSupportWindowBody(plan: NurtureSupportPlan): string {
    const mentorLabel = plan.mentors.length > 0 ? plan.mentors.join(' / ') : '教官群';
    const summary = plan.supportSummary?.trim();
    if (summary) {
        return `${mentorLabel}提供訓練線加成；${summary}`;
    }
    return `${mentorLabel}提供訓練線加成；${plan.lineageBoundary}。`;
}

function buildRiskWindowBody(plan: NurtureRiskPlan): string {
    const pressure = plan.pressureTags.length > 0 ? plan.pressureTags.join(' / ') : '高壓事件';
    const conceal = plan.concealExactYield ? '，不提前洩露精確收益' : '';
    return `${pressure}可能疊加戰術壓力；${plan.recoveryHint}${conceal}。`;
}

function buildGraduationTagsSummary(tags: string[]): string {
    if (tags.length === 0) {
        return '畢業標籤';
    }
    return tags.slice(0, 2).join(' / ');
}

function formatPhaseBlock(phaseBlock: string): string {
    return PHASE_LABEL[phaseBlock] ?? phaseBlock;
}

function extractPhaseBlock(value: string | undefined): string {
    if (!value) {
        return 'MID';
    }
    if (value.includes('前期')) return 'BEGIN';
    if (value.includes('後期')) return 'LATE';
    if (value.includes('畢業')) return 'GRADUATION';
    return 'MID';
}

function extractMentorModeLabel(value: string | undefined): string {
    if (!value) {
        return 'TeachingOnly';
    }
    return value.replace('教官模式：', '').trim() || 'TeachingOnly';
}

function extractRecommendedFocus(value: string | undefined): string[] {
    if (!value) {
        return ['校場操練', '沙盤推演'];
    }

    const hits = ['校場操練', '講武堂研經', '沙盤推演', '市集巡視', '名士清談']
        .filter((token) => value.includes(token));

    return hits.length > 0 ? hits.slice(0, 2) : ['校場操練', '沙盤推演'];
}

function extractGraduationTags(value: string | undefined): string[] {
    if (!value) {
        return ['守成', '教學線偏好'];
    }

    const rawTags = value
        .replace('候選標籤：', '')
        .replace('。正式標籤於畢業前後摘要帶顯示。', '')
        .split(/[\/／]/)
        .map((token) => token.trim())
        .filter((token) => token.length > 0);

    return rawTags.length > 0 ? rawTags : ['守成', '教學線偏好'];
}