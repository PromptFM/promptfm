// tests/unit/schedule-service.test.ts
import { describe, it, expect } from 'vitest';
import {
  getStationSchedule,
  getAllChannelsSchedule,
  getScheduleBlockForHour,
  ScheduleBlock,
} from '@/lib/radio/schedule';

describe('Station 24/7 Schedule Service', () => {
  it('returns full 24-hour programming blocks for main stage', () => {
    const schedule = getStationSchedule('main');

    expect(schedule).toBeDefined();
    expect(schedule.channel.slug).toBe('main');
    expect(schedule.blocks.length).toBeGreaterThanOrEqual(4);

    const blockTimes = schedule.blocks.map((b) => b.time_utc);
    expect(blockTimes).toContain('06:00 - 10:00 UTC');
    expect(blockTimes).toContain('10:00 - 15:00 UTC');
    expect(blockTimes).toContain('15:00 - 20:00 UTC');
    expect(blockTimes).toContain('20:00 - 06:00 UTC');
  });

  it('correctly flags the currently live show block based on UTC hour', () => {
    // 08:30 UTC -> Morning Beats (DJ Neon)
    const morningDate = new Date('2026-11-03T08:30:00Z');
    const morningSchedule = getStationSchedule('main', morningDate);
    expect(morningSchedule.current_show).toBeDefined();
    expect(morningSchedule.current_show?.show).toBe('Morning Beats & AI Briefings');
    expect(morningSchedule.current_show?.is_live).toBe(true);

    // 13:00 UTC -> Deep Focus (DJ Luna)
    const noonDate = new Date('2026-11-03T13:00:00Z');
    const noonSchedule = getStationSchedule('main', noonDate);
    expect(noonSchedule.current_show?.show).toBe('Deep Focus & Generative Ambient');
    expect(noonSchedule.current_show?.dj.name).toBe('DJ Luna');

    // 23:00 UTC -> Night Shift (DJ Cipher)
    const nightDate = new Date('2026-11-03T23:00:00Z');
    const nightSchedule = getStationSchedule('main', nightDate);
    expect(nightSchedule.current_show?.show).toBe('Night Shift: Experimental & Free Requests');
    expect(nightSchedule.current_show?.dj.name).toBe('DJ Cipher');
  });

  it('resolves hourly clock milestones within each block', () => {
    const schedule = getStationSchedule('main');
    const firstBlock = schedule.blocks[0] as ScheduleBlock;

    expect(firstBlock.clock_milestones).toBeDefined();
    expect(firstBlock.clock_milestones.length).toBeGreaterThanOrEqual(3);

    const minutes = firstBlock.clock_milestones.map((m) => m.minute);
    expect(minutes).toContain(0);
    expect(minutes).toContain(15);
    expect(minutes).toContain(20);
  });

  it('provides specialized channel schedules for Cyberpunk, Chillout, and Kids', () => {
    const cyberpunkSchedule = getStationSchedule('cyberpunk');
    expect(cyberpunkSchedule.channel.slug).toBe('cyberpunk');
    expect(cyberpunkSchedule.blocks.length).toBeGreaterThan(0);

    const kidsSchedule = getStationSchedule('kids');
    expect(kidsSchedule.channel.slug).toBe('kids');
    expect(kidsSchedule.channel.name).toContain('Kids');

    const chilloutSchedule = getStationSchedule('chillout');
    expect(chilloutSchedule.channel.slug).toBe('chillout');
  });

  it('returns schedules across all channels with getAllChannelsSchedule', () => {
    const all = getAllChannelsSchedule();
    expect(all.length).toBeGreaterThanOrEqual(4);
    const slugs = all.map((c) => c.channel.slug);
    expect(slugs).toContain('main');
    expect(slugs).toContain('cyberpunk');
    expect(slugs).toContain('kids');
    expect(slugs).toContain('chillout');
  });

  it('getScheduleBlockForHour matches correctly wrapping midnight', () => {
    // 02:00 UTC wraps across 20:00 - 06:00
    const block = getScheduleBlockForHour(2, 'main');
    expect(block).toBeDefined();
    expect(block?.time_utc).toBe('20:00 - 06:00 UTC');
    expect(block?.dj.id).toBe('dj_cipher');
  });
});

