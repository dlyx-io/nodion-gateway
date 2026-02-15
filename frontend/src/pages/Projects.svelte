<script lang="ts">
  import { get, post, patch, del } from '../lib/api.js';

  interface Project {
    slug: string;
    label: string;
    created_at: string;
  }

  let projects: Project[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  // Create form
  let showCreate = $state(false);
  let createSlug = $state('');
  let createLabel = $state('');
  let createKey = $state('');
  let createError = $state('');
  let creating = $state(false);

  // Edit form
  let editingSlug: string | null = $state(null);
  let editLabel = $state('');
  let editKey = $state('');
  let editError = $state('');
  let saving = $state(false);

  // Delete confirmation
  let deletingSlug: string | null = $state(null);

  async function load() {
    loading = true;
    error = '';
    try {
      projects = await get<Project[]>('/admin/projects');
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  load();

  async function handleCreate(e: Event) {
    e.preventDefault();
    if (!createSlug.trim() || !createLabel.trim() || !createKey.trim()) {
      createError = 'All fields are required';
      return;
    }
    creating = true;
    createError = '';
    try {
      await post('/admin/projects', {
        slug: createSlug.trim(),
        label: createLabel.trim(),
        nodionApiKey: createKey.trim(),
      });
      createSlug = '';
      createLabel = '';
      createKey = '';
      showCreate = false;
      await load();
    } catch (err: any) {
      createError = err.message;
    } finally {
      creating = false;
    }
  }

  function startEdit(proj: Project) {
    editingSlug = proj.slug;
    editLabel = proj.label;
    editKey = '';
    editError = '';
  }

  function cancelEdit() {
    editingSlug = null;
    editError = '';
  }

  async function handleEdit(e: Event) {
    e.preventDefault();
    if (!editingSlug) return;
    saving = true;
    editError = '';
    try {
      const body: any = {};
      if (editLabel.trim()) body.label = editLabel.trim();
      if (editKey.trim()) body.nodionApiKey = editKey.trim();
      await patch(`/admin/projects/${editingSlug}`, body);
      editingSlug = null;
      await load();
    } catch (err: any) {
      editError = err.message;
    } finally {
      saving = false;
    }
  }

  async function handleDelete(slug: string) {
    try {
      await del(`/admin/projects/${slug}`);
      deletingSlug = null;
      await load();
    } catch (err: any) {
      error = err.message;
    }
  }

  function formatDate(ts: string): string {
    return new Date(ts).toLocaleDateString();
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h1>Projects</h1>
      <p class="page-desc">Manage Nodion projects and their API keys</p>
    </div>
    <button class="btn-primary" onclick={() => showCreate = !showCreate}>
      {showCreate ? 'Cancel' : '+ New Project'}
    </button>
  </div>

  {#if showCreate}
    <div class="card form-card">
      <h2>Create Project</h2>
      <form onsubmit={handleCreate}>
        <div class="form-row">
          <div class="field">
            <label for="slug">Slug</label>
            <input id="slug" type="text" bind:value={createSlug} placeholder="my-project" disabled={creating} />
          </div>
          <div class="field">
            <label for="label">Label</label>
            <input id="label" type="text" bind:value={createLabel} placeholder="My Project" disabled={creating} />
          </div>
        </div>
        <div class="field">
          <label for="key">Nodion API Key</label>
          <input id="key" type="password" bind:value={createKey} placeholder="Nodion API key" disabled={creating} />
        </div>
        {#if createError}
          <div class="field-error">{createError}</div>
        {/if}
        <div class="form-actions">
          <button type="submit" class="btn-primary" disabled={creating}>
            {creating ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  {/if}

  {#if loading}
    <div class="loading">Loading projects...</div>
  {:else if error}
    <div class="error-msg">{error}</div>
  {:else if projects.length === 0}
    <div class="empty-state">
      <p>No projects yet. Create one to get started.</p>
    </div>
  {:else}
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Slug</th>
              <th>Label</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each projects as proj}
              {#if editingSlug === proj.slug}
                <tr class="edit-row">
                  <td>
                    <code>{proj.slug}</code>
                  </td>
                  <td colspan="3">
                    <form onsubmit={handleEdit} class="inline-edit">
                      <input type="text" bind:value={editLabel} placeholder="Label" class="inline-input" />
                      <input type="password" bind:value={editKey} placeholder="New API key (optional)" class="inline-input" />
                      {#if editError}
                        <span class="inline-error">{editError}</span>
                      {/if}
                      <div class="inline-actions">
                        <button type="submit" class="btn-sm btn-primary" disabled={saving}>
                          {saving ? 'Saving...' : 'Save'}
                        </button>
                        <button type="button" class="btn-sm btn-ghost" onclick={cancelEdit}>Cancel</button>
                      </div>
                    </form>
                  </td>
                </tr>
              {:else}
                <tr>
                  <td><code>{proj.slug}</code></td>
                  <td>{proj.label}</td>
                  <td class="muted">{formatDate(proj.created_at)}</td>
                  <td>
                    <div class="actions">
                      <button class="btn-sm btn-ghost" onclick={() => startEdit(proj)}>Edit</button>
                      {#if deletingSlug === proj.slug}
                        <button class="btn-sm btn-danger" onclick={() => handleDelete(proj.slug)}>Confirm</button>
                        <button class="btn-sm btn-ghost" onclick={() => deletingSlug = null}>Cancel</button>
                      {:else}
                        <button class="btn-sm btn-danger-ghost" onclick={() => deletingSlug = proj.slug}>Delete</button>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>
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
  .field input {
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
  .field input:focus {
    border-color: var(--primary);
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
  .edit-row {
    background: var(--bg-hover);
  }
  .inline-edit {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .inline-input {
    padding: 6px 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text);
    font-size: 13px;
    outline: none;
    flex: 1;
    min-width: 140px;
  }
  .inline-input:focus {
    border-color: var(--primary);
  }
  .inline-error {
    color: var(--danger);
    font-size: 12px;
  }
  .inline-actions {
    display: flex;
    gap: 6px;
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
