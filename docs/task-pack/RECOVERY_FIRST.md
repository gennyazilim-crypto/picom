# Recovery-first instruction for Codex

If previous work was lost, do not begin implementing tasks immediately.

First run:

```text
Do not modify files.
Inspect the current project, local history/checkpoints, backups, remaining modules, docs, package scripts, and missing files.
Return a recovery plan before changing anything.
```

Then commit the current project state before restoration:

```bash
git init
git add -A
git commit -m "current snapshot before recovery"
```

Do not use:

```bash
git reset --hard
git clean -fd
git checkout .
```

unless you have a verified backup.
