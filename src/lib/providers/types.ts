import type { GitProvider, ProviderConfig } from '../types.js';
import { createBitbucketProvider } from './bitbucket.js';
import { createGitHubProvider } from './github.js';

export function createProvider(config: ProviderConfig): GitProvider {
  switch (config.type) {
    case 'bitbucket':
      return createBitbucketProvider(config);
    case 'github':
      return createGitHubProvider(config);
    default:
      throw new Error(
        `Unknown provider type: ${(config as { type: string }).type}`
      );
  }
}
