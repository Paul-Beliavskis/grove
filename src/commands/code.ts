import inquirer from 'inquirer';
import { loadConfig } from '../lib/config.js';
import { listWorktrees } from '../lib/git.js';
import { launchAiInWorktree } from '../lib/ai.js';
import { info, error, warn } from '../lib/ui.js';
import type { WorktreeInfo } from '../lib/types.js';

export async function codeCommand(name?: string) {
  const config = loadConfig();

  if (!config.ai?.command) {
    error('No AI tool configured. Add an "ai" block to ~/.grove/config.json:');
    console.log('  { "ai": { "command": "claude", "reviewPrompt": "...", "args": [] } }');
    return;
  }

  // Collect all non-main worktrees across repos
  const allWorktrees: WorktreeInfo[] = [];
  for (const repo of Object.values(config.repos)) {
    const wts = listWorktrees(repo.gitRoot);
    const nonMain = wts.filter(
      (wt) =>
        !wt.bare &&
        wt.path.replace(/\\/g, '/') !== repo.gitRoot.replace(/\\/g, '/')
    );
    allWorktrees.push(...nonMain);
  }

  if (allWorktrees.length === 0) {
    warn('No worktrees found. Create one with `grove work <ticket>`.');
    return;
  }

  let target: WorktreeInfo;

  if (name) {
    const q = name.toLowerCase();
    const match =
      allWorktrees.find((wt) => wt.folderName.toLowerCase() === q) ||
      allWorktrees.find((wt) => wt.folderName.toLowerCase().startsWith(q)) ||
      allWorktrees.find((wt) => wt.folderName.toLowerCase().includes(q));

    if (!match) {
      error(`No worktree matching "${name}"`);
      return;
    }
    target = match;
  } else {
    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Select worktree:',
        choices: allWorktrees.map((wt) => ({
          name: `${wt.folderName} (${wt.branch})`,
          value: wt,
        })),
      },
    ]);
    target = selected;
  }

  info(`Launching ${config.ai!.command} in ${target.folderName}...`);
  try {
    launchAiInWorktree(config.ai!, target.path);
  } catch (err: any) {
    error(`Failed to launch AI tool: ${err.message}`);
  }
}
