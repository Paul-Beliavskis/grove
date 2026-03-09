import inquirer from 'inquirer';
import { join } from 'path';
import { loadConfig, getRepoConfig } from '../lib/config.js';
import {
  fetchOrigin,
  searchRemoteBranches,
  addWorktree,
} from '../lib/git.js';
import { runPostCreateHooks } from '../lib/hooks.js';
import { info, success, warn, error, ora } from '../lib/ui.js';

export async function workCommand(
  ticket: string,
  options: { repo?: string }
): Promise<string | null> {
  const config = loadConfig();
  const { name, repo } = getRepoConfig(config, options.repo);

  info(`Using repo: ${name}`);

  // Fetch origin
  const spinner = ora('Fetching from origin...').start();
  try {
    fetchOrigin(repo.gitRoot);
    spinner.succeed('Fetched latest from origin');
  } catch (err: any) {
    spinner.fail('Failed to fetch from origin');
    error(err.message);
    return null;
  }

  // Search for matching remote branches
  const matches = searchRemoteBranches(repo.gitRoot, ticket);

  let selectedBranch: string;

  if (matches.length === 0) {
    warn(`No remote branches matching "${ticket}"`);
    const { createNew } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'createNew',
        message: `Create new branch from ${repo.provider.targetBranches[0]}?`,
        default: true,
      },
    ]);

    if (!createNew) return null;

    const { branchName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'branchName',
        message: 'New branch name:',
        default: `feature/${ticket}`,
      },
    ]);

    selectedBranch = `origin/${repo.provider.targetBranches[0]}`;
    // The worktree add will create the branch from the start point
    const folderName = stripPrefixes(branchName, repo.branchPatterns.stripPrefixes);
    const worktreePath = join(repo.worktreeParentDir, folderName);

    info(`Creating worktree at ${worktreePath}`);
    try {
      addWorktree(repo.gitRoot, worktreePath, selectedBranch);
    } catch {
      error('Failed to create worktree');
      return null;
    }

    // Run hooks
    runPostCreateHooks(repo.hooks.postCreate, worktreePath, repo.gitRoot);
    success(`Worktree created: ${worktreePath}`);
    info(`Run 'gw ${folderName}' to cd into it`);
    return worktreePath;
  }

  if (matches.length === 1) {
    selectedBranch = matches[0];
  } else {
    const { branch } = await inquirer.prompt([
      {
        type: 'list',
        name: 'branch',
        message: 'Multiple branches found. Select one:',
        choices: matches,
      },
    ]);
    selectedBranch = branch;
  }

  info(`Using branch: ${selectedBranch}`);

  // Derive folder name
  const branchWithoutRemote = selectedBranch.replace(/^origin\//, '');
  const folderName = stripPrefixes(
    branchWithoutRemote,
    repo.branchPatterns.stripPrefixes
  );
  const worktreePath = join(repo.worktreeParentDir, folderName);

  info(`Creating worktree at ${worktreePath}`);
  try {
    addWorktree(repo.gitRoot, worktreePath, selectedBranch);
  } catch {
    error('Failed to create worktree');
    return null;
  }

  // Run post-create hooks
  runPostCreateHooks(repo.hooks.postCreate, worktreePath, repo.gitRoot);

  success(`Worktree created: ${worktreePath}`);
  info(`Run 'gw ${folderName}' to cd into it`);
  return worktreePath;
}

function stripPrefixes(branch: string, prefixes: string[]): string {
  for (const prefix of prefixes) {
    if (branch.startsWith(prefix)) {
      return branch.slice(prefix.length);
    }
  }
  return branch;
}
