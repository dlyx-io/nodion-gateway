<script lang="ts">
  import { get, post, fetchMerged } from '../lib/api.js';
  import { navigate } from '../lib/router.svelte.js';
  import { success, error as toastError } from '../lib/toast.svelte.js';
  import { isAdmin } from '../lib/auth.js';

  interface Props {
    params?: { slug?: string };
  }

  let { params }: Props = $props();

  interface Project {
    slug: string;
    label: string;
  }

  interface App {
    id: number | string;
    name: string;
    status: string;
    region?: { name: string; slug: string };
    instance_type?: { name: string };
    instance_amount?: number;
    workers?: any[];
  }

  let projects: Project[] = $state([]);
  let selectedSlug = $state('');
  let apps: App[] = $state([]);
  let loadingProjects = $state(true);
  let loadingApps = $state(false);
  let error = $state('');

  // Create app
  let showCreate = $state(false);
  let creating = $state(false);
  let newAppName = $state('');
  let newRegionId = $state('');
  let newInstanceTypeId = $state('');
  let newInstanceAmount = $state(1);
  let newIntegrationId = $state('');
  let newRepoId = $state('');
  let newBranchId = $state('');

  let regions: any[] = $state([]);
  let instanceTypes: any[] = $state([]);
  let integrations: any[] = $state([]);
  let repositories: any[] = $state([]);
  let branches: any[] = $state([]);
  let loadingRegions = $state(false);
  let loadingIntegrations = $state(false);
  let loadingRepos = $state(false);
  let loadingBranches = $state(false);

  async function loadProjects() {
    loadingProjects = true;
    try {
      projects = await get<Project[]>('/projects');
      if (params?.slug) {
        selectedSlug = params.slug;
        await loadApps();
      } else if (projects.length > 0) {
        selectedSlug = projects[0].slug;
        await loadApps();
      }
    } catch (err: any) {
      error = err.message;
    } finally {
      loadingProjects = false;
    }
  }

  loadProjects();

  async function loadApps() {
    if (!selectedSlug) {
      apps = [];
      return;
    }
    loadingApps = true;
    error = '';
    try {
      const result = await get<any>(`/projects/${selectedSlug}/applications`);
      apps = Array.isArray(result) ? result : (result.data || result.applications || []);
    } catch (err: any) {
      error = err.message;
      apps = [];
    } finally {
      loadingApps = false;
    }
  }

  async function handleProjectChange(e: Event) {
    const sel = (e.target as HTMLSelectElement).value;
    selectedSlug = sel;
    await loadApps();
  }

  function openApp(app: App) {
    navigate(`/apps/${selectedSlug}/${app.id}`);
  }

  // Create app flow
  async function openCreate() {
    showCreate = true;
    newAppName = '';
    newRegionId = '';
    newInstanceTypeId = '';
    newInstanceAmount = 1;
    newIntegrationId = '';
    newRepoId = '';
    newBranchId = '';
    regions = [];
    instanceTypes = [];
    integrations = [];
    repositories = [];
    branches = [];

    // Load reference data — regions/instance_types from current project, integrations merged from all
    const allSlugs = projects.map((p) => p.slug);
    loadingRegions = true;
    loadingIntegrations = true;
    try {
      const [regResult, itResult, mergedIntegrations] = await Promise.all([
        get<any>(`/projects/${selectedSlug}/regions`),
        get<any>(`/projects/${selectedSlug}/instance_types`),
        fetchMerged<any>(allSlugs, (s) => `/projects/${s}/integrations`, 'integrations'),
      ]);
      regions = regResult.regions || regResult.data || [];
      instanceTypes = itResult.instance_types || itResult.data || [];
      integrations = mergedIntegrations;
      if (regions.length > 0) newRegionId = regions[0].id;
      if (instanceTypes.length > 0) newInstanceTypeId = instanceTypes[0].id;
    } catch (e: any) {
      toastError('Failed to load reference data: ' + e.message);
    } finally {
      loadingRegions = false;
      loadingIntegrations = false;
    }
  }

  async function onIntegrationChange() {
    newRepoId = '';
    newBranchId = '';
    repositories = [];
    branches = [];
    if (!newIntegrationId) return;
    loadingRepos = true;
    try {
      const allSlugs = projects.map((p) => p.slug);
      repositories = await fetchMerged<any>(allSlugs, (s) => `/projects/${s}/integrations/${newIntegrationId}/repositories`, 'repositories');
    } catch { repositories = []; }
    finally { loadingRepos = false; }
  }

  async function onRepoChange() {
    newBranchId = '';
    branches = [];
    if (!newRepoId || !newIntegrationId) return;
    loadingBranches = true;
    try {
      const allSlugs = projects.map((p) => p.slug);
      branches = await fetchMerged<any>(allSlugs, (s) => `/projects/${s}/integrations/${newIntegrationId}/repositories/${newRepoId}/branches`, 'branches');
    } catch { branches = []; }
    finally { loadingBranches = false; }
  }

  async function createApp() {
    if (!newAppName.trim() || !newRegionId || !newInstanceTypeId || !newIntegrationId || !newRepoId || !newBranchId) {
      toastError('Please fill in all fields');
      return;
    }
    creating = true;
    try {
      await post(`/projects/${selectedSlug}/applications`, {
        name: newAppName,
        region_id: newRegionId,
        instance_type_id: newInstanceTypeId,
        instance_amount: newInstanceAmount,
        integration_id: newIntegrationId,
        repository_id: newRepoId,
        branch_id: newBranchId,
      });
      success('Application created');
      showCreate = false;
      await loadApps();
    } catch (e: any) {
      toastError('Create failed: ' + e.message);
    } finally {
      creating = false;
    }
  }

  function statusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'online': case 'running': case 'available': case 'active':
        return 'var(--success)';
      case 'failed': case 'error':
        return 'var(--danger)';
      case 'deploying': case 'waiting': case 'created':
        return 'var(--warning)';
      default:
        return 'var(--text-muted)';
    }
  }
