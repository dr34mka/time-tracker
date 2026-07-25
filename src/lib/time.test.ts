import { describe, expect, it } from 'vitest';
import { addDays, reportRange, startOfDay, startOfMonth } from './time';

describe('reportRange', () => {
  const now = new Date(2026, 6, 25, 14, 30).getTime();

  it('ends the current month range at the start of tomorrow', () => {
    expect(reportRange('month', now, [], 0, 0)).toEqual([
      startOfMonth(now),
      addDays(startOfDay(now), 1),
    ]);
  });

  it('normalizes a reversed custom range', () => {
    const earlier = new Date(2026, 6, 10).getTime();
    const later = new Date(2026, 6, 20).getTime();
    expect(reportRange('custom', now, [], later, earlier)).toEqual([
      earlier,
      addDays(later, 1),
    ]);
  });

  it('uses the first entry for the all-time range', () => {
    const first = new Date(2025, 1, 3, 18).getTime();
    expect(reportRange('all', now, [now, first], 0, 0)).toEqual([
      startOfDay(first),
      addDays(startOfDay(now), 1),
    ]);
  });
});
