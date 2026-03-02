<script lang="ts">
  import { checkSession, clearToken } from './lib/auth.js';
  import { navigate, getPath, matchRoute } from './lib/router.svelte.js';
  import Nav from './components/Nav.svelte';
  import Toast from './components/Toast.svelte';
  import Login from './pages/Login.svelte';
  import Dashboard from './pages/Dashboard.svelte';
  import Projects from './pages/Projects.svelte';
  import Keys from './pages/Keys.svelte';
  import Apps from './pages/Apps.svelte';
  import AppDetail from './pages/AppDetail.svelte';
  import Blocklist from './pages/Blocklist.svelte';
  import AuditLog from './pages/AuditLog.svelte';
  import ServiceAccounts from './pages/ServiceAccounts.svelte';

  let ready = $state(false);
  let loggedIn = $state(false);

  const routes: Record<string, any> = {
    '/': Dashboard,
    '/projects': Projects,
    '/keys': Keys,
    '/service-accounts': ServiceAccounts,
    '/apps': Apps,
    '/apps/:slug': Apps,
    '/apps/:slug/:appId': AppDetail,
    '/blocklist': Blocklist,
    '/audit': AuditLog,
  };

  const currentMatch = $derived(matchRoute(routes, getPath()));

  async function init() {
    const ok = await checkSession();
    loggedIn = ok;
    ready = true;
  }

  init();

  function handleLogin() {
    loggedIn = true;
  }

  function handleLogout() {
    clearToken();
    loggedIn = false;
    navigate('/');
  }
</script>

<Toast />

{#if !ready}
  <div class="loading">
    <div class="spinner"></div>
  </div>
{:else if !loggedIn}
  <Login onLogin={handleLogin} />
{:else}
  <div class="layout">
    <Nav onLogout={handleLogout} />
    <main class="main">
      {#if currentMatch}
        {#key getPath()}
          <currentMatch.component params={currentMatch.params} />
        {/key}
      {:else}
        <div class="not-found">
          <h2>Page not found</h2>
          <p>The page <code>{getPath()}</code> does not exist.</p>
        </div>
      {/if}
    </main>
  </div>
{/if}

<style>
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border);
    border-top-color: var(--primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .layout {
    display: flex;
    min-height: 100vh;
  }
  .main {
    flex: 1;
    padding: 32px;
    margin-left: 240px;
    min-height: 100vh;
    overflow-y: auto;
  }
  .not-found {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-muted);
  }
  .not-found h2 {
    font-size: 20px;
    margin-bottom: 8px;
    color: var(--text);
  }
  .not-found code {
    background: var(--bg-card);
    padding: 2px 6px;
    border-radius: 4px;
  }
  @media (max-width: 768px) {
    .main {
      margin-left: 0;
      padding: 16px;
      padding-top: 60px;
    }
  }
</style>
