import inquirer from 'inquirer';
import { loadConfig, saveConfig, configExists } from '../lib/config.js';
import { getGitRoot, getRemoteUrl, parseRemoteUrl } from '../lib/git.js';
import { success, info, warn, error } from '../lib/ui.js';
import type {
  GroveConfig,
  RepoConfig,
  ProviderConfig,
  PostCreateHook,
} from '../lib/types.js';

export async function initCommand(options: { path?: string }) {
  const config = configExists() ? loadConfig() : createFreshConfig();

  // Detect git root
  let gitRoot: string;
  if (options.path) {
    gitRoot = options.path;
  } else {
    try {
      gitRoot = getGitRoot();
    } catch {
      const answer = await inquirer.prompt([
        {
          type: 'input',
          name: 'path',
          message: 'Not in a git repo. Path to git repository:',
        },
      ]);
      gitRoot = answer.path;
    }
  }

  // Auto-detect from remote URL
  const remoteUrl = getRemoteUrl(gitRoot);
  const parsed = remoteUrl ? parseRemoteUrl(remoteUrl) : null;

  const alias = gitRoot.split(/[\\/]/).pop() || 'repo';
  const worktreeParentDir = gitRoot.split(/[\\/]/).slice(0, -1).join('/');

  // Build provider config from detected values
  let provider: ProviderConfig;
  if (parsed?.provider === 'bitbucket') {
    provider = {
      type: 'bitbucket',
      workspace: parsed.owner,
      repoSlug: parsed.repo,
      targetBranches: ['develop', 'master'],
    };
  } else if (parsed?.provider === 'github') {
    provider = {
      type: 'github',
      owner: parsed.owner,
      repo: parsed.repo,
      targetBranches: ['main'],
    };
  } else {
    // Couldn't detect - ask
    warn('Could not detect provider from remote URL.');
    const providerAnswers = await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: 'Git provider:',
        choices: ['bitbucket', 'github'],
      },
    ]);

    if (providerAnswers.type === 'bitbucket') {
      const bb = await inquirer.prompt([
        { type: 'input', name: 'workspace', message: 'Bitbucket workspace:' },
        { type: 'input', name: 'repoSlug', message: 'Bitbucket repo slug:' },
      ]);
      provider = {
        type: 'bitbucket',
        workspace: bb.workspace,
        repoSlug: bb.repoSlug,
        targetBranches: ['develop', 'master'],
      };
    } else {
      const gh = await inquirer.prompt([
        { type: 'input', name: 'owner', message: 'GitHub owner/org:' },
        { type: 'input', name: 'repo', message: 'GitHub repo name:' },
      ]);
      provider = {
        type: 'github',
        owner: gh.owner,
        repo: gh.repo,
        targetBranches: ['main'],
      };
    }
  }

  // Show summary and confirm
  const remote =
    provider.type === 'bitbucket'
      ? `${provider.workspace}/${provider.repoSlug}`
      : `${(provider as any).owner}/${(provider as any).repo}`;

  console.log('');
  info('Detected repo settings:');
  console.log('');
  console.log(`  Alias:     ${alias}`);
  console.log(`  Git root:  ${gitRoot}`);
  console.log(`  Worktrees: ${worktreeParentDir}`);
  console.log(`  Provider:  ${provider.type} (${remote})`);
  console.log(`  Targets:   ${provider.targetBranches.join(', ')}`);
  console.log('');

  const { confirmed } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message: 'Register this repo?',
      default: true,
    },
  ]);

  if (!confirmed) {
    warn('Cancelled.');
    return;
  }

  const repoConfig: RepoConfig = {
    gitRoot,
    worktreeParentDir,
    provider,
    branchPatterns: {
      stripPrefixes: ['feature/', 'bugfix/', 'hotfix/'],
    },
    hooks: { postCreate: [] },
  };

  config.repos[alias] = repoConfig;

  if (!config.defaults.repo) {
    config.defaults.repo = alias;
  }

  saveConfig(config);
  success(`Repo "${alias}" registered. Config saved to ~/.grove/config.json`);
  info('Edit ~/.grove/config.json to add post-create hooks or adjust settings.');
}

function createFreshConfig(): GroveConfig {
  return {
    version: 1,
    repos: {},
    defaults: {},
  };
}
