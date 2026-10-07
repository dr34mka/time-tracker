# Резервные копии дизайна

Созданы 7 октября 2026 перед уточнением теней кнопок. Это резервные копии **исходного кода**, пользовательские записи времени хранятся отдельно и в архивы не входят.

| Версия | Зафиксированный коммит | Ветка на GitHub |
| --- | --- | --- |
| Исходный дизайн до редизайна | `8938d4faec9bb4ab574ba9e5fa937fc3fa6f013d` | [backup/original-design-2026-10-07](https://github.com/dr34mka/time-tracker/tree/backup/original-design-2026-10-07) |
| Тестовый дизайн с исправлениями сохранения, до уточнения теней | `b7c249924fb62391a7969cc3dea9bbcacca108f5` | [backup/preview-before-shadows-2026-10-07](https://github.com/dr34mka/time-tracker/tree/backup/preview-before-shadows-2026-10-07) |

Локальные файлы в `/workspace/backups/time-tracker/`:

- `original-design-8938d4f.zip` — исходный проект.
- `preview-before-shadows-b7c2499.zip` — тестовый проект перед изменением теней.
- `design-history.bundle` — обе резервные ветки с полной историей Git.
- `SHA256SUMS` — контрольные суммы архивов и bundle.

Архивы проверены на целостность; `git bundle verify` подтвердил полную историю без внешних зависимостей. Резервные ветки не используются для разработки; новая работа продолжается в `codex/editor-design-preview`.

## Открыть старый дизайн отдельно

```bash
git fetch origin
git worktree add ../time-tracker-original --detach origin/backup/original-design-2026-10-07
```

Или восстановить репозиторий из локального bundle:

```bash
git clone -b backup/original-design-2026-10-07 /workspace/backups/time-tracker/design-history.bundle ../time-tracker-restored
```

Используйте отдельный браузерный профиль/порт для просмотра старой версии, чтобы она не записала старую схему поверх рабочих данных. В текущей тестовой ветке все действия кнопок сохраняются, а глубина обычного, наведённого и нажатого состояния вынесена в общие стили главного окна и popover.
