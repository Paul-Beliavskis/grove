import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import type { Credentials, TokenCredentials } from './types.js';

const cache: Record<string, Credentials | TokenCredentials | null> = {};

export interface CredentialSource {
  credential: Credentials | TokenCredentials;
  source: string;
}

export function getBitbucketCredentials(): Credentials | null {
  return detectBitbucketCredentials()?.credential as Credentials | null;
}

export function detectBitbucketCredentials(): CredentialSource | null {
  if ('bitbucket' in cache) {
    return cache.bitbucket
      ? { credential: cache.bitbucket, source: bitbucketSourceCache || 'cached' }
      : null;
  }

  const sources: [() => Credentials | null, string][] = [
    [() => fromEnvVars('ATLASSIAN_USER_EMAIL', 'ATLASSIAN_API_TOKEN'), 'env vars (ATLASSIAN_USER_EMAIL)'],
    [() => fromClaudeConfig('@aashari/mcp-server-atlassian-bitbucket'), '~/.claude.json (MCP: @aashari/mcp-server-atlassian-bitbucket)'],
    [() => fromClaudeConfig('atlassian'), '~/.claude.json (MCP: atlassian)'],
    [() => fromGitCredentialManager('bitbucket.org'), 'git credential manager'],
  ];

  for (const [fn, source] of sources) {
    const cred = fn();
    if (cred) {
      cache.bitbucket = cred;
      bitbucketSourceCache = source;
      return { credential: cred, source };
    }
  }

  cache.bitbucket = null;
  return null;
}

let bitbucketSourceCache: string | undefined;
let githubSourceCache: string | undefined;

export function getGitHubToken(): TokenCredentials | null {
  return detectGitHubCredentials()?.credential as TokenCredentials | null;
}

export function detectGitHubCredentials(): CredentialSource | null {
  if ('github' in cache) {
    return cache.github
      ? { credential: cache.github, source: githubSourceCache || 'cached' }
      : null;
  }

  const sources: [() => TokenCredentials | null, string][] = [
    [() => fromEnvToken('GITHUB_TOKEN'), 'env var (GITHUB_TOKEN)'],
    [() => fromGhCli(), 'gh CLI (gh auth token)'],
    [() => fromGitCredentialManagerToken('github.com'), 'git credential manager'],
  ];

  for (const [fn, source] of sources) {
    const cred = fn();
    if (cred) {
      cache.github = cred;
      githubSourceCache = source;
      return { credential: cred, source };
    }
  }

  cache.github = null;
  return null;
}

function fromEnvVars(
  userKey: string,
  tokenKey: string
): Credentials | null {
  const username = process.env[userKey];
  const token = process.env[tokenKey];
  if (username && token) {
    return { type: 'basic', username, token };
  }
  return null;
}

function fromEnvToken(key: string): TokenCredentials | null {
  const token = process.env[key];
  if (token) return { type: 'token', token };
  return null;
}

function fromClaudeConfig(serverName: string): Credentials | null {
  const configPath = join(homedir(), '.claude.json');
  if (!existsSync(configPath)) return null;

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw);
    const servers = config.mcpServers || {};
    const server = servers[serverName];
    if (!server?.env) return null;

    const username =
      server.env.ATLASSIAN_USER_EMAIL || server.env.CONFLUENCE_USER_EMAIL;
    const token =
      server.env.ATLASSIAN_API_TOKEN || server.env.CONFLUENCE_API_TOKEN;

    if (username && token) {
      return { type: 'basic', username, token };
    }
  } catch {
    // Failed to parse, try next source
  }
  return null;
}

function fromGhCli(): TokenCredentials | null {
  try {
    const token = execSync('gh auth token', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (token) return { type: 'token', token };
  } catch {
    // gh not installed or not logged in
  }
  return null;
}

function fromGitCredentialManager(
  host: string
): Credentials | null {
  try {
    const input = `protocol=https\nhost=${host}\n\n`;
    const output = execSync('git credential fill', {
      input,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const lines = output.split('\n');
    let username = '';
    let password = '';
    for (const line of lines) {
      if (line.startsWith('username=')) username = line.slice(9);
      if (line.startsWith('password=')) password = line.slice(9);
    }
    if (username && password) {
      return { type: 'basic', username, token: password };
    }
  } catch {
    // git credential manager not available
  }
  return null;
}

function fromGitCredentialManagerToken(
  host: string
): TokenCredentials | null {
  const cred = fromGitCredentialManager(host);
  if (cred) return { type: 'token', token: cred.token };
  return null;
}

export function isCommandAvailable(command: string): boolean {
  try {
    const where = process.platform === 'win32' ? 'where' : 'which';
    execSync(`${where} ${command}`, { stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}
