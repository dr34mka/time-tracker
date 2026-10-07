import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chrome' }),
  headless: true, args: process.env.CI ? ['--no-sandbox'] : [],
});
const base = process.env.UI_BASE_URL || 'http://localhost:5173';
const initial = {
  schemaVersion: 2,
  settings: { globalRate: 50, currency: 'USD', roundingMinutes: 15, theme: 'dark', dailyGoalHours: 8 },
  clients: [], entries: [], timer: null,
  projects: [{ id: 'p', name: 'Локальная работа', client: '', color: '#38bdf8', status: 'active', archived: false, createdAt: 1 }],
  tasks: [{ id: 't', projectId: 'p', title: 'Рабочая задача', createdAt: 1 }],
};
const errors = [];
const pages = [];
async function pageFor(mode) {
  const page = await browser.newPage({ viewport: { width: 1160, height: 850 } });
  pages.push(page);
  page.setDefaultTimeout(8000);
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(({ initial, mode }) => {
    const originalSet = Storage.prototype.setItem;
    if (mode !== 'late') localStorage.setItem('time-tracker-v1', JSON.stringify(initial));
    window.failSave = mode === 'quota' || mode === 'ipc';
    if (mode === 'quota') {
      Storage.prototype.setItem = function (key, value) {
        if (key === 'time-tracker-v1' && window.failSave) throw new DOMException('quota', 'QuotaExceededError');
        return originalSet.call(this, key, value);
      };
      return;
    }
    window.fileRaw = JSON.stringify(initial);
    window.writes = [];
    let external = () => {};
    window.emitExternal = raw => { window.fileRaw = raw; external(raw); };
    window.desktop = {
      loadData: () => mode === 'late' ? new Promise(resolve => { window.finishLoad = () => resolve(window.fileRaw); }) : Promise.resolve(window.fileRaw),
      saveData: async (raw, expected) => {
        window.writes.push({ raw, expected });
        if (window.failSave) throw new Error('Disk unavailable');
        window.fileRaw = raw;
        return true;
      },
      onExternalChange: cb => { external = cb; return () => { external = () => {}; }; },
      onDataConflict: () => () => {},
      setTrayState: () => {}, onTimerCommand: () => () => {},
      getUpdate: async () => null, onUpdateAvailable: () => () => {},
      getInfo: async () => ({ dir: '/test', isDefault: true }), appVersion: async () => 'test',
    };
  }, { initial, mode });
  await page.goto(base);
  return page;
}
async function downloaded(page, name) {
  const promise = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  const download = await promise;
  const parsed = JSON.parse(await readFile(await download.path(), 'utf8'));
  await download.delete();
  return parsed;
}
try {
  const quota = await pageFor('quota');
  await quota.getByRole('button', { name: 'Старт', exact: true }).click();
  await quota.getByRole('alert', { name: 'Ошибка сохранения' }).waitFor();
  const copy = await downloaded(quota, 'Скачать копию JSON');
  assert.equal(copy.timer.taskId, 't');
  assert.equal(copy.timer.running, true);
  await quota.evaluate(() => { window.failSave = false; });
  await quota.getByRole('button', { name: 'Повторить сохранение' }).click();
  await quota.getByRole('alert').waitFor({ state: 'detached' });
  assert.equal(await quota.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')).timer.taskId), 't');

  const ipc = await pageFor('ipc');
  await ipc.getByRole('alert', { name: 'Ошибка сохранения' }).waitFor();
  await ipc.evaluate(() => { window.failSave = false; });
  await ipc.getByRole('button', { name: 'Повторить сохранение' }).click();
  await ipc.getByRole('alert').waitFor({ state: 'detached' });

  const sync = await pageFor('sync');
  await sync.getByRole('button', { name: 'Старт', exact: true }).click();
  const remote = { ...initial, timer: { taskId: 't', projectId: 'p', startedAt: 10, firstStartedAt: 10, accumulatedMs: 3000, running: false } };
  await sync.evaluate(raw => window.emitExternal(raw), JSON.stringify(remote));
  await sync.getByRole('alert', { name: 'Конфликт синхронизации' }).waitFor();
  assert.equal(await sync.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')).timer.running), true);
  await sync.getByRole('button', { name: 'Пауза', exact: true }).click();
  const externalCopy = await downloaded(sync, 'Скачать файл и оставить мои');
  assert.equal(externalCopy.timer.startedAt, 10);
  await sync.waitForFunction(() => JSON.parse(window.fileRaw).timer.firstStartedAt > 10 && !JSON.parse(window.fileRaw).timer.running);
  const deleted = { ...initial, projects: [], tasks: [], timer: null };
  await sync.evaluate(raw => window.emitExternal(raw), JSON.stringify(deleted));
  await sync.getByRole('alert', { name: 'Конфликт синхронизации' }).waitFor();
  const localCopy = await downloaded(sync, 'Скачать мою копию и загрузить файл');
  assert.equal(localCopy.tasks[0].id, 't');
  assert.equal(localCopy.timer.running, false);
  await sync.getByRole('button', { name: 'Создать первый проект' }).waitFor();
  assert.equal(await sync.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')).timer), null);

  const late = await pageFor('late');
  await late.getByRole('button', { name: 'Создать первый проект' }).click();
  await late.getByRole('dialog').getByLabel('Название', { exact: true }).fill('Изменение во время загрузки');
  await late.getByRole('button', { name: 'Создать проект', exact: true }).click();
  assert.equal(await late.evaluate(() => window.writes.length), 0);
  await late.evaluate(() => window.finishLoad());
  await late.getByRole('alert', { name: 'Конфликт синхронизации' }).waitFor();
  assert.equal(await late.evaluate(() => JSON.parse(localStorage.getItem('time-tracker-v1')).projects[0].name), 'Изменение во время загрузки');
  assert.equal(await late.evaluate(() => window.writes.length), 0);
  assert.deepEqual(errors, []);
  console.log('Persistence UI: quota/IPC failures, live JSON backup, retry, concurrent timers, deleted task, latest local edits and delayed startup passed.');
} finally { await browser.close(); }
