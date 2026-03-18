import { Command } from 'commander';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

const program = new Command();

program
  .name('grove')
  .description('Git worktree manager with PR review and AI integration')
  .version(pkg.version);

program
  .command('setup')
  .description('View config and configure AI, credentials, defaults')
  .action(async () => {
    const { setupCommand } = await import('./commands/setup.js');
    await setupCommand();
  });

program
  .command('init')
  .description('Register a repo with grove')
  .option('--path <path>', 'Path to git repository')
  .action(async (options) => {
    const { initCommand } = await import('./commands/init.js');
    await initCommand(options);
  });

program
  .command('work <ticket>')
  .description('Create a worktree for a ticket/branch')
  .option('-r, --repo <name>', 'Repo alias to use')
  .action(async (ticket, options) => {
    const { workCommand } = await import('./commands/work.js');
    await workCommand(ticket, options);
  });

program
  .command('sprint')
  .description('Pick a ticket from your active sprint and create a worktree')
  .option('-r, --repo <name>', 'Repo alias to use')
  .action(async (options) => {
    const { sprintCommand } = await import('./commands/sprint.js');
    await sprintCommand(options);
  });

program
  .command('list')
  .description('List all worktrees')
  .option('--names-only', 'Output only folder names')
  .action(async (options) => {
    const { listCommand } = await import('./commands/list.js');
    listCommand(options);
  });

program
  .command('path <name>')
  .description('Output worktree path for cd (use with gw shell function)')
  .action(async (name) => {
    const { pathCommand } = await import('./commands/path.js');
    pathCommand(name);
  });

program
  .command('cleanup [name]')
  .description('Remove worktrees')
  .option('-r, --repo <name>', 'Repo alias to use')
  .action(async (name, options) => {
    const { cleanupCommand } = await import('./commands/cleanup.js');
    await cleanupCommand(name, options);
  });

program
  .command('review')
  .description('Browse and review pull requests')
  .option('-r, --repo <name>', 'Repo alias to use')
  .action(async (options) => {
    const { reviewCommand } = await import('./commands/review.js');
    await reviewCommand(options);
  });

program
  .command('code [name]')
  .description('Launch AI tool in a worktree')
  .action(async (name) => {
    const { codeCommand } = await import('./commands/code.js');
    await codeCommand(name);
  });

program
  .command('remove [name]')
  .description('Unregister a repo from grove')
  .action(async (name) => {
    const { removeCommand } = await import('./commands/remove.js');
    await removeCommand(name);
  });

program
  .command('repos')
  .description('List registered repos')
  .action(async () => {
    const { reposCommand } = await import('./commands/repos.js');
    reposCommand();
  });

program
  .command('hooks')
  .description('Manage post-create hooks (global or per-repo)')
  .option('-r, --repo <name>', 'Repo alias to use')
  .option('-g, --global', 'Configure global hooks (all repos)')
  .action(async (options) => {
    const { hooksCommand } = await import('./commands/hooks.js');
    await hooksCommand(options);
  });

program
  .command('status')
  .description('Dashboard view of all worktrees')
  .option('--no-remote', 'Skip remote checks (fast local-only mode)')
  .action(async (options) => {
    const { statusCommand } = await import('./commands/status.js');
    statusCommand({ noRemote: !options.remote });
  });

program
  .command('shell-init [shell]')
  .description('Output shell integration (powershell or bash)')
  .action(async (shell) => {
    const { shellInitCommand } = await import('./commands/shell-init.js');
    shellInitCommand(shell);
  });

program.parse();
