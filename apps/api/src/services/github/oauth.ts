/**
 * GitHub OAuth 2.0 service
 *
 * SECURITY RULES (PRD §9.3):
 * - All GitHub API calls are server-side only
 * - OAuth tokens are NEVER exposed to client-side JS
 * - Default scope: public_repo (user must explicitly opt-in for private repos)
 */

const GITHUB_CLIENT_ID     = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const GITHUB_CALLBACK_URL  = process.env.GITHUB_CALLBACK_URL!;

// Default: public repos only. User can grant private_repo scope later.
const DEFAULT_SCOPE = 'read:user,public_repo';

export interface GitHubUser {
  id:         number;
  login:      string;
  name:       string | null;
  avatar_url: string;
  email:      string | null;
}

export interface GitHubTokenResponse {
  access_token: string;
  token_type:   string;
  scope:        string;
}

/**
 * Step 1 — Build the GitHub OAuth authorization URL.
 * The `state` param prevents CSRF. Generate a random one per request.
 */
export function buildOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id:    GITHUB_CLIENT_ID,
    redirect_uri: GITHUB_CALLBACK_URL,
    scope:        DEFAULT_SCOPE,
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

/**
 * Step 2 — Exchange the authorization code for an access token.
 * Called ONLY from the callback route handler — never from client JS.
 */
export async function exchangeCodeForToken(code: string): Promise<GitHubTokenResponse> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
    body: JSON.stringify({
      client_id:     GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
      redirect_uri:  GITHUB_CALLBACK_URL,
    }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as GitHubTokenResponse & { error?: string };
  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error}`);
  }

  return data;
}

/**
 * Step 3 — Fetch the authenticated user's profile from GitHub API.
 * Token is used server-side ONLY — not forwarded to client.
 */
export async function fetchGitHubUser(accessToken: string): Promise<GitHubUser> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept':        'application/vnd.github.v3+json',
      'User-Agent':    'GitReport/3.0',
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub user fetch failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<GitHubUser>;
}
