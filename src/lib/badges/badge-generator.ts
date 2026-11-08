// src/lib/badges/badge-generator.ts
// Programmatic SVG badge generator for GitHub READMEs, dashboards, and live API endpoints.
// Produces 100% resilient, self-contained SVG badges matching Shields.io 'for-the-badge' standard.

export interface BadgeOptions {
  label: string;
  message: string;
  color: string;
  labelColor?: string;
  logo?: string;
  style?: 'for-the-badge' | 'flat';
}

function toBase64Svg(svgInner: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svgInner).toString('base64')}`;
}

export const BUILTIN_LOGOS: Record<string, string> = {
  vercel: toBase64Svg(
    '<svg fill="white" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Vercel</title><path d="m12 1.608 12 20.784H0Z"/></svg>'
  ),
  googlecloud: toBase64Svg(
    '<svg fill="white" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Google Cloud</title><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>'
  ),
  vitest: toBase64Svg(
    '<svg fill="white" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Vitest</title><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
  ),
};

export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function generateBadgeSvg(options: BadgeOptions): string {
  const {
    label,
    message,
    color,
    labelColor = '#555',
    logo,
  } = options;

  const upperLabel = label.toUpperCase();
  const upperMessage = message.toUpperCase();

  // Resolve logo URI if builtin or passed as data URI
  let logoUri: string | undefined = undefined;
  if (logo) {
    logoUri = BUILTIN_LOGOS[logo.toLowerCase()] || logo;
  }

  const hasLogo = Boolean(logoUri);

  // Approximate character width in Verdana 10px uppercase (~7.4px avg per char)
  const charWidth = 7.4;
  const labelTextLength = Math.max(1, Math.round(upperLabel.length * charWidth * 10));
  const messageTextLength = Math.max(1, Math.round(upperMessage.length * charWidth * 10));

  const logoSpacing = hasLogo ? 24 : 0;
  const labelWidth = Math.round(labelTextLength / 10 + 20 + logoSpacing);
  const messageWidth = Math.round(messageTextLength / 10 + 24);
  const totalWidth = labelWidth + messageWidth;

  const labelCenterX = Math.round((logoSpacing + (labelWidth - logoSpacing) / 2) * 10);
  const messageCenterX = Math.round((labelWidth + messageWidth / 2) * 10);

  const escapedLabel = escapeXml(upperLabel);
  const escapedMessage = escapeXml(upperMessage);
  const ariaLabel = `${escapedLabel}: ${escapedMessage}`;

  const logoElement = hasLogo
    ? `<image x="9" y="7" width="14" height="14" href="${logoUri}"/>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="28" role="img" aria-label="${ariaLabel}"><title>${ariaLabel}</title><g shape-rendering="crispEdges"><rect width="${labelWidth}" height="28" fill="${labelColor}"/><rect x="${labelWidth}" width="${messageWidth}" height="28" fill="${color}"/></g><g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="100">${logoElement}<text transform="scale(.1)" x="${labelCenterX}" y="175" textLength="${labelTextLength}">${escapedLabel}</text><text transform="scale(.1)" x="${messageCenterX}" y="175" textLength="${messageTextLength}" font-weight="bold">${escapedMessage}</text></g></svg>`;
}

