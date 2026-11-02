// src/app/robots.ts
// Next.js App Router MetadataRoute for dynamic robots.txt generation.

import { MetadataRoute } from 'next';
import { generateRobotsConfig } from '@/lib/seo/structured-data';

export default function robots(): MetadataRoute.Robots {
  const config = generateRobotsConfig();
  return {
    rules: config.rules,
    sitemap: config.sitemap,
    host: config.host,
  };
}
