# UI Vibe Coding 自動化生產藍圖

## TL;DR

本文件定義一條適用於 Cocos Creator 3.8 的 UI 量產工作流，目標是用 `JSON layout spec + skin asset manifest + Cocos 預覽生成器 + Auto Atlas policy + Agent Skill`，把 UI 生產流程從「手工拖節點 + 手工換圖」改造成「資料驅動 + 可預覽 + 可驗證 + 可批量替換美術 Atlas」的模式。

Unity 對照：
- `ui-layout.json` 類似 Prefab 結構描述 + Layout 規則
- `ui-skin.json` 類似 Theme ScriptableObject / Sprite Atlas Mapping
- `ui-screen.json` 類似某個畫面的裝配設定
- Cocos 預覽生成器類似 Unity EditorWindow + Prefab Variant Builder
- Workspace Skill 類似團隊版的固定 SOP，自動要求 Agent 走一致流程

---

## 1. 目標與非目標

### 1.1 目標

1. 徹底降低 UI 錯亂風險
2. 能快速預覽，讓 AI 與人都能邊做邊調
3. 支援大量畫面量產，不靠每張面板手工重做
4. 支援後續美術 Atlas 無縫替換
5. 讓 Auto Atlas 成為打包期能力，而不是設計期綁死點
6. 讓 AI 產圖、AI 生碼、Cocos 匯入、畫面驗證形成一條閉環

### 1.2 非目標

1. 不追求一次性全自動產出完美視覺
2. 不把最終審美判斷完全交給 AI
3. 不把 stitch MCP 當唯一依賴
4. 不讓 Prefab 成為手工排版唯一真實來源

---

## 2. 核心原則

### 2.1 單一真實來源

UI 量產流程的真實來源不是 Prefab，而是三層資料契約：

1. `ui-layout/*.json`
   管結構、版位、Widget/Layout/SafeArea 規則
2. `ui-skins/*.json`
   管 SpriteFrame、9-slice border、字型、顏色、狀態圖對應
3. `ui-screens/*.json`
   管單一畫面的組裝結果，指定用哪個 layout、哪個 skin、哪個 bundle

### 2.2 白模先行，皮膚覆蓋

預覽與實作的第一版永遠可以先用白模跑通，再讓美術皮膚覆蓋。這延續現有 `assets/scripts/ui/components/SolidBackground.ts` 的設計方向。

### 2.3 設計期與打包期分離

設計期以原子資產與 manifest 工作。
打包期才依規則進行 Auto Atlas 彙整。
這樣可以避免美術改圖後，整個設計流程被 Auto Atlas 綁死。

### 2.4 驗證前移

九宮格、命名、padding、bleed、螢幕比例、文字溢出、點擊熱區遮擋，必須在進遊戲前就先驗證，而不是等到整合後才被動修圖。

---

## 3. 端到端工作流

### Phase A: UI 設計輸入

1. 規格文件提供畫面需求
2. AI 先草擬 `ui-layout.json`
3. AI 或美術根據 layout 需要產出貼圖需求單
4. 美術或 AI 產圖輸出到原始素材區

建議原始素材區：

```text
artifacts/
  ui-source/
    battle-hud/
    lobby-main/
    popup-common/
```

### Phase B: 切片與貼圖 metadata

原始貼圖不能直接丟進 Cocos，要先產生切片 metadata。

每組貼圖至少要有：

1. `slice-manifest.json`
2. 原始 PNG
3. 邊距規則
4. 是否允許進 atlas
5. 是否為 9-slice
6. 是否屬於 hover/pressed/disabled 等狀態圖

### Phase C: Cocos 匯入

1. 貼圖匯入指定 bundle 或 resources 路徑
2. 依 manifest 套用 9-slice 設定
3. 由預覽生成器從 `ui-screen.json` 自動建構畫面
4. 如果 skin 未就緒，退回白模
5. 由 `UIManager` / `ResourceManager` 接入執行期流程

### Phase D: 預覽與調整

1. 產生預覽畫面
2. 檢查多種螢幕比例
3. 重新調整 layout json 或 skin manifest
4. 再生成一次預覽

### Phase E: 驗證與打包

1. 檢查命名規範
2. 檢查 9-slice 整數 border
3. 檢查文字溢出
4. 檢查互動熱區
5. 依 atlas policy 打包 Auto Atlas
6. 驗證 draw call 與圖集大小

---

## 4. 建議資料夾藍圖

