import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import type { SystemHealthReport } from '@/lib/status/health-checker';

const healthCheckerMockState = vi.hoisted(() => ({
  checkSystemHealthMock: vi.fn<() => Promise<SystemHealthReport>>(),
}));

vi.mock('@/lib/status/health-checker', () => ({
  checkSystemHealth: healthCheckerMockState.checkSystemHealthMock,
}));

import StatusPage, { dynamic, metadata } from '@/app/status/page';

const { checkSystemHealthMock } = healthCheckerMockState;

function makeHealthReport(
  overrides: Partial<SystemHealthReport> & {
    services?: SystemHealthReport['services'];
  } = {}
): SystemHealthReport {
  return {
    status: 'all_operational',
    uptimePercentage: 99.98,
    timestamp: '2026-11-11T00:00:00.000Z',
    services: [
      {
        id: 'audio_streamer',
        name: '24/7 Audio Streaming Engine (Icecast / Liquidsoap)',
        description: 'Continuous low-latency audio mixing and live MP3/AAC mount point streaming.',
        status: 'operational',
        latencyMs: 18,
        lastChecked: '2026-11-11T00:00:00.000Z',
      },
      {
        id: 'database',
        name: 'PostgreSQL Database & pgvector',
        description: 'Track catalog, listener preferences, rotation logs, and semantic prompt indexing.',
        status: 'operational',
        latencyMs: 24,
        lastChecked: '2026-11-11T00:00:00.000Z',
      },
      {
        id: 'ai_dj_engine',
        name: 'Generative AI DJ Roster (Gemini & Neural TTS)',
        description: 'Real-time DJ persona scriptwriting, weather synthesis, and neural speech synthesis.',
        status: 'not_configured',
        latencyMs: 0,
        error: 'GEMINI_API_KEY not configured',
        configurationIssue: 'missing_runtime_secret',
        lastChecked: '2026-11-11T00:00:00.000Z',
      },
      {
        id: 'edge_delivery',
        name: 'Global Edge Network & CDN',
        description: 'Vercel edge functions, Next.js web application routing, and Cloudflare static asset caching.',
        status: 'operational',
        latencyMs: 9,
        lastChecked: '2026-11-11T00:00:00.000Z',
      },
      {
        id: 'community_bridge',
        name: 'Community Discord & Telegram Notification Bridges',
        description: 'Real-time track announcements, listener song requests, and DJ shoutout dispatches.',
        status: 'not_configured',
        latencyMs: 0,
        error: 'DISCORD_WEBHOOK_URL not configured',
        configurationIssue: 'missing_runtime_secret',
        lastChecked: '2026-11-11T00:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

function makeOperationalServices() {
  return makeHealthReport().services.map((service) => ({
    ...service,
    status: 'operational' as const,
    latencyMs: service.latencyMs || 12,
    error: undefined,
    configurationIssue: undefined,
  }));
}

async function renderStatusPage(report: SystemHealthReport) {
  checkSystemHealthMock.mockResolvedValueOnce(report);
  return renderToString(await StatusPage());
}

function countMatches(html: string, pattern: RegExp) {
  return (html.match(pattern) || []).length;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('status page status surfaces', () => {
  it('exports the expected dynamic setting and static metadata', () => {
    expect(dynamic).toBe('force-dynamic');
    expect(metadata.title).toBe('System Status & Operational Health');
    expect(metadata.description).toContain('Real-time uptime');
  });

  it('keeps the top banner green while marking missing runtime secrets as config regressions', async () => {
    const html = await renderStatusPage(makeHealthReport());

    expect(html).toContain('All Systems Fully Operational');
    expect(html).toContain('Core broadcast services are healthy. Some optional integrations are unavailable because expected runtime secrets are missing in this deployment.');
    expect(html).toContain('bg-emerald-950/40 border-emerald-500/30 text-emerald-300');
    expect(html).toContain('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400');
    expect(html).toContain('relative inline-flex rounded-full h-4 w-4 bg-emerald-500');
    expect(html).toContain('Runtime configuration regression: ');
    expect(html).toContain('runtime secret missing');
    expect(html).toContain('bg-amber-500/10 text-amber-400');
    expect(html).toContain('GEMINI_API_KEY not configured');
    expect(html).toContain('DISCORD_WEBHOOK_URL not configured');
    expect(countMatches(html, /class="h-2\.5 w-2\.5 rounded-full bg-emerald-500"/g)).toBe(3);
    expect(countMatches(html, /class="h-2\.5 w-2\.5 rounded-full bg-amber-500"/g)).toBe(2);
    expect(
      countMatches(
        html,
        /class="text-xs pl-5\.5 font-mono text-amber-400">Runtime configuration regression:/g
      )
    ).toBe(2);
    expect(
      countMatches(
        html,
        /class="text-xs uppercase font-bold tracking-wider px-2\.5 py-1 rounded bg-amber-500\/10 text-amber-400">runtime secret missing/g
      )
    ).toBe(2);
  });

  it('distinguishes intentionally disabled optional integrations from runtime secret regressions', async () => {
    const html = await renderStatusPage(
      makeHealthReport({
        services: [
          {
            id: 'audio_streamer',
            name: '24/7 Audio Streaming Engine (Icecast / Liquidsoap)',
            description: 'Continuous low-latency audio mixing and live MP3/AAC mount point streaming.',
            status: 'operational',
            latencyMs: 18,
            lastChecked: '2026-11-11T00:00:00.000Z',
          },
          {
            id: 'database',
            name: 'PostgreSQL Database & pgvector',
            description: 'Track catalog, listener preferences, rotation logs, and semantic prompt indexing.',
            status: 'operational',
            latencyMs: 24,
            lastChecked: '2026-11-11T00:00:00.000Z',
          },
          {
            id: 'ai_dj_engine',
            name: 'Generative AI DJ Roster (Gemini & Neural TTS)',
            description: 'Real-time DJ persona scriptwriting, weather synthesis, and neural speech synthesis.',
            status: 'not_configured',
            latencyMs: 0,
            error: 'Feature intentionally disabled for this runtime',
            configurationIssue: 'optional_integration',
            lastChecked: '2026-11-11T00:00:00.000Z',
          },
          {
            id: 'edge_delivery',
            name: 'Global Edge Network & CDN',
            description: 'Vercel edge functions, Next.js web application routing, and Cloudflare static asset caching.',
            status: 'operational',
            latencyMs: 9,
            lastChecked: '2026-11-11T00:00:00.000Z',
          },
          {
            id: 'community_bridge',
            name: 'Community Discord & Telegram Notification Bridges',
            description: 'Real-time track announcements, listener song requests, and DJ shoutout dispatches.',
            status: 'operational',
            latencyMs: 12,
            lastChecked: '2026-11-11T00:00:00.000Z',
          },
        ],
      })
    );

    expect(html).toContain('Core broadcast services are healthy. Some optional integrations are intentionally not enabled in this runtime.');
    expect(html).toContain('Optional integration: ');
    expect(html).toContain('not configured');
    expect(html).toContain('bg-neutral-500/10 text-neutral-400');
    expect(html).not.toContain('Runtime configuration regression: ');
    expect(html).not.toContain('runtime secret missing');
    expect(countMatches(html, /class="h-2\.5 w-2\.5 rounded-full bg-emerald-500"/g)).toBe(4);
    expect(countMatches(html, /class="h-2\.5 w-2\.5 rounded-full bg-neutral-500"/g)).toBe(1);
    expect(
      countMatches(
        html,
        /class="text-xs pl-5\.5 font-mono text-neutral-500">Optional integration:/g
      )
    ).toBe(1);
  });

  it('keeps the default healthy copy when every service is configured and operational', async () => {
    const html = await renderStatusPage(
      makeHealthReport({
        services: makeOperationalServices(),
      })
    );

    expect(html).toContain('Continuous 24/7 radio broadcast with automated real-time health checks.');
    expect(html).not.toContain('Some optional integrations are intentionally not enabled in this runtime.');
    expect(html).not.toContain('expected runtime secrets are missing in this deployment.');
  });

  it('renders degraded banner and amber service states when the system is degraded', async () => {
    const html = await renderStatusPage(
      makeHealthReport({
        status: 'degraded_performance',
        uptimePercentage: 99.53,
        services: [
          {
            id: 'audio_streamer',
            name: '24/7 Audio Streaming Engine (Icecast / Liquidsoap)',
            description: 'Continuous low-latency audio mixing and live MP3/AAC mount point streaming.',
            status: 'operational',
            latencyMs: 18,
            lastChecked: '2026-11-11T00:00:00.000Z',
          },
          {
            id: 'database',
            name: 'PostgreSQL Database & pgvector',
            description: 'Track catalog, listener preferences, rotation logs, and semantic prompt indexing.',
            status: 'degraded',
            latencyMs: 4021,
            error: 'Replica lag spike',
            lastChecked: '2026-11-11T00:00:00.000Z',
          },
          {
            id: 'ai_dj_engine',
            name: 'Generative AI DJ Roster (Gemini & Neural TTS)',
            description: 'Real-time DJ persona scriptwriting, weather synthesis, and neural speech synthesis.',
            status: 'operational',
            latencyMs: 33,
            lastChecked: '2026-11-11T00:00:00.000Z',
          },
          {
            id: 'edge_delivery',
            name: 'Global Edge Network & CDN',
            description: 'Vercel edge functions, Next.js web application routing, and Cloudflare static asset caching.',
            status: 'operational',
            latencyMs: 9,
            lastChecked: '2026-11-11T00:00:00.000Z',
          },
          {
            id: 'community_bridge',
            name: 'Community Discord & Telegram Notification Bridges',
            description: 'Real-time track announcements, listener song requests, and DJ shoutout dispatches.',
            status: 'operational',
            latencyMs: 12,
            lastChecked: '2026-11-11T00:00:00.000Z',
          },
        ],
      })
    );

    expect(html).toContain('Experiencing Degraded Performance');
    expect(html).toContain('bg-amber-950/40 border-amber-500/30 text-amber-300');
    expect(html).toContain('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-amber-400');
    expect(html).toContain('relative inline-flex rounded-full h-4 w-4 bg-amber-500');
    expect(html).toContain('Replica lag spike');
    expect(html).toContain('Error: ');
    expect(html).toContain('degraded');
    expect(html).toContain('Continuous 24/7 radio broadcast with automated real-time health checks.');
    expect(countMatches(html, /class="h-2\.5 w-2\.5 rounded-full bg-emerald-500"/g)).toBe(4);
    expect(countMatches(html, /class="h-2\.5 w-2\.5 rounded-full bg-amber-500"/g)).toBe(1);
    expect(countMatches(html, /class="text-xs pl-5\.5 font-mono text-red-400">Error:/g)).toBe(1);
    expect(
      countMatches(
        html,
        /class="text-xs uppercase font-bold tracking-wider px-2\.5 py-1 rounded bg-amber-500\/10 text-amber-400">degraded/g
      )
    ).toBe(1);
  });

  it('renders outage banner and red service states when a major outage is detected', async () => {
    const html = await renderStatusPage(
      makeHealthReport({
        status: 'major_outage',
        uptimePercentage: 97.73,
        services: [
          {
            id: 'audio_streamer',
            name: '24/7 Audio Streaming Engine (Icecast / Liquidsoap)',
            description: 'Continuous low-latency audio mixing and live MP3/AAC mount point streaming.',
            status: 'outage',
            latencyMs: 5000,
            error: 'Connection refused: port 8000',
            lastChecked: '2026-11-11T00:00:00.000Z',
          },
          {
            id: 'database',
            name: 'PostgreSQL Database & pgvector',
            description: 'Track catalog, listener preferences, rotation logs, and semantic prompt indexing.',
            status: 'operational',
            latencyMs: 24,
            lastChecked: '2026-11-11T00:00:00.000Z',
          },
          {
            id: 'ai_dj_engine',
            name: 'Generative AI DJ Roster (Gemini & Neural TTS)',
            description: 'Real-time DJ persona scriptwriting, weather synthesis, and neural speech synthesis.',
            status: 'operational',
            latencyMs: 33,
            lastChecked: '2026-11-11T00:00:00.000Z',
          },
          {
            id: 'edge_delivery',
            name: 'Global Edge Network & CDN',
            description: 'Vercel edge functions, Next.js web application routing, and Cloudflare static asset caching.',
            status: 'operational',
            latencyMs: 9,
            lastChecked: '2026-11-11T00:00:00.000Z',
          },
          {
            id: 'community_bridge',
            name: 'Community Discord & Telegram Notification Bridges',
            description: 'Real-time track announcements, listener song requests, and DJ shoutout dispatches.',
            status: 'operational',
            latencyMs: 12,
            lastChecked: '2026-11-11T00:00:00.000Z',
          },
        ],
      })
    );

    expect(html).toContain('Major Service Outage Detected');
    expect(html).toContain('bg-red-950/40 border-red-500/30 text-red-300');
    expect(html).toContain('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-red-400');
    expect(html).toContain('relative inline-flex rounded-full h-4 w-4 bg-red-500');
    expect(html).toContain('Connection refused: port 8000');
    expect(html).toContain('bg-red-500/10 text-red-400');
    expect(html).toContain('outage');
    expect(html).toContain('Continuous 24/7 radio broadcast with automated real-time health checks.');
    expect(countMatches(html, /class="h-2\.5 w-2\.5 rounded-full bg-emerald-500"/g)).toBe(4);
    expect(countMatches(html, /class="h-2\.5 w-2\.5 rounded-full bg-red-500"/g)).toBe(1);
    expect(countMatches(html, /class="text-xs pl-5\.5 font-mono text-red-400">Error:/g)).toBe(1);
    expect(
      countMatches(
        html,
        /class="text-xs uppercase font-bold tracking-wider px-2\.5 py-1 rounded bg-red-500\/10 text-red-400">outage/g
      )
    ).toBe(1);
  });

  it('renders funding and support sections from the server component data helpers', async () => {
    const html = await renderStatusPage(makeHealthReport());

    expect(html).toContain('Transparent Community Funding');
    expect(html).toContain('Radio &amp; Music Royalties (Licensing)');
    expect(html).toContain('Cloud &amp; Stream Bandwidth');
    expect(html).toContain('35<!-- -->%');
    expect(html).toContain('25<!-- -->%');
    expect(html).toContain('Support PromptFM (Donation Rails)');
    expect(html).toContain('Stripe Checkout');
    expect(html).toContain('Ko-fi / Coffee');
    expect(html).toContain('PayPal.Me');
    expect(html).toContain('GitHub Sponsors');
    expect(html).toContain('View on Mempool ↗');
    expect(html).toContain('View on Etherscan ↗');
    expect(html).toContain('PromptFM Open Status');
    expect(html).toContain('Edge Network •<!-- --> <a');
    expect(countMatches(html, /class="p-5 rounded-xl border border-neutral-800 bg-neutral-900\/30 space-y-2"/g)).toBe(5);
  });

  it('renders only operational badges and no configuration messaging when everything is healthy', async () => {
    const html = await renderStatusPage(
      makeHealthReport({
        services: makeOperationalServices(),
      })
    );

    expect((html.match(/bg-emerald-500\/10 text-emerald-400/g) || []).length).toBeGreaterThanOrEqual(5);
    expect(countMatches(html, /class="h-2\.5 w-2\.5 rounded-full bg-emerald-500"/g)).toBe(5);
    expect(html).not.toContain('bg-amber-500/10 text-amber-400');
    expect(html).not.toContain('bg-neutral-500/10 text-neutral-400');
    expect(html).not.toContain('Runtime configuration regression: ');
    expect(html).not.toContain('Optional integration: ');
  });
});
