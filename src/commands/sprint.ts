import inquirer from 'inquirer';
import { join } from 'path';
import { loadConfig, saveConfig, getRepoConfig } from '../lib/config.js';
import {
  fetchOrigin,
  searchRemoteBranches,
  addWorktree,
} from '../lib/git.js';
import { runPostCreateHooks } from '../lib/hooks.js';
import {
  listBoards,
  getActiveSprint,
  getMySprintIssues,
  type JiraIssue,
} from '../lib/jira.js';
import { info, success, warn, error, ora, chalk } from '../lib/ui.js';
import type { JiraConfig } from '../lib/types.js';

async function ensureJiraConfig(config: ReturnType<typeof loadConfig>): Promise<JiraConfig | null> {
  if (config.jira?.host && config.jira.email && config.jira.token) {
    return config.jira;
  }

  warn('Jira not fully configured yet.');
  info('You need an Atlassian API token from:');
  info('https://id.atlassian.com/manage-profile/security/api-tokens');
  console.log('');

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'host',
      message: 'Jira Cloud host (e.g. yoursite.atlassian.net):',
      default: config.jira?.host,
      validate: (v: string) => v.includes('.') || 'Enter a valid hostname',
    },
    {
      type: 'input',
      name: 'email',
      message: 'Atlassian account email:',
      default: config.jira?.email,
      validate: (v: string) => v.includes('@') || 'Enter a valid email',
    },
    {
      type: 'password',
      name: 'token',
      message: 'Atlassian API token:',
      mask: '*',
      validate: (v: string) => v.length > 0 || 'Token is required',
    },
  ]);

  config.jira = {
    host: answers.host,
    email: answers.email,
    token: answers.token,
    boardId: config.jira?.boardId,
  };
  saveConfig(config);
  success('Jira credentials saved to ~/.grove/config.json');
  return config.jira;
}

