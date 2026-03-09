import { loadConfig } from '../lib/config.js';
import { listWorktrees } from '../lib/git.js';

export function pathCommand(name: string) {
  const config = loadConfig();
  const allWorktrees: { path: string; folderName: string }[] = [];

  for (const repo of Object.values(config.repos)) {
    const worktrees = listWorktrees(repo.gitRoot);
    const nonMain = worktrees.filter(
      (wt) =>
        !wt.bare &&
        wt.path.replace(/\\/g, '/') !== repo.gitRoot.replace(/\\/g, '/')
    );
    allWorktrees.push(...nonMain);
  }

  const match = fuzzyMatch(allWorktrees, name);

  if (!match) {
    process.stderr.write(`No worktree matching "${name}" found.\n`);
    process.exit(1);
  }

  // Output only the path to stdout (pipe-friendly)
  process.stdout.write(match.path);
}

function fuzzyMatch(
  worktrees: { path: string; folderName: string }[],
  query: string
): { path: string; folderName: string } | undefined {
  const q = query.toLowerCase();

  // Exact match
  const exact = worktrees.find((wt) => wt.folderName.toLowerCase() === q);
  if (exact) return exact;

  // Prefix match
  const prefix = worktrees.find((wt) =>
    wt.folderName.toLowerCase().startsWith(q)
  );
  if (prefix) return prefix;

  // Substring match
  const substr = worktrees.find((wt) =>
    wt.folderName.toLowerCase().includes(q)
  );
  if (substr) return substr;

  return undefined;
}
