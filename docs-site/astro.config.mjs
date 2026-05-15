// Update `site` and the GitHub link below with your actual GitHub username/org.
// If using a custom domain (e.g. mcpu.2edge.co), remove the `base` field entirely.

import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import vercel from '@astrojs/vercel';

import partytown from '@astrojs/partytown';

import vtbot from 'astro-vtbot';
import { viewTransitions } from 'astro-vtbot/starlight-view-transitions';

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
  integrations: [starlight({
    plugins: [viewTransitions()],
    components: {
      Head: './src/components/Head.astro',
    },
    title: 'MCP/U',
    description: 'The Unified Interface for AI-Ready Microcontrollers — by 2edge.co',
    social: [
      { icon: 'github', label: 'GitHub', href: 'https://github.com/ThanabordeeN/MCP-U' },
    ],
    editLink: {
      baseUrl: 'https://github.com/ThanabordeeN/MCP-U/edit/main/docs-site/',
    },
    sidebar: [
      {
        label: 'Get Started',
        items: [
          { label: 'Quick Start', slug: 'tutorials/getting-started' },
          { label: 'First Custom Tool', slug: 'tutorials/first-custom-tool' },
          { label: 'Query Memory with AI', slug: 'tutorials/querying-memory-with-ai' },
        ],
      },
      {
        label: 'How-To',
        items: [
          {
            label: 'Connect',
            items: [
              { label: 'Serial (USB)', slug: 'how-to/connect-serial' },
              { label: 'WiFi TCP', slug: 'how-to/connect-wifi-tcp' },
              { label: 'Multi-Device', slug: 'how-to/multi-device-setup' },
            ],
          },
          {
            label: 'Develop',
            items: [
              { label: 'Add a Sensor', slug: 'how-to/add-sensor' },
              { label: 'Enable Pin Buffering', slug: 'how-to/enable-pin-buffer' },
              { label: 'Virtual / Mock Testing', slug: 'how-to/virtual-mock-testing' },
              { label: 'Connect AI Agents', slug: 'how-to/configure-agent' },
            ],
          },
          { label: 'Debug Connection Issues', slug: 'how-to/debug-connection' },
        ],
      },
      {
        label: 'Reference',
        items: [
          {
            label: 'Firmware',
            items: [
              { label: 'API Reference', slug: 'reference/firmware-api' },
              { label: 'Pin Types & Sampling', slug: 'reference/pin-types' },
              { label: 'Build Flags & Limits', slug: 'reference/build-flags' },
            ],
          },
          {
            label: 'Client',
            items: [
              { label: 'Configuration', slug: 'reference/client-config' },
              { label: 'CLI Commands', slug: 'reference/cli-commands' },
              { label: 'Memory Schema', slug: 'reference/memory-schema' },
            ],
          },
          {
            label: 'Protocol',
            items: [
              { label: 'Protocol Specification', slug: 'reference/protocol' },
              { label: 'Compatibility', slug: 'reference/compatibility' },
            ],
          },
        ],
      },
      {
        label: 'Concepts',
        items: [
          { label: 'Architecture', slug: 'explanation/architecture' },
          { label: 'Dynamic Tool Discovery', slug: 'explanation/dynamic-discovery' },
          { label: 'Design Philosophy', slug: 'explanation/design-philosophy' },
        ],
      },
      {
        label: 'Project',
        collapsed: true,
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
      {
        tag: 'script',
        content: `
          (function() {
            var MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
            var loaded = false;
            var queue = [];

            function loadMermaid(cb) {
              if (window.mermaid) return cb();
              queue.push(cb);
              if (loaded) return;
              loaded = true;
              var s = document.createElement('script');
              s.src = MERMAID_CDN;
              s.onload = function() {
                mermaid.initialize({ startOnLoad: false });
                queue.forEach(function(fn) { fn(); });
                queue = [];
              };
              s.onerror = function() {
                console.warn('[mermaid] Failed to load from CDN');
                queue = [];
              };
              document.head.appendChild(s);
            }

            function renderDiagrams() {
              var blocks = document.querySelectorAll('div.expressive-code pre[data-language="mermaid"] code');
              if (blocks.length === 0) return;
              loadMermaid(function() {
                blocks.forEach(function(codeBlock) {
                  var figure = codeBlock.closest('div.expressive-code');
                  if (!figure || figure.dataset.mermaidRendered) return;
                  figure.dataset.mermaidRendered = 'true';
                  var lines = codeBlock.querySelectorAll('.ec-line');
                  var code = lines.length > 0 
                    ? Array.from(lines).map(function(l) { return l.textContent; }).join('\\n')
                    : codeBlock.textContent || '';
                  var wrapper = document.createElement('div');
                  wrapper.className = 'mermaid-diagram';
                  var id = 'm-' + Math.random().toString(36).substring(2, 11);
                  mermaid.render(id, code).then(function(result) {
                    wrapper.innerHTML = result.svg;
                    figure.replaceWith(wrapper);
                  }).catch(function(err) {
                    wrapper.innerHTML = '<div class="mermaid-error"><p>Diagram render error</p><pre>' + err.message.replace(/</g, '&lt;') + '</pre></div>';
                    figure.replaceWith(wrapper);
                  });
                });
              });
            }

            function schedule() {
              if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', renderDiagrams);
              } else {
                renderDiagrams();
              }
            }

            schedule();
            document.addEventListener('astro:after-swap', renderDiagrams);
          })();
        `,
      },
    ],
  }), partytown(), vtbot()],
});