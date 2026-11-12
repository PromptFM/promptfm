// src/lib/infra/track-media-migration.ts
// Planning, reporting, and safety helpers for migrating track media from
// Supabase public storage URLs to Cloudflare R2.

export type TrackMediaField = 'audio_url' | 'cover_art_url';
export type TrackMediaMigrationMode = 'inventory' | 'migrate';

export const TRACK_MEDIA_MIGRATION_EXIT_CODES = {
  success: 0,
  failure: 1,
  pendingMediaFound: 2,
} as const;

const SUPABASE_PUBLIC_OBJECT_PATH = '/storage/v1/object/public/';

export interface TrackMediaInventoryRow {
  id: string;
  title: string;
  artist_name: string;
  status?: string | null;
  audio_url?: string | null;
  cover_art_url?: string | null;
}

export interface SupabaseStorageObjectReference {
  sourceUrl: string;
  sourceHost: string;
  bucket: string;
  objectPath: string;
}

export interface TrackMediaMigrationReference {
  trackId: string;
  title: string;
  artistName: string;
  status: string | null;
  field: TrackMediaField;
  sourceUrl: string;
  sourceBucket: string;
  sourceObjectPath: string;
  targetKey: string;
  targetUrl: string | null;
}

export interface TrackMediaMigrationObject {
  sourceUrl: string;
  sourceBucket: string;
  sourceObjectPath: string;
  targetKey: string;
  targetUrl: string | null;
  referenceCount: number;
  trackIds: string[];
  fields: TrackMediaField[];
}

export interface TrackMediaMigrationSummary {
  rowsScanned: number;
  tracksWithPendingMedia: number;
  pendingReferences: number;
  uniqueObjects: number;
  audioReferences: number;
  coverReferences: number;
}

export interface TrackMediaMigrationPlan {
  references: TrackMediaMigrationReference[];
  objects: TrackMediaMigrationObject[];
  summary: TrackMediaMigrationSummary;
}

export interface TrackMediaMigrationExecutionSummary {
  plannedObjectCopies: number;
  plannedReferenceUpdates: number;
  objectsCopied: number;
  objectsAlreadyPresent: number;
  objectCopyFailures: number;
  referencesUpdated: number;
  referencesSkippedConflict: number;
  referenceFailures: number;
}

export interface TrackMediaMigrationReport {
  mode: TrackMediaMigrationMode;
  dryRun: boolean;
  r2PublicBaseConfigured: boolean;
  summary: TrackMediaMigrationSummary;
  execution: TrackMediaMigrationExecutionSummary;
  preview: {
    references: TrackMediaMigrationReference[];
    objects: TrackMediaMigrationObject[];
    truncated: boolean;
  };
}

export function parseSupabaseStoragePublicUrl(url: string | null | undefined): SupabaseStorageObjectReference | null {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const markerIndex = parsed.pathname.indexOf(SUPABASE_PUBLIC_OBJECT_PATH);
    if (markerIndex === -1) {
      return null;
    }

    const suffix = parsed.pathname.slice(markerIndex + SUPABASE_PUBLIC_OBJECT_PATH.length);
    const segments = suffix.split('/').filter(Boolean);
    const [bucket, ...objectSegments] = segments;

    if (!bucket || objectSegments.length === 0) {
      return null;
    }

    return {
      sourceUrl: url,
      sourceHost: parsed.host,
      bucket,
      objectPath: objectSegments.join('/'),
    };
  } catch {
    return null;
  }
}

export function buildTrackMediaMigrationKey(reference: SupabaseStorageObjectReference): string {
  const normalizedObjectPath = reference.objectPath.replace(/^\/+/, '');
  if (reference.bucket === 'tracks') {
    return `tracks/legacy/${normalizedObjectPath}`;
  }

  return `tracks/legacy/${reference.bucket}/${normalizedObjectPath}`;
}

export function buildPublicObjectUrl(baseUrl: string, key: string): string {
  return `${baseUrl.replace(/\/$/, '')}/${key}`;
}

