// @spec-source → 見 docs/cross-reference-index.md

/**
 * UIPreviewTextCatalog
 * 集中管理 UIPreviewBuilder 的中文字串與 UI 文字
 * 
 * 目標：降低 UIPreviewBuilder.ts 的非 ASCII 字元密度
 * 使用原則：所有中文文字 / 註解 / 說明都透過此模組
 */

export class UIPreviewTextCatalog {
    // =====================================================
    // JSDoc 與方法說明
    // =====================================================
    
    static get buildScreenDocSummary(): string {
        return '敺??渡?銝惜閬撱箸??恍';
    }

    static get preloadFontsDocSummary(): string {
        return '?? skin 銝剜???label-style ?典????撘郊嚗?摮 _fontCache，Unity 撠嚗esources.Load<Font>() ?寥??';
    }

    static get onBuildCompleteDocSummary(): string {
        return '摮??亥?撖恍?嚗?暺邦撱箸?摰?敹怠?，?冽??璆剖??摩嚗??鞈?憛怠?????隞嗥?摰?';
    }

    static get setButtonVisualStateDocSummary(): string {
        return '????閬死???，Unity 撠嚗electable.spriteState + Toggle.isOn ????撖怠??';
    }

    static get resolveColorDocSummary(): string {
        return '閫?? Design Token 憿';
    }

    static get buildPanelDocSummary(): string {
        return '?Ｘ嚗? skin 憟?嚗 skin ??SolidBackground fallback';
    }

    static get buildLabelDocSummary(): string {
        return '??璅惜';
    }

    static get buildButtonDocSummary(): string {
        return '??';
    }

    static get attachShadowLayerDocSummary(): string {
        return '?舀??銵剁?shadow ?潘?';
    }

    static get attachNoiseLayerDocSummary(): string {
        return '?舀??銵剁?noise ?潘?';
    }

    static get buildScrollListDocSummary(): string {
        return '?舀??銵剁??舀????箇?蝯?嚗?';
    }

    static get buildImageDocSummary(): string {
        return '????';
    }

    static get applyLabelStyleDocSummary(): string {
        return '憟 LabelStyle ??Label 蝯辣';
    }

    static get tDocSummary(): string {
        return '?? i18n 蝧餉陌??';
    }

    static get populateListDocSummary(): string {
        return '?典?銵典捆?其葉憛怠?鞈??';
    }

    // =====================================================
    // 節點與結構相關文字
    // =====================================================

    static get nodeLabel(): string {
        return 'Label';
    }

    static get nodeBackground(): string {
        return 'Background';
    }

    static get nodeShadowSuffix(): string {
        return 'Shadow';
    }

    static get nodeNoiseSuffix(): string {
        return 'Noise';
    }

    static get nodeContent(): string {
        return 'Content';
    }

    static get nodeDetachedShadowLayer(): string {
        return '__DetachedShadowLayer';
    }

    // =====================================================
    // 業務邏輯註解與說明
    // =====================================================

    static get labelBuildCommentCondition(): string {
        return '???批捆嚗??摨?textKey > text > bind > node.name';
    }

    static get labelBindPlaceholder(): string {
        return '{';  // UI 中表示待綁定的佔位符
    }

    static get labelFallbackComment(): string {
        return '[UI-2-0023] fallback to empty string to avoid showing node name as UI text.\n            // Business logic (onBuildComplete) must explicitly bind this label.';
    }

    static get labelOverflowComment(): string {
        return '?身?脫滯??';
    }

    static get buttonLabelComment(): string {
        return '????嚗?蝭暺?';
    }

    static get buttonLabelBgComment(): string {
        return '?? 銝??skinSlot嚗????舐?歇憟?嗥?暺?\n            //    摮?Label 蝭暺???憟?skinSlot嚗??_applyBackgroundSkin\n            //    ?航?典歇??Sprite ??暺??? Label嚗? UIRenderer 銵?';
    }

