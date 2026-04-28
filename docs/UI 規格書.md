<!-- doc_id: doc_ui_0027 -->

> **2026-04-26 覆寫裁定：人物頁與治理 UI**
>
> 1. 武將人物頁不顯示武將 `Level / EXP / 突破`。
> 2. `命 / Bloodline` 頁顯示英靈卡命槽、主卡切換、共鳴光效、14 人祖先血統圖與世家入口。
> 3. `寶 / GEAR` 頁顯示一般裝備六槽、傳家寶、道具與裝備評價；`兵 / Aptitude` 頁顯示兵種 / 地形 / 天氣適性、戰鬥定位與虎符槽。
> 4. 戰場 HUD 顯示軍勢、糧草、計謀點與場上部隊數；部隊卡顯示投入兵力與糧草消耗。
> 5. 治理頁以人口核心儀表盤呈現人口對金錢、糧草、城市兵源上限與補兵速度的貢獻。
# UI 規格書

## 1. 文件目的

本文件只定義新手開場的畫面、演出、互動與狀態，不包含資料欄位與程式模組實作。

目標是讓美術、前端與演出設計能直接對齊同一套 UI 規則，避免畫面風格分裂或資訊過載。

## 2. UI 設計目標

- 建立強烈的情懷錨點
- 讓玩家明確感受到「進入夢境」的過場
- 讓名將、紅顏、血統、商業化入口在視覺上完全分層
- 讓新手在前 15 分鐘內看懂自己正在做什麼
- 正式主張調整為「懷舊只是入口，祖靈命紋才是主體」
- UI 在既有骨架上透過色調、紋樣、badge 與提示層微調世界觀，不走全面翻新

## 3. UI 分段

### 3.1 開場序列

- 黑場古文畫面
- Win95 信件畫面
- 像素三國回憶畫面
- 漩渦吸入轉場畫面
- 宿命轉蛋主畫面

### 3.2 角色序列

- 初始名將展示卡
- 名將登場對話框
- 紅顏角色卡
- 趕路中的紅顏提示圖示
- 文官或支援角色提示卡

### 3.2.1 角色展示雙軌

- `日常人物頁`
  - 人物為主角
  - 屬性、戰鬥定位、血脈摘要可快速閱讀
  - 下方可固定放 5~6 格故事條
- `血脈命鏡頁`
  - 用於 Loading、覺醒、升星、二轉突破
  - 世界觀與命格演出優先於資訊效率

### 3.3 系統序列

- 因子六角圖面板
- 祖先矩陣面板
- 子嗣預測面板
- 血統成長提示面板
- 因子解鎖彈出視窗
- 命紋靈獸虛影提示層
- 祖紋命篆點亮提示層
- 晨報摘要提示層
- 武將日誌抽屜層
- 派遣整備掛點
- `歷史趣聞 / 血脈傳聞` 故事抽屜層

### 3.4 商業序列

- 0.99 小額破冰彈窗
- 29.99 全明星包彈窗
- 趕路倒數提醒視窗
- 主畫面常駐倒數圖示
- 重新抽取與確認彈窗

### 3.4.1 世界觀過場序列

- `血脈命鏡` Loading 畫面
- 名將升星 / 二轉突破過場圖
- 英靈血脈覺醒過場圖
- 未持有武將命格展示 Loading

### 3.5 戰鬥序列

- 5 路 x 8 格戰場主畫面
- 單位部署提示
- 因子觸發字卡
- 勝敗結算畫面
- 教學提示浮窗

## 4. 介面互動規則

- 信件畫面必須先引導點擊，再進入下一幕
- 像素畫面與高畫質畫面之間必須有明顯轉場
- 名將與紅顏不得在同一個主介面混雜顯示
- 因子與血統畫面需要讓數值資訊一眼可讀
- 倒數圖示必須常駐在玩家可見區域
- 點擊武將立繪後，應允許短暫顯示命紋靈獸虛影與祖紋命篆，再滑出故事抽屜
- 故事抽屜預設分成 `歷史趣聞` 與 `血脈傳聞` 兩個入口，不直接混成一段長文
- 晨報優先作為登入後摘要層；武將日誌與派遣整備優先掛在大廳或人物頁抽屜，不預設強制拆成獨立 fullscreen

## 5. UI 狀態規則

- 初始：黑場與信件
- 召喚：轉蛋與名將展示
- 教學：戰鬥與因子提示
- 深化：血統與祖先矩陣
- 留存：紅顏倒數與商業入口

## 6. 視覺風格規則

