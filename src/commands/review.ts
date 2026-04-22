import inquirer from 'inquirer';
import { loadConfig, getRepoConfig, promptForRepo } from '../lib/config.js';
import { createProvider } from '../lib/providers/types.js';
import { launchAiReview } from '../lib/ai.js';
import { info, error, ora, truncate } from '../lib/ui.js';
import { workCommand } from './work.js';

export async function reviewCommand(options: { repo?: string }) {
  const config = loadConfig();
  const repoName = await promptForRepo(config, options.repo);
  const { name, repo } = getRepoConfig(config, repoName);

  info(`Fetching PRs for ${name} (${repo.provider.type})...`);

  const spinner = ora('Loading pull requests...').start();
  let prs;
  try {
    const provider = createProvider(repo.provider);
    prs = await provider.listPRs([]);
    spinner.succeed(`Found ${prs.length} open PR(s)`);
  } catch (err: any) {
    spinner.fail('Failed to fetch PRs');
    error(err.message);
    return;
  }

  if (prs.length === 0) {
    info('No open PRs matching target branches.');
    return;
  }

  // Select PR
  const { selectedPr } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedPr',
      message: 'Select a PR:',
      choices: [
        ...prs.map((pr) => ({
          name: `#${pr.id} - ${truncate(pr.title, 50)} (${pr.sourceBranch} → ${pr.targetBranch})`,
          value: pr,
        })),
        new inquirer.Separator(),
        { name: 'Cancel', value: null },
      ],
    },
  ]);

  if (!selectedPr) return;

  // Choose action - only show AI options if configured
  const hasAi = !!config.ai?.command;
  const choices = [
    { name: 'Create worktree only', value: 'worktree' },
    ...(hasAi
      ? [
          { name: 'Create worktree + AI review', value: 'both' },
          { name: 'AI review only (no worktree)', value: 'ai' },
        ]
      : []),
  ];

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices,
    },
  ]);

  let worktreePath: string | null = null;

  if (action === 'worktree' || action === 'both') {
    worktreePath = await workCommand(selectedPr.sourceBranch, { repo: name });
  }

  if (action === 'ai' || action === 'both') {
    const cwd = worktreePath || repo.gitRoot;
    info(`Launching AI review in ${cwd}...`);
    try {
      launchAiReview(config.ai!, repo.provider, {
        prId: selectedPr.id,
        branch: selectedPr.sourceBranch,
        worktreePath: cwd,
      }, cwd);
    } catch (err: any) {
      error(`AI review failed: ${err.message}`);
    }
  }
}
