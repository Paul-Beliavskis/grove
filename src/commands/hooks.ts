import { isAbsolute } from 'path';
import inquirer from 'inquirer';
import { loadConfig, saveConfig, getRepoConfig } from '../lib/config.js';
import { chalk, success, warn } from '../lib/ui.js';
import type { PostCreateHook, GroveConfig } from '../lib/types.js';

export async function hooksCommand(options: { repo?: string; global?: boolean }) {
  const config = loadConfig();

  // Determine scope: --global flag, --repo flag, or ask the user
  let scope: 'global' | 'repo';
  let repoName: string | undefined;

  if (options.global) {
    scope = 'global';
  } else if (options.repo) {
    scope = 'repo';
    repoName = options.repo;
  } else {
    const repoNames = Object.keys(config.repos);
    const choices: Array<{ name: string; value: string }> = [
      { name: 'Global (all repos)', value: '__global__' },
      ...repoNames.map((r) => ({
        name: r + (r === config.defaults.repo ? ' (default)' : ''),
        value: r,
      })),
    ];

    const { target } = await inquirer.prompt([
      {
        type: 'list',
        name: 'target',
        message: 'Configure hooks for:',
        choices,
      },
    ]);

    if (target === '__global__') {
      scope = 'global';
    } else {
      scope = 'repo';
      repoName = target;
    }
  }

  if (scope === 'global') {
    await manageHooks(config, 'Global', getGlobalHooks(config), (hooks) => {
      config.hooks = { postCreate: hooks };
    });
  } else {
    const { name, repo } = getRepoConfig(config, repoName);
    await manageHooks(config, name, repo.hooks.postCreate, (hooks) => {
      repo.hooks.postCreate = hooks;
    });
  }
}

function getGlobalHooks(config: GroveConfig): PostCreateHook[] {
  if (!config.hooks) {
    config.hooks = { postCreate: [] };
  }
  return config.hooks.postCreate;
}

async function manageHooks(
  config: GroveConfig,
  label: string,
  hooks: PostCreateHook[],
  save: (hooks: PostCreateHook[]) => void
) {
  let action: string;
  do {
    console.log(chalk.bold(`\nPost-create hooks — ${label}\n`));

    if (hooks.length === 0) {
      console.log(chalk.dim('  No hooks configured.\n'));
    } else {
      for (let i = 0; i < hooks.length; i++) {
        console.log(`  ${i + 1}. ${formatHook(hooks[i])}`);
      }
      console.log('');
    }

    ({ action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Add a hook', value: 'add' },
          ...(hooks.length > 0
            ? [{ name: 'Remove a hook', value: 'remove' }]
            : []),
          ...(hooks.length > 1
            ? [{ name: 'Reorder hooks', value: 'reorder' }]
            : []),
          { name: 'Done', value: 'done' },
        ],
      },
    ]));

    if (action === 'add') {
      const hook = await promptNewHook();
      if (hook) {
        hooks.push(hook);
        save(hooks);
        saveConfig(config);
        success(`Hook added: ${formatHook(hook)}`);
      }
    }

    if (action === 'remove') {
      const { index } = await inquirer.prompt([
        {
          type: 'list',
          name: 'index',
          message: 'Remove which hook?',
          choices: hooks.map((h, i) => ({
            name: `${i + 1}. ${formatHook(h)}`,
            value: i,
          })),
        },
      ]);
      const removed = hooks.splice(index, 1)[0];
      save(hooks);
      saveConfig(config);
      success(`Removed: ${formatHook(removed)}`);
    }

    if (action === 'reorder') {
      const { indices } = await inquirer.prompt([
        {
          type: 'input',
          name: 'indices',
          message: `Enter new order (e.g. "3,1,2" for ${hooks.length} hooks):`,
          validate: (v: string) => {
            const nums = v.split(',').map((s) => parseInt(s.trim(), 10));
            if (nums.some(isNaN)) return 'Enter only numbers separated by commas';
            const expected = Array.from({ length: hooks.length }, (_, i) => i + 1).sort();
            const sorted = [...nums].sort((a, b) => a - b);
            if (nums.length !== hooks.length) return `Enter exactly ${hooks.length} numbers`;
            if (JSON.stringify(sorted) !== JSON.stringify(expected))
              return `Use each number from 1 to ${hooks.length} exactly once`;
            return true;
          },
        },
      ]);
      const nums = indices.split(',').map((s: string) => parseInt(s.trim(), 10) - 1);
      const reordered = nums.map((i: number) => hooks[i]);
      hooks.splice(0, hooks.length, ...reordered);
      save(hooks);
      saveConfig(config);
      success('Hooks reordered.');
    }
  } while (action !== 'done');
}

function validateRelativePath(v: string): string | true {
  const t = v.trim();
  if (!t.length) return 'Path is required';
  if (isAbsolute(t)) return 'Path must be relative';
  if (t.startsWith('..')) return 'Path must not escape the root directory';
  return true;
}

async function promptNewHook(): Promise<PostCreateHook | null> {
  const { type } = await inquirer.prompt([
    {
      type: 'list',
      name: 'type',
      message: 'Hook type:',
      choices: [
        { name: 'shell       — run a shell command', value: 'shell' },
        { name: 'copy        — copy a file from the main repo', value: 'copy' },
        { name: 'npm-install — run npm install in a directory', value: 'npm-install' },
        { name: 'mkdir       — create a directory', value: 'mkdir' },
      ],
    },
  ]);

  switch (type) {
    case 'shell': {
      warn('Shell hooks run with your full user privileges. Only add commands you trust.');
      const { command } = await inquirer.prompt([
        {
          type: 'input',
          name: 'command',
          message: 'Shell command (runs from worktree root):',
          validate: (v: string) => v.trim().length > 0 || 'Command is required',
        },
      ]);
      return { type: 'shell', command: command.trim() };
    }
    case 'copy': {
      const { from, to } = await inquirer.prompt([
        {
          type: 'input',
          name: 'from',
          message: 'Source path (relative to git root):',
          validate: validateRelativePath,
        },
        {
          type: 'input',
          name: 'to',
          message: 'Destination path (relative to worktree root):',
          validate: validateRelativePath,
        },
      ]);
      return { type: 'copy', from: from.trim(), to: to.trim() };
    }
    case 'npm-install': {
      const { path } = await inquirer.prompt([
        {
          type: 'input',
          name: 'path',
          message: 'Directory containing package.json (relative to worktree, "." for root):',
          default: '.',
          validate: validateRelativePath,
        },
      ]);
      return { type: 'npm-install', path: path.trim() };
    }
    case 'mkdir': {
      const { path } = await inquirer.prompt([
        {
          type: 'input',
          name: 'path',
          message: 'Directory to create (relative to worktree root):',
          validate: validateRelativePath,
        },
      ]);
      return { type: 'mkdir', path: path.trim() };
    }
    default:
      return null;
  }
}

function formatHook(hook: PostCreateHook): string {
  const label = chalk.cyan(hook.type.padEnd(12));
  switch (hook.type) {
    case 'shell':
      return `${label}${hook.command}`;
    case 'copy':
      return `${label}${hook.from} → ${hook.to}`;
    case 'npm-install':
      return `${label}${hook.path}`;
    case 'mkdir':
      return `${label}${hook.path}`;
  }
}
