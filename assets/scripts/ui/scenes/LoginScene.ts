// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Component } from 'cc';
import { services } from '../../core/managers/ServiceLoader';
import { SceneName } from '../../core/config/Constants';
import { ensureGlobalDevOverlay } from '../dev/GachaDevOverlay';

const { ccclass } = _decorator;

@ccclass('LoginScene')
export class LoginScene extends Component {

    start(): void {
        ensureGlobalDevOverlay();
    }

    /** 點擊「開始遊戲」按鈕 → SceneManager 攔截，導向 LoadingScene，再由 Loading 切入 LobbyScene */
    public onClickStart() {
        // ✅ 正確流程：Login → LoadingScene（中繼清理） → LobbyScene（大廳）
        services().scene.switchScene(SceneName.Lobby);

        // ---- 若要跳過大廳直接進戰鬥測試，改這行：----
        // services().scene.switchScene(SceneName.Battle);
    }
}
