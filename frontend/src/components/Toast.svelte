<script lang="ts">
  import { getToasts, removeToast } from '../lib/toast.svelte.js';

  let toasts = $derived(getToasts());
</script>

{#if toasts.length > 0}
  <div class="toast-container">
    {#each toasts as t (t.id)}
      <div class="toast toast-{t.type}">
        <span class="toast-msg">{t.message}</span>
        <button class="toast-close" onclick={() => removeToast(t.id)} aria-label="Dismiss">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-width: 400px;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: var(--radius);
    font-size: 14px;
    font-weight: 500;
    animation: slideIn 0.2s ease-out;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  .toast-success {
    background: #065f46;
    color: #a7f3d0;
    border: 1px solid #059669;
  }
  .toast-error {
    background: #7f1d1d;
    color: #fecaca;
    border: 1px solid #dc2626;
  }
  .toast-info {
    background: #1e3a5f;
    color: #bfdbfe;
    border: 1px solid #3b82f6;
  }
  .toast-msg {
    flex: 1;
  }
  .toast-close {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    padding: 2px;
    opacity: 0.7;
    flex-shrink: 0;
  }
  .toast-close:hover {
    opacity: 1;
  }
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
</style>
