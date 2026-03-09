import inquirer from 'inquirer';
import { loadConfig, saveConfig, configExists, getConfigPath } from '../lib/config.js';
import {
  detectBitbucketCredentials,
  detectGitHubCredentials,
  isCommandAvailable,
} from '../lib/credentials.js';
import { chalk, info, success, warn } from '../lib/ui.js';
import type { AiConfig, GroveConfig } from '../lib/types.js';

export async function setupCommand() {
  const config = configExists() ? loadConfig() : { version: 1, repos: {}, defaults: {} };
  const configPath = getConfigPath();

  // --- Print current state ---
  console.log(chalk.bold('\nGrove Setup\n'));

  // Config file
  console.log(chalk.bold('Config'));
  console.log(`  Path: ${configPath}`);
  console.log(`  Exists: ${configExists() ? chalk.green('yes') : chalk.yellow('no')}`);
  console.log('');

  // Repos
  console.log(chalk.bold('Repos'));
  const repos = Object.entries(config.repos);
  if (repos.length === 0) {
    console.log(chalk.yellow('  None registered. Run `grove init` in a git repo.'));
  } else {
    for (const [alias, repo] of repos) {
      const isDefault = config.defaults.repo === alias ? chalk.dim(' (default)') : '';
      const provider = repo.provider;
      const remote =
        provider.type === 'bitbucket'
          ? `${provider.workspace}/${provider.repoSlug}`
          : `${(provider as any).owner}/${(provider as any).repo}`;
      console.log(`  ${chalk.green(alias)}${isDefault} - ${provider.type} (${remote})`);
    }
  }
  console.log('');

  // Credentials - only show for providers in use
  const providers = new Set(repos.map(([, r]) => r.provider.type));
  if (providers.size > 0) {
    console.log(chalk.bold('Credentials'));
    if (providers.has('bitbucket')) {
      const bbCreds = detectBitbucketCredentials();
      if (bbCreds) {
        console.log(`  Bitbucket: ${chalk.green('found')} via ${bbCreds.source}`);
      } else {
        console.log(`  Bitbucket: ${chalk.yellow('not found')}`);
      }
    }
    if (providers.has('github')) {
      const ghCreds = detectGitHubCredentials();
      if (ghCreds) {
        console.log(`  GitHub:    ${chalk.green('found')} via ${ghCreds.source}`);
      } else {
        console.log(`  GitHub:    ${chalk.yellow('not found')}`);
      }
    }
    console.log('');
  }

  // Jira
  console.log(chalk.bold('Jira'));
  if (config.jira?.host && config.jira.email && config.jira.token) {
    console.log(`  Host:  ${chalk.green(config.jira.host)}`);
    console.log(`  Email: ${config.jira.email}`);
    console.log(`  Token: ${chalk.dim('****' + config.jira.token.slice(-4))}`);
    if (config.jira.boardId) {
      console.log(`  Board: id ${config.jira.boardId}`);
    }
  } else {
    console.log(chalk.yellow('  Not configured. Run `grove sprint` or configure here.'));
  }
  console.log('');

  // AI tool
  console.log(chalk.bold('AI Tool'));
  if (config.ai?.command) {
    const available = isCommandAvailable(config.ai.command);
    console.log(`  Command: ${config.ai.command} ${available ? chalk.green('(installed)') : chalk.red('(not found in PATH)')}`);
    console.log(`  Prompt:  ${config.ai.reviewPrompt.slice(0, 80)}${config.ai.reviewPrompt.length > 80 ? '...' : ''}`);
    if (config.ai.args.length > 0) {
      console.log(`  Args:    ${config.ai.args.join(' ')}`);
    }
  } else {
    console.log(chalk.yellow('  Not configured. AI review features are disabled.'));
  }
  console.log('');

  // Shell integration
  console.log(chalk.bold('Shell'));
  const groveAvailable = isCommandAvailable('grove');
  console.log(`  grove CLI: ${groveAvailable ? chalk.green('in PATH') : chalk.yellow('not in PATH (run npm link)')}`);
  console.log('');

  // --- Menu ---
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to configure?',
      choices: [
        { name: 'Jira credentials', value: 'jira' },
        { name: 'AI tool', value: 'ai' },
        { name: 'Default repo', value: 'default', disabled: repos.length === 0 ? 'no repos registered' : false },
        { name: 'Done', value: 'done' },
      ],
    },
  ]);

  if (action === 'done') return;

  if (action === 'jira') {
    await configureJira(config);
  }

  if (action === 'ai') {
    await configureAi(config);
  }

  if (action === 'default') {
    const { repo } = await inquirer.prompt([
      {
        type: 'list',
        name: 'repo',
        message: 'Default repo:',
        choices: Object.keys(config.repos),
        default: config.defaults.repo,
      },
    ]);
    config.defaults.repo = repo;
    saveConfig(config);
    success(`Default repo set to "${repo}".`);
  }
}

