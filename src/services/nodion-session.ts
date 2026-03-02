import { getServiceAccount } from './service-account-service.js';

const NODION_UI_BASE = 'https://api.nodion.com/ui/v1';

// ---------- Types ----------

interface SessionTokens {
  accessToken: string;
  tokenType: string;
  client: string;
  expiry: string;
  uid: string;
}

// ---------- In-memory session store ----------

const sessions = new Map<string, SessionTokens>();

// ---------- Token helpers ----------

function extractTokens(res: Response): SessionTokens | null {
  const accessToken = res.headers.get('access-token');
  const client = res.headers.get('client');
  if (!accessToken || !client) return null;

  return {
    accessToken,
    tokenType: res.headers.get('token-type') ?? 'Bearer',
    client,
    expiry: res.headers.get('expiry') ?? '',
    uid: res.headers.get('uid') ?? '',
  };
}

function makeHeaders(tokens: SessionTokens): Record<string, string> {
  return {
    'access-token': tokens.accessToken,
    'token-type': tokens.tokenType,
    'client': tokens.client,
    'expiry': tokens.expiry,
    'uid': tokens.uid,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
}

// ---------- Login ----------

async function login(accountId: string): Promise<SessionTokens> {
  const account = await getServiceAccount(accountId);
  if (!account) {
    throw new Error(`Service account not found: ${accountId}`);
  }

  const body: Record<string, string> = {
    email: account.email,
    password: account.passwordEncrypted,
  };

  // Generate TOTP code if a secret is configured
  if (account.totpSecretEncrypted) {
    try {
      const { TOTP } = await import('otpauth');
      const totp = new TOTP({ secret: account.totpSecretEncrypted });
      body.otp = totp.generate();
    } catch {
      // otpauth not installed or TOTP generation failed — proceed without OTP
    }
  }

  const res = await fetch(`${NODION_UI_BASE}/auth/sign_in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Nodion login failed for account ${accountId} (${account.email}): ${res.status} ${text}`,
    );
  }

  const tokens = extractTokens(res);
  if (!tokens) {
    throw new Error(
      `Nodion login succeeded but no auth tokens in response headers for account ${accountId}`,
    );
  }

  sessions.set(accountId, tokens);
  return tokens;
}

// ---------- Internal fetch ----------

async function doFetch(
  tokens: SessionTokens,
  path: string,
  method: string,
  body?: object,
): Promise<Response> {
  const url = `${NODION_UI_BASE}${path}`;
  const init: RequestInit = {
    method,
    headers: makeHeaders(tokens),
  };

  if (body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    init.body = JSON.stringify(body);
  }

  return fetch(url, init);
}

// ---------- Public API ----------

/**
 * Make a request to Nodion /ui/v1/ with automatic session management.
 *
 * - Lazy login: first call triggers sign-in
 * - Token rotation: every response's auth headers are stored
 * - Auto re-auth: on 401, re-login and retry once
 */
export async function fetchWithSession(
  accountId: string,
  path: string,
  method: string = 'GET',
  body?: object,
): Promise<Response> {
  // Ensure we have a session (lazy login)
  let tokens = sessions.get(accountId);
  if (!tokens) {
    tokens = await login(accountId);
  }

  // First attempt
  let res = await doFetch(tokens, path, method, body);

  // Rotate tokens from response (even on error responses)
  const rotated = extractTokens(res);
  if (rotated) {
    sessions.set(accountId, rotated);
  }

  // Auto re-auth on 401: login again and retry once
  if (res.status === 401) {
    tokens = await login(accountId);
    res = await doFetch(tokens, path, method, body);

    const retryRotated = extractTokens(res);
    if (retryRotated) {
      sessions.set(accountId, retryRotated);
    }
  }

  return res;
}

/** Clear the session for a specific account (e.g., on account deletion). */
export function clearSession(accountId: string): void {
  sessions.delete(accountId);
}

/** Clear all sessions (e.g., on shutdown). */
export function clearAllSessions(): void {
  sessions.clear();
}
