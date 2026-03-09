import type {
  GitHubProviderConfig,
  GitProvider,
  PullRequest,
} from '../types.js';
import { getGitHubToken } from '../credentials.js';

export function createGitHubProvider(
  config: GitHubProviderConfig
): GitProvider {
  const creds = getGitHubToken();
  if (!creds) {
    throw new Error(
      'GitHub credentials not found. Set GITHUB_TOKEN env var, install gh CLI, or configure git credential manager.'
    );
  }

  const baseUrl = `https://api.github.com/repos/${config.owner}/${config.repo}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${creds.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  async function apiGet(path: string) {
    const res = await fetch(`${baseUrl}${path}`, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  return {
    async listPRs(targetBranches?: string[]): Promise<PullRequest[]> {
      const targets = targetBranches || config.targetBranches;
      const data: any[] = await apiGet('/pulls?state=open&per_page=50');

      return data
        .filter(
          (pr: any) => !targets.length || targets.includes(pr.base.ref)
        )
        .map((pr: any) => ({
          id: pr.number,
          title: pr.title,
          sourceBranch: pr.head.ref,
          targetBranch: pr.base.ref,
          author: pr.user?.login || 'unknown',
          url: pr.html_url || '',
        }));
    },

    async getPR(prId: number): Promise<PullRequest> {
      const pr = await apiGet(`/pulls/${prId}`);
      return {
        id: pr.number,
        title: pr.title,
        sourceBranch: pr.head.ref,
        targetBranch: pr.base.ref,
        author: pr.user?.login || 'unknown',
        url: pr.html_url || '',
      };
    },
  };
}
