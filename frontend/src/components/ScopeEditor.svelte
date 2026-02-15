<script lang="ts">
  import { get } from '../lib/api.js';

  interface ScopeEntry {
    scope: string;
    target: string;
  }

  interface Props {
    projectSlug: string;
    scopes: ScopeEntry[];
    onChange: (scopes: ScopeEntry[]) => void;
  }

  let { projectSlug, scopes, onChange }: Props = $props();

  interface AppInfo {
    id: string | number;
    name: string;
  }

  let apps: AppInfo[] = $state([]);
  let loadingApps = $state(true);
  let loadError = $state('');

  const scopeColumns: { key: string; label: string }[] = [
    { key: 'read', label: 'Read' },
    { key: 'env:read', label: 'Env Read' },
    { key: 'env:write', label: 'Env Write' },
    { key: 'deploy', label: 'Deploy' },
    { key: 'scale', label: 'Scale' },
    { key: 'delete', label: 'Delete' },
  ];

  // Special rows
  const specialTargets = [
    { target: '*', label: 'All Apps' },
    { target: 'owned', label: 'Owned Apps' },
  ];

  // Internal state: track which scopes are checked per target
  let checkedScopes: Map<string, Set<string>> = $state(new Map());

  // Initialize from incoming scopes
  function initFromScopes() {
    const map = new Map<string, Set<string>>();
    for (const s of scopes) {
      if (!map.has(s.target)) map.set(s.target, new Set());
      map.get(s.target)!.add(s.scope);
    }
    checkedScopes = map;
  }

  $effect(() => {
    // Reinit when scopes prop changes
    initFromScopes();
  });

  async function loadApps() {
    loadingApps = true;
    loadError = '';
    try {
      const result = await get<any>(`/projects/${projectSlug}/applications`);
      const list = Array.isArray(result) ? result : (result.data || result.applications || []);
      apps = list.map((a: any) => ({ id: String(a.id), name: a.name }));
    } catch (err: any) {
      loadError = err.message;
      apps = [];
    } finally {
      loadingApps = false;
    }
  }

  $effect(() => {
    if (projectSlug) {
      loadApps();
    }
  });

  function isChecked(target: string, scope: string): boolean {
    return checkedScopes.get(target)?.has(scope) ?? false;
  }

  function isManageChecked(target: string): boolean {
    return scopeColumns.every(col => isChecked(target, col.key));
  }

  function toggleScope(target: string, scope: string) {
    const map = new Map(checkedScopes);
    if (!map.has(target)) map.set(target, new Set());
    const set = new Set(map.get(target)!);
    if (set.has(scope)) {
      set.delete(scope);
    } else {
      set.add(scope);
    }
    // Also handle 'manage' - it's a virtual scope, just sets all
    map.set(target, set);
    checkedScopes = map;
    emitChange();
  }

  function toggleManage(target: string) {
    const map = new Map(checkedScopes);
    const allChecked = isManageChecked(target);
    if (allChecked) {
      // Uncheck all
      map.delete(target);
    } else {
      // Check all
      const set = new Set<string>();
      for (const col of scopeColumns) set.add(col.key);
      map.set(target, set);
    }
    checkedScopes = map;
    emitChange();
  }

  function emitChange() {
    const result: ScopeEntry[] = [];
    for (const [target, scopes] of checkedScopes) {
      for (const scope of scopes) {
        result.push({ scope, target });
      }
    }
    onChange(result);
  }

  // Build rows: special targets + individual apps
  let rows = $derived([
    ...specialTargets,
    ...apps.map(a => ({ target: String(a.id), label: a.name })),
  ]);
</script>

<div class="scope-editor">
  {#if loadingApps}
    <div class="loading-sm">Loading applications...</div>
  {:else if loadError}
    <div class="error-sm">Failed to load apps: {loadError}</div>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="target-col">Target</th>
            {#each scopeColumns as col}
              <th class="scope-col">{col.label}</th>
            {/each}
            <th class="scope-col">Manage</th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row}
            <tr class:special-row={row.target === '*' || row.target === 'owned'}>
              <td class="target-cell">
                <span class="target-label">{row.label}</span>
                {#if row.target !== '*' && row.target !== 'owned'}
                  <span class="target-id">ID: {row.target}</span>
                {/if}
              </td>
              {#each scopeColumns as col}
                <td class="checkbox-cell">
                  <input
                    type="checkbox"
                    checked={isChecked(row.target, col.key)}
                    onchange={() => toggleScope(row.target, col.key)}
                  />
                </td>
              {/each}
              <td class="checkbox-cell">
                <input
                  type="checkbox"
                  checked={isManageChecked(row.target)}
                  onchange={() => toggleManage(row.target)}
                />
              </td>
            </tr>
          {/each}

          {#if rows.length === specialTargets.length}
            <tr>
              <td colspan={scopeColumns.length + 2} class="empty-row">
                No applications found. Use wildcard (*) or owned targets above.
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .scope-editor {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th {
    text-align: center;
    padding: 10px 8px;
    color: var(--text-muted);
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: var(--bg-card);
    white-space: nowrap;
  }
  th.target-col {
    text-align: left;
    padding-left: 12px;
    min-width: 160px;
  }
  th.scope-col {
    width: 70px;
  }
  td {
    padding: 8px;
    border-top: 1px solid var(--border);
  }
  .target-cell {
    padding-left: 12px;
  }
  .target-label {
    font-weight: 500;
    font-size: 13px;
  }
  .target-id {
    display: block;
    font-size: 10px;
    color: var(--text-muted);
    font-family: monospace;
  }
  .special-row {
    background: rgba(99, 102, 241, 0.04);
  }
  .special-row .target-label {
    font-weight: 600;
    color: var(--primary);
  }
  .checkbox-cell {
    text-align: center;
  }
  .checkbox-cell input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: var(--primary);
    cursor: pointer;
  }
  .empty-row {
    text-align: center;
    color: var(--text-muted);
    padding: 16px;
    font-size: 12px;
  }
  .loading-sm, .error-sm {
    padding: 20px;
    text-align: center;
    font-size: 13px;
    color: var(--text-muted);
  }
  .error-sm {
    color: var(--danger);
  }
</style>
