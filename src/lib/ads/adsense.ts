// src/lib/ads/adsense.ts
// Google AdSense and IAB ads.txt configuration for PromptFM.

export const ADSENSE_CLIENT_ID = 'ca-pub-7299057534028491';
export const ADSENSE_PUBLISHER_ID = 'pub-7299057534028491';
export const GOOGLE_TAG_CERT_AUTHORITY = 'f08c47fec0942fa0';

/**
 * Generates an IAB-compliant ads.txt file string containing
 * the verified Google AdSense authorization record.
 */
export function generateAdsTxt(additionalLines: string[] = []): string {
  const lines: string[] = [
    '# PromptFM Authorized Digital Sellers (ads.txt)',
    '# Domain: promptfm.live',
    '# Contact: contact@promptfm.live',
    `google.com, ${ADSENSE_PUBLISHER_ID}, DIRECT, ${GOOGLE_TAG_CERT_AUTHORITY}`,
    ...additionalLines,
  ];

  return lines.join('\n') + '\n';
}

/**
 * Validates whether the given string contains the required Google AdSense publisher entry.
 */
export function validateAdsTxtContent(content: string): boolean {
  if (!content || !content.trim()) return false;
  const expectedEntry = `google.com, ${ADSENSE_PUBLISHER_ID}, DIRECT, ${GOOGLE_TAG_CERT_AUTHORITY}`;
  return content.includes(expectedEntry);
}

