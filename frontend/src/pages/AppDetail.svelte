<script lang="ts">
  import { get, post, patch, del, fetchMerged } from '../lib/api.js';
  import { navigate } from '../lib/router.svelte.js';
  import { success, error as toastError } from '../lib/toast.svelte.js';
  import { isAdmin } from '../lib/auth.js';

  interface Props {
    params?: { slug?: string; appId?: string };
  }

  let { params }: Props = $props();
  const slug = $derived(params?.slug ?? '');
  const appId = $derived(params?.appId ?? '');

  // --- State ---
  let tab: 'overview' | 'deployments' | 'env' | 'domains' | 'scaling' = $state('overview');
  let app: any = $state(null);
  let loading = $state(true);
  let err = $state('');

  // Deployments
  let deployments: any[] = $state([]);
  let loadingDeploys = $state(false);
  let deploying = $state(false);

  // Env Vars
  let envVars: any[] = $state([]);
  let loadingEnv = $state(false);
  let showAddEnv = $state(false);
  let newEnvKey = $state('');
  let newEnvVal = $state('');
  let newEnvBuild = $state(false);
  let savingEnv = $state(false);
  let editingEnvId: string | null = $state(null);
  let editEnvKey = $state('');
  let editEnvVal = $state('');
  let editEnvBuild = $state(false);

  // Domains
  let domains: any[] = $state([]);
  let loadingDomains = $state(false);
  let showAddDomain = $state(false);
  let newDomainName = $state('');
  let savingDomain = $state(false);

  // Scaling
  let instanceTypes: any[] = $state([]);
  let loadingScaling = $state(false);
  let scaleAmount = $state(1);
  let scaleTypeId = $state('');
  let savingScale = $state(false);

  // Instances
  let instances: any[] = $state([]);
  let loadingInstances = $state(false);

  // Git info (resolved names for integration/repo/branch IDs)
  let gitInfo: { integration: string; repo: string; branch: string } | null = $state(null);

  // Delete
  let showDeleteConfirm = $state(false);
  let deleting = $state(false);

  // Clone
  let showClone = $state(false);
  let cloneName = $state('');
  let cloneRegionId = $state('');
  let cloneInstanceTypeId = $state('');
  let cloneInstanceAmount = $state(1);
  let cloneIntegrationId = $state('');
  let cloneRepoId = $state('');
  let cloneBranchId = $state('');
  let cloneEnvVars: { key: string; val: string; buildtime: boolean; include: boolean }[] = $state([]);
  let cloneAutoDeploy = $state(true);
  let cloneRegions: any[] = $state([]);
  let cloneInstanceTypes: any[] = $state([]);
  let cloneBranches: any[] = $state([]);
  let cloneIntegrations: any[] = $state([]);
  let cloneRepos: any[] = $state([]);
  let allProjectSlugs: string[] = $state([]);
  let loadingCloneData = $state(false);
  let loadingCloneBranches = $state(false);
  let loadingCloneRepos = $state(false);
  let cloning = $state(false);
  let cloneProgress = $state('');
  let cloneSteps: { label: string; status: 'pending' | 'running' | 'done' | 'error' }[] = $state([]);

  // --- Load app ---
  async function loadApp() {
    loading = true;
    err = '';
    try {
      const result = await get<any>(`/projects/${slug}/applications/${appId}`);
      app = result.application || result.data || result;
      scaleAmount = app.instance_amount || 1;
      scaleTypeId = app.instance_type_id || '';
      loadGitInfo();
    } catch (e: any) {
      err = e.message;
    } finally {
      loading = false;
    }
  }

  loadApp();

  async function loadGitInfo() {
    if (!app?.integration_id) return;
    try {
      // Get all project slugs for fetchMerged (integration may belong to a different project)
      const projList = await get<any>('/projects');
      const slugs = (Array.isArray(projList) ? projList : projList.projects || []).map((p: any) => p.slug);
      if (slugs.length === 0) slugs.push(slug);

      // Resolve integration name
      const integrations = await fetchMerged<any>(slugs, (s) => `/projects/${s}/integrations`, 'integrations');
      const integration = integrations.find((i: any) => i.id === app.integration_id);

      let repoName = '';
      let branchName = '';

      // Resolve repo name
      if (app.repository_id) {
        const repos = await fetchMerged<any>(slugs, (s) => `/projects/${s}/integrations/${app.integration_id}/repositories`, 'repositories');
        const repo = repos.find((r: any) => r.id === app.repository_id);
        if (repo) repoName = repo.full_name || repo.name;

        // Resolve branch name
        if (repo && app.branch_id) {
          const branches = await fetchMerged<any>(slugs, (s) => `/projects/${s}/integrations/${app.integration_id}/repositories/${app.repository_id}/branches`, 'branches');
          const branch = branches.find((b: any) => b.id === app.branch_id);
          if (branch) branchName = branch.name;
        }
      }

      gitInfo = {
        integration: integration ? `${integration.service_type}: ${integration.username}` : app.integration_id,
        repo: repoName || app.repository_id || '-',
        branch: branchName || app.branch_id || '-',
      };
    } catch {
      gitInfo = {
        integration: app.integration_id || '-',
        repo: app.repository_id || '-',
        branch: app.branch_id || '-',
      };
    }
  }

  // --- Tab loaders ---
  async function loadDeployments() {
    loadingDeploys = true;
    try {
      const r = await get<any>(`/projects/${slug}/applications/${appId}/deployments`);
      deployments = r.deployments || r.data || [];
    } catch { deployments = []; }
    finally { loadingDeploys = false; }
  }

  async function loadEnvVars() {
    loadingEnv = true;
    try {
      const r = await get<any>(`/projects/${slug}/applications/${appId}/env_variables`);
      envVars = r.env_variables || r.data || [];
    } catch { envVars = []; }
    finally { loadingEnv = false; }
  }

  async function loadDomains() {
    loadingDomains = true;
    try {
      const r = await get<any>(`/projects/${slug}/applications/${appId}/domains`);
      domains = r.domains || r.data || [];
    } catch { domains = []; }
    finally { loadingDomains = false; }
  }

  async function loadScaling() {
    loadingScaling = true;
    try {
      const r = await get<any>(`/projects/${slug}/instance_types`);
      instanceTypes = r.instance_types || r.data || [];
    } catch { instanceTypes = []; }
    finally { loadingScaling = false; }
  }

  async function loadInstances() {
    loadingInstances = true;
    try {
      const r = await get<any>(`/projects/${slug}/applications/${appId}/instances`);
      instances = r.instances || r.data || [];
    } catch { instances = []; }
    finally { loadingInstances = false; }
  }

  function switchTab(t: typeof tab) {
    tab = t;
    if (t === 'deployments' && deployments.length === 0) loadDeployments();
    if (t === 'env' && envVars.length === 0) loadEnvVars();
    if (t === 'domains' && domains.length === 0) loadDomains();
    if (t === 'scaling' && instanceTypes.length === 0) loadScaling();
    if (t === 'overview' && instances.length === 0) loadInstances();
  }

  // Load instances for overview tab on mount
  loadInstances();

  // --- Actions ---
  async function triggerDeploy() {
    deploying = true;
    try {
      await post(`/projects/${slug}/applications/${appId}/deployments`);
      success('Deployment triggered');
      await loadDeployments();
    } catch (e: any) {
      toastError('Deploy failed: ' + e.message);
    } finally {
      deploying = false;
    }
  }

  // Env CRUD
  async function addEnvVar() {
    if (!newEnvKey.trim()) return;
    savingEnv = true;
    try {
      await post(`/projects/${slug}/applications/${appId}/env_variables`, {
        env_key: newEnvKey,
        env_val: newEnvVal,
        buildtime: newEnvBuild || undefined,
      });
      success('Environment variable created');
      newEnvKey = '';
      newEnvVal = '';
      newEnvBuild = false;
      showAddEnv = false;
      await loadEnvVars();
    } catch (e: any) {
      toastError('Failed: ' + e.message);
    } finally {
      savingEnv = false;
    }
  }

  function startEditEnv(v: any) {
    editingEnvId = v.id;
    editEnvKey = v.env_key;
    editEnvVal = v.env_val;
    editEnvBuild = !!v.buildtime;
  }

  function cancelEditEnv() {
    editingEnvId = null;
  }

  async function saveEditEnv() {
    if (!editingEnvId) return;
    savingEnv = true;
    try {
      await patch(`/projects/${slug}/applications/${appId}/env_variables/${editingEnvId}`, {
        env_key: editEnvKey,
        env_val: editEnvVal,
        buildtime: editEnvBuild || undefined,
      });
      success('Environment variable updated');
      editingEnvId = null;
      await loadEnvVars();
    } catch (e: any) {
      toastError('Failed: ' + e.message);
    } finally {
      savingEnv = false;
    }
  }

  async function deleteEnvVar(id: string) {
    if (!confirm('Delete this environment variable?')) return;
    try {
      await del(`/projects/${slug}/applications/${appId}/env_variables/${id}`);
      success('Environment variable deleted');
      await loadEnvVars();
    } catch (e: any) {
      toastError('Failed: ' + e.message);
    }
  }

  // Domain actions
  async function addDomain() {
    if (!newDomainName.trim()) return;
    savingDomain = true;
    try {
      await post(`/projects/${slug}/applications/${appId}/domains`, {
        domain_name: newDomainName,
      });
      success('Domain added');
      newDomainName = '';
      showAddDomain = false;
      await loadDomains();
    } catch (e: any) {
      toastError('Failed: ' + e.message);
    } finally {
      savingDomain = false;
    }
  }

  async function verifyDomain(domainId: string) {
    try {
      await post(`/projects/${slug}/applications/${appId}/domains/${domainId}/verify`);
      success('Domain verification initiated');
      await loadDomains();
    } catch (e: any) {
      toastError('Verify failed: ' + e.message);
    }
  }

  async function connectDomain(domainId: string) {
    try {
      await post(`/projects/${slug}/applications/${appId}/domains/${domainId}/connect`);
      success('Domain connected');
      await loadDomains();
    } catch (e: any) {
      toastError('Connect failed: ' + e.message);
    }
  }

  async function deleteDomain(domainId: string) {
    if (!confirm('Delete this domain?')) return;
    try {
      await del(`/projects/${slug}/applications/${appId}/domains/${domainId}`);
      success('Domain deleted');
      await loadDomains();
    } catch (e: any) {
      toastError('Failed: ' + e.message);
    }
  }

  // Scaling
  async function applyScaling() {
    savingScale = true;
    try {
      await post(`/projects/${slug}/applications/${appId}/scaling_events`, {
        instance_amount: scaleAmount,
        instance_type_id: scaleTypeId,
      });
      success('Scaling event created');
      await loadApp();
    } catch (e: any) {
      toastError('Scaling failed: ' + e.message);
    } finally {
      savingScale = false;
    }
  }

  // Delete app
  async function deleteApp() {
    deleting = true;
    try {
      await del(`/projects/${slug}/applications/${appId}`);
      success('Application deleted');
      navigate(`/apps/${slug}`);
    } catch (e: any) {
      toastError('Delete failed: ' + e.message);
      deleting = false;
      showDeleteConfirm = false;
    }
  }

  // Clone functions
  async function openClone() {
    showClone = true;
    cloneName = app.name + ' (clone)';
    cloneRegionId = app.region?.id || '';
    cloneInstanceTypeId = app.instance_type_id || '';
    cloneInstanceAmount = app.instance_amount || 1;
    cloneIntegrationId = app.integration_id || '';
    cloneRepoId = app.repository_id || '';
    cloneBranchId = app.branch_id || '';
    cloneAutoDeploy = true;
    cloneSteps = [];
    cloneProgress = '';
    cloning = false;

    // Load env vars for clone if not already loaded
    if (envVars.length === 0) {
      try {
        const r = await get<any>(`/projects/${slug}/applications/${appId}/env_variables`);
        envVars = r.env_variables || r.data || [];
      } catch { /* ignore */ }
    }
    cloneEnvVars = envVars.map((v: any) => ({
      key: v.env_key,
      val: v.env_val,
      buildtime: !!v.buildtime,
      include: true,
    }));

    // Load all project slugs + reference data (integrations merged from all projects)
    loadingCloneData = true;
    try {
      const projects = await get<{ slug: string }[]>('/projects');
      allProjectSlugs = projects.map((p) => p.slug);

      const [regResult, itResult, mergedIntegrations] = await Promise.all([
        get<any>(`/projects/${slug}/regions`),
        get<any>(`/projects/${slug}/instance_types`),
        fetchMerged<any>(allProjectSlugs, (s) => `/projects/${s}/integrations`, 'integrations'),
      ]);
      cloneRegions = regResult.regions || [];
      cloneInstanceTypes = itResult.instance_types || [];
      cloneIntegrations = mergedIntegrations;
    } catch { /* ignore */ }
    finally { loadingCloneData = false; }

    // Load repos for current integration
    if (cloneIntegrationId) {
      await loadCloneRepos();
      // Load branches for current repo
      if (cloneRepoId) {
        await loadCloneBranches();
      }
    }
  }

  async function loadCloneRepos() {
    if (!cloneIntegrationId) return;
    loadingCloneRepos = true;
    try {
      const slugs = allProjectSlugs.length > 0 ? allProjectSlugs : [slug];
      cloneRepos = await fetchMerged<any>(slugs, (s) => `/projects/${s}/integrations/${cloneIntegrationId}/repositories`, 'repositories');
    } catch { cloneRepos = []; }
    finally { loadingCloneRepos = false; }
  }

  async function loadCloneBranches() {
    if (!cloneIntegrationId || !cloneRepoId) return;
    loadingCloneBranches = true;
    try {
      const slugs = allProjectSlugs.length > 0 ? allProjectSlugs : [slug];
      cloneBranches = await fetchMerged<any>(slugs, (s) => `/projects/${s}/integrations/${cloneIntegrationId}/repositories/${cloneRepoId}/branches`, 'branches');
    } catch { cloneBranches = []; }
    finally { loadingCloneBranches = false; }
  }

  async function onCloneIntegrationChange() {
    cloneRepoId = '';
    cloneBranchId = '';
    cloneRepos = [];
    cloneBranches = [];
    await loadCloneRepos();
  }

  async function onCloneRepoChange() {
    cloneBranchId = '';
    cloneBranches = [];
    await loadCloneBranches();
  }

  async function executeClone() {
    if (!cloneName.trim() || !cloneRegionId || !cloneInstanceTypeId || !cloneIntegrationId || !cloneRepoId || !cloneBranchId) {
      toastError('Please fill in all required fields');
      return;
    }
    cloning = true;
    const includedEnvVars = cloneEnvVars.filter((v) => v.include);
    const totalSteps = 1 + includedEnvVars.length + (cloneAutoDeploy ? 1 : 0);

    cloneSteps = [
      { label: 'Create application', status: 'pending' },
      ...includedEnvVars.map((v) => ({ label: `Set ${v.key}`, status: 'pending' as const })),
      ...(cloneAutoDeploy ? [{ label: 'Trigger deployment', status: 'pending' as const }] : []),
    ];

    let newAppId: string | null = null;

    // Step 1: Create app
    cloneSteps[0].status = 'running';
    cloneSteps = [...cloneSteps];
    cloneProgress = `Step 1/${totalSteps}: Creating application...`;
    try {
      const result = await post<any>(`/projects/${slug}/applications`, {
        name: cloneName,
        region_id: cloneRegionId,
        instance_type_id: cloneInstanceTypeId,
        instance_amount: cloneInstanceAmount,
        integration_id: cloneIntegrationId,
        repository_id: cloneRepoId,
        branch_id: cloneBranchId,
      });
      newAppId = result.application?.id || result.data?.id || result.id;
      cloneSteps[0].status = 'done';
      cloneSteps = [...cloneSteps];
    } catch (e: any) {
      cloneSteps[0].status = 'error';
      cloneSteps = [...cloneSteps];
      cloneProgress = 'Failed: ' + e.message;
      cloning = false;
      return;
    }

    if (!newAppId) {
      cloneProgress = 'Failed: Could not get new app ID';
      cloning = false;
      return;
    }

    // Step 2-N: Set env vars
    for (let i = 0; i < includedEnvVars.length; i++) {
      const stepIdx = 1 + i;
      cloneSteps[stepIdx].status = 'running';
      cloneSteps = [...cloneSteps];
      cloneProgress = `Step ${stepIdx + 1}/${totalSteps}: Setting ${includedEnvVars[i].key}...`;
      try {
        await post(`/projects/${slug}/applications/${newAppId}/env_variables`, {
          env_key: includedEnvVars[i].key,
          env_val: includedEnvVars[i].val,
          buildtime: includedEnvVars[i].buildtime || undefined,
        });
        cloneSteps[stepIdx].status = 'done';
        cloneSteps = [...cloneSteps];
      } catch (e: any) {
        cloneSteps[stepIdx].status = 'error';
        cloneSteps = [...cloneSteps];
        // Continue with other env vars even if one fails
      }
    }

    // Final step: Deploy
    if (cloneAutoDeploy) {
      const deployIdx = cloneSteps.length - 1;
      cloneSteps[deployIdx].status = 'running';
      cloneSteps = [...cloneSteps];
      cloneProgress = `Step ${totalSteps}/${totalSteps}: Triggering deployment...`;
      try {
        await post(`/projects/${slug}/applications/${newAppId}/deployments`);
        cloneSteps[deployIdx].status = 'done';
        cloneSteps = [...cloneSteps];
      } catch {
        cloneSteps[deployIdx].status = 'error';
        cloneSteps = [...cloneSteps];
      }
    }

    const failedSteps = cloneSteps.filter((s) => s.status === 'error').length;
    if (failedSteps > 0) {
      cloneProgress = `Clone completed with ${failedSteps} error(s)`;
      toastError(`Clone completed with ${failedSteps} error(s)`);
    } else {
      cloneProgress = 'Clone completed successfully!';
      success('Application cloned successfully');
    }
    cloning = false;

    // Navigate to new app after short delay
    if (newAppId) {
      setTimeout(() => {
        navigate(`/apps/${slug}/${newAppId}`);
      }, 1500);
    }
  }

  function statusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'online': case 'running': case 'available': case 'active': case 'finished': return 'var(--success)';
      case 'failed': case 'error': case 'expired': return 'var(--danger)';
      case 'deploying': case 'waiting': case 'created': return 'var(--warning)';
      default: return 'var(--text-muted)';
    }
  }

  function shortDate(d: string): string {
    if (!d) return '-';
    return new Date(d).toLocaleString();
  }

  function shortSha(sha: string): string {
    return sha ? sha.substring(0, 7) : '-';
  }
