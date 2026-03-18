import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import type { WorktreeInfo } from './types.js';
import { basename } from 'path';

function git(args: string, cwd: string): string {
  return execSync(`git ${args}`, { cwd, encoding: 'utf-8' }).trim();
}

export function getGitRoot(cwd?: string): string {
  return git('rev-parse --show-toplevel', cwd || process.cwd());
}

export function fetchOrigin(gitRoot: string): void {
  execSync('git fetch origin', { cwd: gitRoot, stdio: 'inherit' });
}

export function listWorktrees(gitRoot: string): WorktreeInfo[] {
  const output = git('worktree list --porcelain', gitRoot);
  const worktrees: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> = {};

  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.path) {
        worktrees.push(finalizeWorktree(current));
      }
      current = { path: line.slice(9) };
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice(5);
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice(7).replace('refs/heads/', '');
    } else if (line === 'bare') {
      current.bare = true;
    }
  }
  if (current.path) {
    worktrees.push(finalizeWorktree(current));
  }
  return worktrees;
}

function finalizeWorktree(partial: Partial<WorktreeInfo>): WorktreeInfo {
  return {
    path: partial.path!,
    branch: partial.branch || '(detached)',
    head: partial.head || '',
    bare: partial.bare || false,
    folderName: basename(partial.path!),
  };
}

export function searchRemoteBranches(
  gitRoot: string,
  pattern: string
): string[] {
  const output = git('branch -r', gitRoot);
  return output
    .split('\n')
    .map((b) => b.trim())
    .filter((b) => b && !b.includes('->'))
    .filter((b) => b.toLowerCase().includes(pattern.toLowerCase()));
}

/**
 * Ensures a worktree is on the expected local branch, switching from detached
 * HEAD or a wrong branch if needed.
 */
function ensureBranch(
  worktreePath: string,
  localBranch: string,
  remoteBranch: string
): void {
  try {
    execSync(`git checkout "${localBranch}"`, {
      cwd: worktreePath,
      stdio: 'inherit',
    });
  } catch {
    // Local branch may not exist yet — create it tracking the remote
    try {
      execSync(
        `git checkout -b "${localBranch}" "${remoteBranch}"`,
        { cwd: worktreePath, stdio: 'inherit' }
      );
    } catch {
      console.error(
        `Warning: could not switch worktree to branch "${localBranch}" — it may be in a detached HEAD state.`
      );
    }
  }
}

/**
 * Creates a worktree at the target path. Returns true if a new worktree was
 * created, or false if the path was already a valid worktree.
 */
export function addWorktree(
  gitRoot: string,
  targetPath: string,
  branch: string,
  newBranch?: string
): boolean {
  // Safety: ensure targetPath is a child of some parent directory and not the
  // parent itself.  An empty folder name would resolve targetPath to the
  // worktree parent dir and the subsequent rmSync would destroy everything.
  const resolvedTarget = resolve(targetPath);
  const resolvedParent = resolve(dirname(targetPath));
  if (resolvedTarget === resolvedParent || resolvedTarget === resolve(gitRoot)) {
    throw new Error(`Refusing to create worktree at unsafe path: ${targetPath}`);
  }

  if (existsSync(targetPath)) {
    // Check if it's already a registered worktree
    const normalized = resolve(targetPath).replace(/\\/g, '/');
    const worktrees = listWorktrees(gitRoot);
    const existing = worktrees.find(
      (wt) => resolve(wt.path).replace(/\\/g, '/') === normalized
    );
    if (existing) {
      // Already a valid worktree — ensure it's on the expected branch
      const expectedBranch = newBranch || branch.replace(/^origin\//, '');
      if (existing.branch !== expectedBranch) {
        ensureBranch(targetPath, expectedBranch, branch);
      }
      return false;
    }
    // Stale leftover directory — prune git's worktree list and remove it
    pruneWorktrees(gitRoot);
    rmSync(targetPath, { recursive: true, force: true });
  }

  // When creating a new local branch (-b), we need the full remote ref as the
  // start-point (e.g. origin/main).  When checking out an existing remote
  // branch, explicitly create a local tracking branch with -b rather than
  // relying on git's DWIM, which can silently produce a detached HEAD.
  let cmd: string;
  if (newBranch) {
    cmd = `git worktree add -b "${newBranch}" "${targetPath}" "${branch}"`;
  } else {
    const localBranch = branch.replace(/^origin\//, '');
    let localExists = false;
    try {
      git(`rev-parse --verify "refs/heads/${localBranch}"`, gitRoot);
      localExists = true;
    } catch {
      // local branch does not exist yet
    }
    cmd = localExists
      ? `git worktree add "${targetPath}" "${localBranch}"`
      : `git worktree add -b "${localBranch}" "${targetPath}" "${branch}"`;
  }

  execSync(cmd, {
    cwd: gitRoot,
    stdio: 'inherit',
  });
  return true;
}

export function removeWorktree(gitRoot: string, worktreePath: string): void {
  execSync(`git worktree remove "${worktreePath}" --force`, {
    cwd: gitRoot,
    stdio: 'inherit',
  });
}

export function pruneWorktrees(gitRoot: string): void {
  execSync('git worktree prune', { cwd: gitRoot, stdio: 'inherit' });
}

export function deleteBranch(gitRoot: string, branchName: string): void {
  try {
    const exists = git(`branch --list "${branchName}"`, gitRoot);
    if (exists.trim()) {
      execSync(`git branch -D "${branchName}"`, {
        cwd: gitRoot,
        stdio: 'inherit',
      });
    }
  } catch {
    // Branch doesn't exist, ignore
  }
}

export function isWorktreeDirty(worktreePath: string): boolean {
  try {
    const status = git('status --porcelain', worktreePath);
    return status.length > 0;
  } catch {
    return false;
  }
}

export function getAheadBehind(
  worktreePath: string
): { ahead: number; behind: number } | null {
  try {
    const output = git(
      'rev-list --left-right --count HEAD...@{upstream}',
      worktreePath
    );
    const [ahead, behind] = output.split('\t').map(Number);
    return { ahead, behind };
  } catch {
    return null;
  }
}

export function createBranch(
  gitRoot: string,
  branchName: string,
  startPoint: string
): void {
  execSync(`git branch "${branchName}" "${startPoint}"`, {
    cwd: gitRoot,
    stdio: 'inherit',
  });
}

export function getRemoteUrl(gitRoot: string): string | null {
  try {
    return git('remote get-url origin', gitRoot);
  } catch {
    return null;
  }
}

export interface ParsedRemote {
  provider: 'bitbucket' | 'github';
  owner: string;
  repo: string;
}

export function parseRemoteUrl(url: string): ParsedRemote | null {
  // HTTPS: https://bitbucket.org/workspace/repo.git
  // SSH:   git@bitbucket.org:workspace/repo.git
  // HTTPS: https://github.com/owner/repo.git
  // SSH:   git@github.com:owner/repo.git
  const httpsMatch = url.match(
    /(?:https?:\/\/)(?:[^@]+@)?([^/]+)\/([^/]+)\/([^/\s]+?)(?:\.git)?$/
  );
  if (httpsMatch) {
    const [, host, owner, repo] = httpsMatch;
    const provider = host.includes('bitbucket') ? 'bitbucket' : 'github';
    return { provider, owner, repo };
  }

  const sshMatch = url.match(/git@([^:]+):([^/]+)\/([^/\s]+?)(?:\.git)?$/);
  if (sshMatch) {
    const [, host, owner, repo] = sshMatch;
    const provider = host.includes('bitbucket') ? 'bitbucket' : 'github';
    return { provider, owner, repo };
  }

  return null;
}
