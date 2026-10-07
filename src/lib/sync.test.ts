import { expect, it } from 'vitest';
import { DEFAULT_STATE } from './storage';
import { needsSyncDecision } from './sync';
import type { AppState } from '../types';
const local: AppState = { ...DEFAULT_STATE, timer: { taskId: 't', projectId: 'p', running: true, startedAt: 100, firstStartedAt: 100, accumulatedMs: 2000 } };
it('does not let a different incoming timer replace a local session', () => {
  expect(needsSyncDecision(local, { ...local, timer: { ...local.timer!, taskId: 'other' } }, false)).toBe(true);
});
it('requires a decision when the incoming snapshot removes the timer or its task', () => {
  expect(needsSyncDecision(local, DEFAULT_STATE, false)).toBe(true);
});
it('also protects paused sessions', () => {
  expect(needsSyncDecision({ ...local, timer: { ...local.timer!, running: false } }, DEFAULT_STATE, false)).toBe(true);
});
it('protects edits made while loading or waiting for a file write', () => {
  expect(needsSyncDecision(DEFAULT_STATE, { ...DEFAULT_STATE, settings: { ...DEFAULT_STATE.settings, globalRate: 99 } }, true)).toBe(true);
});
it('accepts unchanged snapshots and clean external updates', () => {
  expect(needsSyncDecision(local, local, true)).toBe(false);
  expect(needsSyncDecision(DEFAULT_STATE, { ...DEFAULT_STATE, settings: { ...DEFAULT_STATE.settings, globalRate: 99 } }, false)).toBe(false);
});
