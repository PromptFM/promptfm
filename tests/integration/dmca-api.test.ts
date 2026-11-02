// tests/integration/dmca-api.test.ts
// Integration tests for POST /api/dmca statutory takedown endpoint.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/dmca/route';

const mockSubmitReport = vi.fn();
const mockQuarantine = vi.fn();

vi.mock('@/lib/safety/reports', () => ({
  submitContentReport: (...args: any[]) => mockSubmitReport(...args),
  quarantineInfringingTrack: (...args: any[]) => mockQuarantine(...args),
}));

describe('POST /api/dmca API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmitReport.mockResolvedValue({
      success: true,
      reportId: 'rep_dmca_123',
      message: 'Report received',
    });
    mockQuarantine.mockResolvedValue({
      success: true,
      trackId: 'trk_999',
      action: 'quarantined',
    });
  });

  it('accepts a fully compliant statutory DMCA notice, logs ticket, and returns 201 Created', async () => {
    const payload = {
      copyrightOwner: 'Universal Synthwave Ltd',
      claimantName: 'Jane Counsel, Esq.',
      claimantEmail: 'legal@universalsynth.com',
      workDescription: 'Original master recording "Tokyo Nights"',
      infringingIdentifier: 'trk_999',
      goodFaithStatement: true,
      perjuryStatement: true,
      signature: 'Jane Counsel',
      details: 'Unauthorized commercial reproduction on Cyberpunk station',
    };

    const req = new Request('https://promptfm.live/api/dmca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.ticketId).toBe('rep_dmca_123');
    expect(body.message).toContain('DMCA takedown notice received');

    expect(mockSubmitReport).toHaveBeenCalledWith(
      expect.objectContaining({
        target_type: 'track',
        target_id: 'trk_999',
        reason: 'copyright_dmca',
        details: [
          'Copyright Owner: Universal Synthwave Ltd',
          'Claimant: Jane Counsel, Esq. (legal@universalsynth.com)',
          'Work Claimed: Original master recording "Tokyo Nights"',
          'Infringing Material: trk_999',
          'Additional Details: Unauthorized commercial reproduction on Cyberpunk station',
          'Signed by: Jane Counsel',
        ].join('\n'),
        reporter_platform: 'web',
        reporter_id: 'legal@universalsynth.com',
      })
    );
  });

  it('accepts a notice without optional details, trims whitespace, and omits details line', async () => {
    const payload = {
      copyrightOwner: 'Synth Records',
      claimantName: 'John Lawyer',
      claimantEmail: '  john@synthrecords.com  ',
      workDescription: 'Soundtrack Track 1',
      infringingIdentifier: '  trk_trimmed_777  ',
      goodFaithStatement: true,
      perjuryStatement: true,
      signature: 'John Lawyer',
    };

    const req = new Request('https://promptfm.live/api/dmca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockSubmitReport).toHaveBeenCalledWith(
      expect.objectContaining({
        target_id: 'trk_trimmed_777',
        reporter_id: 'john@synthrecords.com',
        details: [
          'Copyright Owner: Synth Records',
          'Claimant: John Lawyer (  john@synthrecords.com  )',
          'Work Claimed: Soundtrack Track 1',
          'Infringing Material:   trk_trimmed_777  ',
          'Signed by: John Lawyer',
        ].join('\n'),
      })
    );
  });

  it('rejects an incomplete notice with 400 Bad Request and validation errors', async () => {
    const payload = {
      copyrightOwner: '',
      claimantEmail: 'invalid-email',
      goodFaithStatement: false,
    };

    const req = new Request('https://promptfm.live/api/dmca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Statutory DMCA notice requirements incomplete');
    expect(body.errors).toBeDefined();
    expect(body.errors.length).toBeGreaterThan(0);
    expect(mockSubmitReport).not.toHaveBeenCalled();
  });

  it('handles invalid JSON body with 400 Bad Request', async () => {
    const req = new Request('https://promptfm.live/api/dmca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json-string{',
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid JSON body');
  });
});
