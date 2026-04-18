/**
 * i18nIntegration.test.ts — M7 i18n 整合邏輯測試
 *
 * 測試目標（純邏輯，不依賴 Cocos runtime）：
 *  1. MockI18nSystem.t() 正常查詢
 *  2. ChildPanelBase._t() 無 i18n 時回傳 key（graceful fallback）
 *  3. ChildPanelBase._t() 注入 i18n 後回傳翻譯字串
 *  4. onLocaleChanged 訂閱 / 取消訂閱
 *  5. _refreshLabels() 在 locale 切換時被呼叫
 *  6. localeOverride 欄位可賦值
 *
 * 注意：ChildPanelBase 繼承 cc.Component（間接），無法在 Node.js 中實例化。
 * 本套件採用「Mock 實作 + 型別合約」策略，直接測試相同邏輯的 mock 版本。
 *
 * Unity 對照：LocalizationSettings 的 locale-switch callback 測試
 */

import { TestSuite, assert } from '../TestRunner';
import type { LocaleCode } from '../../assets/scripts/core/systems/I18nSystem';

// ─────────────────────────────────────────────────────────────────────────────
//  MockI18nSystem — 不依賴 cc.resources 的純邏輯 i18n 系統
// ─────────────────────────────────────────────────────────────────────────────

class MockI18nSystem {
    private _locale: LocaleCode = 'zh-TW';
    private _strings: Record<string, Record<string, string>> = {
        'zh-TW': {
            'ui.general.basics.uid':   'UID：',
            'ui.general.stats.str':    '武力 STR：',
            'ui.general.aptitude.troop': '兵種適性：',
            'greeting':                '你好',
        },
        'en': {
            'ui.general.basics.uid':   'UID: ',
            'ui.general.stats.str':    'STR: ',
            'ui.general.aptitude.troop': 'Troop Aptitude: ',
            'greeting':                'Hello',
        },
    };
    private _handlers: Array<(locale: LocaleCode) => void> = [];

    get locale(): LocaleCode { return this._locale; }

    setLocale(locale: LocaleCode): void {
        this._locale = locale;
        this._handlers.forEach(h => h(locale));
    }

    t(key: string, ...args: string[]): string {
        let str = this._strings[this._locale]?.[key] ?? key;
        args.forEach((arg, i) => { str = str.replace(`{${i}}`, arg); });
        return str;
    }

