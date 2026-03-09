import inquirer from 'inquirer';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { loadConfig, getRepoConfig } from '../lib/config.js';
import {
  listWorktrees,
  removeWorktree,
  pruneWorktrees,
  deleteBranch,
  isWorktreeDirty,
} from '../lib/git.js';
import { info, success, warn, error } from '../lib/ui.js';

export async function cleanupCommand(
  name?: string,
  options?: { repo?: string }
) {
  const config = loadConfig();
  const { name: repoName, repo } = getRepoConfig(config, options?.repo);

  const worktrees = listWorktrees(repo.gitRoot);
  const nonMain = worktrees.filter(
    (wt) =>
      !wt.bare &&
      wt.path.replace(/\\/g, '/') !== repo.gitRoot.replace(/\\/g, '/')
  );

  if (nonMain.length === 0) {
    warn('No worktrees to clean up.');
    return;
  }

  let selected: typeof nonMain;

  if (name) {
    const match = nonMain.filter((wt) =>
      wt.folderName.toLowerCase().includes(name.toLowerCase())
    );
    if (match.length === 0) {
      error(`No worktree matching "${name}"`);
      return;
    }
    selected = match;
  } else {
    const { chosen } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'chosen',
        message: 'Select worktrees to remove:',
        choices: nonMain.map((wt) => {
          const dirty = isWorktreeDirty(wt.path);
          return {
            name: `${wt.folderName} (${wt.branch})${dirty ? ' [modified]' : ''}`,
            value: wt,
          };
        }),
      },
    ]);

    if (chosen.length === 0) {
      warn('Nothing selected.');
      return;
    }
    selected = chosen;
  }

  for (const wt of selected) {
    // Warn about uncommitted changes
    if (isWorktreeDirty(wt.path)) {
      const { proceed } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: `${wt.folderName} has uncommitted changes. Remove anyway?`,
          default: false,
        },
      ]);
      if (!proceed) {
        info(`Skipped ${wt.folderName}`);
        continue;
      }
    }

    // Remove .vs folder first (Visual Studio lock issue)
    const vsFolder = join(wt.path, '.vs');
    if (existsSync(vsFolder)) {
      info('Removing .vs folder...');
      try {
        rmSync(vsFolder, { recursive: true, force: true });
      } catch (err: any) {
        warn(
          `Could not remove .vs folder: ${err.message}. Close Visual Studio and try again.`
        );
        continue;
      }
    }

    // Remove worktree
    try {
      removeWorktree(repo.gitRoot, wt.path);
    } catch {
      warn('git worktree remove failed. Trying manual removal...');
      try {
        rmSync(wt.path, { recursive: true, force: true });
        pruneWorktrees(repo.gitRoot);
      } catch (err: any) {
        error(`Could not remove folder: ${err.message}`);
        continue;
      }
    }

    // Clean up temp branch
    deleteBranch(repo.gitRoot, `${wt.folderName}-temp`);

    success(`Cleaned up: ${wt.folderName}`);
  }
}
