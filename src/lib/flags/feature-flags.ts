// src/lib/flags/feature-flags.ts
// Central Runtime Admin Feature-Flag & Kill-Switch System for PromptFM
// Supports runtime toggles, emergency kill switches, Supabase persistence,
// environment variable overrides, and moderation community alerts.

import { createAdminClient } from '../supabase/server';
import { broadcastToCommunity } from '../chat/bridge';
import type { FeatureFlag, FeatureFlagCategory } from '../../types/database';

export type { FeatureFlag, FeatureFlagCategory };

export interface UpdateFeatureFlagInput {
  key: string;
  enabled: boolean;
  actor: string;
  notes?: string | null;
}

export interface GetAllFlagsOptions {
  category?: FeatureFlagCategory;
  killSwitchOnly?: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlag[] = [
  {
    key: 'maintenance_mode',
    name: 'Station Maintenance Mode',
    description: 'Puts the station in maintenance mode and alerts listeners',
    enabled: false,
    category: 'system',
    is_kill_switch: true,
    updated_at: '2026-11-07T00:00:00.000Z',
    updated_by: 'system',
    notes: 'Emergency kill-switch to pause station operations',
  },
  {
    key: 'live_audio_stream',
    name: 'Live Audio Stream Output',
    description: 'Controls whether the live Icecast audio stream player is active',
    enabled: true,
    category: 'streaming',
    is_kill_switch: true,
    updated_at: '2026-11-07T00:00:00.000Z',
    updated_by: 'system',
    notes: 'Emergency switch to halt stream playback',
  },
  {
    key: 'community_requests',
    name: 'Listener Song Requests',
    description: 'Allows listeners to submit song and dedication requests via Discord, Telegram, and Web',
    enabled: true,
    category: 'community',
    is_kill_switch: true,
    updated_at: '2026-11-07T00:00:00.000Z',
    updated_by: 'system',
    notes: 'Allows pausing listener request queues during peak traffic or moderation review',
  },
  {
    key: 'ai_dj_speech',
    name: 'AI DJ Voice Synthesis',
    description: 'Enables generative speech for track intros, station IDs, weather, and news',
    enabled: true,
    category: 'ai_dj',
    is_kill_switch: true,
    updated_at: '2026-11-07T00:00:00.000Z',
    updated_by: 'system',
    notes: 'Kill switch if TTS or LLM APIs experience rate limits or degradation',
  },
  {
    key: 'sponsor_ads',
    name: 'Sponsor Audio Ads',
    description: 'Plays sponsor campaign audio spots between rotational track blocks',
    enabled: true,
    category: 'monetization',
    is_kill_switch: true,
    updated_at: '2026-11-07T00:00:00.000Z',
    updated_by: 'system',
    notes: 'Controls commercial injection into broadcast',
  },
  {
    key: 'listener_chat',
    name: 'Listener Community Chat',
    description: 'Enables listener chat bridge across Discord and Telegram',
    enabled: true,
    category: 'community',
    is_kill_switch: false,
    updated_at: '2026-11-07T00:00:00.000Z',
    updated_by: 'system',
    notes: 'Community chat bridge',
  },
  {
    key: 'community_voting',
    name: 'Song Leaderboard Voting',
    description: 'Allows listeners to upvote songs for the weekly leaderboard',
    enabled: true,
    category: 'community',
    is_kill_switch: false,
    updated_at: '2026-11-07T00:00:00.000Z',
    updated_by: 'system',
    notes: 'Voting system for leaderboard ranking',
  },
  {
    key: 'explicit_content',
    name: 'Allow Explicit Broadcasts',
    description: 'Permits explicit lyrics on designated adult late-night channels',
    enabled: false,
    category: 'moderation',
    is_kill_switch: false,
    updated_at: '2026-11-07T00:00:00.000Z',
    updated_by: 'system',
    notes: 'Moderation toggle for explicit channel content',
  },
  {
    key: 'x_social_broadcasts',
    name: 'X (Twitter) Now-Playing Alerts',
    description: 'Posts live on-air transitions and station drops to @promptfm_live',
    enabled: true,
    category: 'streaming',
    is_kill_switch: false,
    updated_at: '2026-11-07T00:00:00.000Z',
    updated_by: 'system',
    notes: 'Social media broadcast synchronization',
  },
];

// Runtime in-memory storage for zero-latency queries
let memoryFlags: Map<string, FeatureFlag> = new Map(
  DEFAULT_FEATURE_FLAGS.map((f) => [f.key, { ...f }])
);

/**
 * Checks whether an environment variable override exists for a flag key.
 * Supports PROMPTFM_FLAG_<KEY_UPPERCASE> and FLAG_<KEY_UPPERCASE>.
 */
function getEnvOverride(key: string): boolean | undefined {
  const normalizedKey = key.toUpperCase().replace(/-/g, '_');
  const envVal =
    process.env[`PROMPTFM_FLAG_${normalizedKey}`] ??
    process.env[`FLAG_${normalizedKey}`];

  if (envVal !== undefined) {
    const val = envVal.trim().toLowerCase();
    if (val === 'true' || val === '1') return true;
    if (val === 'false' || val === '0') return false;
  }
  return undefined;
}

/**
 * Evaluates whether a feature is currently enabled.
 * Evaluates environment variable overrides first, followed by in-memory runtime flags.
 */
export function isFeatureEnabled(key: string, defaultValue = false): boolean {
  const envOverride = getEnvOverride(key);
  if (envOverride !== undefined) {
    return envOverride;
  }

  const flag = memoryFlags.get(key);
  if (flag) {
    return flag.enabled;
  }

  return defaultValue;
}

/**
 * Returns a specific feature flag definition by key.
 */
export function getFeatureFlag(key: string): FeatureFlag | undefined {
  const flag = memoryFlags.get(key);
  return flag ? { ...flag } : undefined;
}

/**
 * Returns all feature flags, optionally filtered by category or kill switch status.
 */
export function getAllFeatureFlags(options?: GetAllFlagsOptions): FeatureFlag[] {
  let flags = Array.from(memoryFlags.values()).map((f) => ({ ...f }));

  if (options?.category) {
    flags = flags.filter((f) => f.category === options.category);
  }

  if (options?.killSwitchOnly) {
    flags = flags.filter((f) => f.is_kill_switch);
  }

  return flags;
}

/**
 * Updates a feature flag's state, persists it, and dispatches alerts on critical kill-switch flips.
 */
export async function setFeatureFlag(input: UpdateFeatureFlagInput): Promise<FeatureFlag> {
  const trimmedKey = input.key?.trim();
  if (!trimmedKey) {
    throw new Error('Feature flag key cannot be empty');
  }

  const existing = memoryFlags.get(trimmedKey);
  if (!existing) {
    throw new Error(`Unknown feature flag: "${trimmedKey}"`);
  }

  const trimmedActor = input.actor?.trim();
  if (!trimmedActor) {
    throw new Error('Actor (updated_by) is required when updating a feature flag');
  }

  const previousState = existing.enabled;
  const now = new Date().toISOString();

  const updated: FeatureFlag = {
    ...existing,
    enabled: Boolean(input.enabled),
    updated_at: now,
    updated_by: trimmedActor,
    notes: input.notes !== undefined ? (input.notes ? input.notes.trim() : null) : existing.notes,
  };

  memoryFlags.set(trimmedKey, updated);

  // If a kill-switch was toggled or maintenance mode was activated, dispatch a community alert
  if (existing.is_kill_switch && (previousState !== updated.enabled || (trimmedKey === 'maintenance_mode' && updated.enabled))) {
    const statusText = updated.enabled ? 'ENABLED' : 'DISABLED';
    const alertTitle = `🚨 Station Alert: [${updated.name}] ${statusText}`;
    const alertMessage = [
      `⚠️ **FEATURE FLAG UPDATE / KILL SWITCH**`,
      `• **Flag:** \`${updated.key}\` (${updated.name})`,
      `• **Status:** **${statusText}**`,
      `• **Actor:** ${updated.updated_by}`,
      updated.notes ? `• **Reason:** ${updated.notes}` : null,
      `• **Timestamp:** ${updated.updated_at}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await broadcastToCommunity({
        title: alertTitle,
        message: alertMessage,
        category: 'announcement',
      });
    } catch (err) {
      console.warn('[FeatureFlags] Could not broadcast flag alert:', err);
    }
  }

  // Persist to Supabase if available
  try {
    const supabase = createAdminClient();
    await supabase.from('feature_flags').upsert({
      key: updated.key,
      name: updated.name,
      description: updated.description,
      enabled: updated.enabled,
      category: updated.category,
      is_kill_switch: updated.is_kill_switch,
      updated_at: updated.updated_at,
      updated_by: updated.updated_by,
      notes: updated.notes,
    });
  } catch (dbErr) {
    console.warn('[FeatureFlags] Supabase persistence error (in-memory state preserved):', dbErr);
  }

  return { ...updated };
}

/**
 * Toggles a feature flag's boolean status.
 */
export async function toggleFeatureFlag(
  key: string,
  actor: string,
  notes?: string | null
): Promise<FeatureFlag> {
  const current = getFeatureFlag(key);
  if (!current) {
    throw new Error(`Unknown feature flag: "${key}"`);
  }

  return setFeatureFlag({
    key,
    enabled: !current.enabled,
    actor,
    notes: notes ?? `Toggled by ${actor}`,
  });
}

/**
 * Registers a custom feature flag definition at runtime.
 */
export function registerFeatureFlag(definition: FeatureFlag): void {
  if (!definition.key || !definition.name || !definition.category) {
    throw new Error('Invalid feature flag definition: key, name, and category are required');
  }

  memoryFlags.set(definition.key, { ...definition });
}

/**
 * Hydrates runtime flags from Supabase table if available.
 */
export async function initFeatureFlagsFromDatabase(): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('feature_flags').select('*');
    if (!error && Array.isArray(data)) {
      for (const item of data) {
        if (item.key && typeof item.enabled === 'boolean') {
          const existing = memoryFlags.get(item.key);
          memoryFlags.set(item.key, {
            key: item.key,
            name: item.name || existing?.name || item.key,
            description: item.description || existing?.description || '',
            enabled: item.enabled,
            category: item.category || existing?.category || 'system',
            is_kill_switch: Boolean(item.is_kill_switch ?? existing?.is_kill_switch),
            updated_at: item.updated_at || new Date().toISOString(),
            updated_by: item.updated_by || 'system',
            notes: item.notes ?? existing?.notes ?? null,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[FeatureFlags] Could not hydrate from Supabase, keeping defaults:', err);
  }
}

/**
 * Resets runtime flags back to initial default configuration (for test isolation).
 */
export function resetFeatureFlagsForTesting(): void {
  memoryFlags = new Map(DEFAULT_FEATURE_FLAGS.map((f) => [f.key, { ...f }]));
}

