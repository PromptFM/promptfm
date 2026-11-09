import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Bitrate and listener-capacity policy for the Oracle Always Free stream.
//  - nothing we encode or send goes above 128 kbps
//  - spoken word (news, podcasts, announcements) is 64 kbps wherever we own the encoder
//  - Icecast caps concurrent listeners so the worst case stays under Oracle's 10 TB/month outbound allowance
describe('Bitrate and listener capacity policy', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const streamerDir = path.join(rootDir, 'deploy/streamer');
  const read = (rel: string) => fs.readFileSync(path.join(rootDir, rel), 'utf8');

  const MAX_KBPS = 128;
  const TALK_KBPS = 64;
  const FREE_OUTBOUND_BYTES = 10 * 1e12;
  const WORST_MONTH_SECONDS = 31 * 24 * 3600;

  const liqFiles = fs.readdirSync(streamerDir).filter((f) => f.endsWith('.liq'));

  describe('Liquidsoap outputs', () => {
    it('finds the streamer scripts', () => {
      expect(liqFiles).toEqual(expect.arrayContaining(['radio.liq', 'radio-standby.liq']));
    });

    it.each(liqFiles)('%s never encodes above 128 kbps', (file) => {
      const src = fs.readFileSync(path.join(streamerDir, file), 'utf8');
      const rates = [...src.matchAll(/%mp3\(\s*bitrate\s*=\s*(\d+)/g)].map((m) => Number(m[1]));
      expect(rates.length).toBeGreaterThan(0);
      for (const kbps of rates) expect(kbps).toBeLessThanOrEqual(MAX_KBPS);
    });

    it.each(liqFiles)('%s encodes any news, podcast, talk or announcement mount at 64 kbps or less', (file) => {
      const src = fs.readFileSync(path.join(streamerDir, file), 'utf8');
      const outputs = src.split('output.icecast(').slice(1);
      for (const block of outputs) {
        const mount = block.match(/mount\s*=\s*"([^"]+)"/)?.[1] ?? '';
        if (!/news|podcast|talk|announce/i.test(mount)) continue;
        const kbps = Number(block.match(/%mp3\(\s*bitrate\s*=\s*(\d+)/)?.[1]);
        expect(kbps, `${file} ${mount}`).toBeLessThanOrEqual(TALK_KBPS);
      }
    });
  });

  describe('YouTube / TikTok video feed', () => {
    it('sends audio at 128 kbps or less', () => {
      const js = read('deploy/streamer/controller.js');
      const kbps = Number(js.match(/'-b:a',\s*'(\d+)k'/)?.[1]);
      expect(kbps).toBeGreaterThan(0);
      expect(kbps).toBeLessThanOrEqual(MAX_KBPS);
    });
  });

  describe('Icecast listener cap', () => {
    const xml = read('deploy/streamer/icecast.xml');
    const mountBlock = xml.match(/<mount type="normal">[\s\S]*?<\/mount>/)?.[0] ?? '';
    const maxListeners = Number(mountBlock.match(/<max-listeners>(\d+)<\/max-listeners>/)?.[1]);
    const clients = Number(xml.match(/<clients>(\d+)<\/clients>/)?.[1]);

    it('limits /stream.mp3 listeners', () => {
      expect(mountBlock).toContain('/stream.mp3');
      expect(maxListeners).toBeGreaterThan(0);
    });

    it('keeps worst-case outbound traffic under 10 TB even in a 31-day month with every slot full', () => {
      const bytesPerListener = (MAX_KBPS * 1000 * WORST_MONTH_SECONDS) / 8;
      expect(maxListeners * bytesPerListener).toBeLessThan(FREE_OUTBOUND_BYTES);
    });

    it('leaves room in the total connection limit for the source, the admin page and status polls', () => {
      expect(clients).toBeGreaterThan(maxListeners);
      expect(clients).toBeLessThanOrEqual(maxListeners + 20);
    });
  });

  describe('documentation', () => {
    const doc = read('docs/oracle-always-free-streamer.md');

    it('documents the 128 kbps ceiling, the 64 kbps spoken-word rate and the listener math', () => {
      expect(doc).toContain('## Bitrate and listener capacity');
      expect(doc).toContain('128 kbps');
      expect(doc).toContain('64 kbps');
      expect(doc).toMatch(/about 240 listeners/i);
      expect(doc).toContain('max-listeners');
    });
  });
});
