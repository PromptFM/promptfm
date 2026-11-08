// tests/unit/icecast-metadata.test.ts
// Verifies UTF-8 stream metadata parsing and mojibake recovery across Icecast status endpoints (Issue #133)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  repairMojibake,
  parseIcecastTitle,
  parseIcecastStatus,
  fetchIcecastMetadata,
  validateStreamerUtf8Config,
} from '@/lib/dj/icecast-metadata';
import * as fs from 'fs';
import * as path from 'path';

describe('Icecast UTF-8 Metadata & Mojibake Repair (Issue #133)', () => {
  describe('repairMojibake()', () => {
    it('returns empty or non-string inputs safely without modification', () => {
      expect(repairMojibake('')).toBe('');
      expect(repairMojibake(null as unknown as string)).toBeNull();
      expect(repairMojibake(undefined as unknown as string)).toBeUndefined();
      expect(repairMojibake(123 as unknown as string)).toBe(123);
      expect(repairMojibake(false as unknown as string)).toBe(false);
      expect(repairMojibake({} as unknown as string)).toEqual({});
    });

    it('returns original text when string has no characters in UTF-8 lead byte range (0xC2-0xF4)', () => {
      expect(repairMojibake('Hello World 123')).toBe('Hello World 123');
      expect(repairMojibake('Simple ASCII without any high bytes')).toBe('Simple ASCII without any high bytes');
      expect(repairMojibake('\u00A0\u00B0')).toBe('\u00A0\u00B0');
    });

    it('preserves clean valid UTF-8 strings untouched', () => {
      const cleanStation = 'PromptFM — 24/7 AI Generated Music Radio';
      expect(repairMojibake(cleanStation)).toBe(cleanStation);

      const cleanSong = 'alextrifan — Haina-mi este cea mai dragă';
      expect(repairMojibake(cleanSong)).toBe(cleanSong);

      const cleanAccented = 'Café de Paris & Über alles';
      expect(repairMojibake(cleanAccented)).toBe(cleanAccented);

      const cleanNonLatin = '日本語のラジオとПривет мир';
      expect(repairMojibake(cleanNonLatin)).toBe(cleanNonLatin);

      const cleanEmoji = 'PromptFM 🎵 Electronic & Ambient 🔥';
      expect(repairMojibake(cleanEmoji)).toBe(cleanEmoji);
    });

    it('repairs CP1252/Latin-1 mangled em dash (â€” -> —)', () => {
      const mangledStation = 'PromptFM â€” 24/7 AI Generated Music Radio';
      expect(repairMojibake(mangledStation)).toBe('PromptFM — 24/7 AI Generated Music Radio');
    });

    it('repairs raw byte-escaped mangled em dash (â\\x80\\x94 -> —)', () => {
      const mangledStation = 'PromptFM \u00e2\u0080\u0094 24/7 AI Generated Music Radio';
      expect(repairMojibake(mangledStation)).toBe('PromptFM — 24/7 AI Generated Music Radio');
    });

    it('repairs mangled en dash (â€“ -> –)', () => {
      const mangled = 'Track Title â€“ Instrumental';
      expect(repairMojibake(mangled)).toBe('Track Title – Instrumental');
    });

    it('repairs mangled quotation marks (â€œ â€\x9d â€˜ â€™ -> “ ” ‘ ’)', () => {
      const mangledDouble = 'â€œSpecial Editionâ€\u009d';
      expect(repairMojibake(mangledDouble)).toBe('“Special Edition”');

      const mangledSingle = 'â€˜PromptFM Liveâ€™';
      expect(repairMojibake(mangledSingle)).toBe('‘PromptFM Live’');
    });

    it('repairs mangled ellipsis (â€¦ -> …)', () => {
      const mangled = 'Coming up nextâ€¦';
      expect(repairMojibake(mangled)).toBe('Coming up next…');
    });

    it('repairs double-encoded UTF-8 accents (CafÃ© -> Café, naÃ¯ve -> naïve)', () => {
      expect(repairMojibake('CafÃ©')).toBe('Café');
      expect(repairMojibake('naÃ¯ve')).toBe('naïve');
      expect(repairMojibake('Ã¼ber')).toBe('über');
    });

    it('repairs double-encoded emojis and symbols without corrupting valid text', () => {
      const original = 'DJ Beats 🎵 & Synth 🔥';
      const mangled = Buffer.from(original, 'utf-8').toString('latin1');
      expect(repairMojibake(mangled)).toBe(original);
    });

    it('decodes mixed strings containing Asian characters and mojibake correctly', () => {
      expect(repairMojibake('PromptFM â€” 東京 Radio')).toBe('PromptFM — 東京 Radio');
      expect(repairMojibake('Привет мир â€” PromptFM')).toBe('Привет мир — PromptFM');
    });

    it('handles char code 255 (0xff) and unmapped high characters safely', () => {
      const textWith255 = 'Test \u00ff';
      expect(repairMojibake(textWith255)).toBe('Test \u00ff');

      const textWithUnmapped = '\u00e2\u0100\u0101';
      expect(repairMojibake(textWithUnmapped)).toBe('\u00e2\u0100\u0101');
    });

    it('verifies all 27 CP1252 mapped byte entries (0x80 - 0x9F) are recovered faithfully', () => {
      const cp1252Pairs: Array<[number, number]> = [
        [0x20ac, 0x80], // €
        [0x201a, 0x82], // ‚
        [0x0192, 0x83], // ƒ
        [0x201e, 0x84], // „
        [0x2026, 0x85], // …
        [0x2020, 0x86], // †
        [0x2021, 0x87], // ‡
        [0x02c6, 0x88], // ˆ
        [0x2030, 0x89], // ‰
        [0x0160, 0x8a], // Š
        [0x2039, 0x8b], // ‹
        [0x0152, 0x8c], // Œ
        [0x017d, 0x8e], // Ž
        [0x2018, 0x91], // ‘
        [0x2019, 0x92], // ’
        [0x201c, 0x93], // “
        [0x201d, 0x94], // ”
        [0x2022, 0x95], // •
        [0x2013, 0x96], // –
        [0x2014, 0x97], // —
        [0x02dc, 0x98], // ˜
        [0x2122, 0x99], // ™
        [0x0161, 0x9a], // š
        [0x203a, 0x9b], // ›
        [0x0153, 0x9c], // œ
        [0x017e, 0x9e], // ž
        [0x0178, 0x9f], // Ÿ
      ];

      for (const [charPoint, targetByte] of cp1252Pairs) {
        const mangled = `Â${String.fromCodePoint(charPoint)}`;
        const expected = String.fromCharCode(targetByte);
        const repaired = repairMojibake(mangled);
        expect(repaired).toBe(expected);
      }
    });
  });

  describe('parseIcecastTitle()', () => {
    it('splits Artist - Title format and trims excess whitespace', () => {
      const parsed = parseIcecastTitle('alextrifan - THE GYPSY WITCH');
      expect(parsed).toEqual({
        artist: 'alextrifan',
        title: 'THE GYPSY WITCH',
      });
    });

    it('returns title-only when no hyphen separator exists', () => {
      const parsed = parseIcecastTitle('PromptFM Ambient AI Anthem');
      expect(parsed).toEqual({
        title: 'PromptFM Ambient AI Anthem',
      });
    });

    it('trims leading and trailing whitespace on solitary title', () => {
      const parsed = parseIcecastTitle('   PromptFM Ambient AI Anthem   ');
      expect(parsed).toEqual({
        title: 'PromptFM Ambient AI Anthem',
      });
    });

    it('trims leading and trailing whitespace on artist and title parts', () => {
      const parsed = parseIcecastTitle('   alextrifan    -    THE GYPSY WITCH   ');
      expect(parsed).toEqual({
        artist: 'alextrifan',
        title: 'THE GYPSY WITCH',
      });
    });

    it('handles multiple hyphens by joining subsequent parts as title', () => {
      const parsed = parseIcecastTitle('Artist - Song Part 1 - Remastered');
      expect(parsed).toEqual({
        artist: 'Artist',
        title: 'Song Part 1 - Remastered',
      });
    });

    it('repairs mojibake in both artist and title fields', () => {
      const parsed = parseIcecastTitle('BeyoncÃ© - Halo â€” Acoustic Live');
      expect(parsed).toEqual({
        artist: 'Beyoncé',
        title: 'Halo — Acoustic Live',
      });
    });

    it('handles falsy or empty title input safely', () => {
      expect(parseIcecastTitle('')).toEqual({ title: '' });
      expect(parseIcecastTitle(null as unknown as string)).toEqual({ title: '' });
      expect(parseIcecastTitle(undefined as unknown as string)).toEqual({ title: '' });
    });
  });

  describe('parseIcecastStatus()', () => {
    it('returns null for missing, empty, or malformed status objects', () => {
      expect(parseIcecastStatus(null)).toBeNull();
      expect(parseIcecastStatus(undefined)).toBeNull();
      expect(parseIcecastStatus(123 as any)).toBeNull();
      expect(parseIcecastStatus('string' as any)).toBeNull();
      expect(parseIcecastStatus(false as any)).toBeNull();
      expect(parseIcecastStatus({})).toBeNull();
      expect(parseIcecastStatus({ icestats: {} })).toBeNull();
      expect(parseIcecastStatus({ icestats: { source: null } })).toBeNull();
      expect(parseIcecastStatus({ icestats: { source: [] } })).toBeNull();
      expect(parseIcecastStatus({ icestats: { source: [null] } })).toBeNull();
      expect(parseIcecastStatus({ icestats: { source: ['not-an-object'] } })).toBeNull();
    });

    it('extracts and repairs metadata from single source object', () => {
      const raw = {
        icestats: {
          admin: 'admin@promptfm.internal',
          source: {
            server_name: '   PromptFM â€” 24/7 AI Generated Music Radio   ',
            server_description: '   Continuous beats â€¦ curated by AI DJs   ',
            title: 'alextrifan - The Gypsy Witch â€” Remix',
            listeners: 12,
            bitrate: 128,
            genre: '   AI Music   ',
          },
        },
      };

      const parsed = parseIcecastStatus(raw);
      expect(parsed).toEqual({
        serverName: 'PromptFM — 24/7 AI Generated Music Radio',
        serverDescription: 'Continuous beats … curated by AI DJs',
        title: 'The Gypsy Witch — Remix',
        artist: 'alextrifan',
        listeners: 12,
        bitrate: 128,
        genre: 'AI Music',
      });
    });

    it('preserves listeners count 0 without defaulting to undefined', () => {
      const raw = {
        icestats: {
          source: {
            title: 'Test Song',
            listeners: 0,
            bitrate: 0,
          },
        },
      };

      const parsed = parseIcecastStatus(raw);
      expect(parsed?.listeners).toBe(0);
      expect(parsed?.bitrate).toBe(0);
    });

    it('handles non-string server metadata and non-number telemetry safely', () => {
      const raw = {
        icestats: {
          source: {
            title: 12345 as any,
            server_name: 100 as any,
            server_description: true as any,
            genre: {} as any,
            listeners: '10' as any,
            bitrate: '128' as any,
          },
        },
      };

      const parsed = parseIcecastStatus(raw);
      expect(parsed).toEqual({
        title: '',
        artist: undefined,
        serverName: undefined,
        serverDescription: undefined,
        genre: undefined,
        listeners: undefined,
        bitrate: undefined,
      });
    });

    it('extracts and repairs metadata when source is an array of mountpoints', () => {
      const raw = {
        icestats: {
          source: [
            {
              mount: '/stream.mp3',
              server_name: 'PromptFM â€” Primary Mount',
              title: 'Artist - Clean Title',
              listeners: 5,
            },
            {
              mount: '/fallback.mp3',
              server_name: 'PromptFM Backup',
              title: 'Fallback Ambient',
              listeners: 0,
            },
          ],
        },
      };

      const parsed = parseIcecastStatus(raw);
      expect(parsed).toEqual({
        serverName: 'PromptFM — Primary Mount',
        serverDescription: undefined,
        title: 'Clean Title',
        artist: 'Artist',
        listeners: 5,
        bitrate: undefined,
        genre: undefined,
      });
    });
  });

  describe('fetchIcecastMetadata()', () => {
    const originalFetch = globalThis.fetch;

    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('fetches status-json.xsl using default endpoint and timeout, repairs mojibake, and returns structured metadata', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        expect(url).toBe('https://stream.promptfm.live/status-json.xsl');
        return {
          ok: true,
          json: async () => ({
            icestats: {
              source: {
                server_name: 'PromptFM â€” 24/7 AI Generated Music Radio',
                title: 'alextrifan - Gypsy Witch â€” Club Mix',
                listeners: 42,
              },
            },
          }),
        } as unknown as Response;
      });

      const metadata = await fetchIcecastMetadata();
      expect(metadata).toEqual({
        serverName: 'PromptFM — 24/7 AI Generated Music Radio',
        serverDescription: undefined,
        title: 'Gypsy Witch — Club Mix',
        artist: 'alextrifan',
        listeners: 42,
        bitrate: undefined,
        genre: undefined,
      });
    });

    it('returns null when fetch returns non-ok status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({
          icestats: {
            source: {
              title: 'Should Never Be Returned On Error',
            },
          },
        }),
      } as unknown as Response);

      const metadata = await fetchIcecastMetadata('https://stream.promptfm.live/status-json.xsl');
      expect(metadata).toBeNull();
    });

    it('returns null on request timeout or network rejection', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('AbortError: The operation was aborted'));

      const metadata = await fetchIcecastMetadata('https://stream.promptfm.live/status-json.xsl', 50);
      expect(metadata).toBeNull();
    });

    it('returns null when res.json() throws a SyntaxError', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
      } as unknown as Response);

      const metadata = await fetchIcecastMetadata('https://stream.promptfm.live/status-json.xsl');
      expect(metadata).toBeNull();
    });
  });

  describe('Streamer Configuration UTF-8 Compliance', () => {
    const rootDir = path.resolve(__dirname, '../../');

    it('validates deploy/streamer/icecast.xml specifies UTF-8 charset on mountpoints and Alpine paths', () => {
      const icecastPath = path.join(rootDir, 'deploy/streamer/icecast.xml');
      expect(fs.existsSync(icecastPath)).toBe(true);
      const xml = fs.readFileSync(icecastPath, 'utf8');

      expect(xml).toContain('<charset>UTF-8</charset>');
      expect(xml).toContain('<webroot>/usr/share/icecast/web</webroot>');
      expect(xml).toContain('<changeowner>');
    });

    it('validates infra/ansible/roles/streamer/templates/icecast.xml.j2 specifies UTF-8 charset', () => {
      const templatePath = path.join(rootDir, 'infra/ansible/roles/streamer/templates/icecast.xml.j2');
      expect(fs.existsSync(templatePath)).toBe(true);
      const xml = fs.readFileSync(templatePath, 'utf8');

      expect(xml).toContain('<charset>UTF-8</charset>');
    });

    it('validates deploy/streamer/radio.liq and ansible radio.liq.j2 configure encoding="UTF-8"', () => {
      const radioLiqPath = path.join(rootDir, 'deploy/streamer/radio.liq');
      const radioJ2Path = path.join(rootDir, 'infra/ansible/roles/streamer/templates/radio.liq.j2');

      const liqContent = fs.readFileSync(radioLiqPath, 'utf8');
      const j2Content = fs.readFileSync(radioJ2Path, 'utf8');

      expect(liqContent).toMatch(/encoding\s*=\s*"UTF-8"/);
      expect(j2Content).toMatch(/encoding\s*=\s*"UTF-8"/);
    });

    it('validates docker-compose.yml routes icecast directly via entrypoint with read-only config', () => {
      const composePath = path.join(rootDir, 'deploy/streamer/docker-compose.yml');
      const composeContent = fs.readFileSync(composePath, 'utf8');

      expect(composeContent).toContain('./icecast.xml:/etc/icecast.xml');
      expect(composeContent).toMatch(/entrypoint:\s*\["icecast",\s*"-c",\s*"\/etc\/icecast\.xml"\]/);
    });

    it('validateStreamerUtf8Config() helper passes for compliant configurations and partial inputs', () => {
      const full = validateStreamerUtf8Config({
        icecastXml: '<mount><charset>UTF-8</charset></mount>',
        radioLiq: 'output.icecast(encoding="UTF-8")',
        composeYml: 'entrypoint: ["icecast", "-c", "/etc/icecast.xml"]',
      });
      expect(full.compliant).toBe(true);
      expect(full.issues).toHaveLength(0);

      const empty = validateStreamerUtf8Config({});
      expect(empty.compliant).toBe(true);
      expect(empty.issues).toHaveLength(0);

      const xmlOnly = validateStreamerUtf8Config({
        icecastXml: '<mount><charset>UTF-8</charset></mount>',
      });
      expect(xmlOnly.compliant).toBe(true);

      const liqOnly = validateStreamerUtf8Config({
        radioLiq: 'output.icecast(encoding="UTF-8")',
      });
      expect(liqOnly.compliant).toBe(true);

      const composeOnly = validateStreamerUtf8Config({
        composeYml: 'entrypoint: ["icecast", "-c", "/etc/icecast.xml"]',
      });
      expect(composeOnly.compliant).toBe(true);
    });

    it('validateStreamerUtf8Config() flags missing charset or encoding parameters individually', () => {
      const compliance = validateStreamerUtf8Config({
        icecastXml: '<mount><mount-name>/stream.mp3</mount-name></mount>',
        radioLiq: 'output.icecast(host="icecast")',
        composeYml: 'image: icecast',
      });
      expect(compliance.compliant).toBe(false);
      expect(compliance.issues).toContain('icecast_missing_utf8_charset');
      expect(compliance.issues).toContain('liquidsoap_missing_utf8_encoding');
      expect(compliance.issues).toContain('compose_missing_icecast_entrypoint');
    });
  });
});
