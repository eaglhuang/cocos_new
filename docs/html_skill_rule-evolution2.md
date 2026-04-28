<!-- doc_id: doc_other_0012 -->
# HTML Skill Rule Evolution 2

本檔是 HTML-to-UCUF v2 的 append-only 規則演進紀錄，對應 `docs/html_skill_plan2.md`。

v2 與舊版 `docs/html_skill_rule-evolution.md` 的差異是：本檔只收錄會影響 source package、CSS/token ingestion、HTML vs Cocos Editor visual gate、runtime scoring 與自我修正規則的事件。browser `sourceVsUcufPreview` 低分可以記錄，但不能單獨作為 production cutover 的通過依據。

## 寫入規則

1. 本檔只能 append，不可刪改既有 entry。
2. 每筆 entry 必須有穩定 suggestion id。
3. entry 必須標記 `status`：`candidate`、`accepted`、`rejected`、`applied`。
4. `accepted` / `applied` entry 必須有 reviewer 或等價審核來源。
5. 任何 `runtimeVsSource.score < 0.95` 或 `runtimeVsSource.score:null` 都必須產生 candidate。
6. 任何 linked CSS 未被 converter 攝取、source token 未被使用、unsupported CSS 造成大面積失真，都必須產生 candidate。
7. 可自動套用的規則必須標記 `safety: auto-applicable`；會改變視覺判準、waiver 或資產化策略者必須標記 `safety: reviewer-required`。
8. 下一輪 skill 只能自動套用 `status: accepted` 且 `safety: auto-applicable` 的規則，並且仍需重新跑完整 gate。

## Entry Template

```markdown
## Entry YYYY-MM-DD — <suggestion-id>

- suggestion id: `<suggestion-id>`
- status: `candidate|accepted|rejected|applied`
- safety: `auto-applicable|reviewer-required`
- reviewer: `(pending)`
- source package: `<source-dir>` / `<main-html>`
- screenId: `<screen-id>`
- source hashes: `html=<hash>` / `css=<hash>` / `tokens=<hash>`
- before: `<what failed; include runtimeVsSource score if available>`
- top offenders:
  - `<zone or selector>` — `<property/token/asset>` — `<impact>`
- proposed rule: `<parser / mapper / token / assetize / waiver / validation rule>`
- verification:
  - `<command>`
- impact: `<expected improvement and risk>`
```

## Entry 2026-04-28 — v2-source-package-and-editor-gate-baseline

- suggestion id: `v2-source-package-and-editor-gate-baseline-2026-04-28`
- status: `accepted`
- safety: `reviewer-required`
- reviewer: `user-requested-baseline`
- source package: `Design System 3` / `ui_kits/character/index.html`
- screenId: `character-ds3-main`
- source hashes: `pending-tooling`
- before: 舊流程可取得 browser `sourceVsUcuf` 高分，但 `runtimeVsSource.score` 沒有實際計算；`runtime-screen-diff.js --runtime` 只把 runtime PNG 放進 board，score 仍為 null。
- top offenders:
  - `source package` — `ui-design-tokens.json` 未作為 converter authority — token 來源可能漂移。
  - `source package` — `colors_and_type.css` 只被 browser snapshot 看見，靜態 parser 未必攝取 — CSS variables / font / global type 可能丟失。
  - `runtime visual gate` — `sourceVsUcufPreview` 被誤當 final pass — Cocos Editor 實畫面差異被漏掉。
- proposed rule: v2 正式流程必須以 `--source-dir` 驗證三件套，並以 HTML source screenshot vs Cocos Editor screenshot 的 `runtimeVsSource.score >= 0.95` 作為最終通過條件。
- verification:
  - `node tools_node/run-ui-workflow.js --workflow html-to-ucuf --source-dir "Design System 3" --main-html "ui_kits/character/index.html" --screen-id character-ds3-main --bundle lobby_ui --editor-screenshot <png>`
  - `node tools_node/compare-html-to-cocos-editor.js --source-dir "Design System 3" --main-html "ui_kits/character/index.html" --screen-id character-ds3-main --editor-screenshot <png> --output artifacts/runtime-diff/character-ds3`
