export type SpiritFamilyOverviewOrigin = 'lobby' | 'general-detail';

export interface SpiritFamilyOverviewOpenPayload {
    origin?: SpiritFamilyOverviewOrigin;
    generalName?: string;
    branchUid?: string;
    entryLabel?: string;
}

export interface SpiritFamilyOverviewStoryCell {
    title: string;
    body: string;
}

export interface SpiritFamilyOverviewDisplayModel {
    texts: Record<string, string>;
    storyCells: {
        origin: SpiritFamilyOverviewStoryCell;
        bloodline: SpiritFamilyOverviewStoryCell;
        trial: SpiritFamilyOverviewStoryCell;
        awakening: SpiritFamilyOverviewStoryCell;
        future: SpiritFamilyOverviewStoryCell;
    };
}

export function buildSpiritFamilyOverviewDisplayModel(
    payload?: SpiritFamilyOverviewOpenPayload,
): SpiritFamilyOverviewDisplayModel {
    if (payload?.origin === 'general-detail') {
        const generalName = payload.generalName?.trim() || '該武將';
        const branchLabel = payload.branchUid?.trim()
            ? `分支：${payload.branchUid.trim()}`
            : '分支：已形成';

        return {
            texts: {
                StateBadgeLabel: '武將捷徑',
                HeaderTitle: `${generalName} 的世家分支`,
                HeaderSubtitle: '只有已形成世家分支的武將才會顯示這個入口，並直接導向該分支視角。',
                PhaseLabel: branchLabel,
                RarityLabel: '來源：命頁',
                MirrorLabel: '視角：單一分支',
                CrestLabel: '用途：陳列 / 主卡切換',
                TipTitle: '入口說明',
                TipBody: '先看這個分支的英靈卡群，再決定主卡、副卡與要回看的英靈詳情。',
                ProgressLabel: '返回後仍可從大廳進入世家總覽',
                PrimaryActionLabel: '返回命頁',
                PublicMarker: '現役武將',
                SpiritMarker: '該家英靈',
            },
            storyCells: {
                origin: {
                    title: '入口來源',
                    body: '這裡不是全域總覽，而是從人物命頁直接切進來的分支捷徑。',
                },
                bloodline: {
                    title: '分支定位',
                    body: '命頁只在該武將已形成世家分支時顯示入口，避免沒有家族時出現空按鈕。',
                },
                trial: {
                    title: '管理內容',
                    body: '進入後可檢視同家族英靈卡群、主卡狀態、鎖定資訊與陳列內容。',
                },
                awakening: {
                    title: '主卡切換',
                    body: '主卡 / 副卡只在同家族多卡情境成立時出現，不預設套給所有武將。',
                },
                future: {
                    title: '後續路由',
                    body: '若要比較各家狀態，請回到大廳的世家總覽，從君主層重新挑選分支。',
                },
            },
        };
    }

    return {
        texts: {
            StateBadgeLabel: '君主總覽',
            HeaderTitle: '世家總覽',
            HeaderSubtitle: '統覽麾下所有世家、主卡狀態與家族深度，再挑選要深入的分支。',
            PhaseLabel: '入口：大廳',
            RarityLabel: '視角：君主層',
            MirrorLabel: '分組：依世家',
            CrestLabel: '操作：選分支',
            TipTitle: '入口說明',
            TipBody: '先看全域總覽，再進各家的英靈陳列室；不必先找單一武將。',
            ProgressLabel: '武將命頁只在已形成分支時提供捷徑',
            PrimaryActionLabel: '返回大廳',
            PublicMarker: '麾下群臣',
            SpiritMarker: '祖靈世家',
        },
        storyCells: {
            origin: {
                title: '君主層',
                body: '玩家扮演的是君主，所以正式入口放在大廳，而不是綁死在單一武將頁。',
            },
            bloodline: {
                title: '分組方式',
                body: '總覽先依世家分支分組，讓你先看哪一家有主卡、名聲與可管理卡群。',
            },
            trial: {
                title: '入口節流',
                body: '未形成世家分支的武將不顯示捷徑，避免玩家誤以為每個人都有世家系統。',
            },
            awakening: {
                title: '分工關係',
                body: '大廳負責總覽，人物命頁負責捷徑，真正的多卡管理則留給英靈陳列室。',
            },
            future: {
                title: '下一步',
                body: '從這裡選中分支後，再進家族層頁面處理主卡、副卡與英靈詳情。',
            },
        },
    };
}
