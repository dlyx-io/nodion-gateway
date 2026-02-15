import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  onwarn(warning, handler) {
    // Suppress a11y warnings for modal overlay click-to-dismiss pattern
    if (warning.code?.startsWith('a11y_')) return;
    handler(warning);
  },
};
