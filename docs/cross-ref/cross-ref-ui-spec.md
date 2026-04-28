<!-- doc_id: doc_index_0003 -->

> **2026-04-26 UI 規格索引補充**：人物頁正式收斂為 `將 / 屬 / 命 / 技 / 寶 / 兵` 六頁：`將` 顯示 `名聲 / 官職 / 帶兵上限 / 可用城市兵源 / 預估出征軍勢`，`命` 顯示 14 人祖先血統圖與英靈卡命槽，`寶 / GEAR` 顯示一般裝備 / 傳家寶 / 道具，`兵 / Aptitude` 顯示戰場適性與虎符槽；主戰場 HUD 顯示 `軍勢 / 糧草 / 計謀點 / 場上部隊數`；治理頁顯示 `人口 / 城市兵源 / 補兵速度`。舊的 `Level / EXP / 戰備值主顯示 / Command_Load 主限制` 不再作為正式 UI contract。
# Cross-Reference: UI Spec JSON 鞈蝝Ｗ?

> ? doc_index_0005 ??C 蝭?????渡揣撘? `docs/cross-reference-index.md (doc_index_0005)` (doc_index_0005)??
> ?敺?啗???瑼?Header??
>
> **doc_id ?亥岷**嚗 `node tools_node/resolve-doc-id.js <??閰?` ?交?隞嗡誨???汗 `docs/doc-id-registry.md (doc_other_0001)` (doc_other_0001)??
> ?? **憯葬??doc_id 蝝Ｗ?嚗?*嚗葉??蝔勗歇蝘駁嚗閰Ｗ?蝔梯???resolve-doc-id.js?犖憿霈?脣漲 ??`docs/cross-ref/cross-ref-?脣漲.md (doc_index_0017)` (doc_index_0017)

## C. UI Spec JSON 鞈蝝Ｗ?嚗ssets/resources/ui-spec/嚗?

