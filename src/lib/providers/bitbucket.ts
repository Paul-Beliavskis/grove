import type {
  BitbucketProviderConfig,
  GitProvider,
  PullRequest,
} from '../types.js';
import { getBitbucketCredentials } from '../credentials.js';

export function createBitbucketProvider(
  config: BitbucketProviderConfig
): GitProvider {
  const creds = getBitbucketCredentials();
  if (!creds) {
    throw new Error(
      'Bitbucket credentials not found. Set ATLASSIAN_USER_EMAIL and ATLASSIAN_API_TOKEN env vars, or configure them in ~/.claude.json'
    );
  }

  const authHeader =
    'Basic ' +
    Buffer.from(`${creds.username}:${creds.token}`).toString('base64');

  const baseUrl = `https://api.bitbucket.org/2.0/repositories/${config.workspace}/${config.repoSlug}`;

  async function apiGet(path: string) {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { Authorization: authHeader },
    });
    if (!res.ok) {
      throw new Error(`Bitbucket API error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }

  return {
    async listPRs(targetBranches?: string[]): Promise<PullRequest[]> {
      const targets = targetBranches || config.targetBranches;
      const data = await apiGet('/pullrequests?state=OPEN&pagelen=50');
      const values: any[] = data.values || [];

      return values
        .filter(
          (pr: any) =>
            !targets.length ||
            targets.includes(pr.destination.branch.name)
        )
        .map((pr: any) => ({
          id: pr.id,
          title: pr.title,
          sourceBranch: pr.source.branch.name,
          targetBranch: pr.destination.branch.name,
          author: pr.author?.display_name || 'unknown',
          url: pr.links?.html?.href || '',
        }));
    },

    async getPR(prId: number): Promise<PullRequest> {
      const pr = await apiGet(`/pullrequests/${prId}`);
      return {
        id: pr.id,
        title: pr.title,
        sourceBranch: pr.source.branch.name,
        targetBranch: pr.destination.branch.name,
        author: pr.author?.display_name || 'unknown',
        url: pr.links?.html?.href || '',
      };
    },
  };
}
