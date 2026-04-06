import { sys } from 'cc';
import { EventSystem } from './EventSystem';
import { NetworkService, EVENT_NETWORK_ONLINE } from './NetworkService';
import { ActionRecord, SyncRequest, SyncResponse } from '../../../../shared/protocols';
import CryptoJS from 'crypto-js'; // 假設已安裝於前端或透過外部 bundle 引入

export const EVENT_SYNCING = 'EVENT_SYNCING';
export const EVENT_SYNC_COMPLETE = 'EVENT_SYNC_COMPLETE';
export const EVENT_OFFLINE_REMINDER = 'EVENT_OFFLINE_REMINDER'; 

export enum SyncActionType {
    DEFERRABLE = 'DEFERRABLE',               // 可延遲上傳 (本機先算 Hash 存佇列，等連線後背景上傳)
    IMMEDIATE_REQUIRED = 'IMMEDIATE_REQUIRED' // 必即時上傳 (若斷線則直接阻擋操作，如：課金購買)
}

export class SyncManager {
    private eventSystem: EventSystem | null = null;
    private network: NetworkService | null = null;

    private actionRecords: ActionRecord[] = [];
    private currentSeq: number = 0;
    private sessionSecret: string = 'MOCK_SECRET_KEY'; // 當前有效金鑰 (Server 成功連線時下發)
    private lastHash: string = 'INIT_HASH';          // 上次同步成功後的雜湊錨點
    private deviceId: string = '';

    private isSyncing: boolean = false;
    private reminderTimer: any = null;

    private readonly STORAGE_KEY = 'OFFLINE_ACTION_LOGS';
    private readonly DEVICE_KEY = 'CLIENT_DEVICE_ID';
    private readonly SERVER_URL = 'http://localhost:3000'; // 模擬伺服器位址

    public setup(eventSystem: EventSystem, network: NetworkService): void {
        this.eventSystem = eventSystem;
        this.network = network;

        this.initDeviceId();
        this.loadLocalActions();

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

    private loadLocalActions(): void {
        const stored = sys.localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            try {
                this.actionRecords = JSON.parse(stored);
                this.currentSeq = this.actionRecords.length > 0 
                    ? Math.max(...this.actionRecords.map(r => r.Seq)) 
                    : 0;
                console.log(`[SyncManager] Loaded ${this.actionRecords.length} actions from local storage.`);
            } catch (e) {
                console.error('[SyncManager] Failed to parse local actions:', e);
                this.actionRecords = [];
            }
        }
    }

    private saveLocalActions(): void {
        sys.localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.actionRecords));
    }

    /**
     * 嘗試將一筆操作寫入 Action Log 佇列。
     * 如果是 IMMEDIATE_REQUIRED 且斷線，回傳 false 並拒絕執行，保障資料一致性。
     */
    public pushAction(actionName: string, payload: any, type: SyncActionType = SyncActionType.DEFERRABLE): boolean {
        if (!this.network?.isOnline && type === SyncActionType.IMMEDIATE_REQUIRED) {
            this.eventSystem?.emit('SHOW_TOAST', { message: '此操作涉及到帳戶變動，請連接網路後再試' });
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
        const calculatedHash = CryptoJS.HmacSHA256(dataToHash, secret).toString();
        this.lastHash = calculatedHash;

        const record: ActionRecord = {
            Seq: this.currentSeq,
            Timestamp: Date.now(),
            Action: actionName,
            Payload: payload,
            Tx_Hash: calculatedHash
        };

        this.actionRecords.push(record);
        this.saveLocalActions(); 
        
        console.log(`[SyncManager] Action Logged: ${actionName} (Hash: ${calculatedHash.substring(0, 8)}...)`);

        if (this.network?.isOnline) {
            this.syncNow();
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
        if (this.actionRecords.length > 0) {
            console.log('[SyncManager] Network restored. Resuming pending actions...');
            this.syncNow();
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

        console.log(`[SyncManager] Requesting Sync for ${this.actionRecords.length} records...`);

        try {
            const response = await fetch(`${this.SERVER_URL}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(syncData)
            });

            const result: SyncResponse = await response.json();

            if (result.Success) {
                console.log('[SyncManager] Sync OK. New Secret issued.');
                this.actionRecords = []; 
                sys.localStorage.removeItem(this.STORAGE_KEY);
                
                this.sessionSecret = result.New_Session_Secret!;
                this.lastHash = result.New_Hash!; // 以此為下次離線的第一個雜湊鎖
                this.isSyncing = false;
                this.eventSystem?.emit(EVENT_SYNC_COMPLETE);
            } else {
                console.error(`[SyncManager] Sync Rejected: ${result.Message}`);
                this.isSyncing = false;
            }
        } catch (e) {
            console.error('[SyncManager] API Call Failed (Network Error?):', e);
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
            console.log('[SyncManager] offline - queuing delta patch');
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
                console.warn('[SyncManager] delta conflict (409) - falling back to full sync');
                this.isSyncing = false;
                await this.syncFull(currentSave);
                return;
            }

            if (response.ok) {
                const result = await response.json();
                this.lastHash = result.newHash ?? this.lastHash;
                this.actionRecords = [];
                sys.localStorage.removeItem(this.STORAGE_KEY);
                this.deltaPatchQueue = [];
                this.eventSystem?.emit(EVENT_SYNC_COMPLETE);
                console.log('[SyncManager] delta sync OK');
            } else {
                console.error(`[SyncManager] delta sync failed: ${response.status}`);
                this._enqueueDeltaPatch(baseSave, currentSave);
            }
        } catch (e) {
            console.error('[SyncManager] delta sync error:', e);
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
                sys.localStorage.removeItem(this.STORAGE_KEY);
                this.deltaPatchQueue = [];
                this.eventSystem?.emit(EVENT_SYNC_COMPLETE);
                console.log('[SyncManager] full sync OK');
            } else {
                console.error(`[SyncManager] full sync failed: ${response.status}`);
            }
        } catch (e) {
            console.error('[SyncManager] full sync error:', e);
        } finally {
            this.isSyncing = false;
        }
    }

    private _enqueueDeltaPatch(base: object, current: object): void {
        this.deltaPatchQueue.push({ base, current, ts: Date.now() });
        if (this.deltaPatchQueue.length > this.DELTA_QUEUE_MAX) {
            console.warn('[SyncManager] delta queue full (>10) - will trigger full sync on next online');
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
                console.log(`[SyncManager] flushed ${this.actionRecords.length} actions (compressed)`);
                this.actionRecords = [];
                sys.localStorage.removeItem(this.STORAGE_KEY);
            }
        } catch (e) {
            console.error('[SyncManager] flushCompressedActions error:', e);
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
            console.warn('[SyncManager] max retries reached - notifying player');
            this.eventSystem?.emit('SHOW_TOAST', { message: '同步失敗，請稍後手動儲存或重連網路。' });
            this._retryCount = 0;
            return;
        }

        const delayMs = Math.pow(2, this._retryCount) * 1000; // 1s, 2s, 4s
        this._retryCount++;
        console.log(`[SyncManager] retry #${this._retryCount} in ${delayMs}ms`);

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
            console.log('[SyncManager] network restored with pending delta queue - full sync');
            await this.syncFull(this._pendingSaveForOnline);
            this._pendingSaveForOnline = null;
        }
    }
}
