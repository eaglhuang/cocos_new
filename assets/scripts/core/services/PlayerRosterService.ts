import { sys } from 'cc';
import type { GeneralConfig } from '../models/GeneralUnit';
import { UCUFLogger, LogCategory } from '../../ui/core/UCUFLogger';

const STORAGE_KEY = 'ucuf.player-roster';

let cachedRoster: GeneralConfig[] | null = null;

function cloneGeneral(general: GeneralConfig): GeneralConfig {
    try {
        return JSON.parse(JSON.stringify(general)) as GeneralConfig;
    } catch {
        return { ...general };
    }
}

function ensureLoaded(): void {
    if (cachedRoster !== null) {
        return;
    }

    const stored = sys.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
        cachedRoster = [];
        return;
    }

    try {
        const parsed = JSON.parse(stored) as unknown;
        cachedRoster = Array.isArray(parsed)
            ? parsed
                .filter((item) => item && typeof item === 'object')
                .map((item) => ({ ...(item as GeneralConfig) }))
            : [];
    } catch (error) {
        cachedRoster = [];
        UCUFLogger.warn(LogCategory.DATA, '[PlayerRosterService] 名冊解析失敗，已重置為空。', error);
    }
}

function persist(): void {
    if (cachedRoster === null) {
        return;
    }

    try {
        sys.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedRoster));
    } catch (error) {
        UCUFLogger.warn(LogCategory.DATA, '[PlayerRosterService] 名冊寫入失敗。', error);
    }
}

export class PlayerRosterService {
    public static getAll(): GeneralConfig[] {
        ensureLoaded();
        return (cachedRoster ?? []).map(cloneGeneral);
    }

    public static getCount(): number {
        ensureLoaded();
        return cachedRoster?.length ?? 0;
    }

    public static addGenerals(generals: GeneralConfig[]): void {
        ensureLoaded();
        if (!Array.isArray(generals) || generals.length === 0) {
            return;
        }

        cachedRoster?.push(...generals.map(cloneGeneral));
        persist();
    }

    public static replaceAll(generals: GeneralConfig[]): void {
        cachedRoster = Array.isArray(generals) ? generals.map(cloneGeneral) : [];
        persist();
    }

    public static clear(): void {
        cachedRoster = [];
        persist();
    }
}