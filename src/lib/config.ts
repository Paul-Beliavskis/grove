import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import inquirer from 'inquirer';
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

/**
 * Prompts the user to select a repo when multiple are configured and none was explicitly specified.
 * Returns the resolved repo name.
 */
export async function promptForRepo(config: GroveConfig, repoName?: string): Promise<string> {
  if (repoName) return repoName;

  const repoNames = Object.keys(config.repos);

  if (repoNames.length === 0) {
    throw new Error('No repos configured. Run `grove init` first.');
  }

  if (repoNames.length === 1) {
    return repoNames[0];
  }

  // Multiple repos: prompt the user
  const { selected } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selected',
      message: 'Which repo do you want to work in?',
      choices: repoNames,
      default: config.defaults.repo,
    },
  ]);

  return selected;
}
