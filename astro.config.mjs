// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  // Hover-prefetch links marked `data-astro-prefetch` (search results) so a
  // selection navigates instantly; paired with `<ClientRouter />` for View
  // Transitions. See slice #6 / ADR D-016.
  prefetch: { defaultStrategy: 'hover' },
  integrations: [react()],
});
