import inquirer from 'inquirer';
import { loadConfig, saveConfig } from '../lib/config.js';
import { success, warn, error } from '../lib/ui.js';

export async function removeCommand(name?: string) {
  const config = loadConfig();
  const repos = Object.keys(config.repos);

  if (repos.length === 0) {
    warn('No repos registered.');
    return;
  }

  let alias: string;
  if (name) {
    if (!config.repos[name]) {
      error(`Repo "${name}" not found.`);
      return;
    }
    alias = name;
  } else {
    const { selected } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selected',
        message: 'Select repo to remove:',
        choices: repos,
      },
    ]);
    alias = selected;
  }

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: `Unregister "${alias}"? (worktrees on disk are not affected)`,
      default: false,
    },
  ]);

  if (!confirmed) {
    warn('Cancelled.');
    return;
  }

  delete config.repos[alias];

  if (config.defaults.repo === alias) {
    const remaining = Object.keys(config.repos);
    config.defaults.repo = remaining[0] || undefined;
  }

  saveConfig(config);
  success(`Repo "${alias}" removed from grove config.`);
}
