// @spec-source → 見 docs/cross-reference-index.md
import { director } from "cc";
import { SceneName } from "../config/Constants";

export class SceneManager {
    private targetScene: string = "";
    private sceneData: any = null;

    /**
     * 切換場景：A -> LoadingScene -> B
     * 呼叫此函式將進入共用的輕量中繼場景（LoadingScene），藉此安全釋放前場景記憶體
     */
    public switchScene(targetSceneName: string, data?: any): void {
        this.targetScene = targetSceneName;
        this.sceneData = data;
        director.loadScene(SceneName.Loading);
    }

    /**
     * 取得切換目標與夾帶的資料，供 LoadingScene 讀取
     */
    public getTargetScene(): { name: string, data: any } {
        return { name: this.targetScene, data: this.sceneData };
    }

    /**
     * 直接設定下一場景（不觸發 LoadingScene 橋接），供 QA preview 工作流使用
     */
    public setNextScene(name: string, data?: any): void {
        this.targetScene = name;
        this.sceneData = data ?? null;
    }

    // ─── View Bridge ────────────────────────────────────────────────────────
    private boardRenderer: any = null;

    /**
     * 註冊當前場景的 BoardRenderer（由 BattleScene.start 呼叫）
     */
    public registerBoardRenderer(renderer: any): void {
        this.boardRenderer = renderer;
    }

    /**
     * 取得當前場景的 BoardRenderer
     */
    public getBoardRenderer(): any {
        return this.boardRenderer;
    }
}