> 銝惜??嚗layouts/` 蝭暺邦 ??`skins/` 憭?鞈? ??`screens/` 蝯?+鞈?蝬?  
> Bundle: `lobby_ui`嚗tlas ??閬?瑼?`atlasPolicy` 甈?

### C-0. UI ?辣撠箏站憟?嚗憓?2026-04-09嚗?

| ?辣 | ?券?|
|------|------|
| doc_ui_0038 | **Repo 蝝銝撠箏站?靘?**嚗嗾雿??箏憿?FX/SS/SR/TR/LC/DI嚗itle A/B 鈭?閬???隞嗆?皞偕撖貊??creen Sizing Table ?澆?閬? |

**瘥遢 screen spec / task card 敹???Component Sizing Table ??閬朣???*

| 瑼? | 憿? | 撠?閬??| Atlas | ?釣 |
|---|---|---|---|---|
| `layouts/support-card-main.json` | layout | doc_spec_0027 | lobby_support_card | 銝? Grid嚗?50?460 cell嚗?-tab |
| `skins/support-card-default.json` | skin | doc_spec_0027 | lobby_support_card | 蝔?漲?∟????局???湔???|
| `screens/support-card-screen.json` | screen | doc_spec_0027 | ??| 3 screens + 2 popups嚗??渡Ⅱ隤?憟賢??嚗?|
| `layouts/gacha-main.json` | layout | doc_spec_0042 | lobby_gacha | ?????ityBar?urrencyBar?ull1+Pull10 |
| `skins/gacha-default.json` | skin | doc_spec_0042 | lobby_gacha | 銝? bg 霈??????蝔?漲?予?賢?摨?|
| `screens/gacha-screen.json` | screen | doc_spec_0042 | ??| 3 screens + 2 popups嚗????瘙惜摰?嚗?|
| `layouts/lobby-main-main.json` | layout | doc_spec_0002 | lobby_ui | 憭批輒銝餃?舫爸?塚??踵?? / 銝?瘝 / 閮梢?蟡剖??? |
| `skins/lobby-main-default.json` | skin | doc_spec_0002 | lobby_ui | 霅唬?撱喃蜓憿??嗆?瑽賬??方?隞餃???閫 |
| `screens/lobby-main-screen.json` | screen | doc_spec_0002?oc_spec_0014 | ??| 憭批輒銝餃??screen嚗????瑕翰?扯?銝?瘝???|
| `layouts/lobby-mission-detail-dialog-main.json` | layout | doc_spec_0002 | lobby_ui | 800?900 銝剖亢隞餃?閰單?敶?嚗??桃蔗?郎撠???皞祥????|
| `skins/lobby-mission-detail-dialog-default.json` | skin | doc_spec_0002 | lobby_ui | 隞餃?閰單?敶??楛?脣?Ｕ??噬蝡?鞈?璇見撘?|
| `contracts/lobby-mission-detail-dialog-content.schema.json` | contract | doc_spec_0002 | ??| 隞餃?閰單?敶??批捆憟?嚗??急??勗漲?郎撠祥???菔? AI 憪遙 |
| `content/lobby-mission-detail-dialog-states-v1.json` | content | doc_spec_0002 | ??| `smoke-military-partial` / `smoke-domestic-revealed` 璅? |
| `screens/lobby-mission-detail-dialog-screen.json` | screen | doc_spec_0002 | ??| 頠? / ?扳隞餃?閰單?銝剖亢敶?嚗?鞎祆??勗漲璅∠??郎撠?瘣曇? AI 憪遙 |
| `layouts/general-detail-unified-main.json` | layout | doc_ui_0012?oc_spec_0174 | general_detail | 甇血?鈭箇????銝駁爸?塚?`撖跆 ??亥?????蝚衣畾局 |
| `skins/general-detail-unified-default.json` | skin | doc_ui_0012?oc_spec_0174 | general_detail | 甇血?鈭箇?迤撘????`撖跆 ?畾局???tab chrome |
| `screens/general-detail-unified-screen.json` | screen | doc_ui_0012?oc_spec_0174 | ??| 甇血?鈭箇?迤撘?screen嚗???`撠?/ 撅?/ ? / ??/ 撖跆 |
| `layouts/spirit-tally-detail-main.json` | layout | doc_spec_0012?oc_spec_0022?oc_spec_0174 | general_detail | ?梢???/ ?泵閰單????梁鈭箇??`撖跆 ?底???|
| `skins/spirit-tally-detail-default.json` | skin | doc_spec_0012?oc_spec_0022?oc_spec_0174 | general_detail | ?梢???/ ?泵閰單????|
| `screens/spirit-tally-detail-screen.json` | screen | doc_spec_0012?oc_spec_0022?oc_spec_0174 | ??| ?梢???/ ?泵閰單? screen |

### C-2. UI Spec JSON ??閬?賂???蝝Ｗ?嚗?

| UI Spec JSON | 銝餉?靘陷閬??| ?賊? Schema 甈? |
|---|---|---|
| support-card-*.json (?3) | doc_spec_0027 禮B, 禮D, 禮F, 禮K, 禮L, 禮M | Support_Card_ID, Star_Level, Training_Slot_Affinity, Synergy_Partners, Decompose_Value, BorrowSession, Role_Boundary |
| gacha-*.json (?3) | doc_spec_0042 禮C, 禮E, 禮F, 禮I | Hero_Pool, Support_Pool, Pool_Positioning, Pity_Independent, Player_Currency嚗pirit_Jade/Bronze_Charm/Divination_Token嚗?|
| lobby-main-*.json (?3) | doc_spec_0002 禮E, 禮I?oc_spec_0014 禮E, 禮I | Mission_Boards, Task_Title, Task_Brief, Task_Detail, Intel_Reveal_Percent, Selected_General_UID, Rewards, Costs, Available_Actions, AI_Assign_Enabled, Officer_Snapshot, World_Sandtable, Wish_Altar, Volunteer_Event_Log, Morning_Report_Summary, Dispatch_Board_State |
| lobby-mission-detail-dialog-screen.json | doc_spec_0002 禮E, 禮F, 禮H | Mission_Boards, Intel_Reveal_Percent, Selected_General_UID, Rewards, Costs, Available_Actions, AI_Assign_Enabled |
| general-detail-unified-*.json (?2) | doc_ui_0012 禮3????1.2.2嚗oc_spec_0174 禮H | Default_Tab, Story_Strip_Cells, Equipped_Spirit_UID, Equipped_Tally_UID, Slot_Type, Display_Bucket, Card_Role |
| spirit-tally-detail-*.json (?2) | doc_spec_0012 禮A, 禮F嚗oc_spec_0022 禮E嚗oc_spec_0174 禮H | Spirit_ID, Resonance_Band, Glow_State, TigerTallyScore, Linked_Troop_ID, grainCost |
| spirit-collection-room-main.json | doc_spec_0022 禮I-5、doc_ui_0012 禮9.4 | Spirit_Collection_Room, Spirit_Display_Row, Spirit_Archive_Snapshot, Display_Weight, Featured_Archive_Spirit_UIDs |
