import { loadConfig } from '../lib/config.js';
import { listWorktrees } from '../lib/git.js';
import { createTable, warn } from '../lib/ui.js';

export function reposCommand() {
  const config = loadConfig();
  const repos = Object.entries(config.repos);

  if (repos.length === 0) {
    warn('No repos registered. Run `grove init` first.');
    return;
  }

  const table = createTable({
    head: ['Alias', 'Git Root', 'Worktrees', 'Provider', 'Remote'],
  });

  for (const [alias, repo] of repos) {
    let worktreeCount: number;
    try {
      const wts = listWorktrees(repo.gitRoot);
      worktreeCount = wts.filter(
        (wt) =>
          !wt.bare &&
          wt.path.replace(/\\/g, '/') !== repo.gitRoot.replace(/\\/g, '/')
      ).length;
    } catch {
      worktreeCount = 0;
    }

    const provider = repo.provider;
    const remote =
      provider.type === 'bitbucket'
        ? `${provider.workspace}/${provider.repoSlug}`
        : `${provider.owner}/${provider.repo}`;

    const isDefault = config.defaults.repo === alias ? ' (default)' : '';

    table.push([
      `${alias}${isDefault}`,
      repo.gitRoot,
      String(worktreeCount),
      provider.type,
      remote,
    ]);
  }

  console.log(table.toString());
}
