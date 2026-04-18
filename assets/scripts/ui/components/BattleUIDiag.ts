/**
 * BattleUIDiag — 戰場 UI 診斷工具
 *
 * 提供 console 可呼叫的全域診斷函式 window.__battleUIDiag()，
 * 以及各 Composite 可呼叫的 logBattleUIPosition() 工具函式。
 *
 * 用途：在瀏覽器 F12 console 中快速查看 Canvas / Camera / Widget 佈局
 *       與節點世界座標，協助排查 Editor vs Browser 位置不一致問題。
 */
import { Node, UITransform, Widget, view, director, Canvas } from 'cc';

/**
 * 記錄一個 UI 根節點的位置診斷資訊到 console。
 * @param tag     呼叫來源標籤（如 'TigerTallyComposite'）
 * @param rootNode 要診斷的根節點（如 TigerTallyRoot）
 */
export function logBattleUIPosition(tag: string, rootNode: Node): void {
    const ut = rootNode.getComponent(UITransform);
    const w = rootNode.getComponent(Widget);
    const wp = rootNode.worldPosition;
    const parent = rootNode.parent;
    const parentUT = parent?.getComponent(UITransform);

    const designRes = view.getDesignResolutionSize();
    const visibleSize = view.getVisibleSize();

    // Canvas 節點位置
    const scene = director.getScene();
    const canvasNode = scene?.getChildByName('Canvas');
    const canvasWP = canvasNode?.worldPosition;
    const canvasUT = canvasNode?.getComponent(UITransform);

    console.log(
        `%c[BattleUIDiag] ${tag}`,
        'color: #00bcd4; font-weight: bold',
    );
    console.log(`  設計解析度: ${designRes.width}×${designRes.height}`);
    console.log(`  實際可見區: ${visibleSize.width.toFixed(0)}×${visibleSize.height.toFixed(0)}`);
    if (canvasWP && canvasUT) {
        console.log(
            `  Canvas: worldPos=(${canvasWP.x.toFixed(0)},${canvasWP.y.toFixed(0)})` +
            ` size=${canvasUT.contentSize.width.toFixed(0)}×${canvasUT.contentSize.height.toFixed(0)}`
        );
    }
    if (parentUT) {
        console.log(
            `  父節點 [${parent!.name}]: size=${parentUT.contentSize.width.toFixed(0)}×${parentUT.contentSize.height.toFixed(0)}`
        );
    }

    const sz = ut ? `${ut.contentSize.width.toFixed(0)}×${ut.contentSize.height.toFixed(0)}` : '?';
    console.log(
        `  ${rootNode.name}: localPos=(${rootNode.position.x.toFixed(0)},${rootNode.position.y.toFixed(0)})` +
        ` worldPos=(${wp.x.toFixed(0)},${wp.y.toFixed(0)}) size=${sz}`
    );

    if (w) {
        console.log(
            `  Widget: enabled=${w.enabled}` +
            ` left=${w.isAlignLeft ? w.left : '-'}` +
            ` right=${w.isAlignRight ? w.right : '-'}` +
            ` top=${w.isAlignTop ? w.top : '-'}` +
            ` bottom=${w.isAlignBottom ? w.bottom : '-'}`
        );
    }

    // 可見性判斷：計算節點是否在 Canvas 設計解析度的可視範圍內
    if (canvasWP) {
        const halfDesignW = designRes.width / 2;
        const halfDesignH = designRes.height / 2;
        const cx = canvasWP.x;
        const cy = canvasWP.y;
        const designLeft = cx - halfDesignW;
        const designRight = cx + halfDesignW;
        const designBottom = cy - halfDesignH;
        const designTop = cy + halfDesignH;

        const nodeLeft = wp.x - (ut ? ut.contentSize.width * ut.anchorX : 0);
        const nodeRight = wp.x + (ut ? ut.contentSize.width * (1 - ut.anchorX) : 0);
        const nodeBottom = wp.y - (ut ? ut.contentSize.height * ut.anchorY : 0);
        const nodeTop = wp.y + (ut ? ut.contentSize.height * (1 - ut.anchorY) : 0);

        const inDesignArea = nodeRight > designLeft && nodeLeft < designRight
            && nodeTop > designBottom && nodeBottom < designTop;

        if (!inDesignArea) {
            console.warn(
                `  ⚠ 節點超出設計解析度範圍！` +
                ` 節點X=[${nodeLeft.toFixed(0)},${nodeRight.toFixed(0)}]` +
                ` 設計X=[${designLeft.toFixed(0)},${designRight.toFixed(0)}]` +
                ` 節點Y=[${nodeBottom.toFixed(0)},${nodeTop.toFixed(0)}]` +
                ` 設計Y=[${designBottom.toFixed(0)},${designTop.toFixed(0)}]`
            );
            console.warn(
                `  ⚠ 原因：Widget 對齊到擴展後的 Canvas (${visibleSize.width.toFixed(0)}px)，` +
                `而非設計解析度 (${designRes.width}px)。` +
                `在視窗比例不同於設計比例時，節點會被推到螢幕外。`
            );
        } else {
            console.log(`  ✓ 節點在設計解析度範圍內`);
        }

        // 額外：檢查 HTML Canvas 的 CSS 位置
        if (typeof document !== 'undefined') {
            const gameCanvas = document.getElementById('GameCanvas');
            if (gameCanvas) {
                const rect = gameCanvas.getBoundingClientRect();
                console.log(
                    `  HTML GameCanvas: CSS left=${rect.left.toFixed(0)} top=${rect.top.toFixed(0)}` +
                    ` width=${rect.width.toFixed(0)} height=${rect.height.toFixed(0)}` +
                    ` window=${window.innerWidth}×${window.innerHeight}`
                );
                if (rect.left < 0) {
                    console.warn(
                        `  ⚠ GameCanvas CSS left=${rect.left.toFixed(0)}px — ` +
                        `Canvas 左側 ${Math.abs(rect.left).toFixed(0)}px 被瀏覽器視窗裁切！` +
                        `左對齊的 UI 元素會被看不到。`
                    );
                }
            }
        }
    }
}

