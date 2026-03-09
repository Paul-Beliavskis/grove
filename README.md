# grove

Git worktree manager CLI with PR review and AI integration. Works from anywhere, supports multiple repos, and streamlines the full worktree + AI-assisted PR review workflow.

## Install

```bash
npm install -g git-grove
```

## Quick Start

```bash
# Register a repo
grove init

# Create a worktree for a ticket
grove work BO-2048

# List worktrees
grove list

# Switch to a worktree (with shell integration)
gw BO-2048

# Review PRs
grove review

# Launch AI tool in a worktree
grove code BO-2048

# Clean up worktrees
grove cleanup
```

## Shell Integration

Add to your shell profile for the `gw` function (cd into worktrees) with tab completion:

**PowerShell:**
```powershell
Invoke-Expression (grove shell-init powershell)
```

**Bash/Zsh:**
```bash
eval "$(grove shell-init bash)"
```

## Commands

| Command | Description |
|---|---|
| `grove init` | Register a repo interactively |
| `grove work <ticket>` | Create worktree for a ticket/branch |
| `grove list` | List all worktrees across repos |
| `grove switch <name>` | Output worktree path (used by `gw`) |
| `grove cleanup [name]` | Remove worktrees (interactive if no name) |
| `grove review` | Browse and review PRs (Bitbucket/GitHub) |
| `grove code [name]` | Launch AI tool in a worktree |
| `grove repos` | List registered repos |
| `grove status` | Dashboard with dirty/ahead-behind status |
| `grove shell-init` | Output shell integration script |

## Git Providers

Grove supports **Bitbucket** and **GitHub**. Configure during `grove init`.

### Credential Auto-Detection

**Bitbucket:** Checks env vars (`ATLASSIAN_USER_EMAIL`/`ATLASSIAN_API_TOKEN`), `~/.claude.json` MCP server config, then git credential manager.

**GitHub:** Checks `GITHUB_TOKEN` env var, `gh auth token` (GitHub CLI), then git credential manager.

Grove never stores credentials itself.

## AI Integration

Configure your AI CLI tool once in `grove init`. Grove supports any CLI tool (Claude Code, Cursor, Aider, Copilot CLI, etc.).

- `grove review` can spawn your AI tool with a review prompt template
- `grove code` launches your AI tool with cwd set to a worktree

## Config

Stored at `~/.grove/config.json`. Supports multiple repos, each with their own provider, branch patterns, and post-create hooks (copy files, mkdir, npm install, shell commands).

## License

MIT