</script>

<div class="page">
  <!-- Breadcrumb -->
  <div class="breadcrumb">
    <a href="#/apps/{slug}">Applications</a>
    <span class="sep">/</span>
    <span>{app?.name || appId}</span>
  </div>

  {#if loading}
    <div class="loading-page">Loading application...</div>
  {:else if err}
    <div class="error-page">{err}</div>
  {:else if app}
    <div class="app-header">
      <div class="app-title">
        <h1>{app.name}</h1>
        <span class="status-badge" style="color: {statusColor(app.status)}; border-color: {statusColor(app.status)}">
          {app.status}
        </span>
      </div>
      <div class="app-actions">
        <button class="btn-primary" onclick={triggerDeploy} disabled={deploying}>
          {deploying ? 'Deploying...' : 'Deploy'}
        </button>
        <button class="btn-secondary" onclick={openClone}>Clone</button>
        {#if isAdmin()}
          <button class="btn-danger" onclick={() => showDeleteConfirm = true}>Delete</button>
        {/if}
      </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab" class:active={tab === 'overview'} onclick={() => switchTab('overview')}>Overview</button>
      <button class="tab" class:active={tab === 'deployments'} onclick={() => switchTab('deployments')}>Deployments</button>
      <button class="tab" class:active={tab === 'env'} onclick={() => switchTab('env')}>Env Variables</button>
      <button class="tab" class:active={tab === 'domains'} onclick={() => switchTab('domains')}>Domains</button>
      <button class="tab" class:active={tab === 'scaling'} onclick={() => switchTab('scaling')}>Scaling</button>
    </div>

    <!-- Tab content -->
    <div class="tab-content">
      {#if tab === 'overview'}
        <div class="info-grid">
          <div class="info-card">
            <span class="info-label">ID</span>
            <span class="info-value mono">{app.id}</span>
          </div>
          <div class="info-card">
            <span class="info-label">Slug</span>
            <span class="info-value">{app.slug || '-'}</span>
          </div>
          <div class="info-card">
            <span class="info-label">Integration</span>
            <span class="info-value">{gitInfo?.integration || '...'}</span>
          </div>
          <div class="info-card">
            <span class="info-label">Repository</span>
            <span class="info-value">{gitInfo?.repo || '...'}</span>
          </div>
          <div class="info-card">
            <span class="info-label">Branch</span>
            <span class="info-value">{gitInfo?.branch || '...'}</span>
          </div>
          <div class="info-card">
            <span class="info-label">Region</span>
            <span class="info-value">{app.region?.name || '-'}</span>
          </div>
          <div class="info-card">
            <span class="info-label">Instance Type</span>
            <span class="info-value">{app.instance_type?.name || '-'}</span>
          </div>
          <div class="info-card">
            <span class="info-label">Instances</span>
            <span class="info-value">{app.instance_amount || 0}</span>
          </div>
          <div class="info-card">
            <span class="info-label">Created</span>
            <span class="info-value">{shortDate(app.created_at)}</span>
          </div>
        </div>

        {#if app.instance_type}
          <div class="section">
            <h3 class="section-title">Instance Specs</h3>
            <div class="info-grid">
              <div class="info-card">
                <span class="info-label">CPU</span>
                <span class="info-value">{app.instance_type.cpu} vCPU</span>
              </div>
              <div class="info-card">
                <span class="info-label">Memory</span>
                <span class="info-value">{app.instance_type.mem} GB</span>
              </div>
              <div class="info-card">
                <span class="info-label">Price</span>
                <span class="info-value">{app.instance_type.price_month}/mo</span>
              </div>
            </div>
          </div>
        {/if}

        <div class="section">
          <h3 class="section-title">Instances ({instances.length})</h3>
          {#if loadingInstances}
            <div class="loading-sm">Loading instances...</div>
          {:else if instances.length === 0}
            <div class="empty-sm">No running instances</div>
          {:else}
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Hostname</th>
                    <th>Deploy #</th>
                    <th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {#each instances as inst}
                    <tr>
                      <td class="mono">{inst.name}</td>
                      <td><span style="color: {statusColor(inst.status)}">{inst.status}</span></td>
                      <td class="mono text-sm">{inst.hostname}</td>
                      <td>#{inst.deployment?.deploy_number || '-'}</td>
                      <td>{shortDate(inst.created_at)}</td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>

      {:else if tab === 'deployments'}
        <div class="section-header">
          <h3 class="section-title">Deployment History</h3>
          <button class="btn-sm" onclick={triggerDeploy} disabled={deploying}>
            {deploying ? 'Deploying...' : 'New Deployment'}
          </button>
        </div>
        {#if loadingDeploys}
          <div class="loading-sm">Loading deployments...</div>
        {:else if deployments.length === 0}
          <div class="empty-sm">No deployments</div>
        {:else}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Status</th>
                  <th>Commit</th>
                  <th>Message</th>
                  <th>Author</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {#each deployments as d}
                  <tr>
                    <td>{d.deploy_number}</td>
                    <td><span class="status-pill" style="color: {statusColor(d.status)}">{d.status}</span></td>
                    <td class="mono">{shortSha(d.git_sha)}</td>
                    <td class="truncate">{d.commit_message?.split('\n')[0] || '-'}</td>
                    <td>{d.committer_name || d.committer_username || '-'}</td>
                    <td class="text-sm">{shortDate(d.created_at)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

      {:else if tab === 'env'}
        <div class="section-header">
          <h3 class="section-title">Environment Variables</h3>
          <button class="btn-sm" onclick={() => { showAddEnv = !showAddEnv; }}>
            {showAddEnv ? 'Cancel' : 'Add Variable'}
          </button>
        </div>

        {#if showAddEnv}
          <div class="add-form">
            <div class="form-row">
              <input type="text" placeholder="KEY" bind:value={newEnvKey} class="input" />
              <input type="text" placeholder="Value" bind:value={newEnvVal} class="input flex-1" />
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={newEnvBuild} />
                Build
              </label>
              <button class="btn-primary btn-sm" onclick={addEnvVar} disabled={savingEnv}>
                {savingEnv ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        {/if}

        {#if loadingEnv}
          <div class="loading-sm">Loading...</div>
        {:else if envVars.length === 0}
          <div class="empty-sm">No environment variables</div>
        {:else}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Build</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each envVars as v}
                  {#if editingEnvId === v.id}
                    <tr class="editing-row">
                      <td><input type="text" bind:value={editEnvKey} class="input-inline" /></td>
                      <td><input type="text" bind:value={editEnvVal} class="input-inline" /></td>
                      <td>
                        <label class="checkbox-label">
                          <input type="checkbox" bind:checked={editEnvBuild} />
                        </label>
                      </td>
                      <td class="actions">
                        <button class="btn-xs btn-primary" onclick={saveEditEnv} disabled={savingEnv}>Save</button>
                        <button class="btn-xs" onclick={cancelEditEnv}>Cancel</button>
                      </td>
                    </tr>
                  {:else}
                    <tr>
                      <td><code>{v.env_key}</code></td>
                      <td class="env-val">{v.env_val}</td>
                      <td>{v.buildtime ? 'Yes' : 'No'}</td>
                      <td class="actions">
                        <button class="btn-xs" onclick={() => startEditEnv(v)}>Edit</button>
                        <button class="btn-xs btn-danger-text" onclick={() => deleteEnvVar(v.id)}>Delete</button>
                      </td>
                    </tr>
                  {/if}
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

      {:else if tab === 'domains'}
        <div class="section-header">
          <h3 class="section-title">Custom Domains</h3>
          <button class="btn-sm" onclick={() => { showAddDomain = !showAddDomain; }}>
            {showAddDomain ? 'Cancel' : 'Add Domain'}
          </button>
        </div>

        {#if showAddDomain}
          <div class="add-form">
            <div class="form-row">
              <input type="text" placeholder="app.example.com" bind:value={newDomainName} class="input flex-1" />
              <button class="btn-primary btn-sm" onclick={addDomain} disabled={savingDomain}>
                {savingDomain ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        {/if}

        {#if loadingDomains}
          <div class="loading-sm">Loading...</div>
        {:else if domains.length === 0}
          <div class="empty-sm">No domains configured</div>
        {:else}
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Domain</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Verification</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each domains as d}
                  <tr>
                    <td class="mono">{d.domain_name}</td>
                    <td><span class="badge">{d.domain_type}</span></td>
                    <td><span style="color: {statusColor(d.status)}">{d.status}</span></td>
                    <td class="mono text-sm">{d.verification_code || '-'}</td>
                    <td class="actions">
                      {#if d.status !== 'available'}
                        <button class="btn-xs" onclick={() => verifyDomain(d.id)}>Verify</button>
                        <button class="btn-xs" onclick={() => connectDomain(d.id)}>Connect</button>
                      {/if}
                      <button class="btn-xs btn-danger-text" onclick={() => deleteDomain(d.id)}>Delete</button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

      {:else if tab === 'scaling'}
        <div class="section">
          <h3 class="section-title">Scale Application</h3>
          <p class="section-desc">Change the number of instances or instance type for this application.</p>

          {#if loadingScaling}
            <div class="loading-sm">Loading instance types...</div>
          {:else}
            <div class="scale-form">
              <div class="form-group">
                <label for="scale-amount">Instances</label>
                <input
                  id="scale-amount"
                  type="number"
                  min="1"
                  max="16"
                  bind:value={scaleAmount}
                  class="input"
                />
                <span class="form-hint">1 - 16 instances</span>
              </div>

              <div class="form-group">
                <label for="scale-type">Instance Type</label>
                <select id="scale-type" bind:value={scaleTypeId} class="input">
                  {#each instanceTypes as t}
                    <option value={t.id}>{t.name} ({t.cpu} CPU, {t.mem}GB RAM, {t.price_month}/mo)</option>
                  {/each}
                </select>
              </div>

              <div class="form-group">
                <button class="btn-primary" onclick={applyScaling} disabled={savingScale}>
                  {savingScale ? 'Applying...' : 'Apply Scaling'}
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  <!-- Clone modal -->
  {#if showClone}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-overlay" onclick={() => { if (!cloning) showClone = false; }}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="clone-modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-top">
          <h2>Clone Application</h2>
          {#if !cloning}
            <button class="close-btn" onclick={() => showClone = false} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          {/if}
        </div>

        {#if cloneSteps.length > 0}
          <!-- Progress view -->
          <div class="clone-progress">
            <div class="progress-text">{cloneProgress}</div>
            <div class="steps-list">
              {#each cloneSteps as step}
                <div class="step" class:step-done={step.status === 'done'} class:step-running={step.status === 'running'} class:step-error={step.status === 'error'}>
                  <span class="step-icon">
                    {#if step.status === 'done'}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                    {:else if step.status === 'running'}
                      <div class="step-spinner"></div>
                    {:else if step.status === 'error'}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    {:else}
                      <div class="step-dot"></div>
                    {/if}
                  </span>
                  <span class="step-label">{step.label}</span>
                </div>
              {/each}
            </div>
            {#if !cloning}
              <div class="modal-actions" style="margin-top: 16px">
                <button class="btn-primary" onclick={() => showClone = false}>Close</button>
              </div>
            {/if}
          </div>
        {:else}
          <!-- Configuration view -->
          <div class="clone-form">
            <div class="form-group">
              <label for="clone-name">Application Name</label>
              <input id="clone-name" type="text" bind:value={cloneName} class="input" />
            </div>

            {#if loadingCloneData}
              <div class="loading-sm">Loading configuration...</div>
            {:else}
              <div class="form-row-2">
                <div class="form-group">
                  <label for="clone-region">Region</label>
                  <select id="clone-region" bind:value={cloneRegionId} class="input">
                    {#each cloneRegions as r}
                      <option value={r.id}>{r.name} ({r.slug})</option>
                    {/each}
                  </select>
                </div>
                <div class="form-group">
                  <label for="clone-type">Instance Type</label>
                  <select id="clone-type" bind:value={cloneInstanceTypeId} class="input">
                    {#each cloneInstanceTypes as t}
                      <option value={t.id}>{t.name} ({t.cpu}CPU, {t.mem}GB)</option>
                    {/each}
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label for="clone-amount">Instances</label>
                <input id="clone-amount" type="number" min="1" max="16" bind:value={cloneInstanceAmount} class="input" style="width: 100px" />
              </div>

              <hr class="divider" />

              <div class="form-group">
                <label for="clone-integration">Git Integration</label>
                <select id="clone-integration" bind:value={cloneIntegrationId} class="input" onchange={onCloneIntegrationChange}>
                  {#each cloneIntegrations as i}
                    <option value={i.id}>{i.service_type}: {i.username}</option>
                  {/each}
                </select>
              </div>

              <div class="form-group">
                <label for="clone-repo">Repository</label>
                <select id="clone-repo" bind:value={cloneRepoId} class="input" onchange={onCloneRepoChange} disabled={loadingCloneRepos}>
                  {#if loadingCloneRepos}
                    <option>Loading...</option>
                  {:else}
                    {#each cloneRepos as r}
                      <option value={r.id}>{r.full_name || r.name}</option>
                    {/each}
                  {/if}
                </select>
              </div>

              <div class="form-group">
                <label for="clone-branch">Branch</label>
                <select id="clone-branch" bind:value={cloneBranchId} class="input" disabled={loadingCloneBranches}>
                  {#if loadingCloneBranches}
                    <option>Loading...</option>
                  {:else}
                    {#each cloneBranches as b}
                      <option value={b.id}>{b.name}</option>
                    {/each}
                  {/if}
                </select>
              </div>

              <hr class="divider" />

              <div class="form-group">
                <label>Environment Variables ({cloneEnvVars.filter(v => v.include).length}/{cloneEnvVars.length} selected)</label>
                {#if cloneEnvVars.length === 0}
                  <div class="empty-hint">No environment variables to clone</div>
                {:else}
                  <div class="env-clone-list">
                    {#each cloneEnvVars as v, i}
                      <div class="env-clone-item" class:env-excluded={!v.include}>
                        <label class="env-check">
                          <input type="checkbox" bind:checked={cloneEnvVars[i].include} />
                        </label>
                        <input type="text" bind:value={cloneEnvVars[i].key} class="input-sm" disabled={!v.include} />
                        <input type="text" bind:value={cloneEnvVars[i].val} class="input-sm flex-1" disabled={!v.include} />
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>

              <div class="form-group">
                <label class="checkbox-label">
                  <input type="checkbox" bind:checked={cloneAutoDeploy} />
                  Auto-deploy after creation
                </label>
              </div>
            {/if}
          </div>

          <div class="modal-actions">
            <button class="btn-secondary" onclick={() => showClone = false}>Cancel</button>
            <button class="btn-primary" onclick={executeClone} disabled={cloning || loadingCloneData}>
              Clone Application
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Delete confirmation modal -->
  {#if showDeleteConfirm}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="modal-overlay" onclick={() => showDeleteConfirm = false}>
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="modal" onclick={(e) => e.stopPropagation()}>
        <h2>Delete Application</h2>
        <p>Are you sure you want to delete <strong>{app?.name}</strong>? This action cannot be undone.</p>
        <div class="modal-actions">
          <button class="btn-secondary" onclick={() => showDeleteConfirm = false}>Cancel</button>
          <button class="btn-danger" onclick={deleteApp} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete Application'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .page { max-width: 1200px; }

  /* Breadcrumb */
  .breadcrumb {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--text-muted);
    margin-bottom: 20px;
  }
  .breadcrumb a { color: var(--primary); }
  .breadcrumb a:hover { color: var(--primary-hover); }
  .sep { color: var(--border); }

  /* Header */
  .app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    gap: 16px;
    flex-wrap: wrap;
  }
  .app-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .app-title h1 { font-size: 24px; font-weight: 700; }
  .status-badge {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    padding: 3px 10px;
    border: 1px solid;
    border-radius: 20px;
  }
  .app-actions { display: flex; gap: 8px; }

  /* Tabs */
  .tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 24px;
    overflow-x: auto;
  }
  .tab {
    padding: 10px 20px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .tab:hover { color: var(--text); }
  .tab.active {
    color: var(--primary);
    border-bottom-color: var(--primary);
  }

  /* Info grid */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }
  .info-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px;
  }
  .info-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 4px;
  }
  .info-value { font-size: 14px; }
  .mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 13px; }

  /* Section */
  .section { margin-bottom: 28px; }
  .section-title {
    font-size: 14px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    margin-bottom: 12px;
  }
  .section-desc {
    font-size: 14px;
    color: var(--text-muted);
    margin-bottom: 16px;
  }
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  /* Table */
  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg-card);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th {
    text-align: left;
    padding: 10px 14px;
    color: var(--text-muted);
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: var(--bg-card);
    position: sticky;
    top: 0;
  }
  td {
    padding: 10px 14px;
    border-top: 1px solid var(--border);
  }
  .text-sm { font-size: 12px; }
  .truncate {
    max-width: 250px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .env-val {
    font-family: monospace;
    font-size: 12px;
    color: var(--text-muted);
    max-width: 300px;
    word-break: break-all;
  }
  code {
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 12px;
    color: var(--primary);
    background: var(--bg);
    padding: 2px 6px;
    border-radius: 4px;
  }
  .status-pill { font-weight: 600; text-transform: capitalize; }
  .badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    background: var(--bg);
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
  }
  .actions { white-space: nowrap; }

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
    transition: background-color 0.15s;
  }
  .btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-danger {
    padding: 8px 16px;
    background: var(--danger);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-danger:hover:not(:disabled) { background: #dc2626; }
  .btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }
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
  .btn-sm {
    padding: 6px 14px;
    background: var(--bg-card);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }
  .btn-sm:hover:not(:disabled) { background: var(--bg-hover); border-color: var(--primary); }
  .btn-sm:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-xs {
    padding: 4px 10px;
    background: transparent;
    color: var(--text-muted);
    border: 1px solid var(--border);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    margin-right: 4px;
  }
  .btn-xs:hover { background: var(--bg-hover); color: var(--text); }
  .btn-danger-text {
    color: var(--danger);
    border-color: transparent;
  }
  .btn-danger-text:hover { background: rgba(239, 68, 68, 0.1); color: var(--danger); border-color: var(--danger); }

  /* Forms */
  .add-form {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px;
    margin-bottom: 16px;
  }
  .form-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .input {
    padding: 8px 12px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    font-size: 14px;
    outline: none;
  }
  .input:focus { border-color: var(--primary); }
  .flex-1 { flex: 1; min-width: 150px; }
  .input-inline {
    padding: 4px 8px;
    background: var(--bg);
    border: 1px solid var(--primary);
    border-radius: 4px;
    color: var(--text);
    font-size: 13px;
    width: 100%;
    outline: none;
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-muted);
    cursor: pointer;
    white-space: nowrap;
  }
  .editing-row { background: var(--bg-hover); }
  select.input {
    min-width: 200px;
  }
  select.input option {
    background: var(--bg);
    color: var(--text);
  }

  /* Scale form */
  .scale-form {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 24px;
    max-width: 500px;
  }
  .form-group {
    margin-bottom: 20px;
  }
  .form-group label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 6px;
  }
  .form-group .input {
    width: 100%;
  }
  .form-hint {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 4px;
    display: block;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
    padding: 20px;
  }
  .modal {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 28px;
    max-width: 480px;
    width: 100%;
  }
  .modal h2 { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
  .modal p { font-size: 14px; color: var(--text-muted); margin-bottom: 20px; line-height: 1.5; }
  .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }

  /* Clone modal */
  .clone-modal {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 28px;
    max-width: 650px;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
  }
  .modal-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 20px;
  }
  .modal-top h2 { font-size: 20px; font-weight: 700; }
  .close-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
  }
  .close-btn:hover { background: var(--bg-hover); color: var(--text); }
  .clone-form { margin-bottom: 20px; }
  .form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .divider { border: none; border-top: 1px solid var(--border); margin: 8px 0 16px; }
  .empty-hint { font-size: 13px; color: var(--text-muted); padding: 8px 0; }
  .env-clone-list {
    max-height: 240px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
  }
  .env-clone-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-bottom: 1px solid var(--border);
  }
  .env-clone-item:last-child { border-bottom: none; }
  .env-excluded { opacity: 0.4; }
  .env-check { flex-shrink: 0; cursor: pointer; }
  .input-sm {
    padding: 4px 8px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--text);
    font-size: 12px;
    font-family: 'SF Mono', 'Fira Code', monospace;
    outline: none;
    min-width: 80px;
  }
  .input-sm:focus { border-color: var(--primary); }
  .input-sm:disabled { opacity: 0.5; }
  .clone-progress { padding: 8px 0; }
  .progress-text {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 16px;
    color: var(--text);
  }
  .steps-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .step {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: var(--text-muted);
    padding: 4px 0;
  }
  .step-done { color: var(--success); }
  .step-running { color: var(--text); font-weight: 500; }
  .step-error { color: var(--danger); }
  .step-icon { width: 20px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .step-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border); }
  .step-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Loading / Empty */
  .loading-page, .error-page {
    text-align: center;
    padding: 60px 24px;
    color: var(--text-muted);
    font-size: 14px;
  }
  .error-page { color: var(--danger); }
  .loading-sm, .empty-sm {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
    font-size: 13px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
</style>
