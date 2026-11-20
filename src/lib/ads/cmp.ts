// src/lib/ads/cmp.ts
// Google AdSense CMP (Funding Choices / IAB TCF CMP ID 300) Integration & Preference Trigger.

export type CookiePreferenceTriggerResult = 'google_cmp' | 'local_preferences';

export interface GoogleFcInterface {
  showRevocationMessage?: () => void;
  callbackQueue?: Array<() => void>;
}

declare global {
  interface Window {
    googlefc?: GoogleFcInterface;
  }
}

/**
 * Invokes Google Funding Choices CMP revocation message if available,
 * otherwise falls back to the native PromptFM Cookie Preferences modal.
 */
export function triggerCookiePreferencesOrCmp(): CookiePreferenceTriggerResult {
  if (typeof window === 'undefined') {
    return 'local_preferences';
  }

  const googlefc = window.googlefc;
  if (googlefc && typeof googlefc.showRevocationMessage === 'function') {
    try {
      googlefc.showRevocationMessage();
      return 'google_cmp';
    } catch {
      // Fallback below if CMP invocation errors
    }
  }

  window.dispatchEvent(new CustomEvent('promptfm-open-cookie-preferences'));
  return 'local_preferences';
}
