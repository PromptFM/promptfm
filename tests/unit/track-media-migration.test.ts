import { describe, it, expect } from 'vitest';
import {
  buildTrackMediaMigrationPlan,
  buildTrackMediaMigrationKey,
  buildPublicObjectUrl,
  formatTrackMediaMigrationReport,
  getTrackMediaMigrationExitCode,
  parseSupabaseStoragePublicUrl,
  TRACK_MEDIA_MIGRATION_EXIT_CODES,
} from '../../src/lib/infra/track-media-migration';

describe('track media migration planning', () => {
  it('parses Supabase public storage URLs into bucket/object references', () => {
    const parsed = parseSupabaseStoragePublicUrl(
      'https://example.supabase.co/storage/v1/object/public/tracks/covers/album-art.jpg',
    );

    expect(parsed).toEqual({
      sourceUrl: 'https://example.supabase.co/storage/v1/object/public/tracks/covers/album-art.jpg',
      sourceHost: 'example.supabase.co',
      bucket: 'tracks',
      objectPath: 'covers/album-art.jpg',
    });
  });

  it('returns null for non-Supabase or malformed URLs', () => {
    expect(parseSupabaseStoragePublicUrl('https://cdn.promptfm.live/tracks/file.mp3')).toBeNull();
    expect(parseSupabaseStoragePublicUrl('not a url')).toBeNull();
    expect(parseSupabaseStoragePublicUrl(null)).toBeNull();
  });

  it('builds stable legacy R2 keys that preserve source bucket context', () => {
    const trackKey = buildTrackMediaMigrationKey({
      sourceUrl: 'https://example.supabase.co/storage/v1/object/public/tracks/song.mp3',
      sourceHost: 'example.supabase.co',
      bucket: 'tracks',
      objectPath: 'song.mp3',
    });
    const coverKey = buildTrackMediaMigrationKey({
      sourceUrl: 'https://example.supabase.co/storage/v1/object/public/covers/cover.jpg',
      sourceHost: 'example.supabase.co',
      bucket: 'covers',
      objectPath: 'cover.jpg',
    });

    expect(trackKey).toBe('tracks/legacy/song.mp3');
    expect(coverKey).toBe('tracks/legacy/covers/cover.jpg');
  });

  it('deduplicates shared source objects while keeping per-field rewrite references', () => {
    const plan = buildTrackMediaMigrationPlan(
      [
        {
          id: 'track-1',
          title: 'Neon Drift',
          artist_name: 'PromptFM',
          status: 'approved',
          audio_url: 'https://project.supabase.co/storage/v1/object/public/tracks/live/neon-drift.mp3',
          cover_art_url: 'https://project.supabase.co/storage/v1/object/public/tracks/covers/neon-drift.jpg',
        },
        {
          id: 'track-2',
          title: 'Neon Drift Replay',
          artist_name: 'PromptFM',
          status: 'approved',
          audio_url: 'https://project.supabase.co/storage/v1/object/public/tracks/live/neon-drift.mp3',
          cover_art_url: 'https://cdn.promptfm.live/covers/neon-drift.jpg',
        },
      ],
      {
        r2PublicBaseUrl: 'https://cdn.promptfm.live/',
      },
    );

    expect(plan.summary.rowsScanned).toBe(2);
    expect(plan.summary.pendingReferences).toBe(3);
    expect(plan.summary.uniqueObjects).toBe(2);
    expect(plan.summary.audioReferences).toBe(2);
    expect(plan.summary.coverReferences).toBe(1);
    expect(plan.objects).toHaveLength(2);
    const sharedAudioObject = plan.objects.find((object) => object.sourceObjectPath === 'live/neon-drift.mp3');
    const coverReference = plan.references.find((reference) => reference.field === 'cover_art_url');

    expect(sharedAudioObject?.trackIds).toEqual(['track-1', 'track-2']);
    expect(coverReference?.targetUrl).toBe(
      'https://cdn.promptfm.live/tracks/legacy/covers/neon-drift.jpg',
    );
  });

  it('formats readable reports and uses deterministic exit codes', () => {
    const plan = buildTrackMediaMigrationPlan([
      {
        id: 'track-1',
        title: 'Neon Drift',
        artist_name: 'PromptFM',
        status: 'approved',
        audio_url: 'https://project.supabase.co/storage/v1/object/public/tracks/live/neon-drift.mp3',
        cover_art_url: null,
      },
    ]);

    const reportText = formatTrackMediaMigrationReport({
      mode: 'inventory',
      dryRun: true,
      r2PublicBaseConfigured: false,
      summary: plan.summary,
      execution: {
        plannedObjectCopies: 1,
        plannedReferenceUpdates: 1,
        objectsCopied: 0,
        objectsAlreadyPresent: 0,
        objectCopyFailures: 0,
        referencesUpdated: 0,
        referencesSkippedConflict: 0,
        referenceFailures: 0,
      },
      preview: {
        references: plan.references,
        objects: plan.objects,
        truncated: false,
      },
    });

    expect(reportText).toContain('PromptFM Track Media Migration');
    expect(reportText).toContain('Pending references:  1');

    expect(
      getTrackMediaMigrationExitCode(
        {
          mode: 'inventory',
          dryRun: true,
          r2PublicBaseConfigured: false,
          summary: plan.summary,
          execution: {
            plannedObjectCopies: 1,
            plannedReferenceUpdates: 1,
            objectsCopied: 0,
            objectsAlreadyPresent: 0,
            objectCopyFailures: 0,
            referencesUpdated: 0,
            referencesSkippedConflict: 0,
            referenceFailures: 0,
          },
          preview: {
            references: [],
            objects: [],
            truncated: false,
          },
        },
        { requireClean: true },
      ),
    ).toBe(TRACK_MEDIA_MIGRATION_EXIT_CODES.pendingMediaFound);

    expect(
      getTrackMediaMigrationExitCode(
        {
          mode: 'migrate',
          dryRun: false,
          r2PublicBaseConfigured: true,
          summary: plan.summary,
          execution: {
            plannedObjectCopies: 1,
            plannedReferenceUpdates: 1,
            objectsCopied: 1,
            objectsAlreadyPresent: 0,
            objectCopyFailures: 0,
            referencesUpdated: 1,
            referencesSkippedConflict: 0,
            referenceFailures: 0,
          },
          preview: {
            references: [],
            objects: [],
            truncated: false,
          },
        },
        { requireClean: true },
      ),
    ).toBe(TRACK_MEDIA_MIGRATION_EXIT_CODES.success);
  });

  it('builds public URLs without duplicate slashes', () => {
    expect(buildPublicObjectUrl('https://cdn.promptfm.live/', 'tracks/legacy/song.mp3')).toBe(
      'https://cdn.promptfm.live/tracks/legacy/song.mp3',
    );
  });
});
