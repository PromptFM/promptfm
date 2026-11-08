// src/lib/badges/badge-catalog.ts
// Central catalog of official repository and status badges.
// Pre-renders deterministic, zero-external-dependency SVG assets into public/badges.

import * as fs from 'fs';
import * as path from 'path';
import { generateBadgeSvg, BadgeOptions } from './badge-generator';

export const BADGE_DEFINITIONS: Record<string, BadgeOptions> = {
  production: {
    label: 'Production',
    message: 'promptfm.live',
    color: '#10b981',
    logo: 'vercel',
  },
  'deployed-on-vercel': {
    label: 'Deployed on',
    message: 'Vercel',
    color: '#000000',
    logo: 'vercel',
  },
  'status-operational': {
    label: 'PromptFM Status',
    message: 'Operational',
    color: '#2ea44f',
  },
  'status-degraded': {
    label: 'PromptFM Status',
    message: 'Degraded',
    color: '#dfb317',
  },
  'status-outage': {
    label: 'PromptFM Status',
    message: 'Outage',
    color: '#e05d44',
  },
  tests: {
    label: 'Tests',
    message: '1519 Passing',
    color: '#2ea44f',
    logo: 'vitest',
  },
  mutation: {
    label: 'Stryker Mutation',
    message: 'Core Domain',
    color: '#8a2be2',
  },
  'gcp-always-free': {
    label: 'GCP Always-Free',
    message: '$0.00/mo',
    color: '#4285F4',
    logo: 'googlecloud',
  },
  'logs-cloud-logging': {
    label: 'Logs',
    message: 'Cloud Logging',
    color: '#E37400',
    logo: 'googlecloud',
  },
  'logs-vercel': {
    label: 'Logs Vercel',
    message: 'Runtime Logs',
    color: '#000000',
    logo: 'vercel',
  },
  'flags-vercel': {
    label: 'Flags Vercel',
    message: 'Feature Flags',
    color: '#000000',
    logo: 'vercel',
  },
  'dashboards-gcp': {
    label: 'Dashboards GCP',
    message: 'Cloud Monitoring',
    color: '#4285F4',
    logo: 'googlecloud',
  },
  'dashboards-vercel': {
    label: 'Dashboards Vercel',
    message: 'Vercel Analytics',
    color: '#000000',
    logo: 'vercel',
  },
  'speed-insights-vercel': {
    label: 'Speed Insights',
    message: 'Vercel Speed',
    color: '#000000',
    logo: 'vercel',
  },
  'traces-gcp': {
    label: 'Traces GCP',
    message: 'Cloud Trace',
    color: '#34A853',
    logo: 'googlecloud',
  },
  license: {
    label: 'License',
    message: 'Community Source-Available',
    color: '#8a2be2',
  },
};

export function generateAllBadges(outputDir: string): Record<string, string> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const generated: Record<string, string> = {};

  for (const [key, definition] of Object.entries(BADGE_DEFINITIONS)) {
    const svg = generateBadgeSvg(definition);
    const targetFile = path.join(outputDir, `${key}.svg`);
    fs.writeFileSync(targetFile, svg, 'utf8');
    generated[key] = svg;
  }

  return generated;
}
