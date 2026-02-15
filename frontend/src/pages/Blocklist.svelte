<script lang="ts">
  import { get, post, del } from '../lib/api.js';

  interface BlocklistEntry {
    app_id: string;
    project_slug: string;
    reason: string;
    created_at: string;
  }

  interface Project {
    slug: string;
    label: string;
  }

  let entries: BlocklistEntry[] = $state([]);
  let projects: Project[] = $state([]);
  let resources: any[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  // Add form
  let showAdd = $state(false);
  let addProjectSlug = $state('');
  let addAppId = $state('');
  let addReason = $state('');
  let addError = $state('');
  let adding = $state(false);

  // Delete confirmation
  let deletingKey: string | null = $state(null);

  async function load() {
    loading = true;
    error = '';
    try {
      const [r, p, res] = await Promise.all([
        get<BlocklistEntry[]>('/admin/resources'),
        get<Project[]>('/admin/projects'),
        get<any[]>('/admin/resources'),
      ]);
      // Resources include blocklist info
      resources = res || [];
      projects = p || [];

      // The blocklist entries may be embedded in resources or separate
      // Try to filter resources that have blocklisted flag, otherwise load from resources endpoint
      entries = resources.filter((r: any) => r.blocked) || [];
      // If no blocked field, try the resources as-is for blocklist display
      if (entries.length === 0) {
        entries = resources;
      }
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  // Separate load for blocklist - resources endpoint returns tracked resources
  async function loadAll() {
    loading = true;
    error = '';
    try {
      const [p, res] = await Promise.all([
        get<Project[]>('/admin/projects'),
        get<any[]>('/admin/resources'),
      ]);
      projects = p || [];
      resources = res || [];
      if (projects.length > 0 && !addProjectSlug) {
        addProjectSlug = projects[0].slug;
      }
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  loadAll();

  async function handleAdd(e: Event) {
    e.preventDefault();
    if (!addProjectSlug || !addAppId.trim()) {
      addError = 'Project and App ID are required';
      return;
    }
    adding = true;
    addError = '';
    try {
      await post('/admin/blocklist', {
        appId: addAppId.trim(),
        projectSlug: addProjectSlug,
        reason: addReason.trim() || 'Protected',
      });
      addAppId = '';
      addReason = '';
      showAdd = false;
      await loadAll();
    } catch (err: any) {
      addError = err.message;
    } finally {
      adding = false;
    }
  }

  async function handleRemove(projectSlug: string, appId: string) {
    try {
      await del(`/admin/blocklist/${projectSlug}/${appId}`);
      deletingKey = null;
      await loadAll();
    } catch (err: any) {
      error = err.message;
    }
  }

  function entryKey(entry: any): string {
    return `${entry.project_slug || entry.projectSlug}:${entry.app_id || entry.appId}`;
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h1>Blocklist</h1>
      <p class="page-desc">Protect production applications from accidental deletion or modification</p>
    </div>
    <button class="btn-primary" onclick={() => showAdd = !showAdd}>
      {showAdd ? 'Cancel' : '+ Add to Blocklist'}
    </button>
  </div>

  {#if showAdd}
    <div class="card form-card">
      <h2>Add to Blocklist</h2>
      <form onsubmit={handleAdd}>
        <div class="form-row">
          <div class="field">
            <label for="project">Project</label>
            <select id="project" bind:value={addProjectSlug} disabled={adding}>
              {#each projects as proj}
                <option value={proj.slug}>{proj.label} ({proj.slug})</option>
              {/each}
            </select>
          </div>
          <div class="field">
            <label for="appId">Application ID</label>
            <input id="appId" type="text" bind:value={addAppId} placeholder="e.g. 12345" disabled={adding} />
          </div>
        </div>
        <div class="field">
          <label for="reason">Reason</label>
          <input id="reason" type="text" bind:value={addReason} placeholder="e.g. Production application" disabled={adding} />
        </div>
        {#if addError}
          <div class="field-error">{addError}</div>
        {/if}
        <div class="form-actions">
          <button type="submit" class="btn-primary" disabled={adding}>
            {adding ? 'Adding...' : 'Add to Blocklist'}
          </button>
        </div>
      </form>
    </div>
  {/if}

  {#if loading}
    <div class="loading">Loading...</div>
  {:else if error}
    <div class="error-msg">{error}</div>
  {:else}
    <div class="card">
      <div class="card-header">
        <h2>Tracked Resources</h2>
        <span class="count">{resources.length} resource{resources.length !== 1 ? 's' : ''}</span>
      </div>
      {#if resources.length === 0}
        <div class="empty">No tracked resources yet. Resources are tracked when apps are created through the gateway.</div>
      {:else}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>App ID</th>
                <th>Project</th>
                <th>Created By</th>
                <th>Blocked</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each resources as res}
                <tr>
                  <td><code>{res.app_id}</code></td>
                  <td>{res.project_slug}</td>
                  <td class="muted">{res.created_by_key || '-'}</td>
                  <td>
                    {#if res.blocked}
                      <span class="blocked-badge">Blocked</span>
                      {#if res.block_reason}
                        <span class="block-reason">{res.block_reason}</span>
                      {/if}
                    {:else}
                      <span class="muted">No</span>
                    {/if}
                  </td>
                  <td>
                    {#if res.blocked}
                      {@const dk = entryKey(res)}
                      {#if deletingKey === dk}
                        <button class="btn-sm btn-danger" onclick={() => handleRemove(res.project_slug, res.app_id)}>Confirm</button>
                        <button class="btn-sm btn-ghost" onclick={() => deletingKey = null}>Cancel</button>
                      {:else}
                        <button class="btn-sm btn-danger-ghost" onclick={() => deletingKey = dk}>Unblock</button>
                      {/if}
                    {:else}
                      <button class="btn-sm btn-ghost" onclick={() => { addProjectSlug = res.project_slug; addAppId = String(res.app_id); showAdd = true; }}>
                        Block
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 1000px;
  }
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 24px;
    gap: 16px;
  }
  .page-header h1 {
    font-size: 24px;
    font-weight: 700;
  }
  .page-desc {
    color: var(--text-muted);
    font-size: 14px;
    margin-top: 4px;
  }
  .btn-primary {
    padding: 8px 16px;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s;
    white-space: nowrap;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--primary-hover);
  }
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: 20px;
  }
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }
  .card-header h2 {
    font-size: 16px;
    font-weight: 600;
  }
  .count {
    font-size: 13px;
    color: var(--text-muted);
  }
  .form-card {
    padding: 24px;
  }
  .form-card h2 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 16px;
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .field {
    margin-bottom: 12px;
  }
  .field label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 4px;
  }
  .field input, .field select {
    width: 100%;
    padding: 8px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s;
  }
  .field input:focus, .field select:focus {
    border-color: var(--primary);
  }
  .field select option {
    background: var(--bg-card);
    color: var(--text);
  }
  .field-error {
    color: var(--danger);
    font-size: 13px;
    margin-bottom: 12px;
  }
  .form-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  th {
    text-align: left;
    padding: 12px 16px;
    color: var(--text-muted);
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  td {
    padding: 12px 16px;
    border-top: 1px solid var(--border);
  }
  code {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 13px;
    background: var(--bg);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--primary);
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  .blocked-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    background: rgba(239, 68, 68, 0.15);
    color: var(--danger);
  }
  .block-reason {
    font-size: 12px;
    color: var(--text-muted);
    margin-left: 8px;
  }
  .btn-sm {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
    margin-right: 4px;
  }
  .btn-ghost {
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border);
  }
  .btn-ghost:hover {
    background: var(--bg-hover);
    color: var(--text);
  }
  .btn-danger-ghost {
    background: transparent;
    color: var(--danger);
    border: 1px solid transparent;
  }
  .btn-danger-ghost:hover {
    background: rgba(239, 68, 68, 0.1);
  }
  .btn-danger {
    background: var(--danger);
    color: white;
  }
  .btn-danger:hover {
    opacity: 0.9;
  }
  .loading, .error-msg, .empty {
    text-align: center;
    padding: 48px 24px;
    color: var(--text-muted);
    font-size: 14px;
  }
  .error-msg {
    color: var(--danger);
  }
</style>
