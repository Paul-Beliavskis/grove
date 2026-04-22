# Release Notes

## New: `grove hooks` command

Manage post-create hooks interactively from the CLI instead of hand-editing `config.json`. Add, remove, and reorder hooks that run automatically when a worktree is created.

```bash
grove hooks              # choose global or repo-specific
grove hooks --global     # manage hooks for all repos
grove hooks -r myrepo    # manage hooks for a specific repo
```

Four hook types are supported: `shell`, `copy`, `npm-install`, and `mkdir`.

## New: Global hooks

Hooks can now be configured at the top level so they run for **every repo**, not just a specific one. Global hooks execute first, followed by repo-specific hooks.

## Fix: Detached HEAD on worktree checkout

Previously, worktree creation relied on git's DWIM (Do What I Mean) to create local tracking branches from remote refs. This didn't always work, leaving the worktree in a detached HEAD state. Grove now explicitly checks whether the local branch exists and uses `git worktree add -b` when needed.

## Fix: Hooks no longer abort on failure

If a hook fails (e.g. `npm install` exits non-zero), the remaining hooks now still run. Previously a single failure would stop all subsequent hooks from executing.

## Improved: Sprint ticket sorting

Tickets in `grove sprint` are now sorted by status — Open/To Do appear first, followed by In Progress, In Review, and Done/Closed last.

## Minor

- `npm-install` hooks now warn when no `package.json` is found instead of silently skipping
- `ensureBranch` warns when it fails to switch a reused worktree to the expected branch
- Path inputs in `grove hooks` are validated against directory traversal and absolute paths
- Shell hooks display a privilege warning before accepting input
- Branch name inputs in `sprint` are validated and trimmed