export async function sprintCommand(options: { repo?: string }): Promise<string | null> {
  const config = loadConfig();

  // Ensure Jira is configured with credentials
  const jiraConfig = await ensureJiraConfig(config);
  if (!jiraConfig) return null;

  // Select board if not saved
  let boardId = jiraConfig.boardId;
  if (!boardId) {
    const spinner = ora('Loading Jira boards...').start();
    let boards;
    try {
      boards = await listBoards(jiraConfig);
      spinner.succeed(`Found ${boards.length} boards`);
    } catch (err: any) {
      spinner.fail('Failed to load boards');
      error(err.message);
      if (err.message.includes('401')) {
        warn('Check your email and API token. You can re-run `grove sprint` to re-enter credentials.');
        // Clear invalid credentials so user gets re-prompted
        config.jira = { host: config.jira!.host, email: '', token: '' };
        saveConfig(config);
      }
      return null;
    }

    if (boards.length === 0) {
      error('No boards found. Check your Jira permissions.');
      return null;
    }

    const { selectedBoard } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedBoard',
        message: 'Select a Jira board:',
        choices: boards.map((b) => ({
          name: `${b.name} (${b.type}, id: ${b.id})`,
          value: b.id,
        })),
        loop: false,
      },
    ]);

    boardId = selectedBoard;

    const { saveBoard } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveBoard',
        message: 'Save this board as default?',
        default: true,
      },
    ]);

    if (saveBoard) {
      config.jira!.boardId = boardId;
      saveConfig(config);
      success(`Default board saved (id: ${boardId})`);
    }
  }

  // Get active sprint
  const sprintSpinner = ora('Finding active sprint...').start();
  let sprint;
  try {
    sprint = await getActiveSprint(jiraConfig, boardId!);
  } catch (err: any) {
    sprintSpinner.fail('Failed to load sprint');
    error(err.message);
    return null;
  }

  if (!sprint) {
    sprintSpinner.fail('No active sprint found on this board.');
    return null;
  }
  sprintSpinner.succeed(`Active sprint: ${sprint.name}`);

  // Get issues assigned to current user
  const issuesSpinner = ora('Loading your issues...').start();
  let issues: JiraIssue[];
  try {
    issues = await getMySprintIssues(jiraConfig, sprint.id);
  } catch (err: any) {
    issuesSpinner.fail('Failed to load issues');
    error(err.message);
    return null;
  }

  if (issues.length === 0) {
    issuesSpinner.succeed('No issues assigned to you in this sprint.');
    return null;
  }
  issuesSpinner.succeed(`Found ${issues.length} issues`);

  // Let user pick a ticket
  const { selectedTicket } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedTicket',
      message: 'Select a ticket:',
      choices: issues.map((issue) => ({
        name: `${chalk.bold(issue.key)} ${issue.summary} ${chalk.dim(`[${issue.status}]`)}`,
        value: issue.key,
        short: issue.key,
      })),
      loop: false,
    },
  ]);

  // Now create a worktree for it — reusing work command logic
  const { name, repo } = getRepoConfig(config, options.repo);
  info(`Using repo: ${name}`);

  // Fetch origin
  const fetchSpinner = ora('Fetching from origin...').start();
  try {
    fetchOrigin(repo.gitRoot);
    fetchSpinner.succeed('Fetched latest from origin');
  } catch (err: any) {
    fetchSpinner.fail('Failed to fetch from origin');
    error(err.message);
    return null;
  }

  // Search for matching remote branches
  const matches = searchRemoteBranches(repo.gitRoot, selectedTicket);

  let selectedBranch: string;
  let branchName: string;
  let isNewBranch = false;

  if (matches.length === 0) {
    // No existing branch — create a new one
    const defaultBranch = `feature/${selectedTicket}`;
    const { newBranchName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newBranchName',
        message: 'No existing branch found. New branch name:',
        default: defaultBranch,
      },
    ]);

    branchName = newBranchName;
    selectedBranch = `origin/${repo.provider.targetBranches[0]}`;
    isNewBranch = true;
  } else if (matches.length === 1) {
    selectedBranch = matches[0];
    branchName = selectedBranch.replace(/^origin\//, '');
    info(`Found existing branch: ${selectedBranch}`);
  } else {
    const { branch } = await inquirer.prompt([
      {
        type: 'list',
        name: 'branch',
        message: 'Multiple branches found. Select one:',
        choices: [
          ...matches,
          new inquirer.Separator(),
          { name: 'Create new branch instead', value: '__new__' },
        ],
      },
    ]);

    if (branch === '__new__') {
      const { newBranchName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'newBranchName',
          message: 'New branch name:',
          default: `feature/${selectedTicket}`,
        },
      ]);
      branchName = newBranchName;
      selectedBranch = `origin/${repo.provider.targetBranches[0]}`;
      isNewBranch = true;
    } else {
      selectedBranch = branch;
      branchName = selectedBranch.replace(/^origin\//, '');
    }
  }

  // Create worktree — replace slashes with hyphens for folder name
  // e.g. feature/BO-352 -> feature-BO-352
  const folderName = branchName.replace(/\//g, '-');
  const worktreePath = join(repo.worktreeParentDir, folderName);

  info(`Creating worktree at ${worktreePath}`);
  let created: boolean;
  try {
    // When creating a new branch, use -b to name the local branch after the ticket.
    // When checking out an existing remote branch, git auto-creates the local tracking branch.
    created = addWorktree(repo.gitRoot, worktreePath, selectedBranch, isNewBranch ? branchName : undefined);
  } catch {
    error('Failed to create worktree');
    return null;
  }

  if (created) {
    // Run post-create hooks only for newly created worktrees
    runPostCreateHooks(repo.hooks.postCreate, worktreePath, repo.gitRoot);
    success(`Worktree created: ${worktreePath}`);
  } else {
    success(`Worktree already exists: ${worktreePath}`);
  }
  info(`Run 'gw ${folderName}' to cd into it`);
  return worktreePath;
}

