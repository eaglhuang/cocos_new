import express, { Request, Response } from 'express';
import cors from 'cors';
import CryptoJS from 'crypto-js';

import { ActionRecord, SyncRequest, SyncResponse } from '../../shared/protocols';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// 模擬伺服器端資料庫中的玩家數據快照
const mockDatabase: { [key: string]: any } = {
    'PLAYER_TEST_01': {
        Last_Sync_Hash: 'INIT_HASH',
        Session_Secret: 'MOCK_SECRET_KEY',
        Assets: { Gold: 1000, Exp: 0 }
    }
};

/**
 * 核心同步驗證 API (防篡改驗證與邏輯重演)
 * Endpoint: POST /sync
 */
app.post('/sync', (req: Request, res: Response) => {
    const syncReq: SyncRequest = req.body;
    const player = mockDatabase[syncReq.Player_ID];

    if (!player) {
        return res.status(404).json({ Success: false, Message: 'Player not found.' });
    }

    // 1. 驗證金鑰
    if (syncReq.Session_Secret !== player.Session_Secret) {
        return res.status(403).json({ Success: false, Message: 'Invalid Session Secret (Security Breach).' });
    }

    // 2. 雜湊鏈重演與防篡改檢查 (Rolling Hash Verification)
    let currentHashAnchor = syncReq.Previous_Hash;
    const secret = player.Session_Secret;

    for (const record of syncReq.Action_Records) {
        // HMAC-SHA256 驗證公式: SHA256 (Action + Payload + Secret + PreviousHash)
        const payloadStr = JSON.stringify(record.Payload);
        const dataToHash = `${record.Action}${payloadStr}${secret}${currentHashAnchor}`;
        const calculatedHash = CryptoJS.HmacSHA256(dataToHash, secret).toString();

        if (calculatedHash !== record.Tx_Hash) {
            console.error(`[Server] Security Violation at Sequence #${record.Seq}! Hash Mismatch.`);
            return res.status(400).json({ 
                Success: false, 
                Message: `Hash chain broken at Seq #${record.Seq}. Sync rejected.` 
            });
        }
        
        console.log(`[Server] Verified Action Seq #${record.Seq}: ${record.Action} -> OK.`);

        // 3. 邏輯重演 (Business Logic Replay - 此處為簡易範例)
        if (record.Action === 'BATTLE_WIN') {
            player.Assets.Gold += (record.Payload.Gold || 0);
        } else if (record.Action === 'SHOP_BUY') {
            player.Assets.Gold -= (record.Payload.Cost || 0);
        }

        // 更新雜湊錨點進行下一筆比對
        currentHashAnchor = calculatedHash;
    }

    // 4. 同步成功：生成新的 Secret 以防重放攻擊 (Replay Attack Prevention)
    const newSecret = CryptoJS.lib.WordArray.random(16).toString();
    player.Session_Secret = newSecret;
    player.Last_Sync_Hash = currentHashAnchor;

    const response: SyncResponse = {
        Success: true,
        New_Session_Secret: newSecret,
        New_Hash: currentHashAnchor,
        Server_Time: Date.now()
    };

    console.log(`[Server] Sync success for ${syncReq.Player_ID}. New Gold: ${player.Assets.Gold}`);
    res.json(response);
});

app.listen(port, () => {
    console.log(`Game Server Simulation running at http://localhost:${port}`);
});
