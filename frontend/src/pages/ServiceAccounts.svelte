<script lang="ts">
  import { get, post, patch, del } from '../lib/api.js';
  import { success, error as toastError } from '../lib/toast.svelte.js';

  interface ServiceAccount {
    id: string;
    label: string;
    email: string;
    created_at: string;
  }

  let accounts: ServiceAccount[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  // Create form
  let showCreate = $state(false);
  let createLabel = $state('');
  let createEmail = $state('');
  let createPassword = $state('');
  let createTotp = $state('');
  let createError = $state('');
  let creating = $state(false);

  // Edit form
  let editingId: string | null = $state(null);
  let editLabel = $state('');
  let editPassword = $state('');
  let editTotp = $state('');
  let editError = $state('');
  let saving = $state(false);

  // Delete confirmation
  let deletingId: string | null = $state(null);

  async function load() {
    loading = true;
    error = '';
    try {
      accounts = await get<ServiceAccount[]>('/admin/service-accounts');
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  load();

  async function handleCreate(e: Event) {
    e.preventDefault();
    if (!createLabel.trim() || !createEmail.trim() || !createPassword.trim()) {
      createError = 'Label, email, and password are required';
      return;
    }
    creating = true;
    createError = '';
    try {
      await post('/admin/service-accounts', {
        label: createLabel.trim(),
        email: createEmail.trim(),
        password: createPassword.trim(),
        totpSecret: createTotp.trim() || undefined,
      });
      success('Service account created');
      createLabel = '';
      createEmail = '';
      createPassword = '';
      createTotp = '';
      showCreate = false;
      await load();
    } catch (err: any) {
      createError = err.message;
    } finally {
      creating = false;
    }
  }

  function startEdit(account: ServiceAccount) {
    editingId = account.id;
    editLabel = account.label;
    editPassword = '';
    editTotp = '';
    editError = '';
  }

  function cancelEdit() {
    editingId = null;
    editError = '';
  }

  async function handleEdit(e: Event) {
    e.preventDefault();
    if (!editingId) return;
    saving = true;
    editError = '';
    try {
      const body: any = {};
      if (editLabel.trim()) body.label = editLabel.trim();
      if (editPassword.trim()) body.password = editPassword.trim();
      if (editTotp.trim()) body.totpSecret = editTotp.trim();
      await patch(`/admin/service-accounts/${editingId}`, body);
      success('Service account updated');
      editingId = null;
      await load();
    } catch (err: any) {
      editError = err.message;
    } finally {
      saving = false;
    }
  }

  async function handleDelete(id: string) {
    try {
      await del(`/admin/service-accounts/${id}`);
      success('Service account deleted');
      deletingId = null;
      await load();
    } catch (err: any) {
      toastError('Delete failed: ' + err.message);
    }
  }

  function formatDate(ts: string): string {
    return new Date(ts).toLocaleDateString();
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h1>Service Accounts</h1>
      <p class="page-desc">Manage Nodion service accounts for integration sync access</p>
    </div>
    <button class="btn-primary" onclick={() => showCreate = !showCreate}>
      {showCreate ? 'Cancel' : '+ New Account'}
    </button>
  </div>

  {#if showCreate}
    <div class="card form-card">
      <h2>Create Service Account</h2>
      <form onsubmit={handleCreate}>
        <div class="form-row">
          <div class="field">
            <label for="sa-label">Label</label>
            <input id="sa-label" type="text" bind:value={createLabel} placeholder="e.g. claude_admin" disabled={creating} />
          </div>
          <div class="field">
            <label for="sa-email">Email</label>
            <input id="sa-email" type="email" bind:value={createEmail} placeholder="user@example.com" disabled={creating} />
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label for="sa-password">Password</label>
            <input id="sa-password" type="password" bind:value={createPassword} placeholder="Password" disabled={creating} />
          </div>
          <div class="field">
            <label for="sa-totp">TOTP Secret <span class="optional">(optional)</span></label>
            <input id="sa-totp" type="password" bind:value={createTotp} placeholder="TOTP seed (if 2FA enabled)" disabled={creating} />
          </div>
        </div>
        {#if createError}
          <div class="field-error">{createError}</div>
        {/if}
        <div class="form-actions">
          <button type="submit" class="btn-primary" disabled={creating}>
            {creating ? 'Creating...' : 'Create Account'}
          </button>
        </div>
      </form>
    </div>
  {/if}

  {#if loading}
    <div class="loading">Loading service accounts...</div>
  {:else if error}
    <div class="error-msg">{error}</div>
  {:else if accounts.length === 0}
    <div class="empty-state">
      <p>No service accounts configured. Add one to enable integration sync.</p>
    </div>
  {:else}
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Email</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each accounts as account}
              {#if editingId === account.id}
                <tr class="edit-row">
                  <td colspan="4">
                    <form onsubmit={handleEdit} class="inline-edit">
                      <input type="text" bind:value={editLabel} placeholder="Label" class="inline-input" />
                      <input type="password" bind:value={editPassword} placeholder="New password (optional)" class="inline-input" />
                      <input type="password" bind:value={editTotp} placeholder="New TOTP secret (optional)" class="inline-input" />
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
                  <td><strong>{account.label}</strong></td>
                  <td class="mono">{account.email}</td>
                  <td class="muted">{formatDate(account.created_at)}</td>
                  <td>
                    <div class="actions">
                      <button class="btn-sm btn-ghost" onclick={() => startEdit(account)}>Edit</button>
                      {#if deletingId === account.id}
                        <button class="btn-sm btn-danger" onclick={() => handleDelete(account.id)}>Confirm</button>
                        <button class="btn-sm btn-ghost" onclick={() => deletingId = null}>Cancel</button>
                      {:else}
                        <button class="btn-sm btn-danger-ghost" onclick={() => deletingId = account.id}>Delete</button>
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
  .optional {
    font-weight: 400;
    color: var(--text-muted);
    font-size: 12px;
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
  .mono {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 13px;
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