export function guessContentTypeFromPath(objectPath: string): string {
  const normalized = objectPath.toLowerCase();

  if (normalized.endsWith('.mp3')) return 'audio/mpeg';
  if (normalized.endsWith('.m4a')) return 'audio/mp4';
  if (normalized.endsWith('.aac')) return 'audio/aac';
  if (normalized.endsWith('.wav')) return 'audio/wav';
  if (normalized.endsWith('.ogg')) return 'audio/ogg';
  if (normalized.endsWith('.flac')) return 'audio/flac';
  if (normalized.endsWith('.mp4')) return 'video/mp4';
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) return 'image/jpeg';
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.webp')) return 'image/webp';
  if (normalized.endsWith('.gif')) return 'image/gif';

  return 'application/octet-stream';
}

export function buildTrackMediaMigrationPlan(
  rows: TrackMediaInventoryRow[],
  options: { r2PublicBaseUrl?: string | null } = {},
): TrackMediaMigrationPlan {
  const references: TrackMediaMigrationReference[] = [];
  const objectMap = new Map<string, TrackMediaMigrationObject>();
  const r2PublicBaseUrl = options.r2PublicBaseUrl?.trim() || null;

  for (const row of rows) {
    for (const field of ['audio_url', 'cover_art_url'] as const) {
      const rawUrl = row[field];
      const source = parseSupabaseStoragePublicUrl(rawUrl);
      if (!source) {
        continue;
      }

      const targetKey = buildTrackMediaMigrationKey(source);
      const targetUrl = r2PublicBaseUrl ? buildPublicObjectUrl(r2PublicBaseUrl, targetKey) : null;

      references.push({
        trackId: row.id,
        title: row.title,
        artistName: row.artist_name,
        status: row.status ?? null,
        field,
        sourceUrl: source.sourceUrl,
        sourceBucket: source.bucket,
        sourceObjectPath: source.objectPath,
        targetKey,
        targetUrl,
      });

      const existing = objectMap.get(source.sourceUrl);
      if (existing) {
        existing.referenceCount += 1;
        if (!existing.trackIds.includes(row.id)) {
          existing.trackIds.push(row.id);
          existing.trackIds.sort();
        }
        if (!existing.fields.includes(field)) {
          existing.fields.push(field);
          existing.fields.sort();
        }
      } else {
        objectMap.set(source.sourceUrl, {
          sourceUrl: source.sourceUrl,
          sourceBucket: source.bucket,
          sourceObjectPath: source.objectPath,
          targetKey,
          targetUrl,
          referenceCount: 1,
          trackIds: [row.id],
          fields: [field],
        });
      }
    }
  }

  references.sort((left, right) => {
    if (left.trackId !== right.trackId) {
      return left.trackId.localeCompare(right.trackId);
    }
    if (left.field !== right.field) {
      return left.field.localeCompare(right.field);
    }
    return left.sourceUrl.localeCompare(right.sourceUrl);
  });

  const objects = [...objectMap.values()].sort((left, right) => {
    if (left.targetKey !== right.targetKey) {
      return left.targetKey.localeCompare(right.targetKey);
    }
    return left.sourceUrl.localeCompare(right.sourceUrl);
  });

  const uniqueTrackIds = new Set(references.map((reference) => reference.trackId));

  return {
    references,
    objects,
    summary: {
      rowsScanned: rows.length,
      tracksWithPendingMedia: uniqueTrackIds.size,
      pendingReferences: references.length,
      uniqueObjects: objects.length,
      audioReferences: references.filter((reference) => reference.field === 'audio_url').length,
      coverReferences: references.filter((reference) => reference.field === 'cover_art_url').length,
    },
  };
}

