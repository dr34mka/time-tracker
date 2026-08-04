# Time Tracker

Трекер рабочего времени для фрилансеров и небольших команд: клиенты, проекты,
задачи, таймер, ставки в RUB/USD и отчёты с расчётом заработка.

## Запуск

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit-тесты основной логики
npm run build      # прод-сборка в dist/
npm run app        # запуск десктоп-приложения (Electron, нужен свежий dist/)
npm run app:dev    # Electron поверх работающего vite dev-сервера (HMR)
npm run icons      # перегенерация template-иконок меню-бара (electron/assets/)
```

## Как выпустить релиз

Обёртка — Electron + electron-builder (конфиг в `package.json`, поле `build`;
главный процесс — `electron/main.cjs`). Репозиторий: github.com/dr34mka/time-tracker
(задан константами `UPDATE_OWNER`/`UPDATE_REPO` в `electron/main.cjs` и полем
`build.publish` в `package.json` — оба должны совпадать с реальным репо).

Три сценария в зависимости от цели:

**A. Просто обновить у себя, без публикации.** Версию можно не трогать.
```bash
npm run dist:mac
```
Откройте `release/Time Tracker-<версия>-arm64.dmg` и перетащите в Applications
поверх старой версии.

**B. Опубликовать для всех через терминал (рекомендуется).** Это единственный
способ, при котором сработает баннер «Доступна новая версия» у всех, у кого
приложение уже установлено.
```bash
npm run release:patch    # 0.1.0 → 0.1.1 (или release:minor → следующий 0.X.0)
git push --follow-tags
```
`npm version` сам поднимает номер в `package.json`, коммитит и ставит тег
`vX.Y.Z`. Пуш тега запускает GitHub Actions (`.github/workflows/build.yml`),
который собирает macOS Apple Silicon и Windows и публикует dmg/exe в Releases —
проверить: github.com/dr34mka/time-tracker/actions (~3–6 минут), затем
github.com/dr34mka/time-tracker/releases. Дальше ничего делать не нужно —
у всех установленных копий баннер появится при следующем запуске.

**C. Опубликовать вручную через сайт GitHub (без git push, если что-то не
так с Actions).** Соберите артефакты локально, поднимите версию (вручную
в `package.json` или `npm version patch --no-git-tag-version` — без коммита
и тега) и загрузите файлы через github.com/dr34mka/time-tracker/releases/new:
укажите новый тег вида `v0.1.2`, перетащите dmg/exe из `release/` как файлы
релиза, Publish.

Общее для B и C:
- **Windows** собирается либо на самой Windows (`npm run dist:win` →
  `Time Tracker Setup X.exe` инсталлятор и `Time Tracker X.exe` portable в
  `release/`; если падает на распаковке winCodeSign — включите Developer
  Mode в Windows или распакуйте архив в кэш вручную, ошибки на
  `darwin/*.dylib` игнорируются), либо через GitHub Actions (сценарий B).
- **macOS Apple Silicon без подписи** (`identity: null`, только ad-hoc от линкера) —
  любой, кто скачает dmg через браузер, увидит диалог Gatekeeper
  «Приложение повреждено, переместите в Корзину». Файл цел, правый клик →
  «Открыть» не помогает (это для другого диалога, «неизвестный
  разработчик»). Чинится в Terminal после установки в Applications:
  ```bash
  xattr -cr "/Applications/Time Tracker.app"
  ```
- Данные приложения сохраняются в `localStorage` и JSON-файл в профиле Electron
  (`%APPDATA%/Time Tracker` на Windows). Запись файла атомарная, предыдущая
  версия хранится как бэкап, а параллельные облачные изменения не
  перезаписываются молча.

## Виджет меню-бара (macOS)

Иконка-секундомер в меню-баре показывает состояние таймера (тикающее время
рядом с иконкой; глиф внутри — play/pause). Клик — компактный popover под
меню-баром: проект и задача, крупное время, заработок, пауза/стоп и переход
в приложение; закрывается по Esc, клику мимо или повторному клику по иконке.
Правый клик по иконке — меню (открыть/завершить). Закрытие главного окна
на macOS прячет его: приложение и таймер продолжают жить в меню-баре.

Механика: рендерер шлёт снапшот таймера в главный процесс (`tray:state`),
тот сам тикает раз в секунду и обновляет `Tray`; popover — отдельная
страница `popover.html` (общий preload), команды паузы/стопа возвращаются
в рендерер главного окна (`timer:command`), где живёт стор. Иконки —
template-PNG, генерируются `scripts/gen-tray-icons.mjs` (`npm run icons`).

## Стек

- React 18 + TypeScript + Vite
- Состояние: React Context + useReducer
- Хранение: схема данных v2 в localStorage (ключ `time-tracker-v1`) и JSON-файле
  Electron. Старые бэкапы мигрируют при чтении; состояние таймера переживает
  перезапуск.
- Проверки: Vitest для бизнес-логики и GitHub Actions для PR и `main`.

## Структура

```
src/
  types.ts                 — модель данных (Client, Project, Task, TimeEntry, Settings)
  state.tsx                — глобальный стор: reducer + Context + персистентность
  hooks.ts                 — useNow (тикер), timerElapsed
  lib/
    money.ts               — наследование ставок (задача → проект → глобальная),
                             округление биллинга, форматирование валют
    client.ts              — сводка работ клиента по проектам и задачам
    time.ts                — форматирование и календарные хелперы
    storage.ts             — валидация, load/save localStorage, миграции схемы
    csv.ts                 — экспорт CSV (UTF-8 BOM, ; как разделитель)
  components/
    Modal.tsx, TaskNameModal.tsx, TimerBar.tsx, Icon.tsx (SVG-иконки)
  popover/
    main.tsx, popover.css  — popover меню-бара macOS (отдельная страница Vite)
  screens/
    TodayScreen.tsx        — главный экран: таймер, быстрый старт, записи за день
    ProjectsScreen.tsx     — список проектов + форма создания/редактирования
    ClientsScreen.tsx      — карточки клиентов, архив и общая сводка
    ClientDetailScreen.tsx — проекты клиента и выполненные задачи
    ProjectDetailScreen.tsx— задачи проекта, ручной ввод времени, записи
    ReportsScreen.tsx      — фильтры, сводка, график, CSV и PDF
    SettingsScreen.tsx     — ставка, валюта, интервал биллинга, тема
```

## Бизнес-правила

- **Ставка записи**: `task.rate ?? project.rate ?? settings.globalRate`;
  валюта: `project.currency ?? settings.currency`.
- **Биллинг**: длительность округляется **вверх** до интервала из настроек
  (1/5/15/30/60 мин), заработок = округлённые часы × ставка.
- **Таймер**: старт нового таймера автоматически останавливает и сохраняет
  предыдущий; записи короче 1 секунды не сохраняются.
- **Клиент**: объединяет связанные проекты и показывает задачи, по которым
  есть выполненные записи времени, вместе с длительностью и заработком.
- **Валюты**: RUB и USD — суммы в отчётах группируются по валютам
  и не смешиваются.

## Дорожная карта (после MVP)

- Календарь (день/неделя/месяц) с drag-and-drop записей
- Сценарии «что если» (сравнение ставок), прогноз дохода
- Инвойсы на основе клиентов и отфильтрованных отчётов
- Авторизация и синхронизация с бэкендом (сейчас данные локальные)
