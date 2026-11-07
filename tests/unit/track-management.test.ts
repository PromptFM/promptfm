// @ts-nocheck
// tests/unit/track-management.test.ts
// Unit tests for track metadata editing and track deletion across admin surfaces

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { editTrackMetadata, deleteTrack } from '@/lib/dj/track-management';
import * as rag from '@/lib/dj/rag';
import * as supabaseServer from '@/lib/supabase/server';

describe('Track Management (Edit & Delete)', () => {
  let mockSupabase: any;
  let tracksTable: any;
  let queueTable: any;

  beforeEach(() => {
    vi.clearAllMocks();

    tracksTable = {
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: '11111111-2222-3333-4444-555555555555',
            title: 'Found Track By Title',
            artist_name: 'AI DJ',
            tool_used: 'Suno',
            audio_url: 'https://promptfm.live/found.mp3',
            category: 'Synthwave',
            status: 'approved',
            upvotes_count: 10,
            created_at: '2026-11-06T00:00:00Z',
          },
        ],
        error: null,
      }),
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: '11111111-2222-3333-4444-555555555555',
          title: 'Found Track By UUID',
          artist_name: 'AI DJ',
          tool_used: 'Suno',
          audio_url: 'https://promptfm.live/found.mp3',
          category: 'Synthwave',
          status: 'approved',
          upvotes_count: 10,
          created_at: '2026-11-06T00:00:00Z',
        },
        error: null,
      }),
      single: vi.fn().mockResolvedValue({
        data: {
          id: '11111111-2222-3333-4444-555555555555',
          title: 'New Neon Horizon',
          artist_name: 'DJ Luna',
          tool_used: 'Suno',
          category: 'Synthwave & Electro',
          status: 'approved',
        },
        error: null,
      }),
    };

    queueTable = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'channel_queue') return queueTable;
        return tracksTable;
      }),
    };

    vi.spyOn(supabaseServer, 'createAdminClient').mockReturnValue(mockSupabase);
  });

  describe('editTrackMetadata', () => {
    it('throws error when track identifier is missing or whitespace', async () => {
      await expect(editTrackMetadata('', { title: 'New' })).rejects.toThrow(
        'Track ID or title is required'
      );
      await expect(editTrackMetadata('   ', { title: 'New' })).rejects.toThrow(
        'Track ID or title is required'
      );
    });

    it('throws error when no update fields are specified', async () => {
      await expect(editTrackMetadata('11111111-2222-3333-4444-555555555555', {})).rejects.toThrow(
        'At least one editable field must be provided'
      );
    });

    it('updates track by UUID and triggers pgvector re-indexing when title/lyrics/description change', async () => {
      const indexSpy = vi.spyOn(rag, 'indexTrackEmbedding').mockResolvedValue(true);

      const updated = await editTrackMetadata(
        '11111111-2222-3333-4444-555555555555',
        {
          title: 'New Neon Horizon',
          artist_name: 'DJ Luna',
          category: 'Synthwave & Electro',
          description: 'A cyberpunk synth vibe',
          lyrics: 'Cruising through the cyber night',
          is_explicit: false,
          tool_used: 'Udio',
        },
        'Program Director'
      );

      expect(updated.success).toBe(true);
      expect(updated.message).toContain('Program Director');
      expect(tracksTable.update).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Neon Horizon',
          artist_name: 'DJ Luna',
          category: 'Synthwave & Electro',
          description: 'A cyberpunk synth vibe',
          lyrics: 'Cruising through the cyber night',
          is_explicit: false,
          tool_used: 'Udio',
        })
      );
      expect(tracksTable.eq).toHaveBeenCalledWith('id', '11111111-2222-3333-4444-555555555555');
      expect(indexSpy).toHaveBeenCalledWith(
        '11111111-2222-3333-4444-555555555555',
        expect.objectContaining({
          title: 'New Neon Horizon',
        })
      );
      expect(updated.indexed).toBe(true);
    });

    it('resolves track by title fallback when ID is not a UUID', async () => {
      vi.spyOn(rag, 'indexTrackEmbedding').mockResolvedValue(true);

      const updated = await editTrackMetadata('Found Track By Title', {
        category: 'Lo-Fi Chill',
      });

      expect(tracksTable.ilike).toHaveBeenCalledWith('title', 'Found Track By Title');
      expect(updated.success).toBe(true);
    });

    it('does not re-index embeddings if only safety or category or tool fields change without text changes', async () => {
      const indexSpy = vi.spyOn(rag, 'indexTrackEmbedding').mockResolvedValue(true);

      const updated = await editTrackMetadata('11111111-2222-3333-4444-555555555555', {
        is_explicit: true,
        category: 'Cyberpunk',
        tool_used: 'Suno',
      });

      expect(updated.success).toBe(true);
      expect(indexSpy).not.toHaveBeenCalled();
      expect(updated.indexed).toBe(false);
    });

    it('handles fallback gracefully when createAdminClient throws or database update fails', async () => {
      vi.spyOn(supabaseServer, 'createAdminClient').mockImplementation(() => {
        throw new Error('Supabase client failed');
      });
      const indexSpy = vi.spyOn(rag, 'indexTrackEmbedding').mockResolvedValue(true);

      const res = await editTrackMetadata('11111111-2222-3333-4444-555555555555', {
        title: 'Offline Edited Track',
      });

      expect(res.success).toBe(true);
      expect(res.track.title).toBe('Offline Edited Track');
      expect(indexSpy).toHaveBeenCalled();
    });

    it('handles error in indexTrackEmbedding gracefully', async () => {
      vi.spyOn(rag, 'indexTrackEmbedding').mockRejectedValue(new Error('Embedding service down'));

      const res = await editTrackMetadata('11111111-2222-3333-4444-555555555555', {
        lyrics: 'Some new lyrics',
      });

      expect(res.success).toBe(true);
      expect(res.indexed).toBe(false);
    });
  });

  describe('deleteTrack', () => {
    it('throws error when track identifier is missing or whitespace', async () => {
      await expect(deleteTrack('')).rejects.toThrow('Track ID or title is required');
      await expect(deleteTrack('   ')).rejects.toThrow('Track ID or title is required');
    });

    it('performs soft delete by updating track status to rejected and cleaning queue', async () => {
      const res = await deleteTrack('11111111-2222-3333-4444-555555555555', {
        softDelete: true,
        actor: 'Moderator Alice',
      });

      expect(res.success).toBe(true);
      expect(res.soft_deleted).toBe(true);
      expect(res.message).toContain('archived');
      expect(res.message).toContain('Moderator Alice');

      // Verify channel_queue deletion
      expect(mockSupabase.from).toHaveBeenCalledWith('channel_queue');
      expect(queueTable.delete).toHaveBeenCalled();
      expect(queueTable.eq).toHaveBeenCalledWith('track_id', '11111111-2222-3333-4444-555555555555');

      // Verify tracks status update to rejected
      expect(tracksTable.update).toHaveBeenCalledWith({ status: 'rejected' });
      expect(tracksTable.eq).toHaveBeenCalledWith('id', '11111111-2222-3333-4444-555555555555');
    });

    it('performs permanent hard delete by removing track and removing queued items', async () => {
      const res = await deleteTrack('11111111-2222-3333-4444-555555555555', {
        softDelete: false,
        actor: 'Admin Bob',
      });

      expect(res.success).toBe(true);
      expect(res.soft_deleted).toBe(false);
      expect(res.deleted_id).toBe('11111111-2222-3333-4444-555555555555');
      expect(res.message).toContain('permanently deleted');
      expect(res.message).toContain('Admin Bob');

      // Verify channel_queue deletion
      expect(queueTable.delete).toHaveBeenCalled();
      expect(queueTable.eq).toHaveBeenCalledWith('track_id', '11111111-2222-3333-4444-555555555555');

      // Verify hard delete from tracks
      expect(tracksTable.delete).toHaveBeenCalled();
      expect(tracksTable.eq).toHaveBeenCalledWith('id', '11111111-2222-3333-4444-555555555555');
    });

    it('resolves track by title for delete operations', async () => {
      const res = await deleteTrack('Found Track By Title', { softDelete: true });
      expect(tracksTable.ilike).toHaveBeenCalledWith('title', 'Found Track By Title');
      expect(res.success).toBe(true);
      expect(res.title).toBe('Found Track By Title');
    });

    it('handles fallback when createAdminClient throws without crashing', async () => {
      vi.spyOn(supabaseServer, 'createAdminClient').mockImplementation(() => {
        throw new Error('Supabase unreachable');
      });

      const res = await deleteTrack('11111111-2222-3333-4444-555555555555', { softDelete: false });
      expect(res.success).toBe(true);
      expect(res.deleted_id).toBe('11111111-2222-3333-4444-555555555555');
    });
  });
});
