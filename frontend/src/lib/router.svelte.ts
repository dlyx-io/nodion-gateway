/** Minimal hash-based router for Svelte 5 */

function getHash(): string {
  return window.location.hash.slice(1) || '/';
}

let currentPath = $state(getHash());

function onHashChange() {
  currentPath = getHash();
}

window.addEventListener('hashchange', onHashChange);

export function navigate(path: string): void {
  window.location.hash = '#' + path;
}

export function getPath(): string {
  return currentPath;
}

interface CompiledRoute {
  pattern: string;
  regex: RegExp;
  keys: string[];
}

function compileRoute(pattern: string): CompiledRoute {
  const keys: string[] = [];
  const regexStr = pattern.replace(/:([^/]+)/g, (_match, key) => {
    keys.push(key);
    return '([^/]+)';
  });
  return { pattern, regex: new RegExp('^' + regexStr + '$'), keys };
}

export function matchRoute(
  routes: Record<string, any>,
  path: string,
): { component: any; params: Record<string, string> } | null {
  for (const [pattern, component] of Object.entries(routes)) {
    const compiled = compileRoute(pattern);
    const match = path.match(compiled.regex);
    if (match) {
      const params: Record<string, string> = {};
      compiled.keys.forEach((key, i) => {
        params[key] = match[i + 1];
      });
      return { component, params };
    }
  }
  return null;
}
