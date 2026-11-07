export interface GithubRepo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
}

export interface GithubIssue {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed';
  htmlUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface GithubPullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  htmlUrl: string;
  draft: boolean;
}

export interface GithubCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface GithubWebhookEvent {
  event: string;
  action?: string;
  repository?: { full_name: string };
  payload: Record<string, unknown>;
}
