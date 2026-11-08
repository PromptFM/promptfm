// tests/unit/channel-admin-controls.test.ts
// Unit tests for PromptFM Channel Enable/Disable Controls across Service, MCP, and CLI
// Follows TDD Red-Green-Refactor cycle for Issue #69

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import {
  OFFICIAL_CHANNELS,
  getAllChannels,
  getActiveChannels,
  isChannelActive,
  setChannelActiveOverride,
  resetChannelActiveOverrides,
  getChannelBySlug,
  type RadioChannel,
} from '@/lib/radio/channels';
import { GET as getChannelsRoute } from '@/app/api/radio/channels/route';
import { POST as mcpRoute } from '@/app/api/mcp/route';

describe('Issue #69: Channel Enable / Disable Controls', () => {
  beforeEach(() => {
    resetChannelActiveOverrides();
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: [] }),
      text: async () => 'OK',
    }) as unknown as typeof fetch;
  });

  describe('Channel Active / Disabled State in RadioChannel Service', () => {
    it('sets main channel as active and disables non-main channels by default (main-stage-only mode)', () => {
      const channels = getAllChannels();
      const main = channels.find((c) => c.slug === 'main');
      expect(main).toBeDefined();
      expect(main?.isActive).toBe(true);

      const nonMain = channels.filter((c) => c.slug !== 'main');
      expect(nonMain.length).toBeGreaterThan(0);
      for (const ch of nonMain) {
        expect(ch.isActive).toBe(false);
      }
    });

    it('returns only active channels via getActiveChannels()', () => {
      const active = getActiveChannels();
      expect(active.length).toBe(1);
      expect(active[0]?.slug).toBe('main');
      expect(active[0]?.isActive).toBe(true);
    });

    it('reports isChannelActive correctly for main and secondary channels', () => {
      expect(isChannelActive('main')).toBe(true);
      expect(isChannelActive('  main  ')).toBe(true);
      expect(isChannelActive('cyberpunk')).toBe(false);
      expect(isChannelActive('chillout')).toBe(false);
      expect(isChannelActive('kids')).toBe(false);
      expect(isChannelActive('afterdark')).toBe(false);
      expect(isChannelActive('nonexistent')).toBe(false);
      expect(isChannelActive(null)).toBe(false);
    });

    it('allows dynamically enabling and disabling channels via setChannelActiveOverride', () => {
      expect(isChannelActive('cyberpunk')).toBe(false);

      setChannelActiveOverride('  cyberpunk  ', true);
      expect(isChannelActive('cyberpunk')).toBe(true);
      expect(isChannelActive('  cyberpunk  ')).toBe(true);

      const active = getActiveChannels();
      expect(active.map((c) => c.slug)).toContain('cyberpunk');

      setChannelActiveOverride('cyberpunk', false);
      expect(isChannelActive('cyberpunk')).toBe(false);
    });

    it('falls back to main stage when resolving inactive channel with requireActive=true', () => {
      const cyberInactive = getChannelBySlug('cyberpunk', true);
      expect(cyberInactive.slug).toBe('main');

      setChannelActiveOverride('cyberpunk', true);
      const cyberActive = getChannelBySlug('cyberpunk', true);
      expect(cyberActive.slug).toBe('cyberpunk');
    });
  });

  describe('Public /api/radio/channels Discovery Endpoint', () => {
    it('returns all channels with their is_active status where only main is active by default', async () => {
      const req = new NextRequest('http://localhost:3000/api/radio/channels');
      const res = await getChannelsRoute(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.channels.length).toBe(5);

      const main = data.channels.find((c: any) => c.slug === 'main');
      expect(main.is_active).toBe(true);

      const cyber = data.channels.find((c: any) => c.slug === 'cyberpunk');
      expect(cyber.is_active).toBe(false);
    });

    it('filters to only active channels when ?active=true is requested', async () => {
      const req = new NextRequest('http://localhost:3000/api/radio/channels?active=true');
      const res = await getChannelsRoute(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      const slugs = data.channels.map((c: any) => c.slug);
      expect(slugs).toEqual(['main']);
      expect(data.channels[0].is_active).toBe(true);
    });
  });

  describe('MCP Admin Channel Enable / Disable Tools', () => {
    it('includes is_active on every channel in promptfm_admin_list_channels', async () => {
      const req = new NextRequest('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'test-mcp-list-active',
          method: 'tools/call',
          params: {
            name: 'promptfm_admin_list_channels',
            arguments: {},
          },
        }),
      });

      const res = await mcpRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      const data = JSON.parse(json.result.content[0].text);

      expect(data.success).toBe(true);
      expect(Array.isArray(data.channels)).toBe(true);

      const main = data.channels.find((c: any) => c.slug === 'main');
      expect(main).toBeDefined();
      expect(main.is_active).toBe(true);

      const cyber = data.channels.find((c: any) => c.slug === 'cyberpunk');
      expect(cyber).toBeDefined();
      expect(cyber.is_active).toBe(false);
    });

    it('enables and disables channels via promptfm_admin_set_channel_status', async () => {
      const reqEnable = new NextRequest('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'test-mcp-enable-ch',
          method: 'tools/call',
          params: {
            name: 'promptfm_admin_set_channel_status',
            arguments: {
              slug: 'cyberpunk',
              is_active: true,
            },
          },
        }),
      });

      const resEnable = await mcpRoute(reqEnable);
      expect(resEnable.status).toBe(200);
      const jsonEnable = await resEnable.json();
      const dataEnable = JSON.parse(jsonEnable.result.content[0].text);

      expect(dataEnable.success).toBe(true);
      expect(dataEnable.slug).toBe('cyberpunk');
      expect(dataEnable.is_active).toBe(true);
      expect(dataEnable.message).toContain('enabled');

      const reqDisable = new NextRequest('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'test-mcp-disable-ch',
          method: 'tools/call',
          params: {
            name: 'promptfm_admin_set_channel_status',
            arguments: {
              slug: 'cyberpunk',
              is_active: false,
            },
          },
        }),
      });

      const resDisable = await mcpRoute(reqDisable);
      expect(resDisable.status).toBe(200);
      const jsonDisable = await resDisable.json();
      const dataDisable = JSON.parse(jsonDisable.result.content[0].text);

      expect(dataDisable.success).toBe(true);
      expect(dataDisable.slug).toBe('cyberpunk');
      expect(dataDisable.is_active).toBe(false);
      expect(dataDisable.message).toContain('disabled');
    });

    it('toggles channel status via promptfm_admin_toggle_channel', async () => {
      const reqToggle = new NextRequest('http://localhost:3000/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'test-mcp-toggle-ch',
          method: 'tools/call',
          params: {
            name: 'promptfm_admin_toggle_channel',
            arguments: {
              slug: 'kids',
            },
          },
        }),
      });

      const resToggle = await mcpRoute(reqToggle);
      expect(resToggle.status).toBe(200);
      const jsonToggle = await resToggle.json();
      const dataToggle = JSON.parse(jsonToggle.result.content[0].text);

      expect(dataToggle.success).toBe(true);
      expect(dataToggle.slug).toBe('kids');
      expect(dataToggle.is_active).toBe(true);
    });
  });

  describe('CLI Admin Channel Commands State & Guardrails', () => {
    it('sets and clears active state when enabling and disabling channels', () => {
      expect(isChannelActive('cyberpunk')).toBe(false);

      setChannelActiveOverride('cyberpunk', true);
      expect(isChannelActive('cyberpunk')).toBe(true);
      expect(getActiveChannels().some((c) => c.slug === 'cyberpunk')).toBe(true);

      setChannelActiveOverride('cyberpunk', false);
      expect(isChannelActive('cyberpunk')).toBe(false);
      expect(getActiveChannels().some((c) => c.slug === 'cyberpunk')).toBe(false);
    });

    it('retains main stage active status when other channels are toggled', () => {
      expect(isChannelActive('main')).toBe(true);
      setChannelActiveOverride('chillout', true);
      expect(isChannelActive('main')).toBe(true);
      expect(isChannelActive('chillout')).toBe(true);

      setChannelActiveOverride('chillout', false);
      expect(isChannelActive('main')).toBe(true);
      expect(isChannelActive('chillout')).toBe(false);
    });
  });
});