- 信件要像 Win95，但背景可以帶水墨或懷舊煙雲
- 轉蛋區與紅顏區要明確區隔
- 因子與血統畫面要避免太花，資訊要一眼看懂
- 倒數要放在玩家每天都能看到的位置
- 像素到高畫質的反差要大，但轉場要有節奏
- 血統 / 因子 UI 視覺語言改用 `祖紋命篆 + 命紋靈獸 + 祠堂 / 玉刻材質`，避免 generic 科技線條
- 正式色調建議優先微調為 `暗金 / 玉白 / 月銀 / 墨青 / 暗赤`
- 兩張血統 UI 參考圖只取其版型、資訊密度與譜系分層，不直接沿用其科幻材質與渦流背景
- `血脈命鏡` 過場圖採品牌級高概念畫面，允許比日常人物頁更重世界觀，但仍不可滑向科幻、恐怖或 generic fantasy portal
- `日常人物頁` 正式母型為：左人物、右主資訊、下方 5~6 格故事條；血脈元素是深層人格區，不是第二主角
- `日常人物頁` 在正式實作上屬於 `GeneralDetail` 的預設首頁 / 總覽態，必須與多分頁詳情整合，不另立平行正式人物系統
- `血脈逸聞` 屬於人物頁的故事層，可掛在日常人物頁的固定故事條或抽屜，不取代 `GeneralDetail` 主體
- `血脈命鏡頁` 正式母型為：左表象面、右血脈面、中央命鏡裂隙、中央定心者、下方 5 格命運故事帶
- `GeneralDetail` 的 tab bar 屬於導航 chrome，不應把 `日常人物頁` 首頁殼層縮成右側窄欄子卡
- `GeneralDetail` 正式 chrome 收斂為 `將 / 屬 / 命 / 技 / 寶 / 兵` 六頁；`命 / Bloodline` 是英靈卡與血脈頁，`寶 / GEAR` 是一般裝備 / 傳家寶 / 道具頁，`兵 / Aptitude` 是虎符與戰場適性頁
- overview 不再承接英靈卡 / 虎符摘要卡，這些資訊正式移到 `命` 頁與 `兵` 頁的正式模組區
- `英靈陳列室` 與家族英靈展示列必須保留死亡快照，讓玩家可直接查看英勇事蹟、完整屬性與技能記錄，且頁面需支援排序與篩選
- 其他 tab 預設沿用同一個人物頁母型與 frame family，優先切換內容模組，不預設為每個 tab 各畫一套全新正式畫面

## 7. UI 驗收重點

- 每個畫面是否有明確的進場與退場
- 文字是否能在手機上清楚閱讀
- 轉場是否足夠有節奏感
- 商業化視窗是否不會遮蔽核心教學
- 主畫面常駐資訊是否足夠簡潔

## 8. 延伸場景 UI 共識（整併早期討論）

> **整併來源**：三國傳承 UI 布局說明書.md (doc_spec_0074)
> **衝突處理**：本章補充整體 UI 語彙與後續場景延伸，不改變本文件以新手開場為主的定位。

- 開場結束後的大廳，不應退化成純按鈕清單，而應延續「幕府議事廳 / 創業團隊中樞」的沉浸式空間感。
- 許願 / 商城相關畫面優先包裝為「誠心祭壇 / 奏摺 / 家祠」等世界觀內 UI，而非直接使用現代商城風格。
- 主戰場、小兵支援列與大廳中的可互動角色，盡量維持一致的 2.5D 立牌 / 半平面角色語彙，降低美術風格斷裂。
- 大廳中的雙牆任務、世界沙盤與官職進度，應視為同一個中樞畫面的三個正式資訊層，不得拆成彼此無關的雜散按鈕頁。
- 大廳雙牆任務點擊後必須打開中央任務詳情視窗，視窗以 800×900px 的 `dialog-card` / `Modal` 呈現，並支援情報度、武將下拉、獎勵 / 耗費、四個行動按鈕與 X / ESC / 背景點擊關閉。
- 大廳武將的「自告奮勇」預設只作彩蛋互動與氛圍強化，不應在母 UI 規格中硬寫固定成功率或固定獎勵公式。
- 武將的「自告奮勇 / 毛遂自薦」只作指派提示與視覺標記，不應改寫任務結算公式；若有自薦者，應在任務詳情視窗中優先提示。
- 武將日誌、晨報摘要與派遣整備屬於同一條「生活感 / 離線互動」資訊線，正式入口優先掛在 `LobbyMain` 與人物頁抽屜，不預設另起平行人物系統。
- 所有延伸 UI 若要正式落地，仍需回寫各自對應文件，如 `主戰場UI規格書.md` (doc_ui_0001)、`UI技術規格書.md` (doc_ui_0049) 與相關 ui-spec JSON。

