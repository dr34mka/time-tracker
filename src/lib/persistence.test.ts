import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppState } from '../types';
let storage: typeof import('./storage');
let write: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  storage = await import('./storage');
  write = vi.fn();
  vi.stubGlobal('localStorage', { setItem: write, getItem: vi.fn() });
  vi.stubGlobal('window', {});
});
afterEach(() => {
  storage.pauseDesktopSaves();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const change = (state: AppState, rate: number): AppState => ({ ...state, settings: { ...state.settings, globalRate: rate } });

describe('persistence failure and ordering', () => {
  it('reports quota failure and clears it only after a successful retry', () => {
    write.mockImplementationOnce(() => { throw new Error('quota'); });
    storage.saveState(storage.DEFAULT_STATE);
    expect(storage.getPersistenceStatus().localError).toBe(true);
    storage.saveState(storage.DEFAULT_STATE);
    expect(storage.getPersistenceStatus().localError).toBe(false);
  });
  it.each([false, 'reject'])('reports an unsuccessful desktop write (%s)', async (result) => {
    const saveData = result === 'reject' ? vi.fn().mockRejectedValue(new Error('IPC')) : vi.fn().mockResolvedValue(false);
    vi.stubGlobal('window', { desktop: { saveData } });
    storage.setDesktopBaseRaw('base');
    storage.saveState(storage.DEFAULT_STATE);
    await vi.runAllTimersAsync();
    expect(storage.getPersistenceStatus()).toMatchObject({ desktopError: true, pending: false });
  });
  it('does not write the file before its initial version is known', async () => {
    const saveData = vi.fn();
    vi.stubGlobal('window', { desktop: { saveData } });
    storage.saveState(storage.DEFAULT_STATE);
    await vi.runAllTimersAsync();
    expect(saveData).not.toHaveBeenCalled();
  });
  it('serializes overlapping writes using the last acknowledged version', async () => {
    let finish!: (saved: boolean) => void;
    const saveData = vi.fn().mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = resolve; })).mockResolvedValue(true);
    vi.stubGlobal('window', { desktop: { saveData } });
    storage.setDesktopBaseRaw('base');
    const first = change(storage.DEFAULT_STATE, 25);
    const next = change(storage.DEFAULT_STATE, 50);
    storage.saveState(first);
    await vi.advanceTimersByTimeAsync(400);
    storage.saveState(next);
    await vi.advanceTimersByTimeAsync(400);
    expect(saveData).toHaveBeenCalledTimes(1);
    finish(true);
    await vi.runAllTimersAsync();
    expect(saveData).toHaveBeenNthCalledWith(2, JSON.stringify(next), JSON.stringify(first));
    expect(storage.getPersistenceStatus()).toMatchObject({ pending: false, desktopError: false });
  });
  it('cancels delayed writes when an external conflict arrives but keeps the local cache', async () => {
    const saveData = vi.fn();
    vi.stubGlobal('window', { desktop: { saveData } });
    storage.setDesktopBaseRaw('base');
    storage.saveState(storage.DEFAULT_STATE);
    storage.pauseDesktopSaves();
    await vi.runAllTimersAsync();
    expect(saveData).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith('time-tracker-v1', JSON.stringify(storage.DEFAULT_STATE));
  });
  it('ignores an old acknowledgement after switching to a different file version', async () => {
    let finish!: (saved: boolean) => void;
    const saveData = vi.fn().mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = resolve; })).mockResolvedValue(true);
    vi.stubGlobal('window', { desktop: { saveData } });
    storage.setDesktopBaseRaw('old');
    storage.saveState(storage.DEFAULT_STATE);
    await vi.advanceTimersByTimeAsync(400);
    storage.setDesktopBaseRaw('external');
    storage.saveState(change(storage.DEFAULT_STATE, 42));
    finish(true);
    await vi.runAllTimersAsync();
    expect(saveData.mock.calls[1][1]).toBe('external');
  });
});
