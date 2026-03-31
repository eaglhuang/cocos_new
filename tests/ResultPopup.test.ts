/**
 * ResultPopup.test.ts — 遷移架構後的單元測試
 *
 * 測試重點：
 *   1. 三層 JSON 規格能被正確載入（透過 mock）
 *   2. showResult 能依據 BattleResult 更新標題、描述
 *   3. 按鈕點擊發出正確的事件
 *
 * 使用 cc.mock 隔離 Cocos 引擎 API
 */

import '../../assets/scripts/tools/tests/cc.mock';
import { ResultPopup, BattleResult } from '../../assets/scripts/ui/components/ResultPopup';

// ── Mock UISpecLoader ────────────────────────────────────────────
jest.mock('../../assets/scripts/ui/core/UISpecLoader', () => ({
    UISpecLoader: jest.fn().mockImplementation(() => ({
        loadFullScreen: jest.fn().mockResolvedValue({
            screen: { id: 'result-popup-screen', uiId: 'ResultPopup' },
            layout: {
                id: 'result-popup-main',
                canvas: { fitWidth: true, fitHeight: true, designWidth: 1920, designHeight: 1024 },
                root: {
                    type: 'container',
                    name: 'ResultPopupRoot',
                    children: [
                        {
                            type: 'panel',
                            name: 'Card',
                            children: [
                                { type: 'label', name: 'TitleLabel', textKey: 'ui.result.victory' },
                                { type: 'label', name: 'DescLabel', textKey: 'ui.result.title' },
                            ],
                        },
                    ],
                },
            },
            skin: {
                id: 'result-popup-default',
                bundle: 'ui_common',
                atlasPolicy: 'common_popup',
                slots: {},
            },
        }),
        loadI18n: jest.fn().mockResolvedValue({
            'ui.result.victory': '勝利',
            'ui.result.defeat': '落敗',
            'ui.result.draw': '平局',
            'ui.result.title': '戰鬥結算',
        }),
    })),
}));

// ── Mock UIPreviewBuilder.buildScreen ────────────────────────────
jest.mock('../../assets/scripts/ui/core/UIPreviewBuilder', () => {
    const { Node } = require('cc');
    return {
        UIPreviewBuilder: class {
            node = new Node('ResultPopupRoot');
            skinResolver = { getSpriteFrame: jest.fn().mockResolvedValue(null) };
            i18nStrings: Record<string, string> = {};

            async buildScreen(_layout: any, _skin: any, i18n: Record<string, string>) {
                this.i18nStrings = i18n ?? {};

                // 建立 Card > TitleLabel / DescLabel 節點
                const { Node, Label } = require('cc');
                const card = new Node('Card');
                card.parent = this.node;

                const titleNode = new Node('TitleLabel');
                const titleLabel = titleNode.addComponent(Label);
                titleLabel.string = '';
                titleNode.parent = card;

                const descNode = new Node('DescLabel');
                const descLabel = descNode.addComponent(Label);
                descLabel.string = '';
                descNode.parent = card;

                return this.node;
            }

            t(key: string): string {
                return this.i18nStrings[key] ?? key;
            }

            playEnterTransition(_node: any): void {}
            playExitTransition(_node: any, _transition: any, cb?: () => void): void {
                cb?.();
            }
            onBuildComplete(_root: any): void {}
        },
    };
});

// ── 測試 ─────────────────────────────────────────────────────────
describe('ResultPopup', () => {

    let popup: ResultPopup;

    beforeEach(() => {
        popup = new ResultPopup();
    });

    it('應正確建立 ResultPopup 實例', () => {
        expect(popup).toBeDefined();
        expect(popup.node).toBeDefined();
    });

    it('showResult(player-win) 應顯示勝利標題', async () => {
        await popup['_initialize']();

        await popup.showResult('player-win');

        const titleLabel = popup.node
            .getChildByName('Card')
            ?.getChildByName('TitleLabel')
            ?.getComponent(require('cc').Label);

        expect(titleLabel?.string).toBe('勝利');
    });

    it('showResult(enemy-win) 應顯示落敗標題', async () => {
        await popup['_initialize']();
        await popup.showResult('enemy-win');

        const titleLabel = popup.node
            .getChildByName('Card')
            ?.getChildByName('TitleLabel')
            ?.getComponent(require('cc').Label);

        expect(titleLabel?.string).toBe('落敗');
    });

    it('showResult(draw) 應顯示平局標題', async () => {
        await popup['_initialize']();
        await popup.showResult('draw');

        const titleLabel = popup.node
            .getChildByName('Card')
            ?.getChildByName('TitleLabel')
            ?.getComponent(require('cc').Label);

        expect(titleLabel?.string).toBe('平局');
    });

    it('onClickReplay 應發出 replay 事件', async () => {
        await popup['_initialize']();

        const replayFn = jest.fn();
        popup.node.on('replay', replayFn);

        popup['onClickReplay']();

        expect(replayFn).toHaveBeenCalled();
    });

    it('onClickBack 應發出 back 事件', async () => {
        await popup['_initialize']();

        const backFn = jest.fn();
        popup.node.on('back', backFn);

        popup['onClickBack']();

        expect(backFn).toHaveBeenCalled();
    });

    it('resetState 應清除標題與描述', async () => {
        await popup['_initialize']();
        await popup.showResult('player-win');

        popup.resetState();

        const titleLabel = popup.node
            .getChildByName('Card')
            ?.getChildByName('TitleLabel')
            ?.getComponent(require('cc').Label);

        expect(titleLabel?.string).toBe('');
    });

    it('BattleResult 型別應包含三種狀態', () => {
        const validResults: BattleResult[] = ['player-win', 'enemy-win', 'draw'];
        expect(validResults).toHaveLength(3);
    });
});