- impact: 建立 v2 正式 gate，避免 browser preview pass 被誤用為 Cocos runtime pass。實作前不得把此 entry 視為已完成工具能力。

## Entry 2026-04-28 — html-cocos-runtime-gap-fdebac96

- suggestion id: `html-cocos-runtime-gap-fdebac96`
- status: `candidate`
- safety: `reviewer-required`
- reviewer: `(pending)`
- source package: `Design System 3` / `ui_kits/character/index.html`
- screenId: `character-ds3-main`
- source hashes: `html=sha256:2d6bfca1ae9c76f2d3ddb85cdcd202f4` / `css=sha256:40af62e125634c89c2f9b13262178782` / `tokens=sha256:a09e5c5b44eb9ab25e2da79b23b0e8ee`
- before: `runtimeVsSource.score=0.3986082175925926`，threshold=`0.95`
- top offenders:
  - `src` — `unsupported` — `css unsupported occurrences=3`
  - `background` — `assetize` — `css assetize occurrences=2`
  - `--accent-gold` — `unsupported` — `css unsupported occurrences=1`
  - `--accent-gold-cta` — `unsupported` — `css unsupported occurrences=1`
  - `--accent-gold-light` — `unsupported` — `css unsupported occurrences=1`
  - `--bg` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-deep` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-mid` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-navy` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-olive` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-lg` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-md` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-sm` — `unsupported` — `css unsupported occurrences=1`
  - `--divider` — `unsupported` — `css unsupported occurrences=1`
  - `--divider-parchment` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-fast` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-norm` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-slow` — `unsupported` — `css unsupported occurrences=1`
  - `--ease-default` — `unsupported` — `css unsupported occurrences=1`
  - `--ease-enter` — `unsupported` — `css unsupported occurrences=1`
- proposed rule: 依 top offenders 補齊 CSS mapper、assetize 或 runtime skin layer 後重跑 HTML vs Cocos Editor visual gate。
- verification:
  - `node tools_node/compare-html-to-cocos-editor.js --source-dir "Design System 3" --main-html "ui_kits/character/index.html" --screen-id character-ds3-main --editor-screenshot <png> --output artifacts/ui-qa/m11-baseline`
- impact: pending — 需 reviewer 接受後才可自動套用。

## Entry 2026-04-28 — html-cocos-runtime-gap-0f735d1d

- suggestion id: `html-cocos-runtime-gap-0f735d1d`
- status: `candidate`
- safety: `reviewer-required`
- reviewer: `(pending)`
- source package: `Design System 3` / `ui_kits/character/index.html`
- screenId: `character-ds3-main`
- source hashes: `html=sha256:2d6bfca1ae9c76f2d3ddb85cdcd202f4` / `css=sha256:40af62e125634c89c2f9b13262178782` / `tokens=sha256:a09e5c5b44eb9ab25e2da79b23b0e8ee`
- before: `runtimeVsSource.score=0.3478853202160494`，threshold=`0.95`
- top offenders:
  - `src` — `unsupported` — `css unsupported occurrences=3`
  - `background` — `assetize` — `css assetize occurrences=2`
  - `--accent-gold` — `unsupported` — `css unsupported occurrences=1`
  - `--accent-gold-cta` — `unsupported` — `css unsupported occurrences=1`
  - `--accent-gold-light` — `unsupported` — `css unsupported occurrences=1`
  - `--bg` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-deep` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-mid` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-navy` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-olive` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-lg` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-md` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-sm` — `unsupported` — `css unsupported occurrences=1`
  - `--divider` — `unsupported` — `css unsupported occurrences=1`
  - `--divider-parchment` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-fast` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-norm` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-slow` — `unsupported` — `css unsupported occurrences=1`
  - `--ease-default` — `unsupported` — `css unsupported occurrences=1`
  - `--ease-enter` — `unsupported` — `css unsupported occurrences=1`
