/**
 * 全局共享的行動紀錄接口 (用於 Event Sourcing / 事件溯源)
 * 確保 Client 與 Server 計算 HMAC 雜湊時使用相同的資料結構
 */
export interface ActionRecord {
    Seq: number;       // 行動編號
    Timestamp: number; // 發生時間
    Action: string;    // 行動代碼 (如: 'GACHA_PULL', 'UNIT_UPGRADE')
    Payload: any;      // 該行動的具體數據 (如: { unitId: 'G001', itemId: 'ITEM_01' })
    Tx_Hash: string;   // 鏈式 HMAC 雜湊簽章 (防篡改簽章)
}

/**
 * 同步請求數據結構
 */
export interface SyncRequest {
    Player_ID: string;
    Session_Secret: string;    // 當前有效的同步金鑰 (Server 回推驗證用)
    Action_Records: ActionRecord[]; // 離線操作日誌
    Previous_Hash: string;     // 同步起始點的雜湊錨點
}

/**
 * 同步結果回傳
 */
export interface SyncResponse {
    Success: boolean;
    New_Session_Secret?: string; // 更新後的同步金鑰
    New_Hash?: string;           // 最新的雜湊錨點
    Message?: string;
    Server_Time: number;
}
