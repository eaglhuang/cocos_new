// @spec-source → 見 docs/cross-reference-index.md
import { Font, JsonAsset, resources } from "cc";

/**
 * 語系代碼 — 可隨時擴充；對應 resources/i18n/{locale}.json 的檔名
 */
export type LocaleCode = 'zh-TW' | 'zh-CN' | 'en' | 'ja';

/**
 * 字型角色 — 僅管理「語系相關 UI 字型」
 * VFX 飄字用 BMFont 不在此管理（由 FloatTextSystem.registerFont 負責）
 */
export type FontRole = 'body' | 'title';

interface LocaleAssets {
    strings: Record<string, string>;
    fonts: Partial<Record<FontRole, Font>>;
}

/**
 * 多國語系管理系統
 *
 * 責任範圍：
 *   - 語系切換（setLocale）
 *   - 字串查詢（t(key)，支援 {0}{1} 佔位符）
 *   - 語系字型懶載入 / 卸載（Font.addRef / decRef，防記憶體洩漏）
 *   - 語系切換事件通知（onLocaleChanged）
 *
 * 不負責：
 *   - VFX 用 BMFont（由 FloatTextSystem 管理）
 *   - 複雜 ICU 格式（複數、日期格式化）
 *   - 翻譯服務的後端通訊
 *
 * Unity 對照：
 *   - setLocale     ≈ LocalizationSettings.SelectedLocaleChanged
 *   - t(key)        ≈ LocalizedString.GetLocalizedString()
 *   - getFont(role) ≈ LocalizationSettings.GetAssetTable().GetEntry<Font>()
 *   - unloadFonts   ≈ Resources.UnloadAsset（Addressables.Release）
 *
 * 資源目錄規範（見 resources/fonts/_GOVERNANCE.md）：
 *   字串：resources/i18n/{locale}.json
 *   字型：resources/fonts/locale/{locale}/{role}.ttf
 */
export class I18nSystem {
    private currentLocale: LocaleCode = 'zh-TW';
    private cache = new Map<LocaleCode, LocaleAssets>();
    private changeHandlers: Array<(locale: LocaleCode) => void> = [];

    get locale(): LocaleCode { return this.currentLocale; }

    // ─────────────────────────────────────────
    //  公開 API
    // ─────────────────────────────────────────

    /**
     * 切換語系並懶載入對應字串與字型。
     * 自動卸載前一語系的字型以釋放記憶體（字串快取保留，重新切換時無需重載）。
     *
     * Unity 對照：Addressables LoadAssetAsync + 卸載前一個 AssetBundle
     */
    async setLocale(locale: LocaleCode): Promise<void> {
        if (locale === this.currentLocale && this.cache.has(locale)) return;

        const prev = this.currentLocale;
        this.currentLocale = locale;

        if (!this.cache.has(locale)) {
            const assets = await this.loadLocaleAssets(locale);
            this.cache.set(locale, assets);
        }

        // 卸載前一語系字型（字串較小保留，字型佔記憶體較多）
        if (prev !== locale) {
            this.unloadFonts(prev);
        }

        this.changeHandlers.forEach(h => h(locale));
    }

    /**
     * 翻譯字串，支援 {0}{1} 佔位符。
     * 若 key 不存在，回傳 key 本身（便於除錯，不會白畫面）。
     *
     * 範例：
     *   t("ui.result.victory")           → "勝利"
     *   t("ui.damage.receive", "100")    → "受到 100 點傷害"
     */
    t(key: string, ...args: string[]): string {
        const assets = this.cache.get(this.currentLocale);
        let str = assets?.strings[key] ?? key;
        args.forEach((arg, i) => {
            str = str.replace(`{${i}}`, arg);
        });
        return str;
    }

    /**
     * 取得目前語系的指定字型角色。
     * 若字型尚未載入或語系字型不存在，回傳 null（使用 Cocos 系統預設字型）。
     *
     * 典型用法：
     *   label.font = services().i18n.getFont('body') ?? label.font;
     */
    getFont(role: FontRole): Font | null {
        return this.cache.get(this.currentLocale)?.fonts[role] ?? null;
    }

    /**
     * 訂閱語系切換事件，回傳取消訂閱函數。
     * 請在 Component.onDestroy() 中呼叫取消訂閱，避免 Component 銷毀後仍被呼叫。
     *
     * 範例：
     *   private _unsubI18n?: () => void;
     *   onEnable()  { this._unsubI18n = services().i18n.onLocaleChanged(loc => this.refresh()); }
     *   onDestroy() { this._unsubI18n?.(); }
     */
    onLocaleChanged(handler: (locale: LocaleCode) => void): () => void {
        this.changeHandlers.push(handler);
        return () => {
            const idx = this.changeHandlers.indexOf(handler);
            if (idx >= 0) this.changeHandlers.splice(idx, 1);
        };
    }

    // ─────────────────────────────────────────
    //  私有方法
    // ─────────────────────────────────────────

    private async loadLocaleAssets(locale: LocaleCode): Promise<LocaleAssets> {
        const assets: LocaleAssets = { strings: {}, fonts: {} };

        // 字串資源（必要，找不到時回退為空字典）
        try {
            assets.strings = await this.loadJson<Record<string, string>>(`i18n/${locale}`);
        } catch {
            console.warn(`[I18nSystem] 找不到語系字串 resources/i18n/${locale}.json，t(key) 將直接回傳 key`);
        }

        // 語系字型（選配，找不到時靜默略過，使用系統字型）
        const fontRoles: FontRole[] = ['body', 'title'];
        await Promise.all(fontRoles.map(async (role) => {
            try {
                const font = await this.loadFont(`fonts/locale/${locale}/${role}`);
                font.addRef();  // 防止 Cocos Asset 自動 GC
                assets.fonts[role] = font;
            } catch {
                // 字型不存在時靜默略過（使用系統字型），不報錯
            }
        }));

        return assets;
    }

    private unloadFonts(locale: LocaleCode): void {
        const assets = this.cache.get(locale);
        if (!assets) return;
        // ES2015 相容：改用 Object.keys 遍歷（Object.values 需要 ES2017+）
        const roles: FontRole[] = ['body', 'title'];
        roles.forEach(role => assets.fonts[role]?.decRef());
        assets.fonts = {};
    }

    private loadJson<T>(path: string): Promise<T> {
        return new Promise((resolve, reject) => {
            resources.load(path, JsonAsset, (err, asset) => {
                if (err || !asset) { reject(err); return; }
                resolve(asset.json as T);
            });
        });
    }

    private loadFont(path: string): Promise<Font> {
        return new Promise((resolve, reject) => {
            resources.load(path, Font, (err, font) => {
                if (err || !font) { reject(err); return; }
                resolve(font);
            });
        });
    }
}
