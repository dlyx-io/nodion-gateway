<script lang="ts">
  import { get, post } from '../lib/api.js';
  import { success, error as toastError } from '../lib/toast.svelte.js';

  interface Integration {
    id: string;
    username: string;
    service_type: string;
    source: { type: string; projects?: string[]; id?: string; label?: string };
    syncable: boolean;
  }

  let integrations: Integration[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  // Expanded state
  let expandedIntegrations: Set<string> = $state(new Set());
  let expandedRepos: Set<string> = $state(new Set());

  // Repos & branches per integration/repo
  let reposByIntegration: Record<string, any[]> = $state({});
  let branchesByRepo: Record<string, any[]> = $state({});
  let loadingRepos: Set<string> = $state(new Set());
  let loadingBranches: Set<string> = $state(new Set());

  // Sync state
  let syncingIntegration: Set<string> = $state(new Set());
  let syncingRepo: Set<string> = $state(new Set());

  async function load() {
    loading = true;
    error = '';
    try {
      const result = await get<any>('/integrations');
      integrations = result.integrations || [];
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  load();

  function sourceLabel(source: Integration['source']): string {
    if (!source) return '';
    if (source.type === 'service-account') return `SA: ${source.label}`;
    if (source.type === 'project' && source.projects?.length) return source.projects.join(', ');
    return '';
  }

  function integrationKey(i: Integration): string {
    return i.source?.type === 'service-account' ? `sa:${i.id}` : i.id;
  }

  async function toggleIntegration(i: Integration) {
    const key = integrationKey(i);
    if (expandedIntegrations.has(key)) {
      expandedIntegrations.delete(key);
      expandedIntegrations = new Set(expandedIntegrations);
      return;
    }
    expandedIntegrations.add(key);
    expandedIntegrations = new Set(expandedIntegrations);

    if (!reposByIntegration[key]) {
      await loadRepos(i);
    }
  }

  async function loadRepos(i: Integration) {
    const key = integrationKey(i);
    loadingRepos.add(key);
    loadingRepos = new Set(loadingRepos);
    try {
      const r = await get<any>(`/integrations/${i.id}/repositories`);
      reposByIntegration[key] = r.repositories || r.data || [];
      reposByIntegration = { ...reposByIntegration };
    } catch {
      reposByIntegration[key] = [];
      reposByIntegration = { ...reposByIntegration };
    } finally {
      loadingRepos.delete(key);
      loadingRepos = new Set(loadingRepos);
    }
  }

  async function toggleRepo(i: Integration, repo: any) {
    const key = `${integrationKey(i)}:${repo.id}`;
    if (expandedRepos.has(key)) {
      expandedRepos.delete(key);
      expandedRepos = new Set(expandedRepos);
      return;
    }
    expandedRepos.add(key);
    expandedRepos = new Set(expandedRepos);

    if (!branchesByRepo[key]) {
      await loadBranches(i, repo);
    }
  }

  async function loadBranches(i: Integration, repo: any) {
    const key = `${integrationKey(i)}:${repo.id}`;
    loadingBranches.add(key);
    loadingBranches = new Set(loadingBranches);
    try {
      const r = await get<any>(`/integrations/${i.id}/repositories/${repo.id}/branches`);
      branchesByRepo[key] = r.branches || r.data || [];
      branchesByRepo = { ...branchesByRepo };
    } catch {
      branchesByRepo[key] = [];
      branchesByRepo = { ...branchesByRepo };
    } finally {
      loadingBranches.delete(key);
      loadingBranches = new Set(loadingBranches);
    }
  }

  async function syncRepos(i: Integration) {
    const key = integrationKey(i);
    syncingIntegration.add(key);
    syncingIntegration = new Set(syncingIntegration);
    try {
      await post(`/integrations/${i.id}/sync_repos`);
      success('Repositories synced');
      await loadRepos(i);
    } catch (e: any) {
      toastError('Sync failed: ' + e.message);
    } finally {
      syncingIntegration.delete(key);
      syncingIntegration = new Set(syncingIntegration);
    }
  }

  async function syncRepo(i: Integration, repo: any) {
    const key = `${integrationKey(i)}:${repo.id}`;
    syncingRepo.add(key);
    syncingRepo = new Set(syncingRepo);
    try {
      await post(`/integrations/${i.id}/sync_repo`, { repository_id: repo.id });
      success(`Branches synced for ${repo.full_name || repo.name}`);
      await loadBranches(i, repo);
    } catch (e: any) {
      toastError('Sync failed: ' + e.message);
    } finally {
      syncingRepo.delete(key);
      syncingRepo = new Set(syncingRepo);
    }
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h1>Integrations</h1>
      <p class="page-desc">Browse Git integrations, repositories, and branches</p>
    </div>
    <button class="btn-secondary" onclick={load} disabled={loading}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:spin={loading}>
        <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
      </svg>
      Refresh
    </button>
  </div>

  {#if loading}
    <div class="loading">Loading integrations...</div>
  {:else if error}
    <div class="error-msg">{error}</div>
  {:else if integrations.length === 0}
    <div class="empty-state">
      <p>No integrations found. Add a project or service account to see integrations.</p>
    </div>
  {:else}
    <div class="tree">
      {#each integrations as i}
        {@const iKey = integrationKey(i)}
        {@const isExpanded = expandedIntegrations.has(iKey)}
        {@const repos = reposByIntegration[iKey] || []}
        {@const isLoadingRepos = loadingRepos.has(iKey)}
        {@const isSyncing = syncingIntegration.has(iKey)}

        <div class="tree-node integration-node">
          <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
          <div class="tree-row" onclick={() => toggleIntegration(i)}>
            <svg class="chevron" class:expanded={isExpanded} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
            </svg>
            <span class="tree-label">
              <strong>{i.service_type}: {i.username}</strong>
              <span class="source-badge" class:source-sa={i.source?.type === 'service-account'} class:source-project={i.source?.type === 'project'}>
                {sourceLabel(i.source)}
              </span>
              {#if i.syncable}
                <span class="sync-badge">syncable</span>
              {/if}
            </span>
            <span class="tree-meta">{i.id.substring(0, 8)}...</span>
          </div>

          {#if i.syncable}
            <button class="btn-sync" onclick={(e) => { e.stopPropagation(); syncRepos(i); }} disabled={isSyncing} title="Sync repositories">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:spin={isSyncing}>
                <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
              </svg>
            </button>
          {/if}
        </div>

        {#if isExpanded}
          <div class="tree-children">
            {#if isLoadingRepos}
              <div class="tree-loading">Loading repositories...</div>
            {:else if repos.length === 0}
              <div class="tree-empty">No repositories found</div>
            {:else}
              {#each repos as repo}
                {@const rKey = `${iKey}:${repo.id}`}
                {@const isRepoExpanded = expandedRepos.has(rKey)}
                {@const branches = branchesByRepo[rKey] || []}
                {@const isLoadingBr = loadingBranches.has(rKey)}
                {@const isSyncingRepo = syncingRepo.has(rKey)}

                <div class="tree-node repo-node">
                  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                  <div class="tree-row" onclick={() => toggleRepo(i, repo)}>
                    <svg class="chevron" class:expanded={isRepoExpanded} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span class="tree-label">{repo.full_name || repo.name}</span>
                  </div>

                  {#if i.syncable}
                    <button class="btn-sync btn-sync-sm" onclick={(e) => { e.stopPropagation(); syncRepo(i, repo); }} disabled={isSyncingRepo} title="Sync branches">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class:spin={isSyncingRepo}>
                        <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
                      </svg>
                    </button>
                  {/if}
                </div>

                {#if isRepoExpanded}
                  <div class="tree-children tree-children-deep">
                    {#if isLoadingBr}
                      <div class="tree-loading">Loading branches...</div>
                    {:else if branches.length === 0}
                      <div class="tree-empty">No branches found</div>
                    {:else}
                      {#each branches as branch}
                        <div class="tree-node branch-node">
                          <div class="tree-row tree-row-leaf">
                            <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <line x1="6" y1="3" x2="6" y2="15"/>
                              <circle cx="18" cy="6" r="3"/>
                              <circle cx="6" cy="18" r="3"/>
                              <path d="M18 9a9 9 0 0 1-9 9"/>
                            </svg>
                            <span class="tree-label">{branch.name}</span>
                            <span class="tree-meta mono">{branch.id?.substring(0, 8)}...</span>
                          </div>
                        </div>
                      {/each}
                    {/if}
                  </div>
                {/if}
              {/each}
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .page { max-width: 1000px; }
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 24px;
    gap: 16px;
  }
  .page-header h1 { font-size: 24px; font-weight: 700; }
  .page-desc { color: var(--text-muted); font-size: 14px; margin-top: 4px; }

  .btn-secondary {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .btn-secondary:hover:not(:disabled) { background: var(--bg-hover); }
  .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

  /* Tree structure */
  .tree {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .tree-node {
    position: relative;
  }

  .integration-node {
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
  }
  .integration-node:last-child { border-bottom: none; }

  .repo-node {
    display: flex;
    align-items: center;
  }

  .tree-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    cursor: pointer;
    transition: background 0.1s;
    flex: 1;
    min-width: 0;
  }
  .tree-row:hover { background: var(--bg-hover); }

  .tree-row-leaf {
    cursor: default;
    padding: 8px 16px;
  }
  .tree-row-leaf:hover { background: transparent; }

  .chevron {
    flex-shrink: 0;
    transition: transform 0.15s;
    color: var(--text-muted);
  }
  .chevron.expanded { transform: rotate(90deg); }

  .icon {
    flex-shrink: 0;
    color: var(--text-muted);
  }

  .tree-label {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    font-size: 14px;
  }
  .tree-label strong {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tree-meta {
    color: var(--text-muted);
    font-size: 12px;
    flex-shrink: 0;
  }
  .mono {
    font-family: 'SF Mono', 'Fira Code', monospace;
  }

  .source-badge {
    font-size: 11px;
    padding: 1px 6px;
    border-radius: 4px;
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .source-project {
    background: rgba(59, 130, 246, 0.1);
    color: var(--primary);
  }
  .source-sa {
    background: rgba(168, 85, 247, 0.1);
    color: #a855f7;
  }
  .sync-badge {
    font-size: 10px;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(34, 197, 94, 0.1);
    color: var(--success);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .btn-sync {
    padding: 6px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-muted);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s;
    flex-shrink: 0;
    margin-right: 12px;
  }
  .btn-sync:hover:not(:disabled) { background: var(--bg-hover); color: var(--primary); border-color: var(--primary); }
  .btn-sync:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-sync-sm { padding: 4px; margin-right: 8px; }

  .tree-children {
    padding-left: 24px;
    border-top: 1px solid var(--border);
  }
  .tree-children-deep {
    padding-left: 20px;
    border-top: none;
  }

  .tree-loading, .tree-empty {
    padding: 10px 16px;
    color: var(--text-muted);
    font-size: 13px;
  }

  .loading, .empty-state, .error-msg {
    text-align: center;
    padding: 48px 24px;
    color: var(--text-muted);
    font-size: 14px;
  }
  .error-msg { color: var(--danger); }
  .empty-state {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .spin { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
