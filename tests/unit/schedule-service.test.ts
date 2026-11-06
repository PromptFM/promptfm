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
    expect(morningSchedule.current_show?.show).toBe('Morning Beats & Sunrise Synth');
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

  it('resolves hourly clock milestones within each block as 100% pure music', () => {
    const schedule = getStationSchedule('main');
    const firstBlock = schedule.blocks[0] as ScheduleBlock;

    expect(firstBlock.clock_milestones).toBeDefined();
    expect(firstBlock.clock_milestones.length).toBe(4);

    expect(firstBlock.clock_milestones[0]).toEqual({
      minute: 0,
      title: 'Hourly Community Top 40 Countdown',
      type: 'music',
      icon: 'Radio',
      description: 'Top upvoted community AI music productions headlining the hour.',
    });
    expect(firstBlock.clock_milestones[1]).toEqual({
      minute: 15,
      title: 'Deep Cut & Indie AI Showcase',
      type: 'music',
      icon: 'Sparkles',
      description: 'Hidden gems, new releases, and undiscovered community creations.',
    });
    expect(firstBlock.clock_milestones[2]).toEqual({
      minute: 30,
      title: 'Mid-Hour Rhythm & Vibe Transition',
      type: 'music',
      icon: 'Music',
      description: 'Fresh instrumental beats and tempo shifts keeping the flow uninterrupted.',
    });
    expect(firstBlock.clock_milestones[3]).toEqual({
      minute: 45,
      title: 'Listener Requested Airplay Block',
      type: 'music',
      icon: 'Headphones',
      description: 'Community queue picks and listener favorite tracks streamed back-to-back.',
    });

    const types = firstBlock.clock_milestones.map((m) => m.type);
    expect(types.every((t) => t === 'music')).toBe(true);
    expect(types).not.toContain('news');
    expect(types).not.toContain('weather');
    expect(types).not.toContain('dj_banter');

    const minutes = firstBlock.clock_milestones.map((m) => m.minute);
    expect(minutes).toEqual([0, 15, 30, 45]);
  });

  it('orders upcoming_shows correctly following current live show', () => {
    const morningDate = new Date('2026-11-03T08:30:00Z'); // index 0
    const schedule = getStationSchedule('main', morningDate);
    expect(schedule.upcoming_shows.length).toBe(schedule.blocks.length - 1);
    expect(schedule.upcoming_shows[0]?.id).toBe('main-deep-focus');
    expect(schedule.upcoming_shows[1]?.id).toBe('main-cyberpunk-rush');
    expect(schedule.upcoming_shows[2]?.id).toBe('main-night-shift');
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

  it('validates isHourInBlock edge boundaries and wrap conditions', async () => {
    const { isHourInBlock } = await import('@/lib/radio/schedule');
    // Equal start and end
    expect(isHourInBlock(12, 10, 10)).toBe(true);

    // Standard range [6, 10)
    expect(isHourInBlock(6, 6, 10)).toBe(true);
    expect(isHourInBlock(9, 6, 10)).toBe(true);
    expect(isHourInBlock(10, 6, 10)).toBe(false);
    expect(isHourInBlock(5, 6, 10)).toBe(false);

    // Midnight wrap [20, 6)
    expect(isHourInBlock(20, 20, 6)).toBe(true);
    expect(isHourInBlock(23, 20, 6)).toBe(true);
    expect(isHourInBlock(0, 20, 6)).toBe(true);
    expect(isHourInBlock(5, 20, 6)).toBe(true);
    expect(isHourInBlock(6, 20, 6)).toBe(false);
    expect(isHourInBlock(12, 20, 6)).toBe(false);
    expect(isHourInBlock(19, 20, 6)).toBe(false);
  });

  it('provides specialized schedule blocks for afterdark channel and fallback for unknown channels', () => {
    const afterdark = getStationSchedule('afterdark');
    expect(afterdark.channel.slug).toBe('afterdark');
    expect(afterdark.blocks.length).toBeGreaterThan(0);
    expect(afterdark.current_show).toBeDefined();

    // Unknown channel fallback defaults to main
    const fallbackSchedule = getStationSchedule('unknown-channel-slug');
    expect(fallbackSchedule.channel.slug).toBe('main');
    expect(fallbackSchedule.blocks.length).toBeGreaterThanOrEqual(4);
  });
});

