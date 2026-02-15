<script lang="ts">
  import { isAdmin, getUser } from '../lib/auth.js';
  import { get } from '../lib/api.js';

  let projects: any[] = $state([]);
  let keys: any[] = $state([]);
  let audit: any[] = $state([]);
  let accessibleProjects: any[] = $state([]);
  let loading = $state(true);
  let error = $state('');

  const admin = $derived(isAdmin());
  const user = $derived(getUser());

  async function load() {
    loading = true;
    error = '';
    try {
      const promises: Promise<any>[] = [
        get<any[]>('/projects'),
      ];
      if (admin) {
        promises.push(get<any[]>('/admin/projects'));
        promises.push(get<any[]>('/admin/keys'));
        promises.push(get<any[]>('/admin/audit?limit=10'));
      }
      const results = await Promise.all(promises);
      accessibleProjects = results[0] || [];
      if (admin) {
        projects = results[1] || [];
        keys = results[2] || [];
        audit = results[3] || [];
      }
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  load();

  function formatTime(ts: string): string {
    const d = new Date(ts);
    return d.toLocaleString();
  }

  function methodColor(method: string): string {
    switch (method) {
      case 'GET': return 'var(--success)';
      case 'POST': return 'var(--primary)';
      case 'PATCH': return 'var(--warning)';
      case 'DELETE': return 'var(--danger)';
      default: return 'var(--text-muted)';
    }
  }
</script>

<div class="dashboard">
  <div class="page-header">
    <h1>Dashboard</h1>
    <p class="welcome">Welcome back, {user?.label ?? 'User'}</p>
  </div>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else if error}
    <div class="error">{error}</div>
  {:else}
    <div class="stats-grid">
      <a href="#/apps" class="stat-card">
        <div class="stat-icon" style="color: var(--primary)">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8"/>
            <path d="M12 17v4"/>
          </svg>
        </div>
        <div class="stat-value">{accessibleProjects.length}</div>
        <div class="stat-label">Accessible Projects</div>
      </a>

      {#if admin}
        <a href="#/projects" class="stat-card">
          <div class="stat-icon" style="color: var(--success)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div class="stat-value">{projects.length}</div>
          <div class="stat-label">Total Projects</div>
        </a>

        <a href="#/keys" class="stat-card">
          <div class="stat-icon" style="color: var(--warning)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
            </svg>
          </div>
          <div class="stat-value">{keys.length}</div>
          <div class="stat-label">API Keys</div>
        </a>

        <a href="#/audit" class="stat-card">
          <div class="stat-icon" style="color: var(--text-muted)">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div class="stat-value">{audit.length >= 10 ? '10+' : audit.length}</div>
          <div class="stat-label">Recent Events</div>
        </a>
      {/if}
    </div>

    {#if admin && audit.length > 0}
      <div class="card">
        <div class="card-header">
          <h2>Recent Activity</h2>
          <a href="#/audit" class="card-link">View all</a>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Method</th>
                <th>Endpoint</th>
                <th>Project</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {#each audit as entry}
                <tr>
                  <td class="muted">{formatTime(entry.timestamp)}</td>
                  <td>
                    <span class="method-badge" style="color: {methodColor(entry.method)}">{entry.method}</span>
                  </td>
                  <td class="endpoint">{entry.endpoint}</td>
                  <td>{entry.project_slug || '-'}</td>
                  <td>
                    <span class="result-badge" class:success={entry.result === 'allowed'} class:denied={entry.result === 'denied'}>
                      {entry.result}
                    </span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

    {#if !admin}
      <div class="card">
        <div class="card-header">
          <h2>Your Projects</h2>
        </div>
        {#if accessibleProjects.length === 0}
          <div class="empty">No projects accessible with your current key.</div>
        {:else}
          <div class="project-grid">
            {#each accessibleProjects as proj}
              <a href="#/apps/{proj.slug}" class="project-card">
                <div class="project-slug">{proj.slug}</div>
                <div class="project-label">{proj.label}</div>
              </a>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .dashboard {
    max-width: 1200px;
  }
  .page-header {
    margin-bottom: 28px;
  }
  .page-header h1 {
    font-size: 24px;
    font-weight: 700;
  }
  .welcome {
    color: var(--text-muted);
    font-size: 14px;
    margin-top: 4px;
  }
  .loading, .error {
    padding: 40px;
    text-align: center;
    color: var(--text-muted);
  }
  .error {
    color: var(--danger);
  }
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
    margin-bottom: 28px;
  }
  .stat-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 24px;
    transition: all 0.15s;
    display: block;
    color: var(--text);
  }
  .stat-card:hover {
    background: var(--bg-hover);
    border-color: var(--primary);
    color: var(--text);
  }
  .stat-icon {
    margin-bottom: 12px;
  }
  .stat-value {
    font-size: 32px;
    font-weight: 700;
    line-height: 1;
  }
  .stat-label {
    font-size: 13px;
    color: var(--text-muted);
    margin-top: 6px;
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
  .card-link {
    font-size: 13px;
    color: var(--primary);
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
    padding: 10px 16px;
    color: var(--text-muted);
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  td {
    padding: 10px 16px;
    border-top: 1px solid var(--border);
  }
  .muted {
    color: var(--text-muted);
    font-size: 12px;
  }
  .method-badge {
    font-weight: 600;
    font-size: 12px;
    font-family: monospace;
  }
  .endpoint {
    font-family: monospace;
    font-size: 12px;
    color: var(--text-muted);
  }
  .result-badge {
    font-size: 12px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 4px;
  }
  .result-badge.success {
    color: var(--success);
    background: rgba(34, 197, 94, 0.1);
  }
  .result-badge.denied {
    color: var(--danger);
    background: rgba(239, 68, 68, 0.1);
  }
  .empty {
    padding: 32px;
    text-align: center;
    color: var(--text-muted);
    font-size: 14px;
  }
  .project-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    padding: 16px 20px;
  }
  .project-card {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    transition: all 0.15s;
    display: block;
    color: var(--text);
  }
  .project-card:hover {
    border-color: var(--primary);
    background: var(--bg-hover);
    color: var(--text);
  }
  .project-slug {
    font-family: monospace;
    font-size: 14px;
    font-weight: 600;
  }
  .project-label {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
  }
</style>
