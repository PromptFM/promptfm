// src/app/manifest.ts
// Progressive Web App (PWA) Web App Manifest for PromptFM.

import { MetadataRoute } from 'next';
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from '@/lib/seo/structured-data';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — ${SITE_TAGLINE}`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#10b981',
    icons: [
      {
        src: '/icon.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/logo-mark.png',
        sizes: '1024x1024',
        type: 'image/png',
      },
    ],
  };
}
