import { chromium } from "playwright-core";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : { channel: "chrome" }),
  headless: true,
  args: process.env.CI ? ["--no-sandbox"] : [],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "Europe/Chisinau",
    reducedMotion: "reduce",
  });
  page.setDefaultTimeout(8000);
  const errors = [];
  const checks = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const state = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("time-tracker-v1")));
  const nav = (name) =>
    page
      .getByRole("navigation", { name: "Основная навигация" })
      .getByRole("button", { name, exact: true })
      .click();
  await page.goto(process.env.UI_BASE_URL || "http://localhost:5173");
  await page.getByRole("button", { name: "Создать первый проект" }).click();
  await page.getByRole("dialog").waitFor();
  await page
    .getByRole("dialog")
    .locator("input")
    .first()
    .fill("Тестовый проект");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Создать проект", exact: true })
    .click();
  assert.equal((await state()).projects[0].name, "Тестовый проект");
  checks.push("Create first project");
  await page.getByRole("button", { name: "Старт", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page
    .getByRole("dialog")
    .locator("input")
    .first()
    .fill("Тестовая задача");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Сохранить", exact: true })
    .click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  assert.equal((await state()).timer.running, false);
  const accumulated = (await state()).timer.accumulatedMs;
  await page.reload();
  assert.equal((await state()).timer.accumulatedMs, accumulated);
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.reload();
  assert.equal((await state()).timer.running, true);
  await page.getByRole("button", { name: "Остановить", exact: true }).click();
  assert.equal((await state()).entries.length, 1);
  checks.push("Start, rename, pause, reload, resume, restore running, stop");
  await page.getByRole("button", { name: "Проект", exact: true }).click();
  for (let i = 0; i < 24; i++) {
    await page.keyboard.press("Tab");
    assert(
      await page.evaluate(() => !!document.activeElement.closest("dialog")),
    );
  }
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog").count(), 0);
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent.trim()),
    "Проект",
  );
  checks.push("Modal focus trap, Escape and return focus");
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("time-tracker-v1"));
    const now = Date.now();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    s.entries = [];
    s.timer = {
      taskId: s.tasks[0].id,
      projectId: s.projects[0].id,
      firstStartedAt: yesterday.getTime(),
      startedAt: now,
      accumulatedMs: 3600000,
      running: false,
    };
    localStorage.setItem("time-tracker-v1", JSON.stringify(s));
  });
  await page.reload();
  assert.equal(await page.locator(".goal-numbers .big").innerText(), "0м");
  assert.equal(
    await page.locator(".day-totals .value").first().innerText(),
    "0м",
  );
  checks.push("Previous-day timer excluded from today totals and goal");
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("time-tracker-v1"));
    s.timer = null;
    s.entries = [
      {
        id: "entry",
        taskId: s.tasks[0].id,
        projectId: s.projects[0].id,
        start: Date.now() - 3600000,
        end: Date.now(),
        durationMs: 3600000,
        note: "=1+1",
      },
    ];
    localStorage.setItem("time-tracker-v1", JSON.stringify(s));
  });
  await page.reload();
  const screens = [
    ["Таймер", "Рабочая сессия"],
    ["Проекты", "Проекты"],
    ["Клиенты", "Клиенты"],
    ["Отчёты", "Отчёты"],
    ["Настройки", "Настройки"],
  ];
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, title] of screens) {
      // Project button has a count in its accessible name.
      await page
        .getByRole("navigation")
        .getByRole("button", { name: new RegExp("^" + name) })
        .click();
      await page.getByRole("heading", { name: title, exact: true }).waitFor();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${name} overflows at ${width}`,
      );
    }
  }
  checks.push("All 5 screens fit 320/390/768/1024/1440px");
  await page.getByRole("button", { name: "Включить светлую тему" }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await page.reload();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  checks.push("Light theme persists");
  await nav("Отчёты");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /CSV/ }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  let csv = "";
  for await (const chunk of stream) csv += chunk.toString("utf8");
  assert(csv.includes("'=1+1"));
  checks.push("CSV download escapes formula note");
  await nav("Настройки");
  await page
    .getByRole("combobox", { name: "Минимальный интервал биллинга" })
    .selectOption("5");
  assert.equal((await state()).settings.roundingMinutes, 5);
  checks.push("Native select updates billing");

  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ checks, errors }, null, 2));
} finally {
  await browser.close();
}
