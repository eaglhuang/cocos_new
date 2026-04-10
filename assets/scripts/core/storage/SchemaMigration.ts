/**
 * SchemaMigration.ts
 *
 * 資料 Schema 版本控制與漸進式遷移機制。
 *
 * 使用方式：
 *   1. 每次資料結構變更時，呼叫 SchemaMigration.register(fromVersion, toVersion, migrateFn)
 *   2. App 啟動 / 存檔載入時呼叫 SchemaMigration.migrate(saveData)
 *
 * Unity 對照：類似 PlayFab 的 schema versioning 或 Unity Serialization 的 [FormerlySerializedAs]。
 *
 * 版本格式：整數（1, 2, 3...），每次資料格式破壞性變更時遞增。
 *
 * 範例：
 *   // v1 → v2：Ancestors_JSON 改為 ancestor_chain
 *   SchemaMigration.register(1, 2, (data) => {
 *     if (data.generals) {
 *       for (const g of data.generals) {
 *         if (g.Ancestors_JSON && !g.ancestor_chain) {
 *           g.ancestor_chain = g.Ancestors_JSON.map((a: { uid: string }) => a.uid);
 *           delete g.Ancestors_JSON;
 *         }
 *       }
 *     }
 *     return data;
 *   });
 */

/** 目前最新 Schema 版本（每次資料格式變更時手動遞增） */
export const CURRENT_SCHEMA_VERSION = 1;

export interface VersionedData {
  /** Schema 版本號；舊資料若無此欄位預設為 0 */
  schemaVersion?: number;
  [key: string]: unknown;
}

type MigrationFn = (data: Record<string, unknown>) => Record<string, unknown>;

interface MigrationEntry {
  from: number;
  to: number;
  migrate: MigrationFn;
}

const _registry: MigrationEntry[] = [];

/**
 * 註冊一個 migration 步驟。
 * @param from 來源版本號
 * @param to   目標版本號（必須 = from + 1）
 * @param fn   遷移函式：接收資料物件並回傳遷移後的資料物件
 */
export function register(from: number, to: number, fn: MigrationFn): void {
  if (to !== from + 1) {
    console.error(`[SchemaMigration] 只支援漸進式遷移（from + 1 = to）。傳入 from=${from}, to=${to}`);
    return;
  }
  _registry.push({ from, to, migrate: fn });
}

/**
 * 對一份資料執行所有必要的 migration，使其 schema 達到 CURRENT_SCHEMA_VERSION。
 * @param data 待遷移的資料物件（必須含 schemaVersion 或視為 v0）
 * @returns 遷移完畢的資料物件（含更新後的 schemaVersion）
 */
export function migrate<T extends VersionedData>(data: T): T {
  let currentVersion: number = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;

  if (currentVersion === CURRENT_SCHEMA_VERSION) {
    return data;
  }

  if (currentVersion > CURRENT_SCHEMA_VERSION) {
    console.warn(
      `[SchemaMigration] 資料 schemaVersion(${currentVersion}) > CURRENT_SCHEMA_VERSION(${CURRENT_SCHEMA_VERSION})，` +
      `可能是來自更新版本的存檔，跳過遷移。`
    );
    return data;
  }

  // 找出所有須執行的遷移步驟，依 from 版本排序
  const steps = _registry
    .filter(e => e.from >= currentVersion && e.from < CURRENT_SCHEMA_VERSION)
    .sort((a, b) => a.from - b.from);

  let result: Record<string, unknown> = data as unknown as Record<string, unknown>;

  for (const step of steps) {
    if (step.from !== currentVersion) {
      console.error(
        `[SchemaMigration] 遷移鏈斷裂：期望 from=${currentVersion}，但找到 from=${step.from}。停止遷移。`
      );
      break;
    }
    try {
      result = step.migrate(result);
      currentVersion = step.to;
    } catch (e) {
      console.error(`[SchemaMigration] v${step.from}→v${step.to} 遷移失敗：`, e);
      break;
    }
  }

  result.schemaVersion = currentVersion;
  return result as unknown as T;
}

/**
 * 確認此版本資料是否需要遷移。
 * @returns true 若需要執行 migrate()
 */
export function needsMigration(data: VersionedData): boolean {
  const v = typeof data.schemaVersion === 'number' ? data.schemaVersion : 0;
  return v < CURRENT_SCHEMA_VERSION;
}