- proposed rule: 依 top offenders 補齊 CSS mapper、assetize 或 runtime skin layer 後重跑 HTML vs Cocos Editor visual gate。
- verification:
  - `node tools_node/compare-html-to-cocos-editor.js --source-dir "Design System 3" --main-html "ui_kits/character/index.html" --screen-id character-ds3-main --editor-screenshot <png> --output artifacts/ui-qa/m13-transparent`
- impact: pending — 需 reviewer 接受後才可自動套用。

## Entry 2026-04-28 — html-cocos-runtime-gap-6eba68cf

- suggestion id: `html-cocos-runtime-gap-6eba68cf`
- status: `candidate`
- safety: `reviewer-required`
- reviewer: `(pending)`
- source package: `Design System 3` / `ui_kits/character/index.html`
- screenId: `character-ds3-main`
- source hashes: `html=sha256:2d6bfca1ae9c76f2d3ddb85cdcd202f4` / `css=sha256:40af62e125634c89c2f9b13262178782` / `tokens=sha256:a09e5c5b44eb9ab25e2da79b23b0e8ee`
- before: `runtimeVsSource.score=0.3791295331790123`，threshold=`0.95`
- top offenders:
  - `src` — `unsupported` — `css unsupported occurrences=3`
  - `background` — `assetize` — `css assetize occurrences=2`
  - `--accent-gold` — `unsupported` — `css unsupported occurrences=1`
  - `--accent-gold-cta` — `unsupported` — `css unsupported occurrences=1`
  - `--accent-gold-light` — `unsupported` — `css unsupported occurrences=1`
  - `--bg` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-deep` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-mid` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-navy` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-olive` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-lg` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-md` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-sm` — `unsupported` — `css unsupported occurrences=1`
  - `--divider` — `unsupported` — `css unsupported occurrences=1`
  - `--divider-parchment` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-fast` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-norm` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-slow` — `unsupported` — `css unsupported occurrences=1`
  - `--ease-default` — `unsupported` — `css unsupported occurrences=1`
  - `--ease-enter` — `unsupported` — `css unsupported occurrences=1`
- proposed rule: 依 top offenders 補齊 CSS mapper、assetize 或 runtime skin layer 後重跑 HTML vs Cocos Editor visual gate。
- verification:
  - `node tools_node/compare-html-to-cocos-editor.js --source-dir "Design System 3" --main-html "ui_kits/character/index.html" --screen-id character-ds3-main --editor-screenshot <png> --output artifacts/ui-qa/m13-zone-aware`
- impact: pending — 需 reviewer 接受後才可自動套用。

## Entry 2026-04-28 — html-cocos-runtime-gap-1af0c798

- suggestion id: `html-cocos-runtime-gap-1af0c798`
- status: `candidate`
- safety: `reviewer-required`
- reviewer: `(pending)`
- source package: `Design System 3` / `ui_kits/character/index.html`
- screenId: `character-ds3-main`
- source hashes: `html=sha256:2d6bfca1ae9c76f2d3ddb85cdcd202f4` / `css=sha256:40af62e125634c89c2f9b13262178782` / `tokens=sha256:a09e5c5b44eb9ab25e2da79b23b0e8ee`
- before: `runtimeVsSource.score=0.09067949459876543`，threshold=`0.95`
- top offenders:
  - `src` — `unsupported` — `css unsupported occurrences=3`
  - `background` — `assetize` — `css assetize occurrences=2`
  - `--accent-gold` — `unsupported` — `css unsupported occurrences=1`
  - `--accent-gold-cta` — `unsupported` — `css unsupported occurrences=1`
  - `--accent-gold-light` — `unsupported` — `css unsupported occurrences=1`
  - `--bg` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-deep` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-mid` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-navy` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-olive` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-lg` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-md` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-sm` — `unsupported` — `css unsupported occurrences=1`
  - `--divider` — `unsupported` — `css unsupported occurrences=1`
  - `--divider-parchment` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-fast` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-norm` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-slow` — `unsupported` — `css unsupported occurrences=1`
  - `--ease-default` — `unsupported` — `css unsupported occurrences=1`
  - `--ease-enter` — `unsupported` — `css unsupported occurrences=1`
