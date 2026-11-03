// tests/unit/semantic-rag.test.ts
// Unit tests for PromptFM pgvector Semantic RAG & AI DJ Vibe Search Engine

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateEmbedding,
  buildTrackEmbeddingDocument,
  deterministicVectorFromText,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL,
} from '@/lib/ai/embeddings';
import {
  findTracksByVibe,
  indexTrackEmbedding,
  type VibeMatchResult,
} from '@/lib/dj/rag';

describe('pgvector Semantic RAG & Vibe Search Engine', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-gemini-key-123' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('buildTrackEmbeddingDocument', () => {
    it('builds a rich semantic search document from full track metadata', () => {
      const doc = buildTrackEmbeddingDocument({
        title: '  Neon Nights  ',
        artist_name: '  CyberProducer  ',
        category: '  Synthwave & Electro  ',
        description: '  Dark moody 80s synth with retro arpeggios  ',
        lyrics: '  Driving through the rain, digital neon in the vein  ',
      });

      expect(doc).toBe(
        'Title: Neon Nights. Artist: CyberProducer. Genre/Category: Synthwave & Electro. Musical Vibe & Style: Dark moody 80s synth with retro arpeggios. Lyrics Excerpt: Driving through the rain, digital neon in the vein'
      );
    });

    it('handles minimal metadata with only title and no optional fields', () => {
      const doc = buildTrackEmbeddingDocument({
        title: 'Solo Beat',
      });

      expect(doc).toBe('Title: Solo Beat');
      expect(doc).not.toContain('Artist:');
      expect(doc).not.toContain('Genre/Category:');
      expect(doc).not.toContain('Musical Vibe & Style:');
      expect(doc).not.toContain('Lyrics Excerpt:');
    });

    it('truncates lyrics exceeding 1000 characters to keep semantic focus on musical tone', () => {
      const longLyrics = 'A'.repeat(1500);
      const doc = buildTrackEmbeddingDocument({
        title: 'Epic Opera',
        lyrics: longLyrics,
      });

      expect(doc).toContain(`Lyrics Excerpt: ${'A'.repeat(1000)}`);
      expect(doc).not.toContain('A'.repeat(1001));
    });

    it('handles null and empty optional fields gracefully', () => {
      const doc = buildTrackEmbeddingDocument({
        title: 'Null Fields Track',
        artist_name: undefined,
        category: undefined,
        description: null,
        lyrics: null,
      });

      expect(doc).toBe('Title: Null Fields Track');
    });
  });

  describe('deterministicVectorFromText', () => {
    it('returns a vector with exact EMBEDDING_DIMENSIONS (768)', () => {
      const vec = deterministicVectorFromText('promptfm vibe test');
      expect(vec).toHaveLength(EMBEDDING_DIMENSIONS);
      expect(vec.length).toBe(768);
    });

    it('produces identical deterministic vector for identical input', () => {
      const vec1 = deterministicVectorFromText('synthwave electro night drive');
      const vec2 = deterministicVectorFromText('synthwave electro night drive');
      expect(vec1).toEqual(vec2);
    });

    it('produces distinct vectors for different text inputs', () => {
      const vec1 = deterministicVectorFromText('ambient chillout morning coffee');
      const vec2 = deterministicVectorFromText('brutal death metal chaos breakdown');
      expect(vec1).not.toEqual(vec2);
      expect(vec1[0]).not.toBe(vec2[0]);
    });

    it('produces an approximate unit vector (L2 norm ~ 1.0)', () => {
      const vec = deterministicVectorFromText('unit vector normalization check');
      const sumSq = vec.reduce((acc, val) => acc + val * val, 0);
      const norm = Math.sqrt(sumSq);
      expect(norm).toBeCloseTo(1.0, 2);
    });

    it('formats values to at most 6 decimal places', () => {
      const vec = deterministicVectorFromText('precision check');
      for (let i = 0; i < 10; i++) {
        const val = vec[i] ?? 0;
        const str = val.toString();
        const parts = str.split('.');
        const decimals = parts.length > 1 && parts[1] ? parts[1].length : 0;
        expect(decimals).toBeLessThanOrEqual(6);
      }
    });
  });

  describe('generateEmbedding', () => {
    it('returns deterministic vector for empty or whitespace-only text without calling fetch', async () => {
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      const vec1 = await generateEmbedding('');
      const vec2 = await generateEmbedding('   ');

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(vec1).toHaveLength(768);
      expect(vec1).toEqual(deterministicVectorFromText('empty'));
      expect(vec2).toEqual(vec1);
    });

    it('falls back to deterministic vector immediately when GEMINI_API_KEY is missing', async () => {
      delete process.env.GEMINI_API_KEY;
      const fetchSpy = vi.fn();
      global.fetch = fetchSpy;

      const vec = await generateEmbedding('cyberpunk industrial techno');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(vec).toEqual(deterministicVectorFromText('cyberpunk industrial techno'));
    });

    it('calls Gemini endpoint with correct URL, headers, and payload', async () => {
      const mockVector = new Array(768).fill(0.01);
      let capturedUrl = '';
      let capturedInit: RequestInit | undefined;

      global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        capturedUrl = url;
        capturedInit = init;
        return {
          ok: true,
          status: 200,
          json: async () => ({ embedding: { values: mockVector } }),
        };
      });

      const input = 'dreamy synthwave with saxophone solo';
      const result = await generateEmbedding(input);

      expect(capturedUrl).toBe(
        `https://generativelanguage.googleapis.com/v1beta/${EMBEDDING_MODEL}:embedContent?key=test-gemini-key-123`
      );
      expect(capturedInit?.method).toBe('POST');
      expect(capturedInit?.headers).toEqual({ 'Content-Type': 'application/json' });

      const parsedBody = JSON.parse(capturedInit?.body as string);
      expect(parsedBody.model).toBe(EMBEDDING_MODEL);
      expect(parsedBody.content.parts[0].text).toBe(input);
      expect(result).toEqual(mockVector);
    });

    it('truncates inputs longer than 2048 characters before calling Gemini', async () => {
      const longText = 'Z'.repeat(3000);
      let capturedBody: any;

      global.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
        capturedBody = JSON.parse(init?.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({ embedding: { values: new Array(768).fill(0.02) } }),
        };
      });

      await generateEmbedding(longText);
      expect(capturedBody.content.parts[0].text).toHaveLength(2048);
      expect(capturedBody.content.parts[0].text).toBe('Z'.repeat(2048));
    });

    it('falls back to deterministic vector when Gemini API returns HTTP error', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      });

      const fallback = await generateEmbedding('lo-fi chill beats to relax to');
      expect(fallback).toHaveLength(768);
      expect(fallback).toEqual(deterministicVectorFromText('lo-fi chill beats to relax to'));
    });

    it('falls back to deterministic vector when API response has invalid embedding structure', async () => {
      // Empty or missing values
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ embedding: {} }),
      });

      const vec = await generateEmbedding('invalid response structure test');
      expect(vec).toEqual(deterministicVectorFromText('invalid response structure test'));
    });

    it('falls back to deterministic vector when API values length is not 768', async () => {
      // Returned length 512 instead of 768
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ embedding: { values: new Array(512).fill(0.1) } }),
      });

      const vec = await generateEmbedding('wrong dimension vector');
      expect(vec).toEqual(deterministicVectorFromText('wrong dimension vector'));
    });

    it('falls back to deterministic vector when fetch throws network error', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Connection reset by peer'));

      const vec = await generateEmbedding('network failure resilient prompt');
      expect(vec).toHaveLength(768);
      expect(vec).toEqual(deterministicVectorFromText('network failure resilient prompt'));
    });
  });

  describe('findTracksByVibe Semantic Search', () => {
    it('returns empty array when prompt is empty or blank whitespace', async () => {
      const results1 = await findTracksByVibe('');
      const results2 = await findTracksByVibe('   ');
      expect(results1).toEqual([]);
      expect(results2).toEqual([]);
    });

    it('returns semantically matched tracks via pgvector RPC when successful', async () => {
      const mockRpcResults = [
        {
          id: 'track-uuid-1',
          title: 'Heart of Obsidian',
          artist_name: 'Iron Valkyrie',
          category: 'Rock & Metal',
          description: 'Dark gothic metal with emotional love lyrics',
          lyrics: 'My heart bleeds dark obsidian under your velvet sky',
          audio_url: 'https://r2.promptfm.live/tracks/obsidian.mp3',
          tool_used: 'Suno',
          upvotes_count: 88,
          is_explicit: false,
          family_friendly: false,
          similarity: 0.891234,
        },
        {
          id: 'track-uuid-2',
          title: 'Velvet Chains',
          artist_name: 'Doom Romance',
          category: 'Rock & Metal',
          description: 'Slow doom metal ballad of forbidden romance',
          lyrics: 'Chained to this love in shadows',
          audio_url: 'https://r2.promptfm.live/tracks/chains.mp3',
          tool_used: null, // should default to 'Other'
          upvotes_count: null, // should default to 0
          is_explicit: false,
          family_friendly: false,
          similarity: null, // should default to 0.5
        },
      ];

      const rpcSpy = vi.fn().mockResolvedValueOnce({ data: mockRpcResults, error: null });
      const mockSupabase = {
        rpc: rpcSpy,
        from: vi.fn(),
      };

      const results = await findTracksByVibe('dark metal about love', {
        supabaseClient: mockSupabase as any,
        limit: 5,
        matchThreshold: 0.4,
        channelSlug: 'main',
      });

      expect(results).toHaveLength(2);
      expect(results[0]!.title).toBe('Heart of Obsidian');
      expect(results[0]!.similarity).toBe(0.8912);
      expect(results[0]!.matchMethod).toBe('pgvector');
      expect(results[0]!.tool_used).toBe('Suno');
      expect(results[0]!.upvotes_count).toBe(88);

      expect(results[1]!.title).toBe('Velvet Chains');
      expect(results[1]!.tool_used).toBe('Other');
      expect(results[1]!.upvotes_count).toBe(0);
      expect(results[1]!.similarity).toBe(0.5);

      expect(rpcSpy).toHaveBeenCalledWith('match_tracks_by_vibe', {
        query_embedding: expect.any(Array),
        match_threshold: 0.4,
        match_count: 10,
        filter_family_friendly: null,
        filter_channel_slug: 'main',
      });
    });

    it('enforces family_friendly filter on kids channel and sets filter_family_friendly: true in RPC', async () => {
      const mockRpcResults = [
        {
          id: 't-explicit',
          title: 'Grim Metal',
          artist_name: 'Darkness',
          is_explicit: true,
          family_friendly: false,
          similarity: 0.95,
        },
        {
          id: 't-neutral',
          title: 'Mellow Tune',
          artist_name: 'Average DJ',
          is_explicit: false,
          family_friendly: false, // not family friendly
          similarity: 0.85,
        },
        {
          id: 't-kids',
          title: 'Happy Robot Metal',
          artist_name: 'Chiptune Bots',
          category: 'Chiptune & 8-Bit',
          audio_url: 'https://r2.promptfm.live/robot.mp3',
          tool_used: 'Suno',
          upvotes_count: 12,
          is_explicit: false,
          family_friendly: true,
          similarity: 0.75,
        },
      ];

      const rpcSpy = vi.fn().mockResolvedValueOnce({ data: mockRpcResults, error: null });
      const mockSupabase = {
        rpc: rpcSpy,
      };

      const results = await findTracksByVibe('playful robot metal', {
        supabaseClient: mockSupabase as any,
        channelSlug: 'kids',
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.title).toBe('Happy Robot Metal');
      expect(results[0]!.family_friendly).toBe(true);
      expect(results[0]!.is_explicit).toBe(false);

      expect(rpcSpy).toHaveBeenCalledWith('match_tracks_by_vibe', expect.objectContaining({
        filter_family_friendly: true,
        filter_channel_slug: 'kids',
      }));
    });

    it('permits explicit tracks all day long on afterdark 18+ channel', async () => {
      const mockRpcResults = [
        {
          id: 't-uncensored',
          title: 'Raw Underground Bass',
          artist_name: 'DJ Cipher',
          category: 'Cyberpunk & Industrial',
          audio_url: 'https://r2.promptfm.live/raw.mp3',
          tool_used: 'Other',
          upvotes_count: 77,
          is_explicit: true,
          family_friendly: false,
          similarity: 0.92,
        },
      ];

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValueOnce({ data: mockRpcResults, error: null }),
      };

      // Mid-day reference time (14:00 UTC) when explicit would normally be blocked on standard radio
      const daytime = new Date('2026-11-03T14:00:00Z');

      const results = await findTracksByVibe('uncensored underground bass', {
        supabaseClient: mockSupabase as any,
        channelSlug: 'afterdark',
        referenceDate: daytime,
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.title).toBe('Raw Underground Bass');
      expect(results[0]!.is_explicit).toBe(true);
    });

    it('blocks explicit tracks on daytime standard broadcast channels', async () => {
      const mockRpcResults = [
        {
          id: 't-explicit',
          title: 'Explicit Midday Song',
          artist_name: 'Shock Rocker',
          is_explicit: true,
          family_friendly: false,
          similarity: 0.95,
        },
        {
          id: 't-clean',
          title: 'Clean Midday Song',
          artist_name: 'Smooth Rocker',
          is_explicit: false,
          family_friendly: true,
          similarity: 0.88,
        },
      ];

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValueOnce({ data: mockRpcResults, error: null }),
      };

      // 14:00 UTC daytime
      const daytime = new Date('2026-11-03T14:00:00Z');

      const results = await findTracksByVibe('rock song', {
        supabaseClient: mockSupabase as any,
        channelSlug: 'main',
        referenceDate: daytime,
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.title).toBe('Clean Midday Song');
    });

    it('falls back cleanly to lexical search when RPC errors or throws', async () => {
      const mockLibraryTracks = [
        {
          id: 'track-lex-1',
          title: 'Crimson Heart Metal',
          artist_name: 'Dark Romance',
          category: 'Rock & Metal',
          description: 'A heavy dark metal journey about love and loss',
          lyrics: 'Love burns in the dark metal forge',
          audio_url: 'https://r2.promptfm.live/crimson.mp3',
          tool_used: 'Suno',
          upvotes_count: 50,
          status: 'approved',
          is_explicit: false,
          family_friendly: false,
        },
        {
          id: 'track-lex-2',
          title: 'Electric Sunrise Pop',
          artist_name: 'Sunlight Crew',
          category: 'Pop & Vocal',
          description: 'Happy morning dance track',
          lyrics: 'Wake up to the golden sky',
          audio_url: 'https://r2.promptfm.live/sunrise.mp3',
          tool_used: 'Udio',
          upvotes_count: 20,
          status: 'approved',
          is_explicit: false,
          family_friendly: true,
        },
      ];

      const mockSupabase = {
        rpc: vi.fn().mockRejectedValueOnce(new Error('pgvector extension not installed')),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValueOnce({ data: mockLibraryTracks, error: null }),
          }),
        }),
      };

      const results = await findTracksByVibe('dark metal love', {
        supabaseClient: mockSupabase as any,
        matchThreshold: 0.3,
        channelSlug: 'main',
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.title).toBe('Crimson Heart Metal');
      expect(results[0]!.matchMethod).toBe('lexical_fallback');
      expect(results[0]!.similarity).toBeGreaterThanOrEqual(0.3);
      expect(results[0]!.similarity).toBeCloseTo(3 / 3, 2);
    });

    it('sorts lexical matches by similarity DESC, then by upvotes_count DESC', async () => {
      const mockLibraryTracks = [
        {
          id: 't-1',
          title: 'Cyber City Nights',
          artist_name: 'Neon',
          description: 'synthwave cyber nights',
          upvotes_count: 10,
          is_explicit: false,
        },
        {
          id: 't-2',
          title: 'Cyber City Lights',
          artist_name: 'Neon',
          description: 'synthwave cyber lights',
          upvotes_count: 50,
          is_explicit: false,
        },
      ];

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'no rpc' } }),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValueOnce({ data: mockLibraryTracks, error: null }),
          }),
        }),
      };

      // Prompt matches both terms 'cyber' and 'city' equally (similarity 2/2 = 1.0)
      const results = await findTracksByVibe('cyber city', {
        supabaseClient: mockSupabase as any,
        matchThreshold: 0.1,
      });

      expect(results).toHaveLength(2);
      expect(results[0]!.similarity).toBe(results[1]!.similarity);
      // t-2 has 50 upvotes vs t-1's 10 upvotes, so t-2 must come first
      expect(results[0]!.id).toBe('t-2');
      expect(results[1]!.id).toBe('t-1');
    });

    it('falls through to lexical search when all RPC results are filtered out by channel controls', async () => {
      const mockRpcResults = [
        {
          id: 'rpc-exp',
          title: 'Violent Death Track',
          is_explicit: true,
          family_friendly: false,
          similarity: 0.99,
        },
      ];

      const mockLexicalTracks = [
        {
          id: 'lex-clean',
          title: 'Happy Robot Metal',
          artist_name: 'Friendly Bots',
          description: 'Playful clean robot metal for children',
          audio_url: 'https://r2.promptfm.live/friendly.mp3',
          tool_used: 'Suno',
          upvotes_count: 25,
          is_explicit: false,
          family_friendly: true,
        },
      ];

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValueOnce({ data: mockRpcResults, error: null }),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValueOnce({ data: mockLexicalTracks, error: null }),
          }),
        }),
      };

      const results = await findTracksByVibe('robot metal', {
        supabaseClient: mockSupabase as any,
        channelSlug: 'kids',
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('lex-clean');
      expect(results[0]!.matchMethod).toBe('lexical_fallback');
    });

    it('enforces lexical search channel parental filtering (kids vs afterdark vs main daytime)', async () => {
      const mockLexicalTracks = [
        {
          id: 'lex-1-explicit',
          title: 'Hardcore Underground Cyber',
          artist_name: 'Raw DJ',
          category: 'Cyberpunk & Industrial',
          description: 'explicit dark raw electro cyberpunk',
          tool_used: undefined, // test fallback to 'Other'
          upvotes_count: undefined, // test fallback to 0
          is_explicit: true,
          family_friendly: false,
        },
        {
          id: 'lex-2-kids',
          title: 'Sunny Playful Cyber',
          artist_name: 'Kids Bot',
          category: 'Cyberpunk & Industrial',
          description: 'playful child cyber synthwave',
          tool_used: 'Suno',
          upvotes_count: 15,
          is_explicit: false,
          family_friendly: true,
        },
      ];

      const createSupabaseMock = () => ({
        rpc: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValueOnce({ data: mockLexicalTracks, error: null }),
          }),
        }),
      });

      // 1. Kids channel filters out explicit
      const kidsRes = await findTracksByVibe('cyber', {
        supabaseClient: createSupabaseMock() as any,
        channelSlug: 'kids',
        matchThreshold: 0.1,
      });
      expect(kidsRes).toHaveLength(1);
      expect(kidsRes[0]!.id).toBe('lex-2-kids');
      expect(kidsRes[0]!.tool_used).toBe('Suno');
      expect(kidsRes[0]!.upvotes_count).toBe(15);

      // 2. Afterdark allows explicit track
      const afterdarkRes = await findTracksByVibe('cyber', {
        supabaseClient: createSupabaseMock() as any,
        channelSlug: 'afterdark',
        matchThreshold: 0.1,
      });
      expect(afterdarkRes.some((t) => t.id === 'lex-1-explicit')).toBe(true);
      const explicitItem = afterdarkRes.find((t) => t.id === 'lex-1-explicit');
      expect(explicitItem?.tool_used).toBe('Other');
      expect(explicitItem?.upvotes_count).toBe(0);

      // 3. Main daytime blocks explicit track
      const daytime = new Date('2026-11-03T14:00:00Z');
      const mainDaytimeRes = await findTracksByVibe('cyber', {
        supabaseClient: createSupabaseMock() as any,
        channelSlug: 'main',
        referenceDate: daytime,
        matchThreshold: 0.1,
      });
      expect(mainDaytimeRes.every((t) => !t.is_explicit)).toBe(true);
    });

    it('filters out tracks below matchThreshold and includes tracks at or above threshold in lexical search', async () => {
      const mockLexicalTracks = [
        {
          id: 'lex-full-match',
          title: 'Synthwave Neon Drive', // matches synthwave, neon, drive (3/3 = 1.0)
          is_explicit: false,
        },
        {
          id: 'lex-partial-match',
          title: 'Neon Sky Pop', // matches only neon (1/3 = 0.3333)
          is_explicit: false,
        },
        {
          id: 'lex-no-match',
          title: 'Classical Acoustic Piano', // 0/3 = 0.0
          is_explicit: false,
        },
      ];

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValueOnce({ data: mockLexicalTracks, error: null }),
          }),
        }),
      };

      // With threshold 0.5, partial-match (0.33) and no-match (0.0) should be dropped
      const res = await findTracksByVibe('synthwave neon drive', {
        supabaseClient: mockSupabase as any,
        matchThreshold: 0.5,
      });

      expect(res).toHaveLength(1);
      expect(res[0]!.id).toBe('lex-full-match');
    });

    it('works with default options when no options object is provided', async () => {
      const mockTracks = [
        { id: '1', title: 'Default Option Test Track', description: 'default vibe', is_explicit: false },
      ];

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValueOnce({ data: mockTracks, error: null }),
          }),
        }),
      };

      // Call without second argument
      const results = await findTracksByVibe('default vibe', { supabaseClient: mockSupabase as any });
      expect(results).toHaveLength(1);
      expect(results[0]!.title).toBe('Default Option Test Track');
    });

    it('enforces limit on search results', async () => {
      const mockTracks = [
        { id: '1', title: 'Song 1', description: 'rock', is_explicit: false },
        { id: '2', title: 'Song 2', description: 'rock', is_explicit: false },
        { id: '3', title: 'Song 3', description: 'rock', is_explicit: false },
      ];

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValueOnce({ data: [], error: null }),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValueOnce({ data: mockTracks, error: null }),
          }),
        }),
      };

      const results = await findTracksByVibe('rock', {
        supabaseClient: mockSupabase as any,
        limit: 2,
        matchThreshold: 0.1,
      });

      expect(results).toHaveLength(2);
    });

    it('includes tracks with similarity exactly equal to matchThreshold (>=)', async () => {
      const mockLexicalTracks = [
        {
          id: 'exact-match',
          title: 'Retro Wave', // matches 1 out of 2 query terms = 0.5
          is_explicit: false,
        },
      ];

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValueOnce({ data: mockLexicalTracks, error: null }),
          }),
        }),
      };

      const res = await findTracksByVibe('retro synth', {
        supabaseClient: mockSupabase as any,
        matchThreshold: 0.5,
      });

      expect(res).toHaveLength(1);
      expect(res[0]!.id).toBe('exact-match');
      expect(res[0]!.similarity).toBe(0.5);
    });

    it('matches query terms located individually in category, description, or lyrics', async () => {
      const mockTracks = [
        {
          id: 't-cat',
          title: 'Track A',
          category: 'Vaporwave',
          description: null,
          lyrics: null,
          is_explicit: false,
        },
        {
          id: 't-desc',
          title: 'Track B',
          category: null,
          description: 'Soothing lo-fi rainstorm',
          lyrics: null,
          is_explicit: false,
        },
        {
          id: 't-lyr',
          title: 'Track C',
          category: null,
          description: null,
          lyrics: 'Beneath the neon lights we dance',
          is_explicit: false,
        },
      ];

      const createMock = () => ({
        rpc: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValueOnce({ data: mockTracks, error: null }),
          }),
        }),
      });

      // Match category
      const resCat = await findTracksByVibe('vaporwave', {
        supabaseClient: createMock() as any,
        matchThreshold: 0.5,
      });
      expect(resCat).toHaveLength(1);
      expect(resCat[0]!.id).toBe('t-cat');

      // Match description
      const resDesc = await findTracksByVibe('rainstorm', {
        supabaseClient: createMock() as any,
        matchThreshold: 0.5,
      });
      expect(resDesc).toHaveLength(1);
      expect(resDesc[0]!.id).toBe('t-desc');

      // Match lyrics
      const resLyr = await findTracksByVibe('beneath', {
        supabaseClient: createMock() as any,
        matchThreshold: 0.5,
      });
      expect(resLyr).toHaveLength(1);
      expect(resLyr[0]!.id).toBe('t-lyr');
    });

    it('defaults limit to 5 and matchThreshold to 0.3 when omitted in options', async () => {
      const mockTracks = [
        { id: '1', title: 'Song Alpha 1', description: 'vibe match', is_explicit: false },
        { id: '2', title: 'Song Alpha 2', description: 'vibe match', is_explicit: false },
        { id: '3', title: 'Song Alpha 3', description: 'vibe match', is_explicit: false },
        { id: '4', title: 'Song Alpha 4', description: 'vibe match', is_explicit: false },
        { id: '5', title: 'Song Alpha 5', description: 'vibe match', is_explicit: false },
        { id: '6', title: 'Song Alpha 6', description: 'vibe match', is_explicit: false },
      ];

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValueOnce({ data: mockTracks, error: null }),
          }),
        }),
      };

      const results = await findTracksByVibe('vibe match', {
        supabaseClient: mockSupabase as any,
      });

      expect(results).toHaveLength(5);
    });

    it('explicit familyFriendlyOnly: true on non-kids channel enforces family friendly filter', async () => {
      const mockRpcResults = [
        { id: 't-explicit', title: 'Expl', is_explicit: true, family_friendly: false },
        { id: 't-clean', title: 'Clean', is_explicit: false, family_friendly: true },
      ];

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValueOnce({ data: mockRpcResults, error: null }),
      };

      const results = await findTracksByVibe('rock', {
        supabaseClient: mockSupabase as any,
        channelSlug: 'main',
        familyFriendlyOnly: true,
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('t-clean');
    });

    it('does not enforce familyFriendlyOnly on main channel when options.familyFriendlyOnly is omitted', async () => {
      const mockRpcResults = [
        { id: 't-clean-not-family', title: 'Clean Mature Track', is_explicit: false, family_friendly: false },
      ];

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValueOnce({ data: mockRpcResults, error: null }),
      };

      const results = await findTracksByVibe('mature', {
        supabaseClient: mockSupabase as any,
        channelSlug: 'main',
      });

      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('t-clean-not-family');
    });

    it('returns empty array when lexical library is empty or null', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
          }),
        }),
      };

      const results = await findTracksByVibe('any prompt', {
        supabaseClient: mockSupabase as any,
      });

      expect(results).toEqual([]);
    });

    it('returns empty array when lexical search query produces no single-word tokens', async () => {
      const mockTracks = [
        { id: '1', title: 'Hello World', is_explicit: false },
      ];

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValueOnce({ data: mockTracks, error: null }),
          }),
        }),
      };

      // Single-letter query terms are discarded (<2 chars), resulting in empty queryTerms
      const results = await findTracksByVibe('a b c', {
        supabaseClient: mockSupabase as any,
        matchThreshold: 0.5,
      });

      expect(results).toEqual([]);
    });

    it('enforces limit on RPC search results', async () => {
      const mockRpcResults = [
        { id: '1', title: 'Song 1', is_explicit: false, similarity: 0.9 },
        { id: '2', title: 'Song 2', is_explicit: false, similarity: 0.8 },
        { id: '3', title: 'Song 3', is_explicit: false, similarity: 0.7 },
      ];

      const mockSupabase = {
        rpc: vi.fn().mockResolvedValueOnce({ data: mockRpcResults, error: null }),
      };

      const results = await findTracksByVibe('test', {
        supabaseClient: mockSupabase as any,
        limit: 2,
      });

      expect(results).toHaveLength(2);
      expect(results[0]!.id).toBe('1');
      expect(results[1]!.id).toBe('2');
    });

    it('handles lexical search exception gracefully and returns empty array', async () => {
      const mockSupabase = {
        rpc: vi.fn().mockResolvedValueOnce({ data: null, error: null }),
        from: vi.fn().mockImplementation(() => {
          throw new Error('Supabase offline fatal');
        }),
      };

      const results = await findTracksByVibe('crash recovery vibe', {
        supabaseClient: mockSupabase as any,
      });

      expect(results).toEqual([]);
    });
  });

  describe('indexTrackEmbedding', () => {
    it('successfully computes embedding and updates track row in Supabase', async () => {
      const eqMock = vi.fn().mockResolvedValueOnce({ error: null });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      const fromMock = vi.fn().mockReturnValue({ update: updateMock });

      const mockSupabase = {
        from: fromMock,
      };

      const res = await indexTrackEmbedding(
        'track-abc-123',
        {
          title: 'Sunset Neon',
          artist_name: 'Synthwave Dreamer',
          category: 'Synthwave & Electro',
          description: 'Warm analog chords',
          lyrics: 'Driving off into the neon sunset',
        },
        mockSupabase as any
      );

      expect(res.success).toBe(true);
      expect(res.embedding).toHaveLength(EMBEDDING_DIMENSIONS);
      expect(fromMock).toHaveBeenCalledWith('tracks');
      expect(updateMock).toHaveBeenCalledWith({ embedding: expect.any(Array) });
      expect(eqMock).toHaveBeenCalledWith('id', 'track-abc-123');
    });

    it('handles database update error and returns success: false with error details', async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValueOnce({ error: { message: 'Column embedding does not exist' } }),
          }),
        }),
      };

      const res = await indexTrackEmbedding(
        'track-err-999',
        { title: 'Test Failed Embedding' },
        mockSupabase as any
      );

      expect(res.success).toBe(false);
      expect(res.error).toBe('Column embedding does not exist');
    });

    it('handles uncaught exceptions during indexing and returns success: false', async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation(() => {
          throw new Error('Database client completely unresponsive');
        }),
      };

      const res = await indexTrackEmbedding(
        'track-crash-888',
        { title: 'Crash Track' },
        mockSupabase as any
      );

      expect(res.success).toBe(false);
      expect(res.error).toBe('Database client completely unresponsive');
    });

    it('handles non-Error thrown objects during indexing', async () => {
      const mockSupabase = {
        from: vi.fn().mockImplementation(() => {
          throw 'Raw string error failure';
        }),
      };

      const res = await indexTrackEmbedding(
        'track-string-err',
        { title: 'String Error Track' },
        mockSupabase as any
      );

      expect(res.success).toBe(false);
      expect(res.error).toBe('Raw string error failure');
    });
  });
});
