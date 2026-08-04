import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_STATE, parseState, saveState, setDesktopBaseRaw } from './storage';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('parseState', () => {
  it('migrates legacy client strings and keeps existing data', () => {
    const parsed = parseState(
      JSON.stringify({
        settings: {
          globalRate: 25,
          currency: 'USD',
          roundingMinutes: 5,
          theme: 'light',
          dailyGoalHours: 6,
        },
        projects: [
          {
            id: 'p1',
            name: 'Website',
            client: 'Acme',
            color: '#123456',
            status: 'active',
            archived: false,
            createdAt: 10,
          },
        ],
        tasks: [{ id: 't1', projectId: 'p1', title: 'Design', createdAt: 11 }],
        entries: [
          {
            id: 'e1',
            projectId: 'p1',
            taskId: 't1',
            start: 100,
            end: 200,
            durationMs: 100,
          },
        ],
        timer: null,
      }),
    );

    expect(parsed?.schemaVersion).toBe(2);
    expect(parsed?.clients).toHaveLength(1);
    expect(parsed?.clients[0].name).toBe('Acme');
    expect(parsed?.projects[0].clientId).toBe(parsed?.clients[0].id);
    expect(parsed?.entries).toHaveLength(1);
  });

  it('accepts the supported currencies', () => {
    for (const currency of ['RUB', 'USD']) {
      const parsed = parseState(
        JSON.stringify({
          settings: { currency },
          clients: [],
          projects: [],
          tasks: [],
          entries: [],
          timer: null,
        }),
      );
      expect(parsed?.settings.currency).toBe(currency);
    }
  });

  it('falls back to RUB for unsupported currencies', () => {
    const parsed = parseState(
      JSON.stringify({
        settings: { currency: 'INVALID' },
        clients: [],
        projects: [],
        tasks: [],
        entries: [],
        timer: null,
      }),
    );
    expect(parsed?.settings.currency).toBe('RUB');
  });

  it('drops the removed client email field from older data', () => {
    const parsed = parseState(
      JSON.stringify({
        settings: {},
        clients: [{ id: 'c1', name: 'Acme', email: 'old@example.com' }],
        projects: [],
        tasks: [],
        entries: [],
        timer: null,
      }),
    );

    expect(parsed?.clients[0]).toEqual(expect.not.objectContaining({ email: expect.anything() }));
  });

  it('filters invalid relations instead of crashing the app', () => {
    const parsed = parseState(
      JSON.stringify({
        settings: {},
        projects: [{ id: 'p1', name: 'Valid', client: '', color: '#000', status: 'active' }],
        tasks: [{ id: 't1', projectId: 'missing', title: 'Orphan' }],
        entries: [{ id: 'e1', projectId: 'p1', taskId: 'missing', start: 1, durationMs: 10 }],
      }),
    );
    expect(parsed?.projects).toHaveLength(1);
    expect(parsed?.tasks).toHaveLength(0);
    expect(parsed?.entries).toHaveLength(0);
  });

  it('rejects unrelated JSON documents', () => {
    expect(parseState('{"hello":"world"}')).toBeNull();
    expect(parseState('not-json')).toBeNull();
  });

  it('saves against the exact desktop file version it was based on', async () => {
    vi.useFakeTimers();
    const saveData = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('window', { desktop: { saveData } });
    setDesktopBaseRaw('base-version');

    saveState(DEFAULT_STATE);
    await vi.runAllTimersAsync();

    expect(saveData).toHaveBeenCalledWith(JSON.stringify(DEFAULT_STATE), 'base-version');
  });
});
