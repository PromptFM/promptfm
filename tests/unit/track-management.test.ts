// @ts-nocheck
// tests/unit/track-management.test.ts
// Unit tests for track metadata editing and track deletion across admin surfaces

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { editTrackMetadata, deleteTrack } from '@/lib/dj/track-management';
import * as rag from '@/lib/dj/rag';

describe('Track Management (Edit & Delete)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('editTrackMetadata', () => {
    it('throws error when track identifier is missing', async () => {
      await expect(editTrackMetadata('', { title: 'New' })).rejects.toThrow(
        'Track ID or title is required'
      );
    });

    it('throws error when no update fields are specified', async () => {
      await expect(editTrackMetadata('track-123', {})).rejects.toThrow(
        'At least one editable field must be provided'
      );
    });

    it('updates track by UUID and triggers pgvector re-indexing when title/lyrics change', async () => {
      const indexSpy = vi.spyOn(rag, 'indexTrackEmbedding').mockResolvedValue(true);

      const updated = await editTrackMetadata('11111111-2222-3333-4444-555555555555', {
        title: 'New Neon Horizon',
        artist_name: 'DJ Luna',
        category: 'Synthwave & Electro',
        lyrics: 'Cruising through the cyber night',
        is_explicit: false,
      });

      expect(updated.success).toBe(true);
      expect(updated.track.title).toBe('New Neon Horizon');
      expect(indexSpy).toHaveBeenCalledWith(
        '11111111-2222-3333-4444-555555555555',
        expect.objectContaining({
          title: 'New Neon Horizon',
        })
      );
    });

    it('does not re-index embeddings if only safety or category fields change without text changes', async () => {
      const indexSpy = vi.spyOn(rag, 'indexTrackEmbedding').mockResolvedValue(true);

      const updated = await editTrackMetadata('11111111-2222-3333-4444-555555555555', {
        is_explicit: true,
      });

      expect(updated.success).toBe(true);
      expect(indexSpy).not.toHaveBeenCalled();
    });
  });

  describe('deleteTrack', () => {
    it('throws error when track identifier is missing', async () => {
      await expect(deleteTrack('')).rejects.toThrow('Track ID or title is required');
    });

    it('performs soft delete by updating track status to rejected', async () => {
      const res = await deleteTrack('track-uuid-to-soft-delete', { softDelete: true });
      expect(res.success).toBe(true);
      expect(res.soft_deleted).toBe(true);
      expect(res.message).toMatch(/archived|soft-deleted/i);
    });

    it('performs permanent hard delete by removing track and removing queued items', async () => {
      const res = await deleteTrack('track-uuid-to-hard-delete', { softDelete: false });
      expect(res.success).toBe(true);
      expect(res.soft_deleted).toBe(false);
      expect(res.deleted_id).toBe('track-uuid-to-hard-delete');
    });
  });
});
