# UI-2-0048 Functional Color Palette Spec

## 用途

這份規格把參考圖中反覆出現的功能語意顏色收斂成固定色票。後續生圖 brief 不應再寫「看起來差不多的金色」，而是直接指定色票角色。

## 色票總表

| 色票代號 | 主要用途 | 主色建議 | 輔助色建議 | 適用條件 | 禁用情境 |
|---|---|---|---|---|---|
| `cta-gold` | 主 CTA、里程碑、高價值 | `#D4AF37` | `#FFE088` | 主按鈕、頂級獎勵、SSR / 高價值入口 | 禁用於次級按鈕或一般說明 icon |
| `danger-red` | 危險、敵方、警告 | `#B22222` | `#8B1A1A` | 敵方警示、危險提示、不可逆操作 | 禁用於稀有度或友方增益 |
| `support-green` | 守護、補益、成功 | `#4CAF50` | `#2E8B57` | 補益、保護、佔領、友方成功狀態 | 禁用於高價值獎勵與主 CTA |
| `info-cyan` | 資訊、冷卻、互動節點 | `#21C7FF` | `#54FF48` | 冷卻、資訊、科技感、可互動 pin | 禁用於危險狀態 |
| `rare-purple` | 稀有、法術、神祕 | `#9C27B0` | `#C58CFF` | SR / 法術 / 神祕系功能 | 禁用於戰場警告或 CTA |
| `neutral-ink` | 鎖定、禁用、背景功能 | `#68605A` | `#888888` | disabled、locked、背景層 icon | 禁用於需要強引導的功能 |
| `paper-black` | 淺色面板正文與標題 | `#2D2926` | `#5A4E3E` | parchment / light-surface 的主要文字與 icon | 禁用於深底主 CTA |
| `battle-light` | 深底上的亮字 / 亮 icon | `#E8DFD0` | `#F5EEDC` | 戰場暗背景上的主字與高對比 icon | 禁用於淺底正文 |

## 使用規則

### 規則 1

同一功能跨畫面保持同色票角色。

例子
- 網路狀態 icon 若走 `info-cyan`，在 Lobby 與其他系統提示不應突然變成紫色。
- 危險 / 鎖定 icon 不可用 `cta-gold` 假裝高價值。

### 規則 2

色票先綁語意，再綁材質。

說明
- 可以有 `cta-gold` 的金屬版、紙面版、浮雕版。
- 但不可以因為換材質就把語意改掉。

### 規則 3

同頁最多一個主 `cta-gold` 焦點。

說明
- 這是為了保證焦點穩定。
- 若同頁出現兩個以上金色主 CTA，必須靠尺寸、位置或光效再拉開主次。

## 針對目前功能的建議指派

### Lobby

- `lobby.icon.network`：`info-cyan`
- `lobby.avatar` placeholder：`neutral-ink` + `paper-black`
- `lobby.nav` 主入口 icon：依功能選 `cta-gold` 或 `paper-black`

### 武將介紹 / QuickView

- `quickview.btn.close`：`neutral-ink`
- portrait placeholder：`paper-black` / `neutral-ink`
- 若有 tab / info badge：優先 `paper-black`，僅重要狀態使用 `cta-gold`

### Battle

- action / ultimate 類：`cta-gold`
- 敵方警示：`danger-red`
- 守護 / 補益 / 佔領：`support-green`
- 冷卻 / 資訊 pin：`info-cyan`

## 製作技巧

- 生圖前先選色票代號，再寫 prompt。
- 亮色若放在淺底，需降低飽和度或改成深色字。
- 深色底上的亮字盡量帶 1px 暗描邊。

## 常見失敗點

- 用金色去畫所有重要東西，最後沒有主次。
- 只看單張圖挑色，沒看整頁語意是否打架。
- 同功能在不同頁面改用不同色票，造成學習成本提高。
