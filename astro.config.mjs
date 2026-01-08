// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Set this in Vercel as an environment variable to ensure canonical URLs + sitemap are correct.
  // Example: SITE=https://your-project.vercel.app
  site: process.env.SITE ?? 'https://vicky-blog-ochre.vercel.app',
  integrations: [mdx(), sitemap()],

  vite: {
    plugins: [tailwindcss()],
  },
});