export function createTrackMediaMigrationExecutionSummary(
  plan: TrackMediaMigrationPlan,
): TrackMediaMigrationExecutionSummary {
  return {
    plannedObjectCopies: plan.summary.uniqueObjects,
    plannedReferenceUpdates: plan.summary.pendingReferences,
    objectsCopied: 0,
    objectsAlreadyPresent: 0,
    objectCopyFailures: 0,
    referencesUpdated: 0,
    referencesSkippedConflict: 0,
    referenceFailures: 0,
  };
}

export function createTrackMediaMigrationReport(
  plan: TrackMediaMigrationPlan,
  options: {
    mode: TrackMediaMigrationMode;
    dryRun: boolean;
    execution?: TrackMediaMigrationExecutionSummary;
    previewLimit?: number;
    r2PublicBaseConfigured?: boolean;
  },
): TrackMediaMigrationReport {
  const previewLimit = Math.max(1, options.previewLimit ?? 10);

  return {
    mode: options.mode,
    dryRun: options.dryRun,
    r2PublicBaseConfigured:
      options.r2PublicBaseConfigured ??
      (plan.objects.length > 0 && plan.objects.every((object) => Boolean(object.targetUrl))),
    summary: plan.summary,
    execution: options.execution ?? createTrackMediaMigrationExecutionSummary(plan),
    preview: {
      references: plan.references.slice(0, previewLimit),
      objects: plan.objects.slice(0, previewLimit),
      truncated: plan.references.length > previewLimit || plan.objects.length > previewLimit,
    },
  };
}

export function formatTrackMediaMigrationReport(report: TrackMediaMigrationReport): string {
  const lines = [
    '🎵 PromptFM Track Media Migration',
    '------------------------------------------------',
    `Mode:                ${report.mode}${report.dryRun ? ' (dry-run)' : ''}`,
    `Rows scanned:        ${report.summary.rowsScanned}`,
    `Tracks with media:   ${report.summary.tracksWithPendingMedia}`,
    `Pending references:  ${report.summary.pendingReferences}`,
    `Unique source files: ${report.summary.uniqueObjects}`,
    `Audio URLs:          ${report.summary.audioReferences}`,
    `Cover URLs:          ${report.summary.coverReferences}`,
    `R2 public base:      ${report.r2PublicBaseConfigured ? 'configured' : 'not configured'}`,
  ];

  if (report.mode === 'migrate') {
    lines.push(
      `Planned copies:      ${report.execution.plannedObjectCopies}`,
      `Planned rewrites:    ${report.execution.plannedReferenceUpdates}`,
      `Objects copied:      ${report.execution.objectsCopied}`,
      `Objects existing:    ${report.execution.objectsAlreadyPresent}`,
      `Copy failures:       ${report.execution.objectCopyFailures}`,
      `References updated:  ${report.execution.referencesUpdated}`,
      `Rewrite conflicts:   ${report.execution.referencesSkippedConflict}`,
      `Rewrite failures:    ${report.execution.referenceFailures}`,
    );
  }

  if (report.preview.references.length > 0) {
    lines.push('', 'Preview references:');
    for (const reference of report.preview.references) {
      lines.push(
        `- [${reference.field}] ${reference.trackId} :: ${reference.title} -> ${reference.targetKey}`,
      );
    }
  }

  if (report.preview.truncated) {
    lines.push('', 'Preview truncated. Re-run with --preview-limit <n> to adjust the preview size.');
  }

  return lines.join('\n');
}

export function getTrackMediaMigrationExitCode(
  report: TrackMediaMigrationReport,
  options: { requireClean?: boolean } = {},
): number {
  if (
    report.execution.objectCopyFailures > 0 ||
    report.execution.referencesSkippedConflict > 0 ||
    report.execution.referenceFailures > 0
  ) {
    return TRACK_MEDIA_MIGRATION_EXIT_CODES.failure;
  }

  if (options.requireClean && report.dryRun && report.summary.pendingReferences > 0) {
    return TRACK_MEDIA_MIGRATION_EXIT_CODES.pendingMediaFound;
  }

  return TRACK_MEDIA_MIGRATION_EXIT_CODES.success;
}
