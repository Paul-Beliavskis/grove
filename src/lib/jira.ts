import type { JiraConfig } from './types.js';

export interface JiraBoard {
  id: number;
  name: string;
  type: string;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: string;
}

export interface JiraIssue {
  key: string;
  summary: string;
  status: string;
  issueType: string;
}

function getAuthHeader(config: JiraConfig): string {
  return (
    'Basic ' +
    Buffer.from(`${config.email}:${config.token}`).toString('base64')
  );
}

async function jiraGet(config: JiraConfig, path: string): Promise<any> {
  const url = `https://${config.host}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: getAuthHeader(config),
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `Jira API error: ${res.status} ${res.statusText} - ${body}`
    );
  }
  return res.json();
}

export async function listBoards(config: JiraConfig): Promise<JiraBoard[]> {
  const data = await jiraGet(config, '/rest/agile/1.0/board?maxResults=50');
  return (data.values || []).map((b: any) => ({
    id: b.id,
    name: b.name,
    type: b.type,
  }));
}

export async function getActiveSprint(
  config: JiraConfig,
  boardId: number
): Promise<JiraSprint | null> {
  const data = await jiraGet(
    config,
    `/rest/agile/1.0/board/${boardId}/sprint?state=active&maxResults=1`
  );
  const sprints: any[] = data.values || [];
  if (sprints.length === 0) return null;
  return {
    id: sprints[0].id,
    name: sprints[0].name,
    state: sprints[0].state,
  };
}

export async function getMySprintIssues(
  config: JiraConfig,
  sprintId: number
): Promise<JiraIssue[]> {
  const data = await jiraGet(
    config,
    `/rest/agile/1.0/sprint/${sprintId}/issue?jql=assignee=currentUser() ORDER BY priority DESC&maxResults=50&fields=summary,status,issuetype`
  );
  return (data.issues || []).map((issue: any) => ({
    key: issue.key,
    summary: issue.fields.summary,
    status: issue.fields.status?.name || 'Unknown',
    issueType: issue.fields.issuetype?.name || 'Unknown',
  }));
}
