<script lang="ts">
  import { get } from '../lib/api.js';

  interface AuditEntry {
    id: string;
    timestamp: string;
    key_id: string;
    key_label: string;
    project_slug: string;
    method: string;
    endpoint: string;
    status_code: number;
    result: string;
  }

  let entries: AuditEntry[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  // Filters
  let filterKeyId = $state('');
  let filterProject = $state('');
  let filterMethod = $state('');
  let filterResult = $state('');
  let filterFrom = $state('');
  let filterTo = $state('');
  let filterLimit = $state(50);

  // Pagination
  let page = $state(0);
  let hasMore = $state(false);

  const methods = ['', 'GET', 'POST', 'PATCH', 'PUT', 'DELETE'];
  const results = ['', 'allowed', 'denied'];

  async function load(resetPage = true) {
    if (resetPage) page = 0;
    loading = true;
    error = '';
    try {
      const params = new URLSearchParams();
      if (filterKeyId) params.set('keyId', filterKeyId);
      if (filterProject) params.set('project', filterProject);
      if (filterMethod) params.set('method', filterMethod);
      if (filterResult) params.set('result', filterResult);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);
      params.set('limit', String(filterLimit + 1)); // fetch one extra to check if there's more
      if (page > 0) params.set('offset', String(page * filterLimit));

      const result = await get<AuditEntry[]>(`/admin/audit?${params.toString()}`);
      const data = Array.isArray(result) ? result : [];
      if (data.length > filterLimit) {
        hasMore = true;
        entries = data.slice(0, filterLimit);
      } else {
        hasMore = false;
        entries = data;
      }
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  load();

  function handleFilter(e: Event) {
    e.preventDefault();
    load(true);
  }

  function clearFilters() {
    filterKeyId = '';
    filterProject = '';
    filterMethod = '';
    filterResult = '';
    filterFrom = '';
    filterTo = '';
    filterLimit = 50;
    load(true);
  }

  function nextPage() {
    page++;
    load(false);
  }

  function prevPage() {
    if (page > 0) {
      page--;
      load(false);
    }
  }

  function formatTime(ts: string): string {
    const d = new Date(ts);
    return d.toLocaleString();
  }

  function methodColor(method: string): string {
    switch (method) {
      case 'GET': return 'var(--success)';
      case 'POST': return 'var(--primary)';
      case 'PATCH': return 'var(--warning)';
      case 'PUT': return 'var(--warning)';
      case 'DELETE': return 'var(--danger)';
      default: return 'var(--text-muted)';
    }
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h1>Audit Log</h1>
      <p class="page-desc">Review all API requests processed by the gateway</p>
    </div>
  </div>

  <div class="card filter-card">
    <form onsubmit={handleFilter} class="filter-form">
      <div class="filter-row">
        <div class="filter-field">
          <label for="fKeyId">Key ID</label>
          <input id="fKeyId" type="text" bind:value={filterKeyId} placeholder="Filter by key ID" />
        </div>
        <div class="filter-field">
          <label for="fProject">Project</label>
          <input id="fProject" type="text" bind:value={filterProject} placeholder="Filter by project slug" />
        </div>
        <div class="filter-field">
          <label for="fMethod">Method</label>
          <select id="fMethod" bind:value={filterMethod}>
            <option value="">All methods</option>
            {#each methods.slice(1) as m}
              <option value={m}>{m}</option>
            {/each}
          </select>
        </div>
        <div class="filter-field">
          <label for="fResult">Result</label>
          <select id="fResult" bind:value={filterResult}>
            <option value="">All results</option>
            {#each results.slice(1) as r}
              <option value={r}>{r}</option>
            {/each}
          </select>
        </div>
      </div>
      <div class="filter-row">
        <div class="filter-field">
          <label for="fFrom">From</label>
          <input id="fFrom" type="date" bind:value={filterFrom} />
        </div>
        <div class="filter-field">
          <label for="fTo">To</label>
          <input id="fTo" type="date" bind:value={filterTo} />
        </div>
        <div class="filter-field">
          <label for="fLimit">Per page</label>
          <select id="fLimit" bind:value={filterLimit}>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <div class="filter-actions">
          <button type="submit" class="btn-primary">Apply</button>
          <button type="button" class="btn-ghost" onclick={clearFilters}>Clear</button>
        </div>
      </div>
    </form>
  </div>

  {#if loading}
    <div class="loading">Loading audit log...</div>
  {:else if error}
    <div class="error-msg">{error}</div>
  {:else if entries.length === 0}
    <div class="empty-state">
      <p>No audit entries found matching your filters.</p>
    </div>
  {:else}
    <div class="card">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Method</th>
              <th>Endpoint</th>
              <th>Project</th>
              <th>Key</th>
              <th>Status</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {#each entries as entry}
              <tr>
                <td class="time-cell">{formatTime(entry.timestamp)}</td>
                <td>
                  <span class="method-badge" style="color: {methodColor(entry.method)}">{entry.method}</span>
                </td>
                <td class="endpoint-cell">{entry.endpoint}</td>
                <td>{entry.project_slug || '-'}</td>
                <td>
                  <div class="key-cell">
                    {#if entry.key_label}
                      <span class="key-label-text">{entry.key_label}</span>
                    {/if}
                    <span class="key-id-text">{entry.key_id}</span>
                  </div>
                </td>
                <td class="status-cell">{entry.status_code || '-'}</td>
                <td>
                  <span class="result-badge" class:result-allowed={entry.result === 'allowed'} class:result-denied={entry.result === 'denied'}>
                    {entry.result}
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="pagination">
        <button class="btn-sm btn-ghost" onclick={prevPage} disabled={page === 0}>
          Previous
        </button>
        <span class="page-info">Page {page + 1}</span>
        <button class="btn-sm btn-ghost" onclick={nextPage} disabled={!hasMore}>
          Next
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .page {
    max-width: 1200px;
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
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: 20px;
  }
  .filter-card {
    padding: 20px;
  }
  .filter-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .filter-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
    align-items: end;
  }
  .filter-field label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 4px;
  }
  .filter-field input, .filter-field select {
    width: 100%;
    padding: 8px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 13px;
    outline: none;
    transition: border-color 0.15s;
  }
  .filter-field input:focus, .filter-field select:focus {
    border-color: var(--primary);
  }
  .filter-field select option {
    background: var(--bg-card);
    color: var(--text);
  }
  .filter-actions {
    display: flex;
    gap: 8px;
    align-items: flex-end;
    padding-bottom: 1px;
  }
  .btn-primary {
    padding: 8px 16px;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s;
    white-space: nowrap;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--primary-hover);
  }
  .btn-ghost {
    padding: 8px 16px;
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .btn-ghost:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text);
  }
  .btn-ghost:disabled {
    opacity: 0.4;
    cursor: not-allowed;
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
    text-align: left;
    padding: 12px 16px;
    color: var(--text-muted);
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
  }
  td {
    padding: 10px 16px;
    border-top: 1px solid var(--border);
  }
  .time-cell {
    font-size: 12px;
    color: var(--text-muted);
    white-space: nowrap;
  }
  .method-badge {
    font-weight: 700;
    font-size: 12px;
    font-family: monospace;
  }
  .endpoint-cell {
    font-family: monospace;
    font-size: 12px;
    color: var(--text-muted);
    max-width: 300px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .key-cell {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .key-label-text {
    font-size: 12px;
    font-weight: 600;
  }
  .key-id-text {
    font-size: 10px;
    font-family: monospace;
    color: var(--text-muted);
  }
  .status-cell {
    font-family: monospace;
    font-size: 12px;
    color: var(--text-muted);
  }
  .result-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .result-allowed {
    background: rgba(34, 197, 94, 0.1);
    color: var(--success);
  }
  .result-denied {
    background: rgba(239, 68, 68, 0.1);
    color: var(--danger);
  }
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 16px;
    border-top: 1px solid var(--border);
  }
  .page-info {
    font-size: 13px;
    color: var(--text-muted);
  }
  .btn-sm {
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
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
