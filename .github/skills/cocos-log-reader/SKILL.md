---
name: cocos-log-reader
description: 'DEBUGGING SKILL — Read and analyze Cocos Creator project.log for runtime errors, warnings, and stack traces. USE FOR: any bug report, crash, UI glitch, TypeError, null reference, missing asset. Load this skill FIRST before any runtime debugging session. DO NOT USE FOR: compile errors (use get_errors tool instead).'
argument-hint: 'Describe the symptom or error message to filter. Examples: "TypeError null root", "BattleHUD init fail", "label no textKey"'
---

<!-- 此檔案為 .agents/skills/cocos-log-reader/SKILL.md 的鏡像副本，供 GitHub Copilot 技能載入使用 -->
<!-- 主版本位於 c:\Users\User\3KLife\.agents\skills\cocos-log-reader\SKILL.md -->

# Cocos Log Reader（鏡像索引）

此技能適用於所有 runtime debug 情境：
- 使用者回報 crash / TypeError / 畫面異常
- 使用者貼出錯誤截圖
- 任何「一團亂」、「行為不對」描述

## 快速讀法

```powershell
# 讀最後 150 行
Get-Content "c:\Users\User\3KLife\temp\logs\project.log" -Tail 150 -Encoding UTF8

# 過濾 Error
Get-Content "c:\Users\User\3KLife\temp\logs\project.log" -Tail 400 -Encoding UTF8 |
  Where-Object { $_ -match "error|TypeError|Cannot" } | Select-Object -Last 40
```

## 完整 SOP

請讀取主技能檔案以取得完整步驟：  
`.agents/skills/cocos-log-reader/SKILL.md`
