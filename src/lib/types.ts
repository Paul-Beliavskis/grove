export interface JiraConfig {
  host: string;
  email: string;
  token: string;
  boardId?: number;
}

export interface GroveConfig {
  version: number;
  ai?: AiConfig;
  jira?: JiraConfig;
  repos: Record<string, RepoConfig>;
  defaults: { repo?: string };
}

export interface AiConfig {
  command: string;
  reviewPrompt: string;
  args: string[];
}

export interface RepoConfig {
  gitRoot: string;
  worktreeParentDir: string;
  provider: ProviderConfig;
  branchPatterns: BranchPatterns;
  hooks: HooksConfig;
}

export type ProviderConfig = BitbucketProviderConfig | GitHubProviderConfig;

export interface BitbucketProviderConfig {
  type: 'bitbucket';
  workspace: string;
  repoSlug: string;
  targetBranches: string[];
}

export interface GitHubProviderConfig {
  type: 'github';
  owner: string;
  repo: string;
  targetBranches: string[];
}

export interface BranchPatterns {
  stripPrefixes: string[];
}

export interface HooksConfig {
  postCreate: PostCreateHook[];
}

export type PostCreateHook =
  | { type: 'copy'; from: string; to: string }
  | { type: 'mkdir'; path: string }
  | { type: 'npm-install'; path: string }
  | { type: 'shell'; command: string };

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
  bare: boolean;
  folderName: string;
}

export interface PullRequest {
  id: number;
  title: string;
  sourceBranch: string;
  targetBranch: string;
  author: string;
  url: string;
}

export interface GitProvider {
  listPRs(targetBranches?: string[]): Promise<PullRequest[]>;
  getPR(prId: number): Promise<PullRequest>;
}

export interface Credentials {
  type: 'basic';
  username: string;
  token: string;
}

export interface TokenCredentials {
  type: 'token';
  token: string;
}