```text
assets/
  bundles/
    ui_common/
      sprites/
      prefabs/
    battle_ui/
      sprites/
      prefabs/
    lobby_ui/
      sprites/
      prefabs/
  resources/
    ui-spec/
      layouts/
      screens/
      skins/

artifacts/
  ui-source/
    battle-hud/
      source.png
      slice-manifest.json
    popup-common/
      frame-gold.png
      frame-dark.png
      slice-manifest.json

.github/
  skills/
    ui-vibe-pipeline/
      SKILL.md
      references/
        pipeline.md
        checklists.md
        json-contracts.md
      assets/
        layout.example.json
        skin.example.json
        screen.example.json
        ui-preview-review.example.md
```

---

## 5. JSON 契約藍圖

### 5.1 layout spec 範例

這份檔案定義節點樹、對齊、尺寸、safe area、元件種類。

```json
{
  "id": "battle-hud-main",
  "version": 1,
  "canvas": {
    "fitWidth": true,
    "fitHeight": true,
    "safeArea": true
  },
  "root": {
    "type": "container",
    "name": "BattleHUDRoot",
    "widget": {
      "top": 0,
      "left": 0,
      "right": 0
    },
    "children": [
      {
        "type": "panel",
        "name": "TopBar",
        "widget": {
          "top": 16,
          "left": 16,
          "right": 16
        },
        "height": 120,
        "skinSlot": "hud.topbar.bg",
        "layout": {
          "type": "horizontal",
          "spacing": 12,
          "paddingLeft": 16,
          "paddingRight": 16
        },
        "children": [
          {
            "type": "label",
            "name": "RoundLabel",
            "textKey": "battle.round",
            "styleSlot": "hud.label.title"
          },
          {
            "type": "resource-counter",
            "name": "DpCounter",
            "iconSlot": "hud.icon.dp",
            "styleSlot": "hud.label.value"
          }
        ]
      },
      {
        "type": "button-group",
        "name": "ActionButtons",
        "widget": {
          "bottom": 24,
          "right": 24
        },
        "layout": {
          "type": "horizontal",
          "spacing": 10
        },
        "items": [
          { "id": "skill", "skinSlot": "hud.button.skill" },
          { "id": "deploy", "skinSlot": "hud.button.deploy" },
          { "id": "pause", "skinSlot": "hud.button.pause" }
        ]
      }
    ]
  }
}
```

### 5.2 skin manifest 範例

這份檔案定義圖塊來源、SpriteFrame 路徑、九宮格、顏色、字型、狀態圖。

```json
{
  "id": "battle-hud-default",
  "version": 1,
  "bundle": "battle_ui",
  "atlasPolicy": "battle_hud",
  "slots": {
    "hud.topbar.bg": {
      "kind": "sprite-frame",
      "path": "sprites/hud/topbar_bg/spriteFrame",
      "spriteType": "sliced",
      "border": [24, 24, 24, 24],
      "allowAutoAtlas": true,
      "bleed": 4
    },
    "hud.icon.dp": {
      "kind": "sprite-frame",
      "path": "sprites/hud/icon_dp/spriteFrame",
      "spriteType": "simple",
      "allowAutoAtlas": true
    },
    "hud.button.skill": {
      "kind": "button-skin",
      "normal": "sprites/hud/btn_skill_normal/spriteFrame",
      "pressed": "sprites/hud/btn_skill_pressed/spriteFrame",
      "disabled": "sprites/hud/btn_skill_disabled/spriteFrame",
      "spriteType": "sliced",
      "border": [20, 20, 20, 20],
      "allowAutoAtlas": true
    },
    "hud.label.title": {
      "kind": "label-style",
      "font": "fonts/notosans_tc_bold/font",
      "fontSize": 34,
      "lineHeight": 38,
      "color": "#F4E7C1",
      "outlineColor": "#3D2A16",
      "outlineWidth": 2
    },
    "hud.label.value": {
      "kind": "label-style",
      "font": "fonts/notosans_tc_bold/font",
      "fontSize": 28,
      "lineHeight": 32,
      "color": "#FFFFFF"
    }
  }
}
```

### 5.3 screen spec 範例

這份檔案決定單一畫面要用哪份 layout、哪份 skin、輸出到哪個 UI ID。

```json
{
  "id": "battle-hud-screen",
  "version": 1,
  "uiId": "BattleHUD",
  "layer": "Game",
  "bundle": "battle_ui",
  "layout": "battle-hud-main",
  "skin": "battle-hud-default",
  "previewScene": "db://assets/scenes/battle.preview",
  "prefabOutput": "db://assets/bundles/battle_ui/prefabs/BattleHUD.prefab",
  "validation": {
    "devices": ["phone-16-9", "phone-19_5-9", "tablet-4-3"],
    "allowMissingSkin": false
  }
}
```

---

## 6. Cocos 端模組藍圖

### 6.1 建議新模組

