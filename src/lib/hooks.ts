import {
  copyFileSync,
  mkdirSync,
  existsSync,
} from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import type { PostCreateHook } from './types.js';
import { info, warn } from './ui.js';

/**
 * Runs post-create hooks. Global hooks run first, then repo-specific hooks.
 * A failing hook logs a warning but does not prevent subsequent hooks from running.
 */
export function runPostCreateHooks(
  repoHooks: PostCreateHook[],
  worktreePath: string,
  gitRoot: string,
  globalHooks: PostCreateHook[] = []
): void {
  const allHooks = [...globalHooks, ...repoHooks];
  for (const hook of allHooks) {
    try {
      runHook(hook, worktreePath, gitRoot);
    } catch (err: any) {
      warn(`Hook failed (${hook.type}): ${err.message ?? err}`);
    }
  }
}

function runHook(hook: PostCreateHook, worktreePath: string, gitRoot: string): void {
  switch (hook.type) {
    case 'copy': {
      const src = join(gitRoot, hook.from);
      const dest = join(worktreePath, hook.to);
      if (existsSync(src)) {
        mkdirSync(dirname(dest), { recursive: true });
        copyFileSync(src, dest);
        info(`Copied ${hook.from}`);
      } else {
        warn(`Source not found, skipped: ${hook.from}`);
      }
      break;
    }
    case 'mkdir': {
      const dir = join(worktreePath, hook.path);
      mkdirSync(dir, { recursive: true });
      info(`Created directory ${hook.path}`);
      break;
    }
    case 'npm-install': {
      const dir = hook.path === '.' ? worktreePath : join(worktreePath, hook.path);
      const pkgJson = join(dir, 'package.json');
      if (existsSync(pkgJson)) {
        info(`Running npm install in ${hook.path}...`);
        execSync('npm install', { cwd: dir, stdio: 'inherit' });
      } else {
        warn(`No package.json found at ${hook.path}, skipped npm install`);
      }
      break;
    }
    case 'shell': {
      info(`Running: ${hook.command}`);
      execSync(hook.command, { cwd: worktreePath, stdio: 'inherit' });
      break;
    }
  }
}
