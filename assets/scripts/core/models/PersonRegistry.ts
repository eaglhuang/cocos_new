/**
 * PersonRegistry.ts
 * 
 * 武將人物登記表介面定義 — 扁平化血統樹的核心資料結構。
 * 
 * Unity 對照：類似 ScriptableObject 資料表，每個 PersonRecord 對應一個武將或虛擬祖先條目，
 * BloodlineLink 對應 parent-child 關係記錄（取代 Unity 中嵌套的 GameObject 樹結構）。
 * 
 * 設計理念：
 *   - 嵌套的 Ancestors_JSON 樹轉為扁平 PersonRecord 陣列 + BloodlineLink 邊表
 *   - ancestor_chain: string[] 儲存 14 個祖先 uid（直接可 lookup，無需遞迴）
 *   - 虛擬祖先（is_virtual = true）不需要真實武將資料，只佔輕量條目
 */

/** 人物記錄 — 對應一位真實武將或虛擬祖先 */
export interface PersonRecord {
  /** 唯一識別碼（真實武將使用 kebab-case id，虛擬祖先使用 VIRT_開頭的 UUID） */
  uid: string;
  /** 對應的武將模板 ID（來自 GeneralConfig.templateId；虛擬祖先為 null） */
  template_id: string | null;
  /** 顯示名稱 */
  name: string;
  /**
   * 基因組 ID 陣列（參照 gene-dictionary.json 的 id 欄位）
   * 空陣列代表未知或虛擬祖先無基因資料
   */
  gene_refs: string[];
  /** 基礎 EP 值（用於血統 EP 遞迴計算） */
  ep_base: number;
  /** 所屬勢力（wei/shu/wu/enemy/neutral/unknown） */
  faction: string;
  /**
   * 是否為虛擬祖先（true = 系統補全的佔位條目，無真實武將資料）
   * Unity 對照：類似 Unity 中為維持樹結構而插入的 placeholder GameObject
   */
  is_virtual: boolean;
}

/** 血統連結 — 對應族譜中的一條親子關係邊 */
export interface BloodlineLink {
  /** 子代武將的 uid */
  child_uid: string;
  /** 親代武將/祖先的 uid */
  parent_uid: string;
  /**
   * 親代關係類型
   *   'F' = Father（父系）
   *   'M' = Mother（母系）
   *   'U' = Unknown（不明）
   */
  relation: 'F' | 'M' | 'U';
  /** 世代數（0 = 本人，1 = 父母，2 = 祖父母，以此類推） */
  generation: number;
}

/** PersonRegistry 資料檔結構（對應 person-registry.json） */
export interface PersonRegistryData {
  version: string;
  updatedAt: string;
  /** 所有人物記錄（真實 + 虛擬祖先） */
  persons: PersonRecord[];
  /** 所有血統連結邊 */
  links: BloodlineLink[];
}
