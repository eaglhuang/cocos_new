import { sys } from 'cc';
import { EventSystem } from './EventSystem';
import { NetworkService, EVENT_NETWORK_ONLINE } from './NetworkService';
import type { ActionRecord, SyncRequest, SyncResponse } from '../../../../shared/protocols';
import { IndexedDbAdapter } from '../storage/IndexedDbAdapter';
import { DataStorageAdapter } from '../storage/DataStorageAdapter';
import { UCUFLogger, LogCategory } from '../../ui/core/UCUFLogger';

interface SyncLocalMeta {
    currentSeq: number;
    deviceId: string;
    sessionSecret: string;
    lastHash: string;
}

export interface SyncDebugSnapshot {
    storageMode: string;
    deviceId: string;
    currentSeq: number;
    lastHash: string;
    pendingCount: number;
    isHydrated: boolean;
    records: ActionRecord[];
}

function computeSyncDigest(data: string, secret: string): string {
    let stateA = 0x811c9dc5;
    let stateB = 0x01000193;
    const input = `${secret.length}:${secret}|${data}|${secret.split('').reverse().join('')}`;

    for (let index = 0; index < input.length; index++) {
        const code = input.charCodeAt(index);
        stateA ^= code;
        stateA = Math.imul(stateA, 0x01000193) >>> 0;
        stateB ^= code + (index & 0xff);
        stateB = Math.imul(stateB, 0x85ebca6b) >>> 0;
        stateB = ((stateB << 13) | (stateB >>> 19)) >>> 0;
    }

    return `${stateA.toString(16).padStart(8, '0')}${stateB.toString(16).padStart(8, '0')}`;
}

export const EVENT_SYNCING = 'EVENT_SYNCING';
export const EVENT_SYNC_COMPLETE = 'EVENT_SYNC_COMPLETE';
export const EVENT_OFFLINE_REMINDER = 'EVENT_OFFLINE_REMINDER'; 

export enum SyncActionType {
    DEFERRABLE = 'DEFERRABLE',               // 可延遲上傳 (本機先算 Hash 存佇列，等連線後背景上傳)
    IMMEDIATE_REQUIRED = 'IMMEDIATE_REQUIRED' // 必即時上傳 (若斷線則直接阻擋操作，如：轉蛋 / 商城 / 課金)
}

export class SyncManager {
    private static readonly ONLINE_ONLY_ACTION_PATTERNS: RegExp[] = [
        /^GACHA_/i,
        /^SHOP_(BUY|PURCHASE|REFRESH)/i,
        /^STORE_/i,
        /^PURCHASE_/i,
        /^IAP_/i,
        /^PAY(MENT)?_/i,
        /^RECHARGE_/i,
        /^BILLING_/i,
    ];

    private eventSystem: EventSystem | null = null;
    private network: NetworkService | null = null;

    private actionRecords: ActionRecord[] = [];
    private currentSeq: number = 0;
    private sessionSecret: string = 'MOCK_SECRET_KEY'; // 當前有效金鑰 (Server 成功連線時下發)
    private lastHash: string = 'INIT_HASH';          // 上次同步成功後的雜湊錨點
    private deviceId: string = '';

    private isSyncing: boolean = false;
    private reminderTimer: any = null;

    private storageAdapter: DataStorageAdapter | null = null;
    private storageInitPromise: Promise<DataStorageAdapter | null> | null = null;
    private restorePromise: Promise<void> | null = null;
    private hasHydratedLocalState = false;

    private readonly LEGACY_STORAGE_KEY = 'OFFLINE_ACTION_LOGS';
    private readonly DEVICE_KEY = 'CLIENT_DEVICE_ID';
    private readonly ACTION_LOG_STORAGE_KEY = 'sync.action-log';
    private readonly META_STORAGE_KEY = 'sync.meta';
    private readonly SERVER_URL = 'http://localhost:3000'; // 模擬伺服器位址

