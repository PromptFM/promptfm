// tests/unit/queue-filter-inbound.test.ts
// Unit tests for Queue & Scheduled Request Inbound Email Filtering (Issue #115)
// Ensures inbound email records never show up in listener-facing /q or queue responses.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getScheduledRequests, getStationQueue, formatQueueForDiscord, formatQueueForTelegram, formatQueueForCLI } from '@/lib/dj/queue';

const mockSelect = vi.fn();
const mockIn = vi.fn();
const mockNot = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

const mockQueryBuilder = {
  select: mockSelect,
  in: mockIn,
  not: mockNot,
  order: mockOrder,
  limit: mockLimit,
};

mockSelect.mockReturnValue(mockQueryBuilder);
mockIn.mockReturnValue(mockQueryBuilder);
mockNot.mockReturnValue(mockQueryBuilder);
mockOrder.mockReturnValue(mockQueryBuilder);

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn().mockReturnValue({
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'community_requests') {
        return mockQueryBuilder;
      }
      return { select: vi.fn().mockReturnThis() };
    }),
  }),
}));

vi.mock('@/lib/dj/rotation', () => ({
  getUpNext: vi.fn().mockResolvedValue([
    {
      id: 'track-1',
      title: 'Neon Nights',
      artist: 'SynthWave AI',
      tool_used: 'Suno v3.5',
      upvotes_count: 5,
    },
  ]),
}));

describe('Queue Service Inbound Email Filtering (Issue #115)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters out rows with [Inbound Email] and [Inbound Resend] in content from getScheduledRequests', async () => {
    const rawData = [
      {
        id: 'req-1',
        platform: 'discord',
        platform_user_name: 'cool_listener',
        type: 'song',
        content: 'synthwave cyberpunk theme',
        target: null,
        batch_id: 'batch-12:00',
        status: 'scheduled',
        estimated_air_time: '2026-11-08T12:00:00Z',
      },
      {
        id: 'req-2-leaked-email',
        platform: 'web',
        platform_user_id: 'sender@example.com',
        platform_user_name: 'sender',
        type: 'song',
        content: '[Inbound Resend] To: dev@promptfm.live | Copyright issue: Please review our song',
        target: null,
        batch_id: null,
        status: 'pending',
        estimated_air_time: null,
      },
      {
        id: 'req-3-leaked-inbound',
        platform: 'web',
        platform_user_id: 'contact@example.com',
        platform_user_name: 'contact',
        type: 'song',
        content: '[Inbound Email] Partnership: We want to sponsor your morning show',
        target: null,
        batch_id: null,
        status: 'pending',
        estimated_air_time: null,
      },
      {
        id: 'req-4',
        platform: 'telegram',
        platform_user_name: 'music_lover',
        type: 'dedication',
        content: 'Happy anniversary Sarah',
        target: 'Sarah',
        batch_id: 'batch-12:15',
        status: 'scheduled',
        estimated_air_time: '2026-11-08T12:15:00Z',
      },
    ];

    mockLimit.mockResolvedValueOnce({ data: rawData, error: null });

    const requests = await getScheduledRequests(10);

    expect(requests).toHaveLength(2);
    expect(requests[0]!.id).toBe('req-1');
    expect(requests[1]!.id).toBe('req-4');
    expect(requests.some((r) => r.content.includes('[Inbound'))).toBe(false);
  });

  it('excludes inbound emails from getStationQueue and /q formatters', async () => {
    const rawData = [
      {
        id: 'req-leaked',
        platform: 'web',
        platform_user_id: 'spammer@example.com',
        platform_user_name: 'spammer',
        type: 'song',
        content: '[Inbound Email] Inbound inquiry text here',
        status: 'scheduled',
      },
      {
        id: 'req-real',
        platform: 'discord',
        platform_user_name: 'listener_bob',
        type: 'song',
        content: 'Chiptune retro 80s arcade vibe',
        status: 'scheduled',
      },
    ];

    mockLimit.mockResolvedValueOnce({ data: rawData, error: null });

    const queue = await getStationQueue({ channelSlug: 'main' });
    expect(queue.scheduledRequests).toHaveLength(1);
    expect(queue.scheduledRequests[0]!.content).toBe('Chiptune retro 80s arcade vibe');

    const discordOutput = formatQueueForDiscord(queue);
    expect(discordOutput).not.toContain('[Inbound');
    expect(discordOutput).not.toContain('Inbound inquiry');
    expect(discordOutput).toContain('Chiptune retro 80s arcade vibe');

    const telegramOutput = formatQueueForTelegram(queue);
    expect(telegramOutput).not.toContain('[Inbound');
    expect(telegramOutput).toContain('Chiptune retro 80s arcade vibe');

    const cliOutput = formatQueueForCLI(queue);
    expect(cliOutput).not.toContain('[Inbound');
    expect(cliOutput).toContain('Chiptune retro 80s arcade vibe');
  });
});