- proposed rule: 依 top offenders 補齊 CSS mapper、assetize 或 runtime skin layer 後重跑 HTML vs Cocos Editor visual gate。
- verification:
  - `node tools_node/compare-html-to-cocos-editor.js --source-dir "Design System 3" --main-html "ui_kits/character/index.html" --screen-id character-ds3-main --editor-screenshot <png> --output artifacts/ui-qa/m13-bg-zones`
- impact: pending — 需 reviewer 接受後才可自動套用。

## Entry 2026-04-28 — html-cocos-runtime-gap-6a1ebe67

- suggestion id: `html-cocos-runtime-gap-6a1ebe67`
- status: `candidate`
- safety: `reviewer-required`
- reviewer: `(pending)`
- source package: `Design System 3` / `ui_kits/character/index.html`
- screenId: `character-ds3-main`
- source hashes: `html=sha256:2d6bfca1ae9c76f2d3ddb85cdcd202f4` / `css=sha256:40af62e125634c89c2f9b13262178782` / `tokens=sha256:a09e5c5b44eb9ab25e2da79b23b0e8ee`
- before: `runtimeVsSource.score=0.11187355324074075`，threshold=`0.95`
- top offenders:
  - `src` — `unsupported` — `css unsupported occurrences=3`
  - `background` — `assetize` — `css assetize occurrences=2`
  - `--accent-gold` — `unsupported` — `css unsupported occurrences=1`
  - `--accent-gold-cta` — `unsupported` — `css unsupported occurrences=1`
  - `--accent-gold-light` — `unsupported` — `css unsupported occurrences=1`
  - `--bg` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-deep` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-mid` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-navy` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-olive` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-lg` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-md` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-sm` — `unsupported` — `css unsupported occurrences=1`
  - `--divider` — `unsupported` — `css unsupported occurrences=1`
  - `--divider-parchment` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-fast` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-norm` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-slow` — `unsupported` — `css unsupported occurrences=1`
  - `--ease-default` — `unsupported` — `css unsupported occurrences=1`
  - `--ease-enter` — `unsupported` — `css unsupported occurrences=1`
- proposed rule: 依 top offenders 補齊 CSS mapper、assetize 或 runtime skin layer 後重跑 HTML vs Cocos Editor visual gate。
- verification:
  - `node tools_node/compare-html-to-cocos-editor.js --source-dir "Design System 3" --main-html "ui_kits/character/index.html" --screen-id character-ds3-main --editor-screenshot <png> --output artifacts/ui-qa/m13-paint-right`
- impact: pending — 需 reviewer 接受後才可自動套用。

## Entry 2026-04-28 — html-cocos-runtime-gap-f530a61c

