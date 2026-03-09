import { execSync } from 'child_process';
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

export function addWorktree(
  gitRoot: string,
  targetPath: string,
  branch: string
): void {
  execSync(`git worktree add "${targetPath}" "${branch}"`, {
    cwd: gitRoot,
    stdio: 'inherit',
  });
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