### 8.1 延伸系統 UI 入口清單

> **2026-03-30 補充**：以下系統已有規格書但尚未建立 ui-spec JSON 契約，列出 UI 入口需求供後續接線。

| 系統 | 預計 UI 入口 | ui-spec JSON（待建） | 規格來源 |
|---|---|---|---|
| 名士預言系統 | 「占卜結果」面板（從結緣 / 大廳進入） | `oracle-result-main.json` | 名士預言系統.md (doc_spec_0006) H 節 UI 字串 |
| 大廳系統 | 「幕府大廳」主入口與雙牆 / 沙盤 / 官職掛點 | `lobby-main-main.json` | 大廳系統.md (doc_spec_0002)、官職系統.md (doc_spec_0014) |
| 大廳任務詳情彈窗 | 「軍事 / 內政任務詳情」中央彈窗；固定 800×900、`dialog-card` / `Modal`、情報度模糊與武將指派 | `lobby-mission-detail-dialog-screen.json` | 大廳系統.md (doc_spec_0002) |
| 名將挑戰賽 | 「賽季卡 / 月度場景賽掛點」；本輪先維持 pending contract，不先寫死獨立 fullscreen | `pending contract: tournament-season-card` | 名將挑戰賽系統.md (doc_spec_0007)、UI 規格補遺_2026-04-11_大廳晨報與人物日誌pending.md (doc_ui_0030) |
| 經濟保底提示 | 「地窖保護 / 每日補貼提示」；本輪先維持大廳 banner / badge contract | `pending contract: economy-subsidy-banner` | 經濟系統.md (doc_spec_0032)、UI 規格補遺_2026-04-11_大廳晨報與人物日誌pending.md (doc_ui_0030) |
| 轉蛋系統 | 「雙池定位導覽 / 死亡傳承提示 / Banner 商業主視覺」；維持在既有 `GachaMain` 主畫面內，不另開平行說明頁 | `pending contract: gacha-pool-positioning-brief / gacha-banner-hero-art-policy` | 轉蛋系統.md (doc_spec_0042)、UI 規格補遺_2026-04-11_培育戰場轉蛋pending.md (doc_ui_0031) |
| 許願池商城 | 「誠心祭壇」全屏畫面 | `shop-wishpool-main.json` | 經濟系統.md (doc_spec_0032)、keep.md (doc_index_0011) |
| 虎符圖鑑 | 「虎符圖鑑」正式頁面（34 筆名錄已接入正式區） | `elite-troop-codex-screen.json` | 兵種（虎符）系統.md (doc_spec_0012) 功能清單 #11 / 卡圖正式區 |
| 培育系統 | 「培育 36 回合」主畫面；三階段學年與畢業標籤先定義成可共用 contract，不先承諾額外 fullscreen | `nurture-session-main.json` + `pending contract: nurture-phase-block-header / graduation-tags-strip` | 培育系統.md (doc_spec_0026) E 節、UI 規格補遺_2026-04-11_培育戰場轉蛋pending.md (doc_ui_0031) |
| 結緣系統 | 「結緣配置」面板；`Peace_Lineage` 模式與退役保種資格先收斂成摘要 chip / note，不另開宗廟或家系子頁 | `bonding-setup-main.json` + `pending contract: bonding-lineage-mode-chip` | 結緣系統（配種）.md (doc_spec_0028) E 節、UI 規格補遺_2026-04-11_培育戰場轉蛋pending.md (doc_ui_0031) |
| 戰場部署 | 已有 DeployPanel（scene 手動綁定） | — (已實現於 BattleScene) | 戰場部署系統.md (doc_spec_0040) |
| 關卡設計 / 戰前偵查 | 「參謀官 HUD 摘要 / 後勤官補給摘要 / 關卡回收摘要」；先維持 pending contract，不直接拆出新 fullscreen | `pending contract: strategist-hud-summary / stage-salvage-summary` | 關卡設計系統.md (doc_spec_0044)、主戰場UI規格書.md (doc_ui_0001)、UI 規格補遺_2026-04-11_培育戰場轉蛋pending.md (doc_ui_0031) |
| 奧義演出 | 全屏演出層（覆蓋戰場） | `ultimate-cutscene-main.json` | 奧義系統.md (doc_spec_0030) F 節 |
| 武將人物頁 | 「將 / 屬 / 命 / 技 / 寶 / 兵」六分頁；`命` 頁承接英靈卡與血脈、`寶` 頁承接一般裝備 / 傳家寶 / 道具、`兵` 頁承接虎符與戰場適性 | `general-detail-unified-screen.json` | 武將人物介面規格書.md (doc_ui_0012)、武將裝備道具系統.md (doc_spec_0174)、英靈世家系統.md (doc_spec_0022)、兵種（虎符）系統.md (doc_spec_0012) |
| 血脈逸聞 | 「歷史趣聞 / 血脈傳聞」抽屜 | `general-bloodline-vignette-main.json` | 武將人物介面規格書.md (doc_ui_0012) § 8.4 |
| 命槽英靈卡 / 虎符詳情 | 「命槽英靈卡 / 虎符」詳情頁 | `spirit-tally-detail-main.json` | 兵種（虎符）系統.md (doc_spec_0012)、英靈世家系統.md (doc_spec_0022) |
| 英靈陳列室 / 家族展示列 | 「家族英靈展示列」；每張卡都帶死亡快照、英勇事蹟、完整屬性與技能；支援排序與篩選 | `spirit-collection-room-main.json` | 英靈世家系統.md (doc_spec_0022)、武將人物介面規格書.md (doc_ui_0012) |
| 血脈命鏡過場 | 「Loading / 覺醒 / 升星 / 未持有預覽」命格展示頁，優先共用 `bloodline-mirror-states-v1` content contract，並透過 `bloodline-mirror-state-content` schema 驗證 | `bloodline-mirror-loading-main.json` | 血脈命鏡過場載入規格書.md (doc_ui_0005) |
| 武將日誌與離線互動 | 「晨報摘要 / 武將日誌抽屜 / 派遣整備掛點」；本輪先維持 pending contract，不先寫死是否獨立成 fullscreen，並與大廳賽季卡 / 經濟保底提示共用待定補遺 | `pending contract: morning-report / general-journal / dispatch-board` | 武將日誌與離線互動系統.md (doc_spec_0015)、UI 規格補遺_2026-04-11_大廳晨報與人物日誌pending.md (doc_ui_0030) |