- suggestion id: `html-cocos-runtime-gap-f530a61c`
- status: `candidate`
- safety: `reviewer-required`
- reviewer: `(pending)`
- source package: `Design System 3` / `ui_kits/character/index.html`
- screenId: `character-ds3-main`
- source hashes: `html=sha256:2d6bfca1ae9c76f2d3ddb85cdcd202f4` / `css=sha256:40af62e125634c89c2f9b13262178782` / `tokens=sha256:a09e5c5b44eb9ab25e2da79b23b0e8ee`
- before: `runtimeVsSource.score=0.3791295331790123`，threshold=`0.95`
- top offenders:
  - `src` — `unsupported` — `css unsupported occurrences=3`
  - `background` — `assetize` — `css assetize occurrences=2`
  - `--accent-gold` — `unsupported` — `css unsupported occurrences=1`
  - `--accent-gold-cta` — `unsupported` — `css unsupported occurrences=1`
  - `--accent-gold-light` — `unsupported` — `css unsupported occurrences=1`
  - `--bg` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-deep` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-mid` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-navy` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-olive` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-lg` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-md` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-sm` — `unsupported` — `css unsupported occurrences=1`
  - `--divider` — `unsupported` — `css unsupported occurrences=1`
  - `--divider-parchment` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-fast` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-norm` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-slow` — `unsupported` — `css unsupported occurrences=1`
  - `--ease-default` — `unsupported` — `css unsupported occurrences=1`
  - `--ease-enter` — `unsupported` — `css unsupported occurrences=1`
- proposed rule: 依 top offenders 補齊 CSS mapper、assetize 或 runtime skin layer 後重跑 HTML vs Cocos Editor visual gate。
- verification:
  - `node tools_node/compare-html-to-cocos-editor.js --source-dir "Design System 3" --main-html "ui_kits/character/index.html" --screen-id character-ds3-main --editor-screenshot <png> --output artifacts/ui-qa/m13-final`
- impact: pending — 需 reviewer 接受後才可自動套用。

## Entry 2026-04-28 — html-cocos-runtime-gap-8072ff72

- suggestion id: `html-cocos-runtime-gap-8072ff72`
- status: `candidate`
- safety: `reviewer-required`
- reviewer: `(pending)`
- source package: `Design System 3/design_handoff` / `character/index.html`
- screenId: `character-ds3-main`
- source hashes: `html=sha256:6d7d7f1f1560f7313eb573689d5d3cc9` / `css=sha256:40af62e125634c89c2f9b13262178782` / `tokens=sha256:a09e5c5b44eb9ab25e2da79b23b0e8ee`
- before: `runtimeVsSource.score=0.3791295331790123`，threshold=`0.95`
- top offenders:
  - `src` — `unsupported` — `css unsupported occurrences=3`
  - `background` — `assetize` — `css assetize occurrences=2`
  - `--accent-gold` — `unsupported` — `css unsupported occurrences=1`
  - `--accent-gold-cta` — `unsupported` — `css unsupported occurrences=1`
  - `--accent-gold-light` — `unsupported` — `css unsupported occurrences=1`
  - `--bg` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-deep` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-mid` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-navy` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-olive` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-lg` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-md` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-sm` — `unsupported` — `css unsupported occurrences=1`
  - `--divider` — `unsupported` — `css unsupported occurrences=1`
  - `--divider-parchment` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-fast` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-norm` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-slow` — `unsupported` — `css unsupported occurrences=1`
  - `--ease-default` — `unsupported` — `css unsupported occurrences=1`
  - `--ease-enter` — `unsupported` — `css unsupported occurrences=1`
- proposed rule: 依 top offenders 補齊 CSS mapper、assetize 或 runtime skin layer 後重跑 HTML vs Cocos Editor visual gate。
- verification:
  - `node tools_node/compare-html-to-cocos-editor.js --source-dir "Design System 3/design_handoff" --main-html "character/index.html" --screen-id character-ds3-main --editor-screenshot <png> --output artifacts/ui-qa/general-detail-ds3-cutover`
- impact: pending — 需 reviewer 接受後才可自動套用。

## Entry 2026-04-28 — html-cocos-runtime-gap-cf4ee754

