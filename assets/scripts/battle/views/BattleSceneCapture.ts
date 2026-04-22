import type { Component } from 'cc';

export type BattleSceneCaptureStatus = 'loading' | 'ready' | 'error';

const BATTLE_SCENE_CAPTURE_SCREEN_ID = 'battle-scene';

export function isBattleSceneCaptureMode(): boolean {
  try {
    const globalScope = globalThis as any;
    const search = globalScope?.window?.location?.search as string | undefined;
    const query = new URLSearchParams(search ?? '');
    const queryMode = query.get('previewMode') ?? query.get('PREVIEW_MODE');
    const queryTarget = query.get('previewTarget') ?? query.get('PREVIEW_TARGET');

    let storedMode = '';
    let storedTarget = '';
    try {
      storedMode = globalScope?.window?.localStorage?.getItem('PREVIEW_MODE') ?? '';
      storedTarget = globalScope?.window?.localStorage?.getItem('PREVIEW_TARGET') ?? '';
    } catch {
      // localStorage 在部分 preview 環境可能不可用，不影響 query 判斷
    }

    const previewMode = queryMode === 'true' || queryMode === '1' || storedMode === 'true';
    const previewTarget = queryTarget ?? storedTarget;
    return previewMode && (previewTarget === '5' || previewTarget === '11');
  } catch {
    return false;
  }
}

export function setBattleSceneCaptureState(status: BattleSceneCaptureStatus, error?: unknown): void {
  const globalScope = globalThis as any;
  globalScope.__UI_CAPTURE_STATE__ = {
    status,
    screenId: BATTLE_SCENE_CAPTURE_SCREEN_ID,
    timestamp: Date.now(),
    error: error ? String(error) : undefined,
  };

  try {
    globalScope?.window?.localStorage?.setItem('UI_CAPTURE_STATE', JSON.stringify(globalScope.__UI_CAPTURE_STATE__));
  } catch {
    // localStorage 不可用時略過，保留 window 全域訊號即可
  }
}

export async function signalBattleSceneCaptureReadyIfNeeded(owner: Component): Promise<void> {
  if (!isBattleSceneCaptureMode()) return;

  await new Promise<void>((resolve) => {
    owner.scheduleOnce(() => resolve(), 0);
  });

  setBattleSceneCaptureState('ready');
}

export function signalBattleSceneCaptureErrorIfNeeded(error: unknown): void {
  if (!isBattleSceneCaptureMode()) return;
  setBattleSceneCaptureState('error', error);
}