    onLocaleChanged(handler: (locale: LocaleCode) => void): () => void {
        this._handlers.push(handler);
        return () => {
            const idx = this._handlers.indexOf(handler);
            if (idx >= 0) this._handlers.splice(idx, 1);
        };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  MockChildPanel — 模擬 ChildPanelBase 的 t() 邏輯（與 ChildPanelBase 對齊）
// ─────────────────────────────────────────────────────────────────────────────

class MockChildPanel {
    localeOverride?: LocaleCode;
    private _i18nSystem: MockI18nSystem | null = null;
    private _refreshCount = 0;
    lastRefreshLocale: LocaleCode | null = null;

    setI18n(i18n: MockI18nSystem): void {
        this._i18nSystem = i18n;
    }

    /** 與 ChildPanelBase.t() 相同邏輯 */
    t(key: string, ...args: string[]): string {
        if (!this._i18nSystem) return key;
        return this._i18nSystem.t(key, ...args);
    }

    /** 與 ChildPanelBase._refreshLabels() 相同合約 */
    _refreshLabels(): void {
        this._refreshCount++;
        this.lastRefreshLocale = this._i18nSystem?.locale ?? null;
    }

    get refreshCount(): number { return this._refreshCount; }
}

// ─────────────────────────────────────────────────────────────────────────────
//  MockCompositePanel — 模擬 CompositePanel 的 locale 訂閱邏輯
// ─────────────────────────────────────────────────────────────────────────────

class MockCompositePanel {
    private _unsubLocale: (() => void) | null = null;
    private _panels: MockChildPanel[] = [];

    registerChildPanel(panel: MockChildPanel, i18n: MockI18nSystem): void {
        panel.setI18n(i18n);
        this._panels.push(panel);
    }

    mount(i18n: MockI18nSystem): void {
        this._unsubLocale?.();
        this._unsubLocale = i18n.onLocaleChanged(() => {
            for (const p of this._panels) {
                p._refreshLabels();
            }
        });
    }

    unmount(): void {
        this._unsubLocale?.();
        this._unsubLocale = null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
//  測試套件
// ─────────────────────────────────────────────────────────────────────────────

export function createI18nIntegrationSuite(): TestSuite {
    const suite = new TestSuite('UCUF-i18n-Integration');

    // ─── 1. MockI18nSystem 基礎查詢 ──────────────────────────────────────────

    suite.test('MockI18nSystem.t() 正確回傳 zh-TW 字串', () => {
        const i18n = new MockI18nSystem();
        assert.equals('UID：', i18n.t('ui.general.basics.uid'));
        assert.equals('武力 STR：', i18n.t('ui.general.stats.str'));
    });

    suite.test('MockI18nSystem.t() key 不存在時回傳 key', () => {
        const i18n = new MockI18nSystem();
        assert.equals('nonexistent.key', i18n.t('nonexistent.key'));
    });

    suite.test('MockI18nSystem.t() 支援 {0} 佔位符', () => {
        const i18n = new MockI18nSystem();
        // 模擬含佔位符的字串
        (i18n as any)._strings['zh-TW']['ui.damage'] = '受到 {0} 點傷害';
        assert.equals('受到 100 點傷害', i18n.t('ui.damage', '100'));
    });

    suite.test('MockI18nSystem locale 切換後 t() 回傳新語系字串', () => {
        const i18n = new MockI18nSystem();
        assert.equals('你好', i18n.t('greeting'));
        i18n.setLocale('en');
        assert.equals('Hello', i18n.t('greeting'));
    });

    // ─── 2. MockChildPanel.t() 無 i18n 時 fallback 回 key ───────────────────

    suite.test('MockChildPanel.t() 無 i18n 時回傳 key（graceful fallback）', () => {
        const panel = new MockChildPanel();
        assert.equals('ui.general.basics.uid', panel.t('ui.general.basics.uid'));
    });

    // ─── 3. MockChildPanel.t() 注入 i18n 後回傳翻譯字串 ────────────────────

    suite.test('MockChildPanel.t() 注入 i18n 後回傳正確字串', () => {
        const panel = new MockChildPanel();
        const i18n = new MockI18nSystem();
        panel.setI18n(i18n);
        assert.equals('UID：', panel.t('ui.general.basics.uid'));
        assert.equals('武力 STR：', panel.t('ui.general.stats.str'));
    });

    // ─── 4. onLocaleChanged 訂閱 / 取消訂閱 ─────────────────────────────────

    suite.test('onLocaleChanged 訂閱後切換 locale 時觸發 handler', () => {
        const i18n = new MockI18nSystem();
        let called = 0;
        let receivedLocale: LocaleCode | null = null;
        i18n.onLocaleChanged(loc => { called++; receivedLocale = loc; });

        i18n.setLocale('en');
        assert.equals(1, called);
        assert.isDefined(receivedLocale);
        assert.equals('en', receivedLocale!);
    });

    suite.test('onLocaleChanged 取消訂閱後不再觸發', () => {
        const i18n = new MockI18nSystem();
        let called = 0;
        const unsub = i18n.onLocaleChanged(() => called++);

        i18n.setLocale('en');
        assert.equals(1, called);

        unsub();
        i18n.setLocale('zh-TW');
        assert.equals(1, called, '取消訂閱後不應再被呼叫');
    });

    // ─── 5. _refreshLabels() 在 locale 切換時被呼叫 ─────────────────────────

    suite.test('locale 切換時所有 childPanel._refreshLabels() 被呼叫', () => {
        const i18n = new MockI18nSystem();
        const composite = new MockCompositePanel();
        const panelA = new MockChildPanel();
        const panelB = new MockChildPanel();

        composite.registerChildPanel(panelA, i18n);
        composite.registerChildPanel(panelB, i18n);
        composite.mount(i18n);

        assert.equals(0, panelA.refreshCount);
        i18n.setLocale('en');
        assert.equals(1, panelA.refreshCount);
        assert.equals(1, panelB.refreshCount);
    });

    suite.test('_refreshLabels() 的 locale 與切換後語系一致', () => {
        const i18n = new MockI18nSystem();
        const composite = new MockCompositePanel();
        const panel = new MockChildPanel();

        composite.registerChildPanel(panel, i18n);
        composite.mount(i18n);

        i18n.setLocale('en');
        assert.isDefined(panel.lastRefreshLocale);
        assert.equals('en', panel.lastRefreshLocale!);
    });

    suite.test('unmount() 後 locale 切換不再觸發 _refreshLabels()', () => {
        const i18n = new MockI18nSystem();
        const composite = new MockCompositePanel();
        const panel = new MockChildPanel();

        composite.registerChildPanel(panel, i18n);
        composite.mount(i18n);
        composite.unmount();

        i18n.setLocale('en');
        assert.equals(0, panel.refreshCount, 'unmount 後不應觸發');
    });

    // ─── 6. localeOverride 欄位合約 ─────────────────────────────────────────

    suite.test('MockChildPanel.localeOverride 可賦值 LocaleCode', () => {
        const panel = new MockChildPanel();
        assert.equals(undefined, panel.localeOverride);

        panel.localeOverride = 'en';
        assert.isDefined(panel.localeOverride);
        assert.equals('en', panel.localeOverride!);

        panel.localeOverride = undefined;
        assert.equals(undefined, panel.localeOverride);
    });

    return suite;
}
