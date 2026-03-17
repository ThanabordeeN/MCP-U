// Update `site` and the GitHub link below with your actual GitHub username/org.
// If using a custom domain (e.g. mcpu.2edge.co), remove the `base` field entirely.

import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://ThanabordeeN.github.io',
  base: '/mcpu',
  integrations: [
    starlight({
      title: 'MCP/U',
      description: 'The Unified Interface for AI-Ready Microcontrollers — by 2edge.co',
      social: {
        github: 'https://github.com/ThanabordeeN/mcpu',
      },
      editLink: {
        baseUrl: 'https://github.com/ThanabordeeN/mcpu/edit/main/docs-site/',
      },
      sidebar: [
        {
          label: 'Start Here',
          items: [
            { label: 'Introduction', slug: 'index' },
            { label: 'Quick Start', slug: 'guides/getting-started' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Firmware (McpIot Library)', slug: 'guides/firmware' },
            { label: 'Client Setup', slug: 'guides/client' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Protocol Specification', slug: 'reference/protocol' },
            { label: 'Architecture', slug: 'reference/architecture' },
            { label: 'Compatibility', slug: 'reference/compatibility' },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
      head: [
        {
          tag: 'meta',
          attrs: { property: 'og:image', content: '/mcpu/og.png' },
        },
      ],
    }),
  ],
});
