import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { GroveConfig } from './types.js';

const CONFIG_DIR = join(homedir(), '.grove');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}

export function configExists(): boolean {
  return existsSync(CONFIG_PATH);
}

export function loadConfig(): GroveConfig {
  if (!existsSync(CONFIG_PATH)) {
    return createDefaultConfig();
  }
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw) as GroveConfig;
}

export function saveConfig(config: GroveConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function createDefaultConfig(): GroveConfig {
  return {
    version: 1,
    repos: {},
    defaults: {},
  };
}

export function getRepoConfig(config: GroveConfig, repoName?: string) {
  const name = repoName || config.defaults.repo;
  if (!name) {
    throw new Error(
      'No repo specified and no default repo set. Run `grove init` first or use --repo.'
    );
  }
  const repo = config.repos[name];
  if (!repo) {
    throw new Error(
      `Repo "${name}" not found in config. Run \`grove init\` to register it.`
    );
  }
  return { name, repo };
}