> 各系統正式建立 ui-spec JSON 時，須遵循三層契約規範（layouts / skins / screens），並同步更新 `UI技術規格書.md` (doc_ui_0049) 與 `cross-reference-index.md` (doc_index_0005)。
### 8.2 UI 量產工作流與 Agent 協作入口

> 執行總綱請同步參照 `docs/keep.md (doc_index_0011)` (doc_index_0011) §19。
> 本節是 UI 正式規格中的方法論說明，用來確保美術、技術、Figma、ui-spec 與 Agent 協作都遵守同一套量產邏輯。

#### 8.2.1 正式量產順序

所有新 UI 需求，預設都走以下順序：

1. 選 `template family`
2. 填 `content contract`
3. 套 `skin fragment`
4. 補少量 screen-specific 收尾
5. 做 preview / smoke / acceptance 驗證

這裡的責任分層必須固定：

- `template / layout`：定義穩定結構、導覽骨架、slot 邊界
- `content contract`：定義故事、數值、角色差異、狀態差異
- `skin / fragment`：定義框體、材質、紋樣、色彩、圖像 slot 與 token
- `screen`：定義 route、bundle、atlas policy、family 組裝

#### 8.2.2 何時重用、何時新增 template family

優先重用既有 family。只有在以下情況同時成立時，才考慮新增 template family：

- 畫面導覽模型不同，例如 `dialog`、`detail split`、`rail + detail`
- 穩定 slot 結構不同，無法用既有 family 的 fragment 組裝
- 同類畫面預估會重複出現，不是一次性的單張特例

若只是角色內容不同、文案排列不同、視覺語氣不同、或 tab 內容不同，通常不應新增 template family，而應落回既有 family 的 `content contract`、`skin fragment` 或 module 組裝。

#### 8.2.3 量產加速判準

下列現象代表量產流程正在加速：

- 第二張同 family 畫面的開發時間明顯低於第一張
- 主要修改集中在 config、contract、skin，而不是大量改 `layout JSON`
- runtime 面板程式偏向 binder / mapper / host，沒有為單畫面重寫整支 panel
- Figma `09_Proof Mapping` 欄位可直接轉成 scaffolder config

若開發仍反覆出現大量手改節點、臨時建立 runtime 字框、或為單畫面複製新 family，代表應優先補 template、fragment、schema，而不是繼續堆個案。

#### 8.2.4 建議的加速器

- 建立 `template family catalogue`
- 建立 `content contract schema` 與範例資料
- 建立 `skin fragment library`
- 建立 `proof mapping -> scaffolder` 對映
- 建立每個高頻 family 的 smoke route

