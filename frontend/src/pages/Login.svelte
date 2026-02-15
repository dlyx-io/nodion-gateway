<script lang="ts">
  import { login } from '../lib/auth.js';

  interface Props {
    onLogin: () => void;
  }

  let { onLogin }: Props = $props();

  let apiKey = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!apiKey.trim()) {
      error = 'Please enter an API key';
      return;
    }
    error = '';
    loading = true;
    try {
      await login(apiKey.trim());
      onLogin();
    } catch (err: any) {
      error = err.message || 'Invalid API key';
    } finally {
      loading = false;
    }
  }
</script>

<div class="login-wrapper">
  <div class="login-card">
    <div class="login-header">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2">
        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
        <path d="M2 17l10 5 10-5"/>
        <path d="M2 12l10 5 10-5"/>
      </svg>
      <h1>Nodion Gateway</h1>
      <p class="subtitle">Enter your API key to continue</p>
    </div>

    <form onsubmit={handleSubmit}>
      <div class="field">
        <label for="apikey">API Key</label>
        <input
          id="apikey"
          type="password"
          placeholder="ngw_..."
          bind:value={apiKey}
          disabled={loading}
          autocomplete="off"
        />
      </div>

      {#if error}
        <div class="error">{error}</div>
      {/if}

      <button type="submit" class="btn-primary" disabled={loading}>
        {#if loading}
          <span class="spinner"></span>
          Authenticating...
        {:else}
          Sign In
        {/if}
      </button>
    </form>
  </div>
</div>

<style>
  .login-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 16px;
  }
  .login-card {
    width: 100%;
    max-width: 400px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 40px 32px;
  }
  .login-header {
    text-align: center;
    margin-bottom: 32px;
  }
  .login-header h1 {
    font-size: 22px;
    font-weight: 700;
    margin-top: 16px;
    color: var(--text);
  }
  .subtitle {
    font-size: 14px;
    color: var(--text-muted);
    margin-top: 6px;
  }
  .field {
    margin-bottom: 16px;
  }
  .field label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    margin-bottom: 6px;
  }
  .field input {
    width: 100%;
    padding: 10px 12px;
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
  .field input:disabled {
    opacity: 0.6;
  }
  .error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: var(--danger);
    padding: 10px 12px;
    border-radius: var(--radius);
    font-size: 13px;
    margin-bottom: 16px;
  }
  .btn-primary {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 16px;
    background: var(--primary);
    color: white;
    border: none;
    border-radius: var(--radius);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.15s;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--primary-hover);
  }
  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
