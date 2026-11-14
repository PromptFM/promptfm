import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeCliTrackUpload } from '../../src/lib/dj/cli-upload';
import fs from 'fs';

describe('PromptFM CLI Track Upload Service (src/lib/dj/cli-upload.ts)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('throws error when local audio file does not exist', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);

    await expect(
      executeCliTrackUpload({
        filePath: '/non/existent/song.mp3',
        ensureSecrets: false,
      })
    ).rejects.toThrow('File not found at "/non/existent/song.mp3"');
  });

  it('uploads audio and embedded cover art to R2, then inserts track into PostgreSQL', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('fake-mp3-bytes'));

    const mockR2Upload = vi.fn().mockImplementation((key: string) => {
      if (key.includes('/covers/')) {
        return Promise.resolve(`https://pub-r2.dev/${key}`);
      }
      return Promise.resolve(`https://pub-r2.dev/${key}`);
    });

    const mockDbInsert = vi.fn().mockResolvedValue({
      id: 'db-track-123',
      title: 'Neon Skyline',
      artist_name: 'DJ Nova',
      audio_url: 'https://pub-r2.dev/tracks/admin/mock.mp3',
      cover_art_url: 'https://pub-r2.dev/tracks/admin/covers/mock-cover.jpg',
      category: 'Synthwave & Electro',
      tool_used: 'Suno',
      upvotes_count: 30,
      status: 'approved',
    });

    const result = await executeCliTrackUpload({
      filePath: '/music/neon-skyline.mp3',
      title: 'Neon Skyline',
      artist: 'DJ Nova',
      category: 'Synthwave & Electro',
      tool: 'Suno',
      votes: 30,
      familyFriendly: true,
      isExplicit: false,
      ensureSecrets: false,
      r2Uploader: mockR2Upload,
      dbInserter: mockDbInsert,
      metadataExtractor: async () => ({
        title: 'Extracted Title',
        artist: 'Extracted Artist',
        category: 'Synthwave & Electro',
        hasCoverArt: true,
        coverArtUrl: 'data:image/jpeg;base64,ZmFrZS1pbWFnZQ==',
      }),
    });

    expect(result.success).toBe(true);
    expect(result.trackId).toBe('db-track-123');
    expect(result.title).toBe('Neon Skyline');
    expect(result.artist).toBe('DJ Nova');

    // Verify audio upload
    expect(mockR2Upload).toHaveBeenCalledWith(
      expect.stringMatching(/^tracks\/admin\/[a-f0-9-]+\.mp3$/),
      expect.any(Buffer),
      'audio/mpeg'
    );

    // Verify cover art upload
    expect(mockR2Upload).toHaveBeenCalledWith(
      expect.stringMatching(/^tracks\/admin\/covers\/[a-f0-9-]+-cover\.jpg$/),
      expect.any(Buffer),
      'image/jpeg'
    );

    // Verify DB insertion
    expect(mockDbInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Neon Skyline',
        artist_name: 'DJ Nova',
        category: 'Synthwave & Electro',
        tool_used: 'Suno',
        upvotes_count: 30,
        status: 'approved',
        audio_url: expect.stringContaining('https://pub-r2.dev/tracks/admin/'),
        cover_art_url: expect.stringContaining('https://pub-r2.dev/tracks/admin/covers/'),
      })
    );
  });

  it('uses default brand icon when audio has no embedded cover art', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('fake-mp3-bytes'));

    const mockR2Upload = vi.fn().mockImplementation((key: string) => {
      return Promise.resolve(`https://pub-r2.dev/${key}`);
    });

    const mockDbInsert = vi.fn().mockResolvedValue({
      id: 'db-track-456',
      title: 'Acoustic Morning',
      artist_name: 'Luna',
      audio_url: 'https://pub-r2.dev/tracks/admin/acoustic.mp3',
      cover_art_url: '/icon-512.png',
      category: 'Ambient & Chill',
      tool_used: 'Udio',
      upvotes_count: 25,
      status: 'approved',
    });

    const result = await executeCliTrackUpload({
      filePath: '/music/acoustic.mp3',
      ensureSecrets: false,
      r2Uploader: mockR2Upload,
      dbInserter: mockDbInsert,
      metadataExtractor: async () => ({
        title: 'Acoustic Morning',
        artist: 'Luna',
        category: 'Ambient & Lo-Fi',
        hasCoverArt: false,
      }),
    });

    expect(result.success).toBe(true);
    // Should upload audio but not cover art
    expect(mockR2Upload).toHaveBeenCalledTimes(1);
    expect(mockDbInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Acoustic Morning',
        artist_name: 'Luna',
        cover_art_url: '/logo-mark.png',
      })
    );
  });

  it('detects different media extensions and handles direct http cover urls and explicit flags', async () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('fake-audio-bytes'));

    const extensions = [
      { file: '/music/track.wav', expectedExt: 'wav', expectedType: 'audio/wav' },
      { file: '/music/track.m4a', expectedExt: 'm4a', expectedType: 'audio/mp4' },
      { file: '/music/track.ogg', expectedExt: 'ogg', expectedType: 'audio/ogg' },
      { file: '/music/track.flac', expectedExt: 'flac', expectedType: 'audio/flac' },
      { file: '/music/track.mp4', expectedExt: 'mp4', expectedType: 'video/mp4' },
    ];

    for (const item of extensions) {
      const mockR2Upload = vi.fn().mockResolvedValue('https://pub-r2.dev/audio');
      const mockDbInsert = vi.fn().mockResolvedValue({ id: 'track-id' });

      await executeCliTrackUpload({
        filePath: item.file,
        ensureSecrets: false,
        r2Uploader: mockR2Upload,
        dbInserter: mockDbInsert,
        metadataExtractor: async () => ({
          hasCoverArt: false,
        }),
      });

      expect(mockR2Upload).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`\\.${item.expectedExt}$`)),
        expect.any(Buffer),
        item.expectedType
      );
    }

    // Direct HTTP cover URL without base64 decoding
    const mockR2 = vi.fn().mockResolvedValue('https://pub-r2.dev/audio');
    const mockDb = vi.fn().mockResolvedValue({ id: 'track-id' });

    const httpResult = await executeCliTrackUpload({
      filePath: '/music/explicit-song.mp3',
      familyFriendly: false,
      isExplicit: true,
      ensureSecrets: false,
      r2Uploader: mockR2,
      dbInserter: mockDb,
      metadataExtractor: async () => ({
        title: 'Raw Cut',
        artist: 'Underground',
        hasCoverArt: true,
        coverArtUrl: 'https://cdn.example.com/art.jpg',
      }),
    });

    expect(httpResult.success).toBe(true);
    expect(mockDb).toHaveBeenCalledWith(
      expect.objectContaining({
        cover_art_url: 'https://cdn.example.com/art.jpg',
        family_friendly: false,
        is_explicit: true,
      })
    );
  });
});
