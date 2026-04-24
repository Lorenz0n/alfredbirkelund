import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://alfredbirkelund.com',
  integrations: [mdx()],
  build: {
    format: 'directory',
  },
});