    static get scrollListComment(): string {
        return 'ScrollView 蝯';
    }

    static get scrollContentComment(): string {
        return 'content 摰孵';
    }

    static get scrollContentLayoutComment(): string {
        return 'content Layout';
    }

    static get scrollContentAnchorComment(): string {
        return '??券?';
    }

    static get scrollItemTemplateComment(): string {
        return 'itemTemplate ?脣???node ?芾?鞈?銝哨?\n            // 靘?onBuildComplete 銝?populate 鞈??蝙??';
    }

    // =====================================================
    // shadowLayer 相關邏輯說明
    // =====================================================

    static get shadowLayerTypeCheck(): string {
        return '?桀? noise overlay ??sibling ??嚗???函蝡?fill panel嚗?\n        // ?踹???panel ?折??Layout/children ?Ｙ?撅斤?銵??';
    }

    static get shadowLayerTypeCheckAlt(): string {
        return '雿?嚗??遙雿?隞?';
    }

    static get shadowLayerLayoutCheck(): string {
        return '?桀? noise overlay ??sibling ??嚗???函蝡?fill panel嚗?\n        // ?踹???panel ?折??Layout/children ?Ｙ?撅斤?銵??';
    }

    // =====================================================
    // 雜項業務文字
    // =====================================================

    static get labelBgNodeComment(): string {
        return '?? Label (UIRenderer) 銝??Sprite / SolidBackground (銋 Sprite) ?勗??澆?銝蝭暺?\n            // ?芾???skinSlot嚗?敺??撱箏摮?暺?Background";';
    }

    static get fontCacheLookupComment(): string {
        return '憟摮?嚗歇??buildScreen ??嚗迨??甇亙?敹怠???嚗?';
    }

    static get layoutHorizontal(): string {
        return 'horizontal';
    }

    static get layoutVertical(): string {
        return 'vertical';
    }

    static get layoutGrid(): string {
        return 'grid';
    }

    static get nodeTypeContainer(): string {
        return 'container';
    }

    static get nodeTypePanel(): string {
        return 'panel';
    }

    static get nodeTypeLabel(): string {
        return 'label';
    }

    static get nodeTypeButton(): string {
        return 'button';
    }

    static get nodeTypeScrollList(): string {
        return 'scroll-list';
    }

    static get nodeTypeImage(): string {
        return 'image';
    }

    static get nodeTypeResourceCounter(): string {
        return 'resource-counter';
    }

    static get nodeTypeSpacer(): string {
        return 'spacer';
    }

    static get resourceCounterComment(): string {
        return '蝪∪?撖虫?嚗???Label';
    }

    static get nodeLayerComment(): string {
        return '???萎耨敺押匱?輻撅斤? UI_2D layer嚗??2D ?蔣璈?皜脫?';
    }

    static get noiseBlendModeAlpha(): string {
        return 'alpha';
    }

    static get slotKindLabelStyle(): string {
        return 'label-style';
    }

    static get slotKindColorRect(): string {
        return 'color-rect';
    }

    static get slotKindSpriteFrame(): string {
        return 'sprite-frame';
    }

    static get slotKindButtonSkin(): string {
        return 'button-skin';
    }

    static get slotKindColor(): string {
        return 'color';
    }

    static get spriteTypeSimple(): string {
        return 'simple';
    }

    static get spriteTypeSliced(): string {
        return 'sliced';
    }

    static get spriteTypeTiled(): string {
        return 'tiled';
    }

    static get buttonVisualStateNormal(): string {
        return 'normal';
    }

    static get buttonVisualStatePressed(): string {
        return 'pressed';
    }

    static get buttonVisualStateHover(): string {
        return 'hover';
    }

    static get buttonVisualStateDisabled(): string {
        return 'disabled';
    }

    static get buttonVisualStateSelected(): string {
        return 'selected';
    }
}
