// tests/unit/adsense-compliance.test.ts
// Unit tests for Google AdSense Publisher Privacy Compliance, Cookie Consent, and Legal Disclosures

import { describe, it, expect } from 'vitest';
import {
  ADSENSE_PRIVACY_DISCLOSURE,
  COOKIE_CONSENT_POLICY,
  resolveCookieConsent,
  allowsPersonalizedAds,
  type CookieConsentChoice,
} from '@/lib/legal/policies';

describe('Google AdSense Legal & Privacy Compliance Specification', () => {
  describe('Mandatory Google AdSense Privacy Policy Disclosures', () => {
    it('contains explicit third-party vendor and Google cookie disclosure', () => {
      expect(ADSENSE_PRIVACY_DISCLOSURE.thirdPartyVendorNotice).toContain(
        'Third party vendors, including Google, use cookies'
      );
      expect(ADSENSE_PRIVACY_DISCLOSURE.advertisingCookieNotice).toContain(
        'Google\'s use of advertising cookies enables it and its partners to serve ads'
      );
    });

    it('contains direct user opt-out links for personalized advertising', () => {
      expect(ADSENSE_PRIVACY_DISCLOSURE.optOutLinks.googleAdsSettings).toBe(
        'https://www.google.com/settings/ads'
      );
      expect(ADSENSE_PRIVACY_DISCLOSURE.optOutLinks.aboutAds).toBe(
        'https://www.aboutads.info/choices/'
      );
      expect(ADSENSE_PRIVACY_DISCLOSURE.optOutLinks.yourOnlineChoices).toBe(
        'https://www.youronlinechoices.com'
      );
    });

    it('references verified AdSense publisher client ID ca-pub-7299057534028491', () => {
      expect(ADSENSE_PRIVACY_DISCLOSURE.publisherClientId).toBe('ca-pub-7299057534028491');
      expect(ADSENSE_PRIVACY_DISCLOSURE.summaryText).toContain('ca-pub-7299057534028491');
    });

    it('includes CCPA / CPRA Do Not Sell or Share Personal Information disclosure', () => {
      expect(ADSENSE_PRIVACY_DISCLOSURE.ccpaNotice).toContain(
        'Do Not Sell or Share My Personal Information'
      );
      expect(ADSENSE_PRIVACY_DISCLOSURE.ccpaNotice).toContain('California Consumer Privacy Act');
    });

    it('includes GDPR & European User Consent compliance terms', () => {
      expect(ADSENSE_PRIVACY_DISCLOSURE.gdprNotice).toContain('European Economic Area');
      expect(ADSENSE_PRIVACY_DISCLOSURE.gdprNotice).toContain('consent');
    });
  });

  describe('Cookie Consent Resolution & Personalization Gates', () => {
    it('defines cookie categories and local storage keys', () => {
      expect(COOKIE_CONSENT_POLICY.storageKey).toBe('promptfm_cookie_consent');
      expect(COOKIE_CONSENT_POLICY.categories.essential.name).toBe('Strictly Necessary & Functional');
      expect(COOKIE_CONSENT_POLICY.categories.essential.description).toContain('core radio stream playback');
      expect(COOKIE_CONSENT_POLICY.categories.essential.examples).toEqual([
        'active_channel',
        'player_volume',
        'promptfm_age_verified_18',
        'promptfm_cookie_consent',
      ]);

      expect(COOKIE_CONSENT_POLICY.categories.advertising.name).toBe('Advertising & Measurement');
      expect(COOKIE_CONSENT_POLICY.categories.advertising.description).toContain('Google AdSense');
      expect(COOKIE_CONSENT_POLICY.categories.advertising.examples).toEqual([
        '__gads',
        '__gpi',
        'IDE',
        'test_cookie',
      ]);
    });

    it('resolves valid consent choices correctly', () => {
      expect(resolveCookieConsent('accepted')).toBe('accepted');
      expect(resolveCookieConsent('essential_only')).toBe('essential_only');
      expect(resolveCookieConsent(null)).toBe('unset');
      expect(resolveCookieConsent(undefined)).toBe('unset');
      expect(resolveCookieConsent('invalid_string')).toBe('unset');
    });

    it('correctly gates personalized advertising based on consent state', () => {
      expect(allowsPersonalizedAds('accepted')).toBe(true);
      expect(allowsPersonalizedAds('essential_only')).toBe(false);
      expect(allowsPersonalizedAds('unset')).toBe(false);
    });
  });
});
