// src/components/JsonLd.tsx
// Server component rendering Schema.org JSON-LD structured data script for search crawlers.

import React from 'react';
import { generateRadioStationJsonLd, generateWebSiteJsonLd } from '@/lib/seo/structured-data';

export default function JsonLd() {
  const radioStationSchema = generateRadioStationJsonLd();
  const webSiteSchema = generateWebSiteJsonLd();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(radioStationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
      />
    </>
  );
}
