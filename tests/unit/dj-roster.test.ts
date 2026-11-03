// tests/unit/dj-roster.test.ts
// Unit tests for PromptFM DJ Roster, Channel Restrictions & Parental Controls

import { describe, it, expect } from 'vitest';
import {
  getAllDJs,
  getDJById,
  getActiveDJ,
  getAdsConfig,
  getActiveAdSpot,
  getParentalControlConfig,
  isContentAllowedForAirplay,
} from '@/lib/dj/roster';

describe('DJ Roster & Parental Control Service', () => {
  describe('getAllDJs & getDJById', () => {
    it('returns default DJs with required voice settings', () => {
      const djs = getAllDJs();
      expect(djs.length).toBeGreaterThanOrEqual(4);

      const neon = getDJById('dj_neon');
      expect(neon.name).toBe('DJ Neon');
      expect(neon.voice.ssmlGender).toBe('FEMALE');

      const luna = getDJById('dj_luna');
      expect(luna.name).toBe('DJ Luna');
      expect(luna.voice.ssmlGender).toBe('MALE');

      const pixel = getDJById('dj_pixel');
      expect(pixel.name).toBe('DJ Pixel');

      const cipher = getDJById('dj_cipher');
      expect(cipher.name).toBe('DJ Cipher');
    });

    it('finds DJ by partial name or falls back gracefully', () => {
      expect(getDJById('neon').id).toBe('dj_neon');
      expect(getDJById('unknown_dj_id').id).toBeTruthy();
      expect(getDJById(undefined).id).toBeTruthy();
    });
  });

  describe('getActiveDJ', () => {
    it('maps specific channel slugs to their dedicated DJ', () => {
      expect(getActiveDJ('kids').id).toBe('dj_pixel');
      expect(getActiveDJ('chillout').id).toBe('dj_luna');
      expect(getActiveDJ('cyberpunk').id).toBe('dj_cipher');
      expect(getActiveDJ('main').id).toBe('dj_neon');
    });

    it('rotates by UTC time for non-channel requests', () => {
      // 08:00 UTC -> Morning (DJ Neon)
      const morningDate = new Date('2026-11-03T08:00:00Z');
      expect(getActiveDJ(undefined, morningDate).id).toBe('dj_neon');

      // 12:00 UTC -> Ambient/Deep Focus (DJ Luna)
      const middayDate = new Date('2026-11-03T12:00:00Z');
      expect(getActiveDJ(undefined, middayDate).id).toBe('dj_luna');

      // 18:00 UTC -> Countdown (DJ Vance)
      const countdownDate = new Date('2026-11-03T18:00:00Z');
      expect(getActiveDJ(undefined, countdownDate).id).toBe('dj_vance');

      // 23:00 UTC -> Night Shift (DJ Cipher)
      const nightDate = new Date('2026-11-03T23:00:00Z');
      expect(getActiveDJ(undefined, nightDate).id).toBe('dj_cipher');
    });
  });

  describe('getParentalControlConfig', () => {
    it('returns defaults including safeChannels kids and chillout', () => {
      const pc = getParentalControlConfig();
      expect(pc.enabled).toBe(true);
      expect(pc.safeChannels).toContain('kids');
      expect(pc.safeChannels).toContain('chillout');
      expect(pc.lateNightStartUtc).toBe(22);
      expect(pc.lateNightEndUtc).toBe(6);
    });
  });

  describe('isContentAllowedForAirplay', () => {
    const dayDate = new Date('2026-11-03T14:00:00Z'); // 14:00 UTC (daytime)
    const lateNightDate1 = new Date('2026-11-03T23:00:00Z'); // 23:00 UTC (late night)
    const lateNightDate2 = new Date('2026-11-03T03:00:00Z'); // 03:00 UTC (late night)

    it('allows clean tracks on all channels by default', () => {
      expect(isContentAllowedForAirplay(false, 'main', dayDate)).toBe(true);
      expect(isContentAllowedForAirplay(false, 'cyberpunk', dayDate)).toBe(true);
      expect(isContentAllowedForAirplay(false, 'chillout', dayDate)).toBe(true);
      expect(isContentAllowedForAirplay(false, 'kids', dayDate, true)).toBe(true);
    });

    it('blocks explicit tracks on safe channels (kids and chillout) 24/7 even during late night', () => {
      expect(isContentAllowedForAirplay(true, 'kids', dayDate)).toBe(false);
      expect(isContentAllowedForAirplay(true, 'kids', lateNightDate1)).toBe(false);
      expect(isContentAllowedForAirplay(true, 'chillout', dayDate)).toBe(false);
      expect(isContentAllowedForAirplay(true, 'chillout', lateNightDate2)).toBe(false);
    });

    it('blocks explicit tracks during daytime on main and cyberpunk channels', () => {
      expect(isContentAllowedForAirplay(true, 'main', dayDate)).toBe(false);
      expect(isContentAllowedForAirplay(true, 'cyberpunk', dayDate)).toBe(false);
    });

    it('permits explicit tracks during late night watershed (22:00-06:00 UTC) on main and cyberpunk', () => {
      expect(isContentAllowedForAirplay(true, 'main', lateNightDate1)).toBe(true);
      expect(isContentAllowedForAirplay(true, 'main', lateNightDate2)).toBe(true);
      expect(isContentAllowedForAirplay(true, 'cyberpunk', lateNightDate1)).toBe(true);
      expect(isContentAllowedForAirplay(true, 'cyberpunk', lateNightDate2)).toBe(true);
    });

    it('enforces family_friendly requirement strictly for Channel 4 (kids)', () => {
      // Clean tracks with family_friendly: true can air on kids
      expect(isContentAllowedForAirplay(false, 'kids', dayDate, true)).toBe(true);

      // Clean tracks with family_friendly: false CANNOT air on kids
      expect(isContentAllowedForAirplay(false, 'kids', dayDate, false)).toBe(false);
    });
  });

  describe('getAdsConfig & getActiveAdSpot', () => {
    it('returns ad configuration and chooses an active ad spot', () => {
      const ads = getAdsConfig();
      expect(ads.enabled).toBe(true);
      expect(ads.spots.length).toBeGreaterThan(0);

      const spot = getActiveAdSpot();
      expect(spot).not.toBeNull();
      expect(spot?.sponsor).toBeTruthy();
    });
  });
});
