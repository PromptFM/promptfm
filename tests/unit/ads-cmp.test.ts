import { describe, it, expect, vi, afterEach } from 'vitest';
import { triggerCookiePreferencesOrCmp } from '@/lib/ads/cmp';

describe('Google CMP & Cookie Preferences Trigger (Issue #272)', () => {
  const originalWindow = (globalThis as any).window;

  afterEach(() => {
    (globalThis as any).window = originalWindow;
  });

  it('returns local_preferences when window is undefined (SSR)', () => {
    (globalThis as any).window = undefined;
    expect(triggerCookiePreferencesOrCmp()).toBe('local_preferences');
  });

  it('invokes googlefc.showRevocationMessage when Google CMP is present in window', () => {
    const showRevocationMock = vi.fn();
    (globalThis as any).window = {
      googlefc: {
        showRevocationMessage: showRevocationMock,
      },
      dispatchEvent: vi.fn(),
    };

    const result = triggerCookiePreferencesOrCmp();
    expect(result).toBe('google_cmp');
    expect(showRevocationMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to dispatching promptfm-open-cookie-preferences event when googlefc is not loaded', () => {
    const dispatchMock = vi.fn();
    (globalThis as any).window = {
      dispatchEvent: dispatchMock,
    };

    const result = triggerCookiePreferencesOrCmp();
    expect(result).toBe('local_preferences');
    expect(dispatchMock).toHaveBeenCalledTimes(1);
    const eventArg = dispatchMock.mock.calls[0]?.[0] as CustomEvent;
    expect(eventArg.type).toBe('promptfm-open-cookie-preferences');
  });

  it('falls back to dispatching promptfm-open-cookie-preferences when showRevocationMessage is not a function', () => {
    const dispatchMock = vi.fn();
    (globalThis as any).window = {
      googlefc: {
        showRevocationMessage: 'not-a-function',
      },
      dispatchEvent: dispatchMock,
    };

    const result = triggerCookiePreferencesOrCmp();
    expect(result).toBe('local_preferences');
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to dispatching promptfm-open-cookie-preferences when showRevocationMessage is undefined on googlefc', () => {
    const dispatchMock = vi.fn();
    (globalThis as any).window = {
      googlefc: {
        showRevocationMessage: undefined,
      },
      dispatchEvent: dispatchMock,
    };

    const result = triggerCookiePreferencesOrCmp();
    expect(result).toBe('local_preferences');
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to local_preferences when window.googlefc is explicitly undefined', () => {
    const dispatchMock = vi.fn();
    (globalThis as any).window = {
      googlefc: undefined,
      dispatchEvent: dispatchMock,
    };

    const result = triggerCookiePreferencesOrCmp();
    expect(result).toBe('local_preferences');
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to dispatching promptfm-open-cookie-preferences if showRevocationMessage throws', () => {
    const dispatchMock = vi.fn();
    (globalThis as any).window = {
      googlefc: {
        showRevocationMessage: () => {
          throw new Error('CMP not ready');
        },
      },
      dispatchEvent: dispatchMock,
    };

    const result = triggerCookiePreferencesOrCmp();
    expect(result).toBe('local_preferences');
    expect(dispatchMock).toHaveBeenCalledTimes(1);
  });
});