```text
assets/scripts/ui/spec/
  UISpecTypes.ts
  UISpecLoader.ts
  UISkinResolver.ts
  UIPreviewBuilder.ts
  UIValidationRunner.ts
```

#### 模組職責

1. `UISpecTypes.ts` — 定義 layout / skin / screen 的 TypeScript 型別
2. `UISpecLoader.ts` — 透過現有 `assets/scripts/core/systems/ResourceManager.ts` 載入 JSON
3. `UISkinResolver.ts` — 將 skin slot 解析成 SpriteFrame / LabelStyle / Button 狀態圖
4. `UIPreviewBuilder.ts` — 根據 layout spec 生成節點樹並套皮
5. `UIValidationRunner.ts` — 檢查缺圖、九宮格、比例、文字溢出與熱區

### 6.2 TypeScript 型別範例

```ts
// @spec-source → 見 docs/cross-reference-index.md
export interface UIScreenSpec {
    id: string;
    version: number;
    uiId: string;
    layer: string;
    bundle: string;
    layout: string;
    skin: string;
    previewScene?: string;
    prefabOutput?: string;
    validation?: {
        devices?: string[];
        allowMissingSkin?: boolean;
    };
}

export interface UILayoutNodeSpec {
    type: string;
    name: string;
    width?: number;
    height?: number;
    textKey?: string;
    skinSlot?: string;
    styleSlot?: string;
    widget?: {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
    };
    layout?: {
        type: 'horizontal' | 'vertical' | 'grid';
        spacing?: number;
        paddingLeft?: number;
        paddingRight?: number;
        paddingTop?: number;
        paddingBottom?: number;
    };
    children?: UILayoutNodeSpec[];
}

export interface UISkinSpriteSlot {
    kind: 'sprite-frame' | 'button-skin';
    path?: string;
    normal?: string;
    pressed?: string;
    disabled?: string;
    spriteType?: 'simple' | 'sliced';
    border?: [number, number, number, number];
    allowAutoAtlas?: boolean;
    bleed?: number;
}
```

### 6.3 預覽生成器範例

```ts
// @spec-source → 見 docs/cross-reference-index.md
import { _decorator, Component, Node, Label, Sprite, UITransform, Widget, Layout } from 'cc';
import { SolidBackground } from '../components/SolidBackground';
import type { UILayoutNodeSpec } from './UISpecTypes';

const { ccclass } = _decorator;

@ccclass('UIPreviewBuilder')
export class UIPreviewBuilder extends Component {
    public buildNodeTree(spec: UILayoutNodeSpec, parent: Node): Node {
        const node = new Node(spec.name);
        node.parent = parent;

        const transform = node.addComponent(UITransform);
        if (spec.width) transform.setContentSize(spec.width, transform.height);
        if (spec.height) transform.setContentSize(transform.width, spec.height);

        if (spec.widget) {
            const widget = node.addComponent(Widget);
            if (spec.widget.top !== undefined) {
                widget.isAlignTop = true;
                widget.top = spec.widget.top;
            }
            if (spec.widget.bottom !== undefined) {
                widget.isAlignBottom = true;
                widget.bottom = spec.widget.bottom;
            }
            if (spec.widget.left !== undefined) {
                widget.isAlignLeft = true;
                widget.left = spec.widget.left;
            }
            if (spec.widget.right !== undefined) {
                widget.isAlignRight = true;
                widget.right = spec.widget.right;
            }
        }

        switch (spec.type) {
            case 'panel': {
                node.addComponent(Sprite);
                node.addComponent(SolidBackground);
                break;
            }
            case 'label': {
                const label = node.addComponent(Label);
                label.string = spec.textKey ?? spec.name;
                break;
            }
        }

        if (spec.layout) {
            const layout = node.addComponent(Layout);
            layout.spacingX = spec.layout.spacing ?? 0;
            layout.spacingY = spec.layout.spacing ?? 0;
            if (spec.layout.type === 'horizontal') {
                layout.type = Layout.Type.HORIZONTAL;
            } else if (spec.layout.type === 'vertical') {
                layout.type = Layout.Type.VERTICAL;
            } else {
                layout.type = Layout.Type.GRID;
            }
        }

        for (const child of spec.children ?? []) {
            this.buildNodeTree(child, node);
        }

        return node;
    }
}
```

### 6.4 Skin 套用器範例

