// tests/unit/audio-player-a11y.test.ts
// Unit & accessibility tests for AudioPlayer mobile progress bar, elapsed/total time, and a11y ARIA semantics

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import AudioPlayer, { AudioPlayerProps } from '@/components/AudioPlayer';

describe('AudioPlayer Accessibility & Mobile Progress (Issue #87)', () => {
  it('renders an accessible progressbar with ARIA attributes and proper roles', () => {
    const html = renderToString(React.createElement(AudioPlayer));

    // Progressbar should have role="progressbar"
    expect(html).toContain('role="progressbar"');

    // Should have aria-label describing playback progress
    expect(html).toContain('aria-label="Playback progress"');

    // Should have valid ARIA bounds
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
    expect(html).toMatch(/aria-valuenow="\d+"/);
    expect(html).toMatch(/aria-valuetext="[\d:]+\s+of\s+[\d:]+"/);
  });

  it('renders elapsed and total time visible on mobile without hidden sm:inline-flex restriction', () => {
    const html = renderToString(React.createElement<AudioPlayerProps>(AudioPlayer, {
      initialNowPlaying: { id: 'track-1', title: 'Solar Echoes', artist: 'Neon DJ' }
    }));

    // Must NOT hide the time chip on mobile with "hidden sm:inline-flex"
    const timeElementMatch = html.match(
      /<span[^>]*(?:class="([^"]*)"[^>]*aria-label="Playback time:[^"]*"|aria-label="Playback time:[^"]*"[^>]*class="([^"]*)")/
    );
    expect(timeElementMatch).toBeTruthy();
    const classes = timeElementMatch![1] || timeElementMatch![2] || '';
    expect(classes).not.toContain('hidden');
    expect(classes).toContain('inline-flex');
    expect(html).toContain('0:00');
    expect(html).toContain('3:00');
  });

  it('provides accessible ARIA label on the playback time display when on air', () => {
    const html = renderToString(React.createElement<AudioPlayerProps>(AudioPlayer, {
      initialNowPlaying: { id: 'track-1', title: 'Solar Echoes', artist: 'Neon DJ' }
    }));

    // The time display should have an accessible label for screen readers
    expect(html).toContain('aria-label="Playback time: 0:00 of 3:00"');
  });

  it('renders a mobile-visible progress bar treatment for small screens / iPhone', () => {
    const html = renderToString(React.createElement<AudioPlayerProps>(AudioPlayer, {
      initialNowPlaying: { id: 'track-1', title: 'Solar Echoes', artist: 'Neon DJ' }
    }));

    // Progress bar must have visible height on mobile (at least 3px or h-1)
    expect(html).toMatch(/h-\[3px\]|h-1/);

    // Mobile-only inline playback progress indicator should be rendered for small screens
    expect(html).toContain('sm:hidden');
  });
});