- suggestion id: `html-cocos-runtime-gap-cf4ee754`
- status: `candidate`
- safety: `reviewer-required`
- reviewer: `(pending)`
- source package: `Design System 3/design_handoff` / `character/index.html`
- screenId: `character-ds3-main`
- source hashes: `html=sha256:6d7d7f1f1560f7313eb573689d5d3cc9` / `css=sha256:40af62e125634c89c2f9b13262178782` / `tokens=sha256:a09e5c5b44eb9ab25e2da79b23b0e8ee`
- before: `runtimeVsSource.score=0.3792192322530864`，threshold=`0.95`
- top offenders:
  - `src` — `unsupported` — `css unsupported occurrences=3`
  - `background` — `assetize` — `css assetize occurrences=2`
  - `--accent-gold` — `unsupported` — `css unsupported occurrences=1`
  - `--accent-gold-cta` — `unsupported` — `css unsupported occurrences=1`
  - `--accent-gold-light` — `unsupported` — `css unsupported occurrences=1`
  - `--bg` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-deep` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-mid` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-navy` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-olive` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-lg` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-md` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-sm` — `unsupported` — `css unsupported occurrences=1`
  - `--divider` — `unsupported` — `css unsupported occurrences=1`
  - `--divider-parchment` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-fast` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-norm` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-slow` — `unsupported` — `css unsupported occurrences=1`
  - `--ease-default` — `unsupported` — `css unsupported occurrences=1`
  - `--ease-enter` — `unsupported` — `css unsupported occurrences=1`
- proposed rule: 依 top offenders 補齊 CSS mapper、assetize 或 runtime skin layer 後重跑 HTML vs Cocos Editor visual gate。
- verification:
  - `node tools_node/compare-html-to-cocos-editor.js --source-dir "Design System 3/design_handoff" --main-html "character/index.html" --screen-id character-ds3-main --editor-screenshot <png> --output artifacts/ui-qa/general-detail-ds3-cutover`
- impact: pending — 需 reviewer 接受後才可自動套用。

## Entry 2026-04-28 — html-cocos-runtime-gap-2a016f82

- suggestion id: `html-cocos-runtime-gap-2a016f82`
- status: `candidate`
- safety: `reviewer-required`
- reviewer: `(pending)`
- source package: `Design System 3/design_handoff` / `character/index.html`
- screenId: `character-ds3-main`
- source hashes: `html=sha256:6d7d7f1f1560f7313eb573689d5d3cc9` / `css=sha256:40af62e125634c89c2f9b13262178782` / `tokens=sha256:a09e5c5b44eb9ab25e2da79b23b0e8ee`
- before: `runtimeVsSource.score=0.3792192322530864`，threshold=`0.95`
- top offenders:
  - `src` — `unsupported` — `css unsupported occurrences=3`
  - `background` — `assetize` — `css assetize occurrences=2`
  - `--accent-gold` — `unsupported` — `css unsupported occurrences=1`
  - `--accent-gold-cta` — `unsupported` — `css unsupported occurrences=1`
  - `--accent-gold-light` — `unsupported` — `css unsupported occurrences=1`
  - `--bg` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-deep` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-mid` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-navy` — `unsupported` — `css unsupported occurrences=1`
  - `--bg-olive` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-lg` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-md` — `unsupported` — `css unsupported occurrences=1`
  - `--btn-sm` — `unsupported` — `css unsupported occurrences=1`
  - `--divider` — `unsupported` — `css unsupported occurrences=1`
  - `--divider-parchment` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-fast` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-norm` — `unsupported` — `css unsupported occurrences=1`
  - `--dur-slow` — `unsupported` — `css unsupported occurrences=1`
  - `--ease-default` — `unsupported` — `css unsupported occurrences=1`
  - `--ease-enter` — `unsupported` — `css unsupported occurrences=1`
- proposed rule: 依 top offenders 補齊 CSS mapper、assetize 或 runtime skin layer 後重跑 HTML vs Cocos Editor visual gate。
- verification:
  - `node tools_node/compare-html-to-cocos-editor.js --source-dir "Design System 3/design_handoff" --main-html "character/index.html" --screen-id character-ds3-main --editor-screenshot <png> --output artifacts/ui-qa/general-detail-ds3-cutover`
- impact: pending — 需 reviewer 接受後才可自動套用。
