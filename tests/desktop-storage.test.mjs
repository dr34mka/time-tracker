import { afterEach, beforeEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
let dir;
let handlers;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'time-tracker-test-'));
  handlers = new Map();
  const source = readFileSync(new URL('../electron/main.cjs', import.meta.url), 'utf8');
  // Exercise the real data IPC handlers with isolated files, without booting Electron.
  runInNewContext(source.slice(0, source.indexOf('let mainWindow = null;')) + '\nregisterIpc(() => null);', {
    require: (name) => name === 'electron' ? {
      app: { getPath: () => dir },
      ipcMain: { handle: (name, handler) => handlers.set(name, handler) },
    } : require(name),
    process: { pid: process.pid }, setTimeout, clearTimeout,
  });
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));
const load = () => handlers.get('data:load')();
const save = (raw, expected) => handlers.get('data:save')(null, raw, expected);

it('does not overwrite a file created after the initial missing-file read', () => {
  expect(load()).toBeNull();
  writeFileSync(join(dir, 'time-tracker-data.json'), '{"remote":1}');
  expect(save('{"local":1}', null)).toBe(false);
  expect(load()).toBe('{"remote":1}');
  const backup = readdirSync(dir).find(name => name.startsWith('time-tracker-conflict-'));
  expect(readFileSync(join(dir, backup), 'utf8')).toBe('{"local":1}');
});
it('keeps corrupt files intact and surfaces read and write failures', () => {
  const file = join(dir, 'time-tracker-data.json');
  writeFileSync(file, 'corrupt json');
  expect(load).toThrow();
  expect(save('{"local":1}', null)).toBe(false);
  expect(readFileSync(file, 'utf8')).toBe('corrupt json');
});
it('accepts a reviewed version and detects a subsequent independent conflict', () => {
  const file = join(dir, 'time-tracker-data.json');
  writeFileSync(file, '{"remote":1}');
  expect(save('{"local":1}', '{"old":1}')).toBe(false);
  expect(save('{"local":2}', '{"remote":1}')).toBe(true);
  writeFileSync(file, '{"remote":2}');
  expect(save('{"local":3}', '{"local":2}')).toBe(false);
  const copies = readdirSync(dir).filter(name => name.startsWith('time-tracker-conflict-'));
  expect(copies.some(name => readFileSync(join(dir, name), 'utf8') === '{"local":3}')).toBe(true);
});