/**
 * 註冊全域診斷函式 window.__battleUIDiag()，
 * 在瀏覽器 F12 console 中可隨時呼叫。
 */
export function registerBattleUIDiag(): void {
    if (typeof window === 'undefined') return;

    (window as unknown as Record<string, unknown>).__battleUIDiag = () => {
        const scene = director.getScene();
        if (!scene) { console.log('scene not loaded'); return; }
        const canvas = scene.getChildByName('Canvas');
        if (!canvas) { console.log('Canvas not found'); return; }

        console.log('%c=== Battle UI Diagnostic ===', 'color: #ff9800; font-weight: bold; font-size: 14px');

        const designRes = view.getDesignResolutionSize();
        const visibleSize = view.getVisibleSize();
        const scaleX = view.getScaleX();
        const canvasUT = canvas.getComponent(UITransform)!;

        console.log(`設計解析度: ${designRes.width}×${designRes.height}`);
        console.log(`實際可見區: ${visibleSize.width.toFixed(0)}×${visibleSize.height.toFixed(0)}`);
        console.log(`Canvas worldPos: (${canvas.worldPosition.x.toFixed(0)},${canvas.worldPosition.y.toFixed(0)})`);
        console.log(`Canvas size: ${canvasUT.contentSize.width.toFixed(0)}×${canvasUT.contentSize.height.toFixed(0)}`);
        console.log(`view.scaleX: ${scaleX.toFixed(4)}`);

        // HTML viewport
        if (typeof document !== 'undefined') {
            const gc = document.getElementById('GameCanvas');
            if (gc) {
                const rect = gc.getBoundingClientRect();
                console.log(
                    `GameCanvas CSS: left=${rect.left.toFixed(0)} width=${rect.width.toFixed(0)} ` +
                    `window=${window.innerWidth}×${window.innerHeight}`
                );
                const overflowLeft = Math.max(0, -rect.left);
                const overflowRight = Math.max(0, rect.right - window.innerWidth);
                if (overflowLeft > 0 || overflowRight > 0) {
                    console.warn(
                        `⚠ Canvas 超出視窗：左溢出 ${overflowLeft.toFixed(0)}px, 右溢出 ${overflowRight.toFixed(0)}px — ` +
                        `邊緣對齊的 UI 會被裁切！`
                    );
                }
            }
        }

        // 掃描所有 Canvas 子節點
        const panels = [
            'TigerTallyPanel', 'ActionCommandPanel', 'HUD',
            'DeployPanelHost', 'BattleLogPanel', 'UnitInfoPanel',
        ];
        for (const name of panels) {
            const node = canvas.getChildByName(name);
            if (!node) continue;
            // safeAreaConstrained 修復後，layout root 會移入 __safeArea 中介節點
            const firstChild = node.children[0];
            const root = (firstChild?.name === '__safeArea' && firstChild.children[0])
                ? firstChild.children[0]     // 跳過 __safeArea，直接看 layout root
                : (firstChild ?? node);
            logBattleUIPosition(`Canvas/${name}`, root);
        }
    };

    console.log('[BattleUIDiag] window.__battleUIDiag() 已註冊 — 在 F12 console 呼叫即可查看診斷');
}
