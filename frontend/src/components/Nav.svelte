<script lang="ts">
  import { getPath } from '../lib/router.svelte.js';
  import { isAdmin, getUser } from '../lib/auth.js';

  interface Props {
    onLogout: () => void;
  }

  let { onLogout }: Props = $props();

  let user = $derived(getUser());
  let admin = $derived(isAdmin());
  let path = $derived(getPath());

  function isActive(href: string): boolean {
    if (href === '/') return path === '/';
    return path === href || path.startsWith(href + '/');
  }
</script>

<nav class="nav">
  <div class="nav-top">
    <a href="#/" class="logo">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      <span>Nodion Gateway</span>
    </a>

    <div class="nav-links">
      <a href="#/" class="nav-link" class:active={isActive('/')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
        </svg>
        Dashboard
      </a>

      <a href="#/apps" class="nav-link" class:active={isActive('/apps')}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <path d="M8 21h8"/>
          <path d="M12 17v4"/>
        </svg>
        Applications
      </a>

      {#if admin}
        <div class="nav-section">Admin</div>

        <a href="#/projects" class="nav-link" class:active={isActive('/projects')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          Projects
        </a>

        <a href="#/keys" class="nav-link" class:active={isActive('/keys')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
          </svg>
          API Keys
        </a>

        <a href="#/blocklist" class="nav-link" class:active={isActive('/blocklist')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M4.93 4.93l14.14 14.14"/>
          </svg>
          Blocklist
        </a>

        <a href="#/audit" class="nav-link" class:active={isActive('/audit')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          Audit Log
        </a>
      {/if}
    </div>
  </div>

  <div class="nav-bottom">
    {#if user}
      <div class="user-info">
        <div class="user-label">{user.label}</div>
        <div class="user-role">{user.role}</div>
      </div>
    {/if}
    <button class="logout-btn" onclick={onLogout}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
      Logout
    </button>
  </div>
</nav>

<style>
  .nav {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    width: 240px;
    background: var(--bg-card);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    z-index: 100;
    overflow-y: auto;
  }
  .nav-top {
    padding: 20px 0;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 20px 20px;
    font-size: 15px;
    font-weight: 700;
    color: var(--text);
    border-bottom: 1px solid var(--border);
    margin-bottom: 12px;
  }
  .logo:hover {
    color: var(--text);
  }
  .nav-links {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 8px;
  }
  .nav-section {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    padding: 16px 12px 6px;
  }
  .nav-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: var(--radius);
    color: var(--text-muted);
    font-size: 14px;
    font-weight: 500;
    transition: all 0.15s;
  }
  .nav-link:hover {
    background: var(--bg-hover);
    color: var(--text);
  }
  .nav-link.active {
    background: var(--bg-hover);
    color: var(--primary);
  }
  .nav-bottom {
    padding: 16px;
    border-top: 1px solid var(--border);
  }
  .user-info {
    padding: 8px 4px 12px;
  }
  .user-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .user-role {
    font-size: 11px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-top: 2px;
  }
  .logout-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 10px 12px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-muted);
    font-size: 14px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .logout-btn:hover {
    background: var(--bg-hover);
    color: var(--danger);
    border-color: var(--danger);
  }
</style>