</script>

<div class="page">
  <div class="page-header">
    <div>
      <h1>Applications</h1>
      <p class="page-desc">View and manage applications across your projects</p>
    </div>
    <div class="header-actions">
      {#if !loadingProjects && projects.length > 0}
        <div class="project-select">
          <label for="project-sel">Project:</label>
          <select id="project-sel" value={selectedSlug} onchange={handleProjectChange}>
            {#each projects as proj}
              <option value={proj.slug}>{proj.label} ({proj.slug})</option>
            {/each}
          </select>
        </div>
        {#if isAdmin()}
          <button class="btn-primary" onclick={openCreate}>Create App</button>
        {/if}
      {/if}
    </div>
  </div>

  {#if loadingProjects}
    <div class="loading">Loading projects...</div>
  {:else if projects.length === 0}
    <div class="empty-state">
      <p>No projects accessible. Contact an admin to grant you project access.</p>
    </div>
  {:else if loadingApps}
    <div class="loading">Loading applications...</div>
  {:else if error}
    <div class="error-msg">{error}</div>
  {:else if apps.length === 0}
    <div class="empty-state">
      <p>No applications found in project <strong>{selectedSlug}</strong>.</p>
      {#if isAdmin()}
        <button class="btn-primary" style="margin-top: 16px" onclick={openCreate}>Create your first app</button>
      {/if}
    </div>
  {:else}
    <div class="apps-grid">
      {#each apps as app}
        <button class="app-card" onclick={() => openApp(app)}>
          <div class="app-header">
            <div class="app-name">{app.name}</div>
            <div class="status-dot" style="background: {statusColor(app.status)}"></div>
          </div>
          <div class="app-meta">
            <span class="app-status" style="color: {statusColor(app.status)}">{app.status || 'unknown'}</span>
            {#if app.region?.name}
              <span class="app-region">{app.region.name}</span>
            {/if}
          </div>
          {#if app.instance_type?.name}
            <div class="app-instance">{app.instance_type.name} x{app.instance_amount || 1}</div>
          {/if}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Create App Modal -->
  {#if showCreate}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-overlay" onclick={() => showCreate = false}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>Create Application</h2>
          <button class="close-btn" onclick={() => showCreate = false} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="create-form">
          <div class="form-group">
            <label for="app-name">Application Name</label>
            <input id="app-name" type="text" bind:value={newAppName} class="input" placeholder="my-app" />
          </div>

          <div class="form-row-2">
            <div class="form-group">
              <label for="region">Region</label>
              <select id="region" bind:value={newRegionId} class="input" disabled={loadingRegions}>
                {#if loadingRegions}
                  <option>Loading...</option>
                {:else}
                  {#each regions as r}
                    <option value={r.id}>{r.name} ({r.slug})</option>
                  {/each}
                {/if}
              </select>
            </div>

            <div class="form-group">
              <label for="instance-type">Instance Type</label>
              <select id="instance-type" bind:value={newInstanceTypeId} class="input" disabled={loadingRegions}>
                {#if loadingRegions}
                  <option>Loading...</option>
                {:else}
                  {#each instanceTypes as t}
                    <option value={t.id}>{t.name} ({t.cpu}CPU, {t.mem}GB, {t.price_month}/mo)</option>
                  {/each}
                {/if}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="instance-amount">Instances</label>
            <input id="instance-amount" type="number" min="1" max="16" bind:value={newInstanceAmount} class="input" style="width: 100px" />
          </div>

          <hr class="divider" />

          <div class="form-group">
            <label for="integration">Git Integration</label>
            <select id="integration" bind:value={newIntegrationId} class="input"
              onchange={onIntegrationChange} disabled={loadingIntegrations}>
              <option value="">Select integration...</option>
              {#if loadingIntegrations}
                <option>Loading...</option>
              {:else}
                {#each integrations as i}
                  <option value={i.id}>{i.service_type}: {i.username}</option>
                {/each}
              {/if}
            </select>
          </div>

          <div class="form-group">
            <label for="repo">Repository</label>
            <select id="repo" bind:value={newRepoId} class="input"
              onchange={onRepoChange} disabled={!newIntegrationId || loadingRepos}>
              <option value="">Select repository...</option>
              {#if loadingRepos}
                <option>Loading...</option>
              {:else}
                {#each repositories as r}
                  <option value={r.id}>{r.full_name || r.name}</option>
                {/each}
              {/if}
            </select>
          </div>

          <div class="form-group">
            <label for="branch">Branch</label>
            <select id="branch" bind:value={newBranchId} class="input" disabled={!newRepoId || loadingBranches}>
              <option value="">Select branch...</option>
              {#if loadingBranches}
                <option>Loading...</option>
              {:else}
                {#each branches as b}
                  <option value={b.id}>{b.name}</option>
                {/each}
              {/if}
            </select>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" onclick={() => showCreate = false}>Cancel</button>
          <button class="btn-primary" onclick={createApp} disabled={creating}>
            {creating ? 'Creating...' : 'Create Application'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .page { max-width: 1200px; }
  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 24px;
    gap: 16px;
    flex-wrap: wrap;
  }
  .page-header h1 { font-size: 24px; font-weight: 700; }
  .page-desc { color: var(--text-muted); font-size: 14px; margin-top: 4px; }
  .header-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .project-select { display: flex; align-items: center; gap: 8px; }
  .project-select label { font-size: 13px; color: var(--text-muted); font-weight: 600; }
  .project-select select {
    padding: 8px 12px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 14px;
    outline: none;
    min-width: 200px;
  }
  .project-select select:focus { border-color: var(--primary); }
  .project-select select option { background: var(--bg-card); color: var(--text); }

  .apps-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
  .app-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
    color: var(--text);
    width: 100%;
    font-family: inherit;
    font-size: inherit;
  }
  .app-card:hover { border-color: var(--primary); background: var(--bg-hover); }
  .app-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .app-name { font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .status-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  .app-meta { display: flex; gap: 12px; font-size: 13px; margin-bottom: 6px; }
  .app-status { font-weight: 600; text-transform: capitalize; }
  .app-region { color: var(--text-muted); }
  .app-instance { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    z-index: 200;
    padding: 40px 16px;
    overflow-y: auto;
  }
  .modal {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 28px;
    max-width: 600px;
    width: 100%;
    margin-bottom: 40px;
  }
  .modal-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .modal-header h2 { font-size: 20px; font-weight: 700; }
  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }
  .close-btn:hover { background: var(--bg-hover); color: var(--text); }
  .modal-footer { display: flex; gap: 10px; justify-content: flex-end; margin-top: 24px; }

  /* Form */
  .create-form { display: flex; flex-direction: column; gap: 0; }
  .form-group { margin-bottom: 16px; }
  .form-group label { display: block; font-size: 13px; font-weight: 600; color: var(--text-muted); margin-bottom: 6px; }
  .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .input {
    width: 100%;
    padding: 8px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 14px;
    outline: none;
  }
  .input:focus { border-color: var(--primary); }
  .input:disabled { opacity: 0.5; cursor: not-allowed; }
  select.input option { background: var(--bg); color: var(--text); }
  .divider { border: none; border-top: 1px solid var(--border); margin: 8px 0 16px; }

  /* Buttons */
  .btn-primary {
    padding: 8px 16px;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-secondary {
    padding: 8px 16px;
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }
  .btn-secondary:hover { background: var(--bg-hover); }

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
</style>