```ts
// @spec-source → 見 docs/cross-reference-index.md
import { Label, Sprite, SpriteFrame } from 'cc';

interface SkinSlotResolver {
    getSpriteFrame(slotId: string): Promise<SpriteFrame | null>;
    getLabelStyle(slotId: string): Promise<{
        fontSize: number;
        lineHeight: number;
        color: string;
    } | null>;
}

export async function applySkinToNode(node: any, skinSlot: string | undefined, styleSlot: string | undefined, resolver: SkinSlotResolver): Promise<void> {
    if (skinSlot) {
        const sprite = node.getComponent(Sprite);
        if (sprite) {
            const frame = await resolver.getSpriteFrame(skinSlot);
            if (frame) {
                sprite.spriteFrame = frame;
            }
        }
    }

    if (styleSlot) {
        const label = node.getComponent(Label);
        if (label) {
            const style = await resolver.getLabelStyle(styleSlot);
            if (style) {
                label.fontSize = style.fontSize;
                label.lineHeight = style.lineHeight;
            }
        }
    }
}
```

### 6.5 Runtime 掛接範例

```ts
// @spec-source → 見 docs/cross-reference-index.md
import { UIID, UIConfig } from '../../core/config/UIConfig';

export function buildRuntimeScreenMap() {
    return {
        [UIID.BattleHUD]: {
            screenSpecId: 'battle-hud-screen',
            layer: UIConfig[UIID.BattleHUD].layer,
            cache: UIConfig[UIID.BattleHUD].cache ?? false
        }
    };
}
```

---

## 7. Skill 藍圖

### 7.1 Workspace Skill 藍圖

建議放在：

```text
.github/skills/ui-vibe-pipeline/
  SKILL.md
  references/
    pipeline.md
    checklists.md
    json-contracts.md
  assets/
    layout.example.json
    skin.example.json
    screen.example.json
    ui-task-template.md
```

#### `SKILL.md` 範例

```md
---
name: ui-vibe-pipeline
description: 'Use for Cocos UI, JSON layout, skin manifest, atlas planning, 9-slice validation, Auto Atlas policy, preview generation, vibe coding workflow, and mass-producing UI screens with consistent structure.'
argument-hint: 'Describe the target screen, visual style, and whether you need layout spec, skin manifest, preview workflow, or validation.'
user-invocable: true
disable-model-invocation: false
---

# UI Vibe Pipeline

## When to Use
- Build a new Cocos UI screen from spec
- Convert an art direction into layout json and skin manifest
- Review atlas grouping and 9-slice correctness
- Generate a preview workflow for mass production
- Prevent UI drift between placeholder and final art

## Procedure
1. Read the relevant UI spec documents and keep consensus.
2. Inspect current UIManager, UIConfig, ResourceManager, and fallback UI components.
3. Produce or update `ui-layout`, `ui-skin`, and `ui-screen` contracts.
4. Validate 9-slice borders, bleed, atlas grouping, and state sprite completeness.
5. Plan preview generation and runtime integration.
6. Produce implementation-ready code examples and verification checklist.

## References
- [Pipeline](./references/pipeline.md)
- [Checklists](./references/checklists.md)
- [JSON Contracts](./references/json-contracts.md)
```
```

### 7.2 User-level Skill 藍圖

個人全域版 skill 只保留跨專案共通能力，不綁 repo 細節。

建議位置：

```text
~/.copilot/skills/ui-vibe-pipeline/
  SKILL.md
  references/
    nine-slice-rules.md
    atlas-strategy.md
    ai-asset-input-spec.md
```

#### User-level `SKILL.md` 範例

```md
---
name: ui-vibe-pipeline
description: 'Use for UI layout JSON design, skin manifests, 9-slice rules, atlas planning, AI art input specs, preview workflow, and repeatable UI production across projects.'
argument-hint: 'Describe the screen type and whether you need layout, atlas policy, or preview review.'
user-invocable: true
disable-model-invocation: false
---

# Cross-project UI Vibe Pipeline

## Use this skill when
- You need a repeatable UI production workflow
- You need 9-slice safe asset rules
- You need atlas grouping guidance
- You need AI-ready art generation constraints

## Do not use this skill when
- The task is a one-off runtime bug unrelated to UI production
- The task is only about editing a single prefab manually
```
```

---

## 8. Optional Custom Agent 藍圖

如果未來你希望把「畫面審查」獨立成另一個角色，可以再做 custom agent。

建議檔名：

```text
.github/agents/ui-preview-reviewer.agent.md
```

範例：

