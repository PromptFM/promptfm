// src/types/database.ts
// Central TypeScript types that mirror the Supabase schema.

export type TrackStatus = 'pending' | 'approved' | 'rejected';
export type AITool = 'Suno' | 'Udio' | 'Stable Audio' | 'Other';

export interface Track {
  id: string;
  created_at: string;
  title: string;
  artist_name: string;
  user_id: string | null;
  audio_url: string;
  tool_used: AITool;
  status: TrackStatus;
  upvotes_count: number;
  is_explicit?: boolean;
  rejection_reason?: string | null;
}

export interface Vote {
  id: string;
  user_id: string;
  track_id: string;
  created_at: string;
}

/** Shape returned by the /top page query — tracks plus a flag for whether
 *  the current user has already voted on each one. */
export interface RankedTrack extends Track {
  user_has_voted: boolean;
}

export interface CommunityRequest {
  id: string;
  platform: 'discord' | 'telegram' | 'web';
  platform_user_id: string;
  platform_user_name: string;
  platform_message_id?: string | null;
  type: 'song' | 'dedication' | 'weather' | 'news' | 'zodiac';
  content: string;
  target?: string | null;
  batch_id?: string | null;
  status: 'pending' | 'scheduled' | 'aired' | 'rejected';
  rejection_reason?: string | null;
  is_explicit?: boolean;
  estimated_air_time?: string | null;
  aired_at?: string | null;
  audio_url?: string | null;
  created_at: string;
}

export type ReportTargetType = 'track' | 'broadcast' | 'request' | 'user';
export type ReportReason =
  | 'copyright_dmca'
  | 'hate_harassment'
  | 'religious_ethical'
  | 'unlabeled_18_plus'
  | 'spam_abuse'
  | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'actioned' | 'dismissed';
export type ReporterPlatform = 'web' | 'discord' | 'telegram' | 'mcp' | 'api';

export const REASON_LABELS: Record<ReportReason, string> = {
  copyright_dmca: 'DMCA & Copyright Infringement',
  hate_harassment: 'Hate Speech, Harassment or Defamation',
  religious_ethical: 'Religious Mockery or Ethical Violation',
  unlabeled_18_plus: 'Unlabeled Adult / Explicit Content (18+)',
  spam_abuse: 'Spam, Flooding or Deceptive Metadata',
  other: 'Other Community Guidelines Violation',
};

export interface ContentReport {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  details?: string | null;
  reporter_platform: ReporterPlatform;
  reporter_id?: string | null;
  status: ReportStatus;
  created_at: string;
}

/** Payload accepted by POST /api/upload-url */
export interface UploadUrlRequest {
  filename: string;
  contentType: string;
}

/** Response from POST /api/upload-url */
export interface UploadUrlResponse {
  presignedUrl: string;
  publicUrl: string;
  key: string;
}
