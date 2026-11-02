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
