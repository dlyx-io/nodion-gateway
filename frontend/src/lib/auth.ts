const TOKEN_KEY = 'ngw_token';

export interface UserInfo {
  id: string;
  label: string;
  role: string;
  projects: string[];
  scopes: { scope: string; target: string; projectSlug: string }[];
}

let currentUser: UserInfo | null = null;

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  currentUser = null;
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function getUser(): UserInfo | null {
  return currentUser;
}

export function setUser(user: UserInfo): void {
  currentUser = user;
}

export function isAdmin(): boolean {
  return currentUser?.role === 'admin';
}

export async function login(token: string): Promise<UserInfo> {
  setToken(token);
  try {
    const res = await fetch('/api/me', {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!res.ok) {
      clearToken();
      throw new Error('Invalid API key');
    }
    const user: UserInfo = await res.json();
    setUser(user);
    return user;
  } catch (e) {
    clearToken();
    throw e;
  }
}

export async function checkSession(): Promise<boolean> {
  const token = getToken();
  if (!token) return false;
  try {
    await login(token);
    return true;
  } catch {
    return false;
  }
}
