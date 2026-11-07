// src/lib/flags/vercel.ts
// Native integration with Vercel Flags SDK (`flags/next`)
// Provides Vercel Toolbar, Flags Explorer discovery, percentage rollout, and A/B testing

import { flag } from 'flags/next';
import type { ApiData, FlagDefinitionsType } from 'flags';
import {
  DEFAULT_FEATURE_FLAGS,
  getAllFeatureFlags,
  evaluateFeatureFlag,
} from './feature-flags';

export interface VercelFlagMeta {
  key: string;
  defaultValue: boolean;
  description: string;
  origin: string;
  options: Array<{ label: string; value: boolean }>;
}

/**
 * Creates individual callable Vercel Flags using Vercel's Flags SDK (`flags/next`)
 */
export function createVercelFlags() {
  const flagsRecord: Record<string, ReturnType<typeof flag<boolean>>> = {};

  for (const f of DEFAULT_FEATURE_FLAGS) {
    flagsRecord[f.key] = flag<boolean>({
      key: f.key,
      description: f.description,
      origin: 'https://promptfm.live/admin',
      defaultValue: f.enabled,
      options: [
        { label: 'Off', value: false },
        { label: 'On', value: true },
      ],
      async decide() {
        const res = evaluateFeatureFlag(f.key);
        return res.enabled;
      },
    });
  }

  return flagsRecord;
}

export const vercelFlags = createVercelFlags();

/**
 * Returns discovery metadata for all feature flags matching Vercel Flags Explorer format
 */
export function getVercelFlagDefinitions(): VercelFlagMeta[] {
  const all = getAllFeatureFlags();
  return all.map((f) => ({
    key: f.key,
    defaultValue: f.enabled,
    description: f.description,
    origin: 'https://promptfm.live/admin',
    options: [
      { label: 'Off', value: false },
      { label: 'On', value: true },
    ],
  }));
}

/**
 * Generates ApiData payload for Vercel Flags Discovery Endpoint
 */
export function getVercelDiscoveryApiData(): ApiData {
  const definitions = getVercelFlagDefinitions();
  const flagsObj: FlagDefinitionsType = {};

  for (const def of definitions) {
    flagsObj[def.key] = {
      defaultValue: def.defaultValue,
      description: def.description,
      origin: def.origin,
      options: def.options,
    };
  }

  return {
    definitions: flagsObj,
  };
}
