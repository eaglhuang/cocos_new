# Audio Bundle — 音效清單

> **規範版本**：2026-03-18
> 音效管理使用 `AudioSystem`（`services().audio`），見 `core/systems/AudioSystem.ts`。
> **每次新增或刪除音效時，必須同步更新本清單。**

---

## SFX — 單次音效（`AudioSystem.playSfx(key)`）

| 檔名 | AudioSystem key | 預估用途 | 使用狀態 | 呼叫位置 |
|------|----------------|---------|---------|---------|
| bat.mp3 | `"bat"` | 蝙蝠拍打 | 🚧 WIP | — |
| bite.mp3 | `"bite"` | 普通咬擊 | 🚧 WIP | — |
| biteskill.mp3 | `"biteskill"` | 咬擊技能 | 🚧 WIP | — |
| boom.mp3 | `"boom"` | 爆炸衝擊 | 🚧 WIP | — |
| buff.mp3 | `"buff"` | Buff 增益 | 🚧 WIP | — |
| die.mp3 | `"die"` | 單位死亡 | 🚧 WIP | — |
| feijian.mp3 | `"feijian"` | 飛劍 | 🚧 WIP | — |
| fireball.mp3 | `"fireball"` | 火球 | 🚧 WIP | — |
| footstep.mp3 | `"footstep"` | 腳步聲 | 🚧 WIP | — |
| heal.mp3 | `"heal"` | 治療 | 🚧 WIP | — |
| hurt.mp3 | `"hurt"` | 受擊 | 🚧 WIP | — |
| laser.mp3 | `"laser"` | 雷射 | 🚧 WIP | — |
| light.mp3 | `"light"` | 光效出現 | 🚧 WIP | — |
| shield.mp3 | `"shield"` | 盾牌格擋 | 🚧 WIP | — |
| skill0.mp3 | `"skill0"` | 武將技能 0 | 🚧 WIP | — |
| skill1.mp3 | `"skill1"` | 武將技能 1 | 🚧 WIP | — |
| skill2.mp3 | `"skill2"` | 武將技能 2 | 🚧 WIP | — |
| skill3.mp3 | `"skill3"` | 武將技能 3 | 🚧 WIP | — |
| skill7.mp3 | `"skill7"` | 武將技能 7 | 🚧 WIP | — |
| start.mp3 | `"start"` | 戰鬥開場 | 🚧 WIP | — |
| teleport.mp3 | `"teleport"` | 瞬移 | 🚧 WIP | — |
| thunder.mp3 | `"thunder"` | 雷電 | 🚧 WIP | — |
| wave.mp3 | `"wave"` | 波紋衝擊 | 🚧 WIP | — |
| weapon.mp3 | `"weapon"` | 武器揮斬 | 🚧 WIP | — |

---

## BGM — 背景音樂（`AudioSystem.playBgm(clip)`）

| 檔名 | 使用場景 | 使用狀態 |
|------|---------|---------|
| _(尚未加入 BGM)_ | — | — |

---

## 清理規則

- MP3 是獨立檔案，**直接刪除無需考慮 Cocos meta 依賴**
- 刪除前確認 `AudioSystem.registerClip(key, clip)` 的呼叫已一併移除
- **禁止**：只刪 `.mp3` 但不更新本清單（讓清單失去參考意義）
- 不確定是否會用到的音效：保留 .mp3、狀態維持 🚧 WIP，下次 Review 時再決定

---

## 使用方式（程式碼範例）

```typescript
// 1. 載入 clip（通常在 BattleScene.start() 中）
const clip = await services().resource.loadAudioClip("audio/clips/hurt");
services().audio.registerClip("hurt", clip);

// 2. 播放
services().audio.playSfx("hurt");           // 50ms 防重複播放
services().audio.playSfxWithCooldown("footstep", 1.0, 300); // 300ms 冷卻
```