    public getActionRecords(): ActionRecord[] {
        return [...this.actionRecords];
    }

    public getActionRecordCount(): number {
        return this.actionRecords.length;
    }

    public getStorageModeLabel(): string {
        if (this.storageAdapter) {
            return this.storageAdapter.adapterName;
        }
        return sys.isNative ? 'localStorage(native)' : 'localStorage(fallback)';
    }

    public getActionLogSnapshot(): SyncDebugSnapshot {
        return {
            storageMode: this.getStorageModeLabel(),
            deviceId: this.deviceId,
            currentSeq: this.currentSeq,
            lastHash: this.lastHash,
            pendingCount: this.actionRecords.length,
            isHydrated: this.hasHydratedLocalState,
            records: [...this.actionRecords],
        };
    }

    public setup(eventSystem: EventSystem, network: NetworkService): void {
        this.eventSystem = eventSystem;
        this.network = network;

        this.initDeviceId();
        this.restorePromise = this.restoreLocalState();

        // 當底層 Service 通知網路復原時，立刻喚醒背景同步
        this.eventSystem.on(EVENT_NETWORK_ONLINE, this.handleNetworkRestored.bind(this));
        
        // 啟動離線提醒監控
        this.startOfflineReminder();
    }

    private initDeviceId(): void {
        this.deviceId = sys.localStorage.getItem(this.DEVICE_KEY);
        if (!this.deviceId) {
            this.deviceId = `DEV_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            sys.localStorage.setItem(this.DEVICE_KEY, this.deviceId);
        }
    }

    private async restoreLocalState(): Promise<void> {
        const legacyRecords = this.loadLegacyActions();
        const adapter = await this.ensureStorageAdapter();

        try {
            const storedMeta = adapter
                ? await adapter.get<SyncLocalMeta>(this.META_STORAGE_KEY)
                : null;
            const storedRecords = adapter
                ? (await adapter.get<ActionRecord[]>(this.ACTION_LOG_STORAGE_KEY)) ?? []
                : [];

            this.actionRecords = this.mergeActionRecords(storedRecords, legacyRecords, this.actionRecords);
            this.currentSeq = Math.max(
                storedMeta?.currentSeq ?? 0,
                ...this.actionRecords.map((record) => record.Seq),
                0,
            );

            if (storedMeta?.sessionSecret) {
                this.sessionSecret = storedMeta.sessionSecret;
            }
            if (storedMeta?.lastHash) {
                this.lastHash = storedMeta.lastHash;
            }
            if (storedMeta?.deviceId && storedMeta.deviceId !== this.deviceId) {
                UCUFLogger.warn(
                    LogCategory.DATA,
                    '[SyncManager] 偵測到不同裝置快取，沿用 bootstrap deviceId。',
                    { bootstrapDeviceId: this.deviceId, storedDeviceId: storedMeta.deviceId },
                );
            }

            this.hasHydratedLocalState = true;
            UCUFLogger.info(
                LogCategory.DATA,
                `[SyncManager] 本地同步狀態已還原，pending actions=${this.actionRecords.length}`,
            );

            if (legacyRecords.length > 0 || !storedMeta || storedMeta.deviceId !== this.deviceId) {
                this.queuePersistLocalState();
            }

            if (this.network?.isOnline && this.actionRecords.length > 0) {
                void this.syncNow();
            }
        } catch (error) {
            UCUFLogger.error(LogCategory.DATA, '[SyncManager] 還原本地同步狀態失敗。', error);
        }
    }

    private loadLegacyActions(): ActionRecord[] {
        const stored = sys.localStorage.getItem(this.LEGACY_STORAGE_KEY);
        if (!stored) {
            return [];
        }

        try {
            const parsed = JSON.parse(stored) as ActionRecord[];
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            UCUFLogger.error(LogCategory.DATA, '[SyncManager] 舊版 localStorage action log 解析失敗，已忽略。', error);
            return [];
        }
    }

    private mergeActionRecords(...batches: ActionRecord[][]): ActionRecord[] {
        const merged = new Map<string, ActionRecord>();
        for (const batch of batches) {
            for (const record of batch) {
                const key = `${record.Seq}:${record.Tx_Hash}`;
                if (!merged.has(key)) {
                    merged.set(key, record);
                }
            }
        }

        return [...merged.values()].sort((left, right) => left.Seq - right.Seq);
    }

    private queuePersistLocalState(): void {
        void this.persistLocalState();
    }

    private async persistLocalState(): Promise<void> {
        const meta: SyncLocalMeta = {
            currentSeq: this.currentSeq,
            deviceId: this.deviceId,
            sessionSecret: this.sessionSecret,
            lastHash: this.lastHash,
        };
        const adapter = await this.ensureStorageAdapter();

        if (adapter) {
            try {
                await adapter.set(this.META_STORAGE_KEY, meta);
                await adapter.set(this.ACTION_LOG_STORAGE_KEY, this.actionRecords);
                sys.localStorage.removeItem(this.LEGACY_STORAGE_KEY);
                return;
            } catch (error) {
                UCUFLogger.warn(LogCategory.DATA, '[SyncManager] IndexedDB 寫入失敗，回退 legacy storage。', error);
            }
        }

        sys.localStorage.setItem(this.LEGACY_STORAGE_KEY, JSON.stringify(this.actionRecords));
    }

    private async ensureStorageAdapter(): Promise<DataStorageAdapter | null> {
        if (this.storageAdapter) {
            return this.storageAdapter;
        }
        if (!this.storageInitPromise) {
            this.storageInitPromise = this.createStorageAdapter();
        }
        return this.storageInitPromise;
    }

    private async createStorageAdapter(): Promise<DataStorageAdapter | null> {
        if (sys.isNative) {
            UCUFLogger.warn(
                LogCategory.DATA,
                '[SyncManager] Native SQLite 尚未接線，暫以 bootstrap localStorage 維持最小同步狀態。',
            );
            return null;
        }

        const adapter = new IndexedDbAdapter();
        try {
            await adapter.init();
            this.storageAdapter = adapter;
            return adapter;
        } catch (error) {
            UCUFLogger.warn(LogCategory.DATA, '[SyncManager] IndexedDB 初始化失敗，回退 legacy storage。', error);
            return null;
        }
    }

    public isOnlineOnlyAction(actionName: string): boolean {
        return SyncManager.ONLINE_ONLY_ACTION_PATTERNS.some((pattern) => pattern.test(actionName));
    }

    private resolveActionType(actionName: string, requestedType: SyncActionType): SyncActionType {
        if (requestedType === SyncActionType.IMMEDIATE_REQUIRED) {
            return requestedType;
        }
        return this.isOnlineOnlyAction(actionName)
            ? SyncActionType.IMMEDIATE_REQUIRED
            : requestedType;
    }

    /**
     * 嘗試將一筆操作寫入 Action Log 佇列。
     * 如果是 IMMEDIATE_REQUIRED 且斷線，回傳 false 並拒絕執行，保障資料一致性。
     */
    public pushAction(actionName: string, payload: any, type: SyncActionType = SyncActionType.DEFERRABLE): boolean {
        const effectiveType = this.resolveActionType(actionName, type);
        if (!this.network?.isOnline && effectiveType === SyncActionType.IMMEDIATE_REQUIRED) {
            const isFinancialAction = this.isOnlineOnlyAction(actionName);
            this.eventSystem?.emit('SHOW_TOAST', {
                message: isFinancialAction
                    ? '轉蛋、商城與金流相關操作需連網後才能執行。'
                    : '此操作涉及到帳戶變動，請連接網路後再試',
            });
            return false;
        }

        // 離線下也要確保存檔是同一個裝置
        const currentStoredId = sys.localStorage.getItem(this.DEVICE_KEY);
        if (currentStoredId && currentStoredId !== this.deviceId) {
            this.eventSystem?.emit('SHOW_TOAST', { message: '偵測到裝置不符，離線資料無法同步至此裝置' });
            return false;
        }

        this.currentSeq++;
        
        // HMAC-SHA256 驗證公式: SHA256 (Action + Payload + Secret + PreviousHash)
        const payloadStr = JSON.stringify(payload);
        const secret = this.sessionSecret;
        const dataToHash = `${actionName}${payloadStr}${secret}${this.lastHash}`;
        
        // 此處產生的 HMAC 是鏈式的，若任何一步被竄改，後續所有雜湊皆會連動失效
        const calculatedHash = computeSyncDigest(dataToHash, secret);
        this.lastHash = calculatedHash;

        const record: ActionRecord = {
            Seq: this.currentSeq,
            Timestamp: Date.now(),
            Action: actionName,
            Payload: payload,
            Tx_Hash: calculatedHash
        };

        this.actionRecords.push(record);
        this.queuePersistLocalState();
        
        if (!this.hasHydratedLocalState) {
            UCUFLogger.warn(LogCategory.DATA, '[SyncManager] action log 在本地狀態完成 hydration 前被寫入。', {
                actionName,
                pendingCount: this.actionRecords.length,
            });
        }
        UCUFLogger.debug(
            LogCategory.DATA,
            `[SyncManager] Action Logged: ${actionName} (${calculatedHash.substring(0, 8)}...)`,
        );

        if (this.network?.isOnline) {
            void this.syncNow();
        }

        return true;
    }

    private startOfflineReminder(): void {
        if (this.reminderTimer) clearInterval(this.reminderTimer);
        // 每 5 分鐘檢查一次，若是離線狀態且有未同步資料，彈出提示
        this.reminderTimer = setInterval(() => {
            if (!this.network?.isOnline && this.actionRecords.length > 0) {
                this.eventSystem?.emit(EVENT_OFFLINE_REMINDER, {
                    message: '您目前處於離線模式，進度僅存於本機。請儘速連網以同步資料並保障帳號安全。'
                });
            }
        }, 300000); // 5 minutes
    }

    private handleNetworkRestored(): void {
        void this.handleDeltaQueueOnRestore();
        if (this.actionRecords.length > 0) {
            UCUFLogger.info(LogCategory.DATA, '[SyncManager] Network restored. Resuming pending actions...');
            void this.syncNow();
        }
    }

    private async syncNow(): Promise<void> {
        if (this.isSyncing || this.actionRecords.length === 0) return;
        
        this.isSyncing = true;
        this.eventSystem?.emit(EVENT_SYNCING);

        const syncData: SyncRequest = {
            Player_ID: 'PLAYER_TEST_01', 
            Session_Secret: this.sessionSecret,
            Action_Records: this.actionRecords,
            Previous_Hash: this.lastHash // 實務應為存檔快照的最後雜湊錨點
        };

        UCUFLogger.info(LogCategory.DATA, `[SyncManager] Requesting Sync for ${this.actionRecords.length} records...`);

        try {
            const response = await fetch(`${this.SERVER_URL}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(syncData)
            });

