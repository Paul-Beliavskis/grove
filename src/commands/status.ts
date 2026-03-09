import { loadConfig } from '../lib/config.js';
import {
  listWorktrees,
  isWorktreeDirty,
  getAheadBehind,
} from '../lib/git.js';
import { createTable, warn, chalk } from '../lib/ui.js';

export function statusCommand(options: { noRemote?: boolean }) {
  const config = loadConfig();
  const repos = Object.entries(config.repos);

  if (repos.length === 0) {
    warn('No repos registered. Run `grove init` first.');
    return;
  }

  for (const [name, repo] of repos) {
    console.log(chalk.bold(`\n${name}`));

    const worktrees = listWorktrees(repo.gitRoot);
    const nonMain = worktrees.filter(
      (wt) =>
        !wt.bare &&
        wt.path.replace(/\\/g, '/') !== repo.gitRoot.replace(/\\/g, '/')
    );

    if (nonMain.length === 0) {
      warn('  No worktrees');
      continue;
    }

    const table = createTable({
      head: ['Folder', 'Branch', 'Dirty', 'Ahead/Behind'],
    });

    for (const wt of nonMain) {
      const dirty = isWorktreeDirty(wt.path);
      let abStr = '-';

      if (!options.noRemote) {
        const ab = getAheadBehind(wt.path);
        if (ab) {
          const parts: string[] = [];
          if (ab.ahead > 0) parts.push(chalk.green(`+${ab.ahead}`));
          if (ab.behind > 0) parts.push(chalk.red(`-${ab.behind}`));
          abStr = parts.length > 0 ? parts.join(' ') : 'up to date';
        }
      }

      table.push([
        wt.folderName,
        wt.branch,
        dirty ? chalk.yellow('yes') : chalk.green('no'),
        abStr,
      ]);
    }

    console.log(table.toString());
  }
}