```md
---
name: ui-preview-reviewer
description: Review Cocos UI screen specs, skin manifests, atlas grouping, 9-slice correctness, and likely layout drift risks before implementation.
model: GPT-5.4
---

You are a review-focused UI planning agent.

Tasks:
1. Read UI spec, layout spec, and skin manifest.
2. Flag inconsistent atlas grouping.
3. Flag 9-slice border risks.
4. Flag likely overflow or touch-target issues.
5. Return a concise review checklist and risk list.
```
```

---

## 9. AI 與人類分工

### AI 負責

1. 依規格產出 layout spec 草案
2. 依畫面需求產出 skin manifest 草案
3. 依 Cocos 架構產生預覽生成器使用範例
4. 檢查 atlas 分組與命名規則
5. 檢查 state sprite 是否齊全
6. 檢查 UI 文字是否可能溢出

### 美術負責

1. 視覺方向與風格決策
2. 九宮格框體的四邊界確認
3. 特殊字體與材質風格
4. 最終審美判斷

### 工程負責

1. 建立 UISpec loader / preview builder / validation runner
2. 整合 UIManager, UIConfig, ResourceManager
3. 建立 atlas policy 與 build 前驗證
4. 建立 Cocos 預覽流程與匯入流程

---

## 10. 9-slice 與 Auto Atlas 量產規則

### 10.1 9-slice 規則

1. border 必須是整數像素
2. 四角不放主陰影細節
3. 內容區至少保留 2px 安全帶
4. 邊緣加 2-4px bleed
5. 盡量避免外框 glow 延伸進角區
6. 同一套框體的 normal / pressed / disabled border 必須一致

### 10.2 Auto Atlas 規則

1. 共用 UI 小件進 shared atlas
2. 戰場 HUD 與大廳各自獨立 atlas
3. 大面積背景與高解析裝飾圖不進 Auto Atlas
4. 九宮格框體可進 atlas，但前提是 bleed 與 padding 正確
5. atlas policy 要和 screen spec 對齊

---

## 11. stitch MCP 的定位

stitch MCP 可以有幫助，但應視為前處理工具，而不是核心流程。

適合的接入點：

1. 原始貼圖拼板
2. 自動切片
3. 補 bleed / padding
4. 產出初版 metadata

不應交給 stitch MCP 的部分：

1. 畫面節點結構決策
2. UI 層級與互動規則
3. 最終 atlas policy
4. 執行期資源對映

建議姿勢：
- 有 stitch MCP 時，加速 `ui-source -> slice-manifest.json`
- 沒有 stitch MCP 時，主流程仍可完整運作

---

## 12. 驗證清單

每個畫面交付前都要有以下工件：

1. 規格 ID
2. `layout.json`
3. `skin.json`
4. `screen.json`
5. 預覽圖
6. 驗證結果

每次變更至少驗證：

1. 16:9 預覽
2. 19.5:9 預覽
3. 平板預覽
4. 缺 skin fallback
5. 9-slice border 檢查
6. Auto Atlas 分組檢查
7. 文字溢出檢查
8. 點擊熱區檢查

---

## 13. 建議先做的兩個試點

### 試點 A

一個簡單 Popup。

目標：
- 驗證 layout / skin / screen 三層資料契約
- 驗證白模 fallback
- 驗證單一 atlas policy

### 試點 B

一個複雜 Battle HUD。

目標：
- 驗證多區塊排版
- 驗證多狀態按鈕
- 驗證多裝置比例
- 驗證 UIManager 掛接

---

## 14. 對目前專案的直接建議

根據現有專案基礎：

1. 延用 `assets/scripts/core/managers/UIManager.ts` 作為執行期分層入口
2. 延用 `assets/scripts/core/config/UIConfig.ts` 作為畫面對映入口
3. 延用 `assets/scripts/core/systems/ResourceManager.ts` 載入 JSON 與 SpriteFrame
4. 延用 `assets/scripts/ui/components/SolidBackground.ts` 作為 fallback 底板
5. 用 `docs/UI技術規格書.md` 當流程母規格
6. 後續把本文件中的決策補寫進 `docs/keep.md`

---

## 15. 最後結論

這套流程的價值不在於把所有事情全自動，而在於把錯誤來源固定在少數幾個可檢查的節點：

1. layout 規則
2. skin 對映
3. atlas policy
4. 9-slice 精度
5. 預覽驗證

只要這 5 個點被制度化，你就可以用 vibe coding 的方式大量生產 UI，同時保留美術替換 Atlas 的自由度，並避免 Cocos 專案在後期因為 Prefab 手調與切圖規則失控而崩掉。

---

## 16. AI 資產自動化生產管線 (AI Asset Pipeline)

2026-03-30 新增。用於實現「AI 產圖 -> 自動替換 -> 引擎刷新」的 Vibe Coding 流程。

### 16.1 核心工具：`tools/gen-placeholders.ps1`

針對快速迭代需求，提供一鍵導入 AI 產圖並刷新 Cocos Creator 的工具。

**工作流 (Workflow)**：
1. **AI 產圖**：使用 `generate_image` 依照 Prompt 產生 PNG。
2. **自動導入**：執行 `powershell -File tools/gen-placeholders.ps1 -SourcePath {暫存PNG} -TargetPath {專案目標PNG}`。
3. **Cocos 刷新**：腳本自動調用 `curl` 觸發 Cocos Asset DB 刷新，產生 `.meta`。

### 16.2 預設存放路徑

*   **暫存/測試資產**：`assets/resources/ui-spec/placeholders/`
*   **正式模組資產**：`assets/bundles/ui/sprites/{module}/`

### 16.3 Prompt 範例（水墨鋼鐵風格）

> "Game UI element, ink wash style, dark background #0F0F0F, gold accent #D4AF37, [元件描述], flat design, no text, transparent PNG"

### 16.4 目前完成進度（2026-03-30）

本輪已完成從「批次生成暫存 UI 圖塊」到「Cocos 匯入刷新」的第一段自動化閉環。

**已完成**：
1. 新增 `tools/gen-ui-sprites.ps1`，可批次產出符合水墨 + 黑鋼主題的程式化 UI 圖塊。
2. 已以 `powershell -ExecutionPolicy Bypass -File tools/gen-ui-sprites.ps1 -Batch all` 成功執行生成。
3. 已落地產出 `assets/resources/sprites/` 下共 36 張 PNG：
  - `battle/`：26 張
  - `common/`：7 張
  - `lobby/`：3 張
4. 對應 `.meta` 已由 Cocos Asset DB 刷新生成，可直接作為 `SpriteFrame` 使用。
5. `tools/gen-placeholders.ps1` 與 `tools/gen-ui-sprites.ps1` 目前已形成雙軌：
  - `gen-ui-sprites.ps1`：批次建立可用的技術白模 / 材質化暫存圖
  - `gen-placeholders.ps1`：將單張 AI 或美術正式圖覆蓋到指定資產路徑
6. 已確認正式通用框來源圖實際位於 `assets/resources/ui-spec/placeholders/bg_ink_detail.png`。
7. 已新增 `tools/gen-approved-ui-frames.ps1`，可將母框切成可重跑的 panel variants，並覆蓋到現有 UI 框體資產路徑。
8. 本輪已實際覆蓋的資產：
  - `sprites/common/popup_card_bg`
  - `sprites/common/popup_card_win`
  - `sprites/common/popup_card_lose`
  - `sprites/battle/unitinfo_root_bg`
  - `sprites/battle/unitinfo_header_bg`
  - `sprites/battle/unitinfo_section_bg`
9. 本輪已實際套用到缺框 slot：
  - `detail.summary.bg`
  - `detail.tabbar.bg`
  - `detail.header.bg`
  - `detail.section.bg`
  - `detail.footer.bg`

### 16.5 通用框定位（目前結論）

使用者已提供一張可用的高質感通用框原稿。這張圖 **仍然需要**，而且不應被目前程式生成的暫存框取代。

**定位建議**：
1. 這類通用框應優先作為正式版 panel family 的母框資產。
2. 最適合替換的目標是大面積容器類圖塊，例如：
  - `sprites/common/popup_card_bg`
  - `sprites/battle/unitinfo_section_bg`
  - `sprites/battle/unitinfo_root_bg`
  - `detail.bg` / `detail.content.bg` 這類 general-detail 大框 slot
3. 不適合直接拿來替換血條、圓環、badge、技能圓鈕等功能型圖塊。
4. `gen-ui-sprites.ps1` 產出的框體保留作為 fallback 與版位驗證用途；正式視覺優先採用已審核的通用框或專屬美術稿。
5. `bg_ink_detail.png` 現在不是僅供參考的草圖，而是已實際成為可重跑 variant pipeline 的母框來源。

### 16.6 尚未完成項目

1. 尚未完成場景層級的人工視覺驗證，目前只完成檔案存在、路徑正確、Asset DB 可匯入與 JSON 接線驗證。
2. 尚未將 `general-detail` 再進一步拆成專屬 icon 與分頁容器美術家族，目前完成的是 panel family。
3. 尚未補齊其他仍可升級的戰場框體，例如 `topbar_bg` 是否也要切入同一家族，需要視實機畫面再判定。
4. 尚未把 variant 生成流程納入更完整的批次資產檢查腳本。

### 16.7 建議後續流程

1. 先把通用框原稿正式匯入專案，保留透明底原始 PNG。
2. 依畫面需求派生 2 到 4 個 variant，例如大框、section 框、header 框、footer 框。
3. 為每個 variant 定義固定 border 值，避免同家族九宮格拉伸手感不一致。
4. 再用 `tools/gen-placeholders.ps1` 覆蓋目前暫存圖，保持既有資產路徑不變，降低 UI 接線成本。

### 16.8 專案級分層框體工作流定位

這套流程不應只服務 `general-detail`，而應定義成整個專案共用的 UI 框體工作流。

#### 定位

1. `general-detail` 是第一個 pilot，不是唯一特例。
2. 後續所有需要「容器 + 材質感 + 階層感」的畫面，都應優先沿用同一套 family / layer 規則。
3. 專案層級共用的是「工具規格 + slot 命名規格 + 驗收規格」，不是共用同一張 PNG。

#### 適用畫面族群

1. Popup 類：如 `general-detail`、`result-popup`、`support-card`。
2. Drawer 類：如戰場兵種資訊、側滑資訊抽屜。
3. Section 類：如技能卡、血統卡、適性卡、商店條目卡。
4. Tab 類：如右側 tab rail、橫向 tab strip、二級切換 plate。
5. Action 類：如大型操作按鈕、底部功能鈕、稀有度 badge。

#### 不應共用的部分

1. 每個 family 的 `frame` 原稿與 ornament 密度可以不同。
2. 但 `layer role`、命名方式、驗收流程、切圖規則必須共用。
3. 血條、圓環、icon、純功能型 glyph 不應被強迫納入同一套 frame family 工具。

### 16.9 Layer-aware 生成工具規格

以下規格是給未來新 skill / 新工具直接採用的正式描述。目標是讓自動 UI 工作流能依 `slot 家族` 直接產出 `frame / bleed / fill / accent` 分層資產，而不是只會生成單張 panel PNG。

#### 建議工具名稱

1. `tools/gen-ui-layered-frames.ps1`
2. 若之後要跨平台與複雜 JSON 解析，建議改為 `tools_node/gen-ui-layered-frames.js`

#### 工具目標

1. 掃描 `assets/resources/ui-spec/skins/*.json`。
2. 找出符合分層命名規則的 slot 家族。
3. 依 family recipe 批次輸出 PNG 到正式 runtime 路徑。
4. 自動刷新 Cocos Asset DB。
5. 輸出報告，標示哪些 slot 已生成、哪些仍是 fallback。

#### 掃描規則

工具必須以 `slot name` 為主，不依賴單一畫面硬編碼。

##### 支援的 layer role suffix

1. `.frame`
2. `.bleed`
3. `.fill`
4. `.accent`

##### 支援的 family key 形式

1. `{family}.frame`
2. `{family}.bleed`
3. `{family}.fill`
4. `{family}.accent`
5. `{family}.{state}.frame`
6. `{family}.{state}.fill`
7. `{family}.{state}.accent`

##### family grouping 範例

1. `detail.header.frame` + `detail.header.bleed` + `detail.header.fill` -> family = `detail.header`
2. `detail.tab.active.frame` + `detail.tab.active.fill` + `detail.tab.active.accent` -> family = `detail.tab.active`
3. `battle.unitinfo.section.frame` + `battle.unitinfo.section.fill` -> family = `battle.unitinfo.section`

#### Slot 判讀規則

1. `kind = sprite-frame`：視為正式輸出目標或既有正式資產 alias。
2. `kind = color-rect`：視為 fallback，不直接代表正式最終輸出，但可做為生成預設色參數。
3. `kind = button-skin`：不直接切圖；按鈕的 layer family 需拆到對應 `*.frame / *.fill / *.accent` family，再由 layout 疊圖與 button node 分工。
4. 舊 alias slot 如 `detail.header.bg`、`detail.section.bg`、`detail.tab.idle` 必須保留，工具不得把它們當新 family 的唯一來源。

#### 建議 JSON metadata

為了讓工具不只靠命名猜測，建議未來在新 family slot 上允許附加 underscore metadata。這些欄位不影響 runtime，因為現行系統會忽略未知鍵。

```json
{
  "detail.header.frame": {
    "kind": "sprite-frame",
    "path": "sprites/common/popup_card_bg",
    "spriteType": "sliced",
    "border": [40, 40, 40, 40],
    "_family": "detail.header",
    "_layerRole": "frame",
    "_recipe": "ornate_panel",
    "_source": "ui-spec/placeholders/bg_ink_detail",
    "_target": "sprites/ui_families/general_detail/header_frame",
    "_sizeHint": [442, 196]
  }
}
```

##### metadata 定義

1. `_family`: family id，工具 grouping 第一優先。
2. `_layerRole`: `frame | bleed | fill | accent`。
3. `_recipe`: 要套用的生成 recipe，例如 `ornate_panel`、`tab_plate`、`soft_bleed`、`paper_fill`。
4. `_source`: 母框來源，可為 `ui-spec/placeholders/...` 或原始來源圖。
5. `_target`: 建議正式輸出路徑，不含副檔名。
6. `_sizeHint`: 預設輸出尺寸，僅供 generator 產圖與預覽，不是 runtime 強制值。

#### Recipe 系統規格

工具不可只做單一 nine-slice copy；必須支援 family recipe。

##### 最低限度 recipe 類型

1. `ornate_panel`
目的：大型或中型主框，保留 ornament 與角花。
輸出：`frame` 必須來自母框 nine-slice；`fill` 優先來自原圖中心紋理或紙感紋理；`bleed` 為邊緣內縮霧層。

2. `soft_bleed`
目的：生成自然過渡層。
輸出：內縮 vignette、低對比煙墨、中心透明度較高、邊緣透明度較低。

3. `paper_fill`
目的：生成內容區底紋。
輸出：可拉伸的紙感、墨霧、山霧或深色底紋，不可只是單色矩形。

4. `tab_plate`
目的：生成單顆 tab 按鈕用 plate。
輸出：`frame` ornament 密度低於主面板；active 狀態由 `accent` 追加亮邊或底光，而不是重畫整張框。

5. `action_plate`
目的：底部操作按鈕、側欄操作鈕。
輸出：可共用主 family 的 frame，但 fill 與 accent 應更聚焦、對比更高。

#### 工具輸入參數

```text
-SkinPath            指定單一 skin manifest；未指定則掃描全部 skins
-FamilyFilter        只處理符合 family 前綴的 slot，例如 detail., result., battle.unitinfo.
-RecipeFilter        只處理特定 recipe
-Apply               直接輸出到正式資產路徑
-Preview             輸出到 temp_workspace 或 artifacts/ui-preview
-RefreshCocos        完成後呼叫 asset-db refresh
-ReportPath          輸出 JSON 或 Markdown 報告
-FailOnMissingMeta   缺少 _family / _recipe 時直接失敗
```

#### 輸出規則

1. 輸出一律為透明底 PNG。
2. 正式輸出路徑優先使用 `_target`；若無 `_target`，則由 slot name 轉換為 snake_case 路徑。
3. `frame`、`bleed`、`fill`、`accent` 各自輸出為獨立 PNG，不做 baked merge。
4. 若 family 只有 `frame`，工具應回報 warning，而不是假設已完成自然過渡。
5. 若 `bleed` 或 `fill` 目前仍是 `color-rect` fallback，工具應允許先生成 preview PNG，並把報告標記為 `fallback-promoted`。

#### 與 layout / skin 的契約

1. layout 要求：分層版節點順序固定為 `fill -> bleed -> frame -> content`。
2. skin 要求：舊 alias slot 與新 family slot 可同時存在。
3. validator 要求：相容期應接受「舊單層 slot」或「新分層 family」任一成立。

#### 驗收規則

工具完成後至少要自動檢查：

1. family 中是否至少有 `frame`。
2. `sliced` 圖的 `border` 是否存在且為整數。
3. `frame` 與對應 alias slot 的 border 是否一致。
4. 輸出 PNG 是否為透明底。
5. `bleed` 是否不為純實心矩形。
6. 黑底預覽下是否有明顯白 fringe。
7. 若有 active / idle 狀態，是否只變更 `fill` / `accent`，避免複製整套 ornament。

#### 錯誤分級

1. `error`：缺少 `frame`、border 非法、輸出失敗、target path 無法解析。
2. `warning`：只有單層 family、仍依賴 `color-rect` fallback、accent 過亮、與 alias border 不一致。
3. `info`：未提供 `_sizeHint`、未提供 `_target`、使用預設 recipe 參數。

#### General Detail 對應範例

第一批 family 建議如下：

1. `detail.header`
2. `detail.summary`
3. `detail.summary.card`
4. `detail.tabbar.rail`
5. `detail.tab.idle`
6. `detail.tab.active`
7. `detail.content`
8. `detail.section`
9. `detail.footer`
10. `detail.action`

其中 `general-detail` 只是 pilot。工具 skill 的實際設計應以這些 family pattern 為共用模板，再擴展到 `result-popup`、`battle unit info`、`shop`、`support-card` 等畫面。

### 16.10 實作順序建議

1. 先做 `scan + group + report`，確認工具能正確辨識 family。
2. 再做 `preview mode`，把 `frame / bleed / fill` 輸出到暫存資料夾。
3. 驗收黑底預覽與 border 後，再做 `apply mode` 寫回正式資產路徑。
4. 最後才把 validator 從舊單層 slot 遷到「舊 alias 或新 family 任一可通過」。