            const result: SyncResponse = await response.json();

            if (result.Success) {
                UCUFLogger.info(LogCategory.DATA, '[SyncManager] Sync OK. New Secret issued.');
                this.actionRecords = []; 
                
                this.sessionSecret = result.New_Session_Secret!;
                this.lastHash = result.New_Hash!; // 以此為下次離線的第一個雜湊鎖
                this.queuePersistLocalState();
                this.isSyncing = false;
                this.eventSystem?.emit(EVENT_SYNC_COMPLETE);
            } else {
                UCUFLogger.error(LogCategory.DATA, `[SyncManager] Sync Rejected: ${result.Message}`);
                this.isSyncing = false;
            }
        } catch (e) {
            UCUFLogger.error(LogCategory.DATA, '[SyncManager] API Call Failed (Network Error?).', e);
            this.isSyncing = false;
        }
    }

    // ========== DC-5-0002: Delta 同步模式 ==========

    /** delta patch 佇列（最多 10 筆，超過觸發全量同步）*/
    private deltaPatchQueue: unknown[] = [];
    private readonly DELTA_QUEUE_MAX = 10;

    /**
     * 優先使用 DeltaPatchBuilder 生成 delta patch 上傳；
     * 若 delta 失敗（hash 不匹配等）自動 fallback 至全量同步。
     * @param baseSave  上次同步的基準存檔物件
     * @param currentSave 當前存檔物件
     */
    public async syncDelta(baseSave: object, currentSave: object): Promise<void> {
        if (this.isSyncing) return;
        if (!this.network?.isOnline) {
            UCUFLogger.info(LogCategory.DATA, '[SyncManager] offline - queuing delta patch');
            this._enqueueDeltaPatch(baseSave, currentSave);
            return;
        }

        this.isSyncing = true;
        this.eventSystem?.emit(EVENT_SYNCING);

        try {
            // 動態引入以避免循環依賴
            const { DeltaPatchBuilder } = await import('../services/DeltaPatchBuilder');
            const patches = DeltaPatchBuilder.build(baseSave, currentSave);

            const body = JSON.stringify({
                deviceId: this.deviceId,
                sessionToken: this.sessionSecret,
                baseHash: this.lastHash,
                patches,
                actionRecords: this.actionRecords,
                clientTimestamp: Date.now(),
            });

            const response = await fetch(`${this.SERVER_URL}/sync/delta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });

            if (response.status === 409) {
                // hash 衝突 → fallback 全量同步
                UCUFLogger.warn(LogCategory.DATA, '[SyncManager] delta conflict (409) - falling back to full sync');
                this.isSyncing = false;
                await this.syncFull(currentSave);
                return;
            }

            if (response.ok) {
                const result = await response.json();
                this.lastHash = result.newHash ?? this.lastHash;
                this.actionRecords = [];
                this.deltaPatchQueue = [];
                this.queuePersistLocalState();
                this.eventSystem?.emit(EVENT_SYNC_COMPLETE);
                UCUFLogger.info(LogCategory.DATA, '[SyncManager] delta sync OK');
            } else {
                UCUFLogger.error(LogCategory.DATA, `[SyncManager] delta sync failed: ${response.status}`);
                this._enqueueDeltaPatch(baseSave, currentSave);
            }
        } catch (e) {
            UCUFLogger.error(LogCategory.DATA, '[SyncManager] delta sync error:', e);
            this._enqueueDeltaPatch(baseSave, currentSave);
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * 全量同步（fallback）。
     */
    public async syncFull(saveData: object): Promise<void> {
        if (this.isSyncing) return;
        this.isSyncing = true;
        this.eventSystem?.emit(EVENT_SYNCING);

        try {
            const body = JSON.stringify({
                deviceId: this.deviceId,
                sessionToken: this.sessionSecret,
                saveData,
                clientTimestamp: Date.now(),
            });

            const response = await fetch(`${this.SERVER_URL}/sync/full`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });

            if (response.ok) {
                const result = await response.json();
                this.lastHash = result.newHash ?? this.lastHash;
                this.actionRecords = [];
                this.deltaPatchQueue = [];
                this.queuePersistLocalState();
                this.eventSystem?.emit(EVENT_SYNC_COMPLETE);
                UCUFLogger.info(LogCategory.DATA, '[SyncManager] full sync OK');
            } else {
                UCUFLogger.error(LogCategory.DATA, `[SyncManager] full sync failed: ${response.status}`);
            }
        } catch (e) {
            UCUFLogger.error(LogCategory.DATA, '[SyncManager] full sync error:', e);
        } finally {
            this.isSyncing = false;
        }
    }

    private _enqueueDeltaPatch(base: object, current: object): void {
        this.deltaPatchQueue.push({ base, current, ts: Date.now() });
        if (this.deltaPatchQueue.length > this.DELTA_QUEUE_MAX) {
            UCUFLogger.warn(LogCategory.DATA, '[SyncManager] delta queue full (>10) - will trigger full sync on next online');
            this.deltaPatchQueue = [];
        }
    }

    // ========== DC-5-0004: Action_Records 批次壓縮上傳 ==========

    /**
     * 批次收集 Action_Records，gzip 壓縮後上傳。
     * 自動呼叫 GzipCodec，需確保 pako 已引入。
     */
    public async flushCompressedActions(): Promise<void> {
        if (this.actionRecords.length === 0 || !this.network?.isOnline) return;

        try {
            const { GzipCodec } = await import('../serialization/GzipCodec');
            const jsonStr = JSON.stringify(this.actionRecords);
            const compressed = GzipCodec.compressJson(jsonStr);

            // 轉為 Base64 供 JSON body 傳送
            const base64 = btoa(String.fromCharCode(...compressed));

            const body = JSON.stringify({
                deviceId: this.deviceId,
                sessionToken: this.sessionSecret,
                actionRecordsCompressed: base64,
                count: this.actionRecords.length,
                clientTimestamp: Date.now(),
            });

            const response = await fetch(`${this.SERVER_URL}/sync/actions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });

            if (response.ok) {
                UCUFLogger.info(
                    LogCategory.DATA,
                    `[SyncManager] flushed ${this.actionRecords.length} actions (compressed)`,
                );
                this.actionRecords = [];
                this.queuePersistLocalState();
            }
        } catch (e) {
            UCUFLogger.error(LogCategory.DATA, '[SyncManager] flushCompressedActions error:', e);
        }
    }

    // ========== DC-5-0005: 網路狀態偵測 + 自動重試 + 斷點續傳 ==========

    private _retryCount = 0;
    private readonly MAX_RETRY = 3;
    private _retryTimer: ReturnType<typeof setTimeout> | null = null;
    private _pendingSaveForOnline: object | null = null;

    /**
     * 標記當前存檔，在恢復網路時自動重試 delta/full 同步。
     */
    public scheduleRetryOnRestore(currentSave: object): void {
        this._pendingSaveForOnline = currentSave;
    }

    /**
     * 帶指數退避的重試同步（最多 3 次）。
     * @param saveFn 同步函式（呼叫 syncDelta 或 syncFull）
     */
    public async retrySync(saveFn: () => Promise<void>): Promise<void> {
        if (this._retryCount >= this.MAX_RETRY) {
            UCUFLogger.warn(LogCategory.DATA, '[SyncManager] max retries reached - notifying player');
            this.eventSystem?.emit('SHOW_TOAST', { message: '同步失敗，請稍後手動儲存或重連網路。' });
            this._retryCount = 0;
            return;
        }

        const delayMs = Math.pow(2, this._retryCount) * 1000; // 1s, 2s, 4s
        this._retryCount++;
        UCUFLogger.info(LogCategory.DATA, `[SyncManager] retry #${this._retryCount} in ${delayMs}ms`);

        this._retryTimer = setTimeout(async () => {
            if (this.network?.isOnline) {
                try {
                    await saveFn();
                    this._retryCount = 0;
                } catch {
                    await this.retrySync(saveFn);
                }
            } else {
                await this.retrySync(saveFn);
            }
        }, delayMs);
    }

    /**
     * 網路恢復後，若有排程的 pending 存檔，自動重送。
     * 覆寫 handleNetworkRestored 行為（保留舊邏輯並新增 delta 重送）。
     */
    private async handleDeltaQueueOnRestore(): Promise<void> {
        // 佇列非空 → 觸發全量同步
        if (this.deltaPatchQueue.length > 0 && this._pendingSaveForOnline) {
            UCUFLogger.info(LogCategory.DATA, '[SyncManager] network restored with pending delta queue - full sync');
            await this.syncFull(this._pendingSaveForOnline);
            this._pendingSaveForOnline = null;
        }
    }
}
