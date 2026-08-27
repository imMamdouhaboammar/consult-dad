# Takeover Mode Reference

## Principle: Takeover Only When Asked

By default, Dad never touches files or makes commits.
When the worker completely exhausts diagnostic avenues and the human or controller requests takeover:

```bash
dad ask --mode takeover --allow-write "Resolve complex cyclic dependency in module loader"
```

## Takeover Invariants
1. **Isolated Worktree**: Changes occur in a separate worktree branch (`git worktree add`).
2. **Permission Gate**: Without `--allow-write`, `takeover` requests are rejected with `workspace_violation`.
3. **No Automatic Commits**: Dad outputs patch/diff artifacts. The Controller reviews and commits.
