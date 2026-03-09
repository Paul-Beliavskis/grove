import { loadConfig } from '../lib/config.js';
import { listWorktrees, isWorktreeDirty } from '../lib/git.js';
import { createTable, warn } from '../lib/ui.js';

export function listCommand(options: { namesOnly?: boolean }) {
  const config = loadConfig();
  const repos = Object.entries(config.repos);

  if (repos.length === 0) {
    warn('No repos registered. Run `grove init` first.');
    return;
  }

  for (const [name, repo] of repos) {
    const worktrees = listWorktrees(repo.gitRoot);
    // Exclude the main worktree (bare or gitRoot itself)
    const nonMain = worktrees.filter(
      (wt) => !wt.bare && wt.path.replace(/\\/g, '/') !== repo.gitRoot.replace(/\\/g, '/')
    );

    if (options.namesOnly) {
      for (const wt of nonMain) {
        console.log(wt.folderName);
      }
      continue;
    }

    if (repos.length > 1) {
      console.log(`\n${name}:`);
    }

    if (nonMain.length === 0) {
      warn('  No worktrees');
      continue;
    }

    const table = createTable({
      head: ['Folder', 'Branch', 'Status'],
    });

    for (const wt of nonMain) {
      const dirty = isWorktreeDirty(wt.path);
      table.push([
        wt.folderName,
        wt.branch,
        dirty ? 'modified' : 'clean',
      ]);
    }

    console.log(table.toString());
  }
}
