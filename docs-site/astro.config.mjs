// Update `site` and the GitHub link below with your actual GitHub username/org.
// If using a custom domain (e.g. mcpu.2edge.co), remove the `base` field entirely.

import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://mcp-u.vercel.app',
  output: 'static',
  adapter: vercel(),
  redirects: {
    '/guides/getting-started': '/tutorials/getting-started',
    '/guides/getting-started/': '/tutorials/getting-started/',
    '/guides/firmware': '/reference/firmware-api',
    '/guides/firmware/': '/reference/firmware-api/',
    '/guides/client': '/how-to/configure-agent',
    '/guides/client/': '/how-to/configure-agent/',
    '/guides/cli-agents': '/how-to/configure-agent',
    '/guides/cli-agents/': '/how-to/configure-agent/',
    '/reference/architecture': '/explanation/architecture',
    '/reference/architecture/': '/explanation/architecture/',
  },
  integrations: [
    starlight({
      components: {
        Head: './src/components/Head.astro',
      },
      title: 'MCP/U',
      description: 'The Unified Interface for AI-Ready Microcontrollers — by 2edge.co',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/ThanabordeeN/mcpu' },
      ],
      editLink: {
        baseUrl: 'https://github.com/ThanabordeeN/mcpu/edit/main/docs-site/',
      },
      sidebar: [
        {
          label: 'Tutorials',
          items: [
            { label: 'Quick Start', slug: 'tutorials/getting-started' },
            { label: 'First Custom Tool', slug: 'tutorials/first-custom-tool' },
          ],
        },
        {
          label: 'How-To Guides',
          items: [
            { label: 'Connect via Serial (USB)', slug: 'how-to/connect-serial' },
            { label: 'Connect via WiFi TCP', slug: 'how-to/connect-wifi-tcp' },
            { label: 'Multi-Device Setup', slug: 'how-to/multi-device-setup' },
            { label: 'Add a Sensor or Peripheral', slug: 'how-to/add-sensor' },
            { label: 'Connect AI Agents', slug: 'how-to/configure-agent' },
            { label: 'Debug Connection Issues', slug: 'how-to/debug-connection' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Firmware API', slug: 'reference/firmware-api' },
            { label: 'Pin Types & Sampling', slug: 'reference/pin-types' },
            { label: 'Client Configuration', slug: 'reference/client-config' },
            { label: 'CLI Commands', slug: 'reference/cli-commands' },
            { label: 'Build Flags & Limits', slug: 'reference/build-flags' },
            { label: 'Protocol Specification', slug: 'reference/protocol' },
            { label: 'Compatibility', slug: 'reference/compatibility' },
          ],
        },
        {
          label: 'Explanation',
          items: [
            { label: 'Architecture', slug: 'explanation/architecture' },
            { label: 'Dynamic Tool Discovery', slug: 'explanation/dynamic-discovery' },
            { label: 'Design Philosophy', slug: 'explanation/design-philosophy' },
          ],
        },
        {
          label: 'Meta',
          items: [
            { label: 'Changelog', slug: 'meta/changelog' },
            { label: 'Troubleshooting', slug: 'meta/troubleshooting' },
            { label: 'Contributing', slug: 'meta/contributing' },
          ],
        },
      ],
      customCss: ['./src/styles/custom.css'],
      head: [
        {
          tag: 'meta',
          attrs: { property: 'og:image', content: '/og.png' },
        },
      ],
    }),
  ],
});
