import { execSync } from 'child_process';
import type { AiConfig, ProviderConfig } from './types.js';

interface PromptVars {
  prId?: number;
  repoSlug?: string;
  workspace?: string;
  owner?: string;
  branch?: string;
  worktreePath?: string;
}

export function substitutePrompt(template: string, vars: PromptVars): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
  }
  // Handle {#prId} pattern (with # prefix)
  if (vars.prId !== undefined) {
    result = result.replace(/\{#prId\}/g, String(vars.prId));
    result = result.replace(/#\{prId\}/g, `#${vars.prId}`);
  }
  return result;
}

export function launchAiReview(
  aiConfig: AiConfig,
  provider: ProviderConfig,
  vars: PromptVars,
  cwd?: string
): void {
  const providerVars: PromptVars = { ...vars };
  if (provider.type === 'bitbucket') {
    providerVars.workspace = provider.workspace;
    providerVars.repoSlug = provider.repoSlug;
  } else if (provider.type === 'github') {
    providerVars.owner = provider.owner;
    providerVars.repoSlug = provider.repo;
  }

  const prompt = substitutePrompt(aiConfig.reviewPrompt, providerVars);
  const args = aiConfig.args.join(' ');
  const cmd = `${aiConfig.command} "${prompt}" ${args}`.trim();

  execSync(cmd, { cwd, stdio: 'inherit' });
}

export function launchAiInWorktree(
  aiConfig: AiConfig,
  worktreePath: string
): void {
  const args = aiConfig.args.join(' ');
  const cmd = `${aiConfig.command} ${args}`.trim();

  execSync(cmd, { cwd: worktreePath, stdio: 'inherit' });
}