async function configureJira(config: GroveConfig) {
  info('Generate an API token at: https://id.atlassian.com/manage-profile/security/api-tokens');
  console.log('');

  const hasToken = !!config.jira?.token;

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
      message: hasToken
        ? 'Atlassian API token (leave blank to keep existing):'
        : 'Atlassian API token:',
      mask: '*',
      validate: (v: string) =>
        v.length > 0 || hasToken || 'Token is required',
    },
  ]);

  config.jira = {
    host: answers.host,
    email: answers.email,
    token: answers.token || config.jira?.token || '',
    boardId: config.jira?.boardId,
  };
  saveConfig(config);
  success('Jira credentials saved.');
}

async function configureAi(config: any) {
  // Detect available AI tools
  const tools = ['claude', 'cursor', 'aider', 'copilot', 'gh'];
  const detected = tools.filter(isCommandAvailable);

  const currentCommand = config.ai?.command || '';

  const { command } = await inquirer.prompt([
    {
      type: 'list',
      name: 'command',
      message: 'AI CLI tool:',
      choices: [
        ...detected.map((t) => ({
          name: `${t} (detected)`,
          value: t,
        })),
        new inquirer.Separator(),
        { name: 'Other (enter manually)', value: '__other__' },
        ...(config.ai ? [{ name: 'Remove AI config', value: '__remove__' }] : []),
      ],
      default: detected.includes(currentCommand) ? currentCommand : undefined,
    },
  ]);

  if (command === '__remove__') {
    delete config.ai;
    saveConfig(config);
    success('AI config removed.');
    return;
  }

  let finalCommand = command;
  if (command === '__other__') {
    const { custom } = await inquirer.prompt([
      { type: 'input', name: 'custom', message: 'AI CLI command:' },
    ]);
    finalCommand = custom;
  }

  // Determine default prompt based on what repos use
  const providers = new Set(Object.values(config.repos).map((r: any) => r.provider.type));
  let defaultPrompt = config.ai?.reviewPrompt || '';
  if (!defaultPrompt) {
    if (providers.has('bitbucket')) {
      defaultPrompt = 'Review PR #{prId} in {repoSlug}. The source branch is {branch} in workspace {workspace}. Provide a thorough code review analyzing code quality, potential bugs, and suggestions.';
    } else {
      defaultPrompt = 'Review PR #{prId} in {repoSlug}. The source branch is {branch}. Provide a thorough code review analyzing code quality, potential bugs, and suggestions.';
    }
  }

  const { reviewPrompt } = await inquirer.prompt([
    {
      type: 'input',
      name: 'reviewPrompt',
      message: 'Review prompt template:',
      default: defaultPrompt,
    },
  ]);

  const ai: AiConfig = {
    command: finalCommand,
    reviewPrompt,
    args: config.ai?.args || [],
  };

  config.ai = ai;
  saveConfig(config);
  success(`AI tool configured: ${finalCommand}`);
}
