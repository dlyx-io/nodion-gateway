<script lang="ts">
  import { get, post, del, put } from '../lib/api.js';
  import ScopeEditor from '../components/ScopeEditor.svelte';

  interface ApiKey {
    id: string;
    label: string;
    role: string;
    projects: string[];
    expiresAt: string | null;
    createdAt: string;
    revokedAt: string | null;
    scopes?: { scope: string; target: string; projectSlug: string }[];
  }

  interface Project {
    slug: string;
    label: string;
  }

  let keys: ApiKey[] = $state([]);
  let projects: Project[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  // Create form
  let showCreate = $state(false);
  let createLabel = $state('');
  let createRole = $state('readonly');
  let createProjects: string[] = $state([]);
  let createExpires = $state('');
  let createError = $state('');
  let creating = $state(false);

  // Custom scopes (collected per project during creation)
  let customScopes: Map<string, { scope: string; target: string }[]> = $state(new Map());

  // Created key modal
  let showTokenModal = $state(false);
  let createdToken = $state('');
  let createdLabel = $state('');
  let copied = $state(false);

  // Delete confirmation
  let deletingId: string | null = $state(null);

  // Scope editor for existing keys
  let editingScopesKeyId: string | null = $state(null);
  let editingScopesProject: string | null = $state(null);

  const roles: { value: string; label: string; desc: string }[] = [
    { value: 'admin', label: 'Admin', desc: 'Full access to all endpoints, projects and admin functions' },
    { value: 'agent', label: 'Agent', desc: 'Create, deploy, manage and delete own applications. Read all apps.' },
    { value: 'deployer', label: 'Deployer', desc: 'Read applications and trigger deployments. No create/delete.' },
    { value: 'readonly', label: 'Readonly', desc: 'Read-only access to applications, regions and instance types' },
    { value: 'custom', label: 'Custom', desc: 'Fine-grained per-app, per-action permissions via scope editor' },
  ];

  async function load() {
    loading = true;
    error = '';
    try {
      const [k, p] = await Promise.all([
        get<ApiKey[]>('/admin/keys'),
        get<Project[]>('/admin/projects'),
      ]);
      keys = k;
      projects = p;
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  load();

  function toggleProject(slug: string) {
    if (createProjects.includes(slug)) {
      createProjects = createProjects.filter(p => p !== slug);
      customScopes.delete(slug);
      customScopes = new Map(customScopes);
    } else {
      createProjects = [...createProjects, slug];
    }
  }

  function handleScopeChange(projectSlug: string, scopes: { scope: string; target: string }[]) {
    customScopes.set(projectSlug, scopes);
    customScopes = new Map(customScopes);
  }

  async function handleCreate(e: Event) {
    e.preventDefault();
    if (!createLabel.trim()) {
      createError = 'Label is required';
      return;
    }
    creating = true;
    createError = '';
    try {
      const body: any = {
        label: createLabel.trim(),
        role: createRole,
      };
      if (createProjects.length > 0) body.projects = createProjects;
      if (createExpires) body.expiresAt = createExpires;

      // For custom role, aggregate scopes from all projects
      if (createRole === 'custom') {
        const allScopes: { scope: string; target: string; projectSlug: string }[] = [];
        for (const [projSlug, scopeList] of customScopes) {
          for (const s of scopeList) {
            allScopes.push({ ...s, projectSlug: projSlug });
          }
        }
        if (allScopes.length > 0) body.scopes = allScopes;
      }

      const result = await post<{ token: string; id: string }>('/admin/keys', body);
      createdToken = result.token;
      createdLabel = createLabel.trim();
      showTokenModal = true;
      copied = false;

      // Reset form
      createLabel = '';
      createRole = 'readonly';
      createProjects = [];
      createExpires = '';
      customScopes = new Map();
      showCreate = false;
      await load();
    } catch (err: any) {
      createError = err.message;
    } finally {
      creating = false;
    }
  }

  async function handleRevoke(id: string) {
    try {
      await del(`/admin/keys/${id}`);
    } catch {
      // Key may already be revoked — refresh list regardless
    }
    deletingId = null;
    await load();
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(createdToken);
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = createdToken;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      copied = true;
      setTimeout(() => copied = false, 2000);
    }
  }

  function formatDate(ts: string): string {
    return new Date(ts).toLocaleDateString();
  }

  function roleBadgeClass(role: string): string {
    switch (role) {
      case 'admin': return 'role-admin';
      case 'agent': return 'role-agent';
      case 'deployer': return 'role-deployer';
      case 'custom': return 'role-custom';
      default: return 'role-readonly';
    }
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h1>API Keys</h1>
      <p class="page-desc">Manage gateway API keys and their permissions</p>
    </div>
    <button class="btn-primary" onclick={() => showCreate = !showCreate}>
      {showCreate ? 'Cancel' : '+ New Key'}
    </button>
  </div>

  {#if showCreate}
    <div class="card form-card">
      <h2>Create API Key</h2>
      <form onsubmit={handleCreate}>
        <div class="form-row">
          <div class="field">
            <label for="label">Label</label>
            <input id="label" type="text" bind:value={createLabel} placeholder="e.g. CI Deploy Key" disabled={creating} />
          </div>
          <div class="field">
            <label for="role">Role</label>
            <select id="role" bind:value={createRole} disabled={creating}>
              {#each roles as r}
                <option value={r.value}>{r.label}</option>
              {/each}
            </select>
          </div>
        </div>

        {#each roles as r}
          {#if r.value === createRole}
            <div class="role-hint">
              <strong>{r.label}</strong> — {r.desc}
            </div>
          {/if}
        {/each}

        <div class="field">
          <label for="expires">Expires At (optional)</label>
          <input id="expires" type="date" bind:value={createExpires} disabled={creating} />
        </div>

        {#if projects.length > 0}
          <div class="field">
            <span id="project-access-label">Project Access</span>
            <div class="project-selector">
              {#each projects as proj}
                <label class="checkbox-item">
                  <input
                    type="checkbox"
                    checked={createProjects.includes(proj.slug)}
                    onchange={() => toggleProject(proj.slug)}
                    disabled={creating}
                  />
                  <span class="checkbox-label">{proj.label} <code>{proj.slug}</code></span>
                </label>
              {/each}
            </div>
          </div>
        {/if}

        {#if createRole === 'custom' && createProjects.length > 0}
          <div class="scope-editors">
            {#each createProjects as projSlug}
              <div class="scope-editor-section">
                <h3>Scopes for <code>{projSlug}</code></h3>
                <ScopeEditor
                  projectSlug={projSlug}
                  scopes={customScopes.get(projSlug) || []}
                  onChange={(scopes) => handleScopeChange(projSlug, scopes)}
                />
              </div>
            {/each}
          </div>
        {/if}

        {#if createError}
          <div class="field-error">{createError}</div>
        {/if}
        <div class="form-actions">
          <button type="submit" class="btn-primary" disabled={creating}>
            {creating ? 'Creating...' : 'Create Key'}
          </button>
        </div>
      </form>
    </div>
  {/if}

  {#if showTokenModal}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-overlay" onclick={() => showTokenModal = false}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="modal" onclick={(e) => e.stopPropagation()}>
        <h2>Key Created</h2>
        <p class="modal-desc">
          Copy this key now. It will not be shown again.
        </p>
        <div class="token-display">
          <code class="token-text">{createdToken}</code>
          <button class="btn-sm btn-primary" onclick={copyToken}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <p class="token-label">Label: <strong>{createdLabel}</strong></p>
        <div class="modal-actions">
          <button class="btn-primary" onclick={() => showTokenModal = false}>Done</button>
        </div>
      </div>
    </div>
  {/if}

  {#if loading}
    <div class="loading">Loading keys...</div>
  {:else if error}
    <div class="error-msg">{error}</div>
  {:else if keys.length === 0}
    <div class="empty-state">
      <p>No API keys yet. Create one to get started.</p>
    </div>
  {:else}
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Role</th>
              <th>Projects</th>
              <th>Expires</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each keys as key}
              <tr class:revoked={!!key.revokedAt}>
                <td>
                  <div class="key-label">
                    {key.label}
                    {#if key.revokedAt}
                      <span class="revoked-badge">Revoked</span>
                    {/if}
                  </div>
                  <div class="key-id">{key.id}</div>
                </td>
                <td>
                  <span class="role-badge {roleBadgeClass(key.role)}">{key.role}</span>
                </td>
                <td>
                  {#if key.projects && key.projects.length > 0}
                    <div class="project-tags">
                      {#each key.projects as p}
                        <span class="project-tag">{p}</span>
                      {/each}
                    </div>
                  {:else}
                    <span class="muted">All</span>
                  {/if}
                </td>
                <td class="muted">
                  {key.expiresAt ? formatDate(key.expiresAt) : 'Never'}
                </td>
                <td class="muted">{formatDate(key.createdAt)}</td>
                <td>
                  <div class="actions">
                    {#if key.revokedAt}
                      <span class="muted">{formatDate(key.revokedAt)}</span>
                    {:else if deletingId === key.id}
                      <button class="btn-sm btn-danger" onclick={() => handleRevoke(key.id)}>Confirm</button>
                      <button class="btn-sm btn-ghost" onclick={() => deletingId = null}>Cancel</button>
                    {:else}
                      <button class="btn-sm btn-danger-ghost" onclick={() => deletingId = key.id}>Revoke</button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 1100px;
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
  .project-selector {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .checkbox-item {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .checkbox-item:hover {
    border-color: var(--primary);
  }
  .checkbox-item input[type="checkbox"] {
    width: auto;
    accent-color: var(--primary);
  }
  .checkbox-label {
    font-size: 13px;
  }
  .checkbox-label code {
    font-size: 11px;
    color: var(--text-muted);
  }
  .scope-editors {
    margin-top: 8px;
  }
  .scope-editor-section {
    margin-bottom: 16px;
  }
  .scope-editor-section h3 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .scope-editor-section h3 code {
    color: var(--primary);
    font-size: 13px;
    background: var(--bg);
    padding: 2px 6px;
    border-radius: 4px;
  }
  .role-hint {
    font-size: 13px;
    color: var(--text-muted);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 10px 14px;
    margin-bottom: 12px;
  }
  .role-hint strong {
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
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 16px;
  }
  .modal {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 32px;
    max-width: 560px;
    width: 100%;
  }
  .modal h2 {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .modal-desc {
    color: var(--text-muted);
    font-size: 14px;
    margin-bottom: 16px;
  }
  .token-display {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 12px;
    margin-bottom: 12px;
  }
  .token-text {
    flex: 1;
    font-size: 13px;
    word-break: break-all;
    font-family: 'SF Mono', 'Fira Code', monospace;
    color: var(--success);
    background: none;
    padding: 0;
  }
  .token-label {
    font-size: 13px;
    color: var(--text-muted);
    margin-bottom: 16px;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
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
  tr.revoked {
    opacity: 0.5;
  }
  .key-label {
    font-weight: 600;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .revoked-badge {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(239, 68, 68, 0.15);
    color: var(--danger);
  }
  .key-id {
    font-family: monospace;
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 2px;
  }
  .role-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .role-admin { background: rgba(239, 68, 68, 0.15); color: var(--danger); }
  .role-agent { background: rgba(99, 102, 241, 0.15); color: var(--primary); }
  .role-deployer { background: rgba(34, 197, 94, 0.15); color: var(--success); }
  .role-readonly { background: rgba(139, 143, 163, 0.15); color: var(--text-muted); }
  .role-custom { background: rgba(245, 158, 11, 0.15); color: var(--warning); }
  .project-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .project-tag {
    display: inline-block;
    padding: 2px 6px;
    background: var(--bg);
    border-radius: 4px;
    font-size: 11px;
    font-family: monospace;
    color: var(--text-muted);
  }
  .muted {
    color: var(--text-muted);
    font-size: 13px;
  }
  code {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 13px;
    background: var(--bg);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--primary);
  }
  .actions {
    display: flex;
    gap: 6px;
  }
  .btn-sm {
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.15s;
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
  .loading, .empty-state, .error-msg {
    text-align: center;
    padding: 48px 24px;
    color: var(--text-muted);
    font-size: 14px;
  }
  .error-msg {
    color: var(--danger);
  }
  .empty-state {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
</style>