這些加速器的目的，是把 UI 生產從「每張畫面重新拼裝」轉成「選母型、填資料、換皮膚、快速驗證」。

#### 8.2.5 Agent 協作入口

所有參與 UI 的 Agent，在開始修改前都必須依序確認：

1. `docs/keep.md (doc_index_0011)` (doc_index_0011)
2. 本文件 §8.2
3. 對應系統正式規格書
4. 對應任務卡與 `docs/ui-quality-todo.json`
5. `docs/cross-reference-index.md (doc_index_0005)` (doc_index_0005)

未完成這個閱讀順序前，不應直接新增 UI family、修改大量 layout、或自行發明新的欄位命名。

#### 8.2.6 文件回寫原則

- 量產方法的新增共識，先回寫 `docs/keep.md (doc_index_0011)` (doc_index_0011) 與本文件。
- 系統專屬規格，回寫到對應正式規格書，例如 `武將人物介面規格書.md` (doc_ui_0012)。
- 程式 / 文件 / ui-spec 的對應關係，回寫 `docs/cross-reference-index.md (doc_index_0005)` (doc_index_0005)。
- 補遺只可作暫時整理，不可長期取代正式母規格。
### 8.2.7 美術資產治理與正式切換

為避免 UI 自動化量產過程把 proof 圖、裁切稿、過渡資產混入正式包體，UI 美術資產必須分為三層：

- `artifacts/ui-source/`
  - AI 原圖、recipe、prompt、compare input、裁切來源。
  - 只作來源管理，不可作為 runtime 載入路徑。
- `assets/resources/.../proof/`
  - 允許 preview / smoke / compare 驗證。
  - 任務進行中可短期引用，但不得視為最終 shipping 資產。
- `assets/resources/.../final/` 或正式 family 路徑
  - 放正式核准資產。
  - 用於可重用 family 與正式版本打包。

正式量產的切換原則如下：

1. 當 `layout / screen / slot-map` 已穩定時，不必等待整頁完成，即可開始切正式 family 資產。
2. 優先切高重用 family，不優先切單頁一次性裝飾。
3. 正式 screen / skin 長期不可依賴 `proof/` 路徑；release 前應視為阻塞。

現階段 `GeneralDetailBloodlineV3` 的正式切圖優先順序：

1. `jade-parchment-panel-final`
2. `crest-medallion-final`
3. `jade-rarity-badge-final`
4. `portrait-stage-final`
5. `story-strip-final`

### 8.2.8 Jade-Parchment Family 品質目標

參考圖的高級感不在於單一外框，而在於同一套 panel family 自然融入整體 UI。`jade-parchment` family 必須至少包含：

- `base fill`
  - 淺羊皮紙底色，不可過白。
- `inner shadow / bevel`
  - 讓主框與內容區自然內沉，而不是硬切。
- `edge wear / paper noise`
  - header、主框、crest 必須共用同一套紙張與歲月痕跡語言。
- `jade cap / corner ornament`
  - 玉飾不是額外貼片，而是 panel kit 的一部分。
- `9-slice 規則`
  - 只拉中段和平邊，不可拉壞角飾與玉件。

Unity 對照：
- 這比較像先做完整的共用 `UI Panel Kit / Theme Kit`，再讓各頁 prefab 套同一套皮，而不是每頁各自拼幾張 Image。


---
## 🗳 MCQ 決策記錄（Q48）

- **問題**：培育教官槽位定義
- **衝突說明**：鏡像時空育才系統設計(doc_spec_0157)寫入學時可快照6位教官；養成系統與教官來源定義(doc_spec_0151)又寫培育時有5個教官插槽；現行培育系統規格書(doc_spec_0026)則定義每輪可更換1名教官，計算式也採單一Mentor。三種結構會改變TP累積、支援卡價值、UI編排與教官重複使用限制，若不拍板，教官系統(doc_spec_0027)與培育UI契約無法實作一致。
- **裁決**：**選項 C** — 固定6教官槽（入學快照鎖定）
- **回寫時間**：2026-04-12 12:52
- **來源**：由 `consolidation-doubt-mcq.js rewrite-all` 自動寫入

---


---
## 🗳 MCQ 決策記錄（Q34）

- **問題**：技能能量與官職條邏輯
- **衝突說明**：技能能量條充能邏輯未定，三種方案對戰場節奏影響截然不同，不拍板則UI動畫觸發條件與戰場代碼無法對齊。
- **裁決**：**選項 D** — 選項 D
- **回寫時間**：2026-04-12 13:16
- **來源**：由 `consolidation-doubt-mcq.js rewrite-all` 自動寫入

---
