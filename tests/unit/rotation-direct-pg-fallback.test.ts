import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as directQueries from '../../src/lib/dj/direct-track-queries';
import { getNextAirplayItem, resetAirplayDedupeCache } from '../../src/lib/dj/rotation';
import { createAdminClient } from '../../src/lib/supabase/server';

vi.mock('../../src/lib/supabase/server', () => {
  return {
    createAdminClient: vi.fn(),
  };
});

describe('rotation direct postgres failover', () => {
  beforeEach(() => {
    resetAirplayDedupeCache();
    vi.clearAllMocks();
  });

  it('falls back to direct PostgreSQL tracks when Supabase REST returns error or empty', async () => {
    // Supabase returns 402 / error
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Service restricted: exceed_cached_egress_quota' },
        }),
        is: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }),
    };
    (createAdminClient as any).mockReturnValue(mockSupabase);

    // Mock direct PG returning approved tracks
    const directSpy = vi.spyOn(directQueries, 'fetchApprovedTracksDirect').mockResolvedValue([
      {
        id: 'direct-track-1',
        title: 'Direct PG Master Track',
        artist_name: 'Resident AI',
        audio_url: 'https://pub-e1f7316a96af4d84b6cf57fa8ebc60e2.r2.dev/tracks/legacy/master.mp3',
        tool_used: 'Suno',
        upvotes_count: 50,
        cover_art_url: '/logo-mark.png',
        category: 'Synthwave & Electro',
        is_explicit: false,
        family_friendly: true,
      },
    ]);

    const item = await getNextAirplayItem('main', true);

    expect(directSpy).toHaveBeenCalled();
    expect(item).not.toBeNull();
    expect(item.id).toBe('direct-track-1');
    expect(item.title).toBe('Direct PG Master Track');
    expect(item.audio_url).toBe('https://pub-e1f7316a96af4d84b6cf57fa8ebc60e2.r2.dev/tracks/legacy/master.mp3');
  });
});
