import {
  copyFileSync,
  mkdirSync,
  existsSync,
} from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import type { PostCreateHook } from './types.js';
import { info, warn } from './ui.js';

export function runPostCreateHooks(
  hooks: PostCreateHook[],
  worktreePath: string,
  gitRoot: string
): void {
  for (const hook of hooks) {
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
          info('Running npm install...');
          execSync('npm install', { cwd: dir, stdio: 'inherit' });
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
